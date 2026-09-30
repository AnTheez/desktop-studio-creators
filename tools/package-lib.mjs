import { closeSync, existsSync, lstatSync, openSync, readFileSync, readdirSync, realpathSync, unlinkSync, writeSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

export const limits = Object.freeze({ entries: 5000, bytes: 2 * 1024 ** 3, metadata: 2 * 1024 ** 2, preview: 10 * 1024 ** 2 });
const schemaRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../schemas");
const extensions = new Set(".json .dseffect .png .jpg .jpeg .webp .bmp .svg .gif .mp4 .webm .m4v .html .htm .css .js .mjs .woff .woff2 .ttf .otf .txt .glb .gltf .vrm .bin".split(" "));
const images = new Set(".png .jpg .jpeg .webp .bmp .svg .gif".split(" "));
const canonicalType = (type) => ["threeD", "threejs", "vrm"].includes(type) ? "3d" : type;
const fail = (message) => { throw new Error(message); };

export function portablePath(value, label = "path") {
  if (typeof value !== "string" || !value || value.length > 260 || isAbsolute(value) || /^[\\/]|:/.test(value)) fail(`${label} must be a portable relative path`);
  const normalized = value.replaceAll("\\", "/");
  for (const segment of normalized.split("/")) if (!segment || segment === "." || segment === ".." || /[<>"|?*\x00-\x1f\x7f]/.test(segment) || /[. ]$/.test(segment) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment)) fail(`${label} contains an unsafe path segment`);
  return normalized;
}

// JSON.parse accepts duplicate keys; scan every object before returning the parsed document.
export function strictJson(text, label = "JSON") {
  const parsed = JSON.parse(text); let cursor = 0;
  const space = () => { while (cursor < text.length && /\s/.test(text[cursor])) cursor++; };
  const string = () => {
    const start = cursor++;
    while (cursor < text.length) { if (text[cursor] === "\\") { cursor += 2; continue; } if (text[cursor++] === '"') return JSON.parse(text.slice(start, cursor)); }
  };
  const value = () => {
    space();
    if (text[cursor] === "{") {
      cursor++; space(); const keys = new Set();
      while (text[cursor] !== "}") { const key = string().toLowerCase(); if (keys.has(key)) fail(`${label} contains duplicate property ${key}`); keys.add(key); space(); cursor++; value(); space(); if (text[cursor] === ",") { cursor++; space(); } else break; }
      cursor++;
    } else if (text[cursor] === "[") {
      cursor++; space(); while (text[cursor] !== "]") { value(); space(); if (text[cursor] === ",") cursor++; else break; } cursor++;
    } else if (text[cursor] === '"') string();
    else while (cursor < text.length && !/[\s,}\]]/.test(text[cursor])) cursor++;
  };
  value(); return parsed;
}

function schemaReference(reference, file) {
  const [refFile, fragment = ""] = reference.split("#");
  const targetFile = refFile ? resolve(dirname(file), refFile) : file;
  let target = JSON.parse(readFileSync(targetFile, "utf8"));
  for (const part of fragment.split("/").filter(Boolean)) target = target[part.replaceAll("~1", "/").replaceAll("~0", "~")];
  return { schema: target, file: targetFile };
}

function schemaPropertyNames(schema, file, names = new Set()) {
  if (!schema || typeof schema !== "object") return names;
  if (schema.$ref) { const target = schemaReference(schema.$ref, file); schemaPropertyNames(target.schema, target.file, names); }
  for (const key of Object.keys(schema.properties ?? {})) names.add(key);
  for (const keyword of ["allOf", "anyOf", "oneOf"]) for (const branch of schema[keyword] ?? []) schemaPropertyNames(branch, file, names);
  for (const keyword of ["if", "then", "else"]) if (schema[keyword]) schemaPropertyNames(schema[keyword], file, names);
  return names;
}

function canonicalFields(value, names, label) {
  const canonicalNames = new Map([...names].map((key) => [key.toLowerCase(), key]));
  for (const key of Object.keys(value)) {
    const canonical = canonicalNames.get(key.toLowerCase());
    if (canonical !== undefined && canonical !== key) fail(`${label}.${key} must use the canonical property name ${canonical}`);
  }
}

function validateSchema(value, schema, label, file) {
  if (schema === true) return;
  if (schema === false) fail(`${label} is not supported`);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    canonicalFields(value, schemaPropertyNames(schema, file), label);
  }
  if (schema.$ref) {
    const target = schemaReference(schema.$ref, file); validateSchema(value, target.schema, label, target.file);
  }
  const accepts = (branch) => { try { validateSchema(value, branch, label, file); return true; } catch { return false; } };
  if (schema.allOf) for (const branch of schema.allOf) validateSchema(value, branch, label, file);
  if (schema.anyOf && !schema.anyOf.some(accepts)) fail(`${label} does not match any supported form`);
  if (schema.oneOf && schema.oneOf.filter(accepts).length !== 1) fail(`${label} does not match exactly one supported form`);
  if (schema.if) { if (accepts(schema.if) && schema.then) validateSchema(value, schema.then, label, file); else if (!accepts(schema.if) && schema.else) validateSchema(value, schema.else, label, file); }
  if (schema.not && accepts(schema.not)) fail(`${label} contains an unsupported value`);
  if ("const" in schema && JSON.stringify(value) !== JSON.stringify(schema.const)) fail(`${label} must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((item) => JSON.stringify(item) === JSON.stringify(value))) fail(`${label} has an unsupported value`);
  if (schema.type) { const type = Array.isArray(value) ? "array" : value === null ? "null" : typeof value; const allowed = Array.isArray(schema.type) ? schema.type : [schema.type]; if (!allowed.includes(type) && !(allowed.includes("integer") && Number.isInteger(value))) fail(`${label} must be ${allowed.join(" or ")}`); }
  if (typeof value === "string") { if (value.length < (schema.minLength ?? 0) || value.length > (schema.maxLength ?? Infinity)) fail(`${label} has an invalid length`); if (schema.pattern && !new RegExp(schema.pattern).test(value)) fail(`${label} has an invalid format`); if (schema.format === "portable-path") portablePath(value, label); }
  if (typeof value === "number" && (!Number.isFinite(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity) || value <= (schema.exclusiveMinimum ?? -Infinity))) fail(`${label} is outside the supported range`);
  if (Array.isArray(value)) {
    if (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity)) fail(`${label} has an invalid item count`);
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) fail(`${label} must contain unique items`);
    if (schema.items) value.forEach((item, index) => validateSchema(item, schema.items, `${label}[${index}]`, file));
  } else if (value && typeof value === "object") {
    if (Object.keys(value).length < (schema.minProperties ?? 0) || Object.keys(value).length > (schema.maxProperties ?? Infinity)) fail(`${label} has an invalid property count`);
    for (const required of schema.required ?? []) if (!Object.hasOwn(value, required)) fail(`${label}.${required} is required`);
    for (const [key, item] of Object.entries(value)) { if (schema.propertyNames) validateSchema(key, schema.propertyNames, `${label} key`, file); if (Object.hasOwn(schema.properties ?? {}, key)) validateSchema(item, schema.properties[key], `${label}.${key}`, file); else if (schema.additionalProperties === false) fail(`${label}.${key} is not supported`); else if (typeof schema.additionalProperties === "object") validateSchema(item, schema.additionalProperties, `${label}.${key}`, file); }
  }
}

function nativeSignature(bytes) {
  if (bytes.length < 4) return false;
  if ([0x7f454c46, 0xfeedface, 0xcefaedfe, 0xfeedfacf, 0xcffaedfe, 0xcafebabe, 0xbebafeca, 0xcafebabf, 0xbfbafeca].includes(bytes.readUInt32BE(0))) return true;
  if (bytes[0] === 0x4d && bytes[1] === 0x5a) return true;
  return false;
}

export function validatePackage(folder) {
  const root = resolve(folder);
  if (!existsSync(root) || !lstatSync(root).isDirectory() || lstatSync(root).isSymbolicLink()) fail("Package root must be a real local directory");
  const realRoot = realpathSync(root); const files = []; const seen = new Set(); let bytes = 0;
  function walk(directory, prefix = "") {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name); const info = lstatSync(path); const archivePath = portablePath(prefix + name);
      if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory())) fail(`${archivePath} is a link or unsupported filesystem object`);
      const outside = relative(realRoot, realpathSync(path)); if (outside.startsWith("..") || isAbsolute(outside)) fail(`${archivePath} escapes the package root`);
      const key = archivePath.toLowerCase(); if (seen.has(key)) fail(`${archivePath} duplicates another package path`); seen.add(key);
      if (info.isDirectory()) { walk(path, archivePath + "/"); continue; }
      if (!extensions.has(extname(name).toLowerCase())) fail(`${archivePath} uses a blocked file extension`);
      if (files.length >= limits.entries || (bytes += info.size) > limits.bytes) fail("Package exceeds the file count or 2 GB size limit");
      if ([".json", ".gltf", ".dseffect"].includes(extname(name).toLowerCase()) && info.size > limits.metadata) fail(`${archivePath} exceeds the 2 MB metadata limit`);
      const data = readFileSync(path); if (data.length !== info.size) fail(`${archivePath} changed during validation`);
      if (nativeSignature(data)) fail(`${archivePath} contains a native executable signature`);
      if ([".json", ".gltf", ".dseffect"].includes(extname(name).toLowerCase())) strictJson(data.toString("utf8"), archivePath);
      files.push({ path, archivePath, size: info.size });
    }
  }
  walk(root);
  const manifestPath = join(root, "manifest.json"); if (!existsSync(manifestPath)) fail("manifest.json is missing at the package root");
  const manifest = strictJson(readFileSync(manifestPath, "utf8"), "manifest.json");
  validateSchema(manifest, JSON.parse(readFileSync(join(schemaRoot, "creator-manifest.schema.json"), "utf8")), "manifest", join(schemaRoot, "creator-manifest.schema.json"));
  const type = canonicalType(manifest.type);
  function local(value, label) { const normalized = portablePath(value, label); const file = files.find((item) => item.archivePath.toLowerCase() === normalized.toLowerCase()); if (!file) fail(`${label} does not reference a local file: ${value}`); return file; }
  for (const file of files.filter((item) => extname(item.archivePath).toLowerCase() === ".gltf")) {
    const definition = strictJson(readFileSync(file.path, "utf8"), file.archivePath);
    if (!definition || typeof definition !== "object" || Array.isArray(definition)) fail(`${file.archivePath} must contain a GLTF JSON object`);
    canonicalFields(definition, ["buffers", "images"], file.archivePath);
    for (const group of ["buffers", "images"]) {
      if (definition[group] === undefined) continue;
      if (!Array.isArray(definition[group])) fail(`${file.archivePath}.${group} must be an array`);
      for (const [index, resource] of definition[group].entries()) {
        const label = `${file.archivePath}.${group}[${index}].uri`;
        if (!resource || typeof resource !== "object" || Array.isArray(resource)) fail(`${file.archivePath}.${group}[${index}] must be an object`);
        canonicalFields(resource, ["uri"], `${file.archivePath}.${group}[${index}]`);
        if (!Object.hasOwn(resource, "uri")) continue;
        if (typeof resource.uri !== "string") fail(`${label} must be a string`);
        if (/^data:/i.test(resource.uri)) continue;
        const path = portablePath(resource.uri, label);
        local(portablePath(join(dirname(file.archivePath), path), label), label);
      }
    }
  }
  if (manifest.preview !== undefined) { const preview = local(manifest.preview, "manifest.preview"); if (!images.has(extname(preview.archivePath).toLowerCase()) || preview.size > limits.preview) fail("Preview must be an image of at most 10 MB"); }
  if (type === "widget") {
    const entry = local(manifest.entryPoint, "manifest.entryPoint"); if (![".html", ".htm"].includes(extname(entry.archivePath).toLowerCase())) fail("Widget entryPoint must be local HTML");
    if (manifest.settings !== undefined) local(manifest.settings, "manifest.settings");
    for (const [name, property] of Object.entries(manifest.properties ?? {})) if (property.min !== undefined && property.max !== undefined && property.min > property.max) fail(`Property ${name} has min greater than max`);
    for (const key of ["animations", "behavior", "stateMachine"]) if (manifest[key] !== undefined && JSON.stringify(manifest[key]).length > 64 * 1024) fail(`${key} exceeds 64 KB`);
  } else if (["sticker", "wallpaper", "effect"].includes(type)) {
    if (manifest.entryPoint && manifest.source && manifest.entryPoint !== manifest.source) fail("entryPoint and source must agree");
    const entry = local(manifest.entryPoint ?? manifest.source, "manifest.entryPoint"); const extension = extname(entry.archivePath).toLowerCase();
    if (!(type === "effect" ? extension === ".dseffect" : images.has(extension) || type === "wallpaper" && [".mp4", ".webm", ".m4v"].includes(extension))) fail(`Unsupported ${type} source extension`);
    if (type === "effect") { if (entry.size > 64 * 1024) fail("Effect definition exceeds 64 KB"); const schema = join(schemaRoot, "effect-definition.schema.json"); validateSchema(strictJson(readFileSync(entry.path, "utf8")), JSON.parse(readFileSync(schema, "utf8")), "effect", schema); }
  } else {
    const model = local(manifest.model.asset, "manifest.model.asset"); const extension = extname(model.archivePath).toLowerCase();
    const allowed = { image: [".png", ".jpg", ".jpeg", ".webp"], gif: [".gif"], spriteSheet: [".png", ".webp"], glb: [".glb"], gltf: [".gltf"], vrm: [".vrm"] }[manifest.model.type];
    if (!allowed?.includes(extension)) fail("Model extension does not match its declared type");
    if (type === "companion") for (const [key, clip] of Object.entries(manifest.animations)) if (clip.asset) { const asset = local(clip.asset, `Animation ${key} asset`); if (![".png", ".webp", ".gif", ".jpg", ".jpeg"].includes(extname(asset.archivePath).toLowerCase())) fail(`Animation ${key} uses an unsupported sprite asset`); }
  }
  return { root, manifest, files, bytes };
}

const crcTable = Array.from({ length: 256 }, (_, index) => { let value = index; for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1; return value >>> 0; });
function crc32(data) { let crc = 0xffffffff; for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }

export function packageFolder(folder, destination) {
  const validated = validatePackage(folder); const output = resolve(destination); const inside = relative(validated.root, output);
  if (!inside.startsWith("..") && !isAbsolute(inside)) fail("ZIP destination must be outside the package folder");
  if (extname(output).toLowerCase() !== ".zip") fail("Package destination must have a .zip extension");
  const descriptor = openSync(output, "wx"); let successful = false;
  try {
    let offset = 0; const directory = [];
    const write = (data) => { let written = 0; while (written < data.length) written += writeSync(descriptor, data, written); offset += data.length; };
    for (const file of validated.files) {
      const data = readFileSync(file.path); if (data.length !== file.size || nativeSignature(data)) fail(`${file.archivePath} changed during packaging`);
      const compressed = deflateRawSync(data); const name = Buffer.from(file.archivePath); const crc = crc32(data); const entryOffset = offset;
      const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6); header.writeUInt16LE(8, 8); header.writeUInt16LE(0x21, 12); header.writeUInt32LE(crc, 14); header.writeUInt32LE(compressed.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(name.length, 26);
      write(header); write(name); write(compressed);
      const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8); central.writeUInt16LE(8, 10); central.writeUInt16LE(0x21, 14); central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(entryOffset, 42); directory.push(central, name);
    }
    const centralOffset = offset; for (const data of directory) write(data);
    const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(validated.files.length, 8); end.writeUInt16LE(validated.files.length, 10); end.writeUInt32LE(offset - centralOffset, 12); end.writeUInt32LE(centralOffset, 16); write(end); successful = true;
  } finally { closeSync(descriptor); if (!successful) unlinkSync(output); }
  return { ...validated, output };
}
