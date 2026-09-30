import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { limits, packageFolder, portablePath, strictJson, validatePackage } from "../tools/package-lib.mjs";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const example = join(repository, "examples/hello-widget");
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "desktop-studio-creator-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const folder = join(root, "widget"); mkdirSync(folder);
  for (const file of readdirSync(example)) writeFileSync(join(folder, file), readFileSync(join(example, file)));
  return { root, folder, output: join(root, "widget.zip"), mutate: (change) => { const path = join(folder, "manifest.json"); const json = JSON.parse(readFileSync(path)); change(json); writeFileSync(path, JSON.stringify(json)); } };
}

// Read the written ZIP independently from its central directory and verify each deflated payload.
function zipEntries(path) {
  const bytes = readFileSync(path), end = bytes.length - 22;
  assert.equal(bytes.readUInt32LE(end), 0x06054b50);
  const count = bytes.readUInt16LE(end + 10); let cursor = bytes.readUInt32LE(end + 16); const entries = new Map();
  for (let index = 0; index < count; index++) {
    assert.equal(bytes.readUInt32LE(cursor), 0x02014b50);
    const nameLength = bytes.readUInt16LE(cursor + 28), extraLength = bytes.readUInt16LE(cursor + 30), commentLength = bytes.readUInt16LE(cursor + 32);
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    const local = bytes.readUInt32LE(cursor + 42), compressedLength = bytes.readUInt32LE(cursor + 20), size = bytes.readUInt32LE(cursor + 24);
    assert.equal(bytes.readUInt32LE(local), 0x04034b50); assert.equal(bytes.readUInt16LE(local + 8), 8);
    const payloadStart = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    const payload = inflateRawSync(bytes.subarray(payloadStart, payloadStart + compressedLength)); assert.equal(payload.length, size);
    let crc = 0xffffffff;
    for (const byte of payload) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1; }
    assert.equal((crc ^ 0xffffffff) >>> 0, bytes.readUInt32LE(cursor + 16));
    assert.equal(bytes.readUInt32LE(cursor + 38), 0); assert.equal(entries.has(name.toLowerCase()), false);
    entries.set(name.toLowerCase(), payload); cursor += 46 + nameLength + extraLength + commentLength;
  }
  assert.equal(cursor, end); return entries;
}

test("widget ZIP has root manifest, portable names, exact data and valid CRCs", (t) => {
  const f = fixture(t); const packaged = packageFolder(f.folder, f.output); const entries = zipEntries(f.output);
  assert.equal(packaged.manifest.id, "antheez.hello-widget"); assert.equal(entries.size, packaged.files.length);
  for (const file of packaged.files) assert.deepEqual(entries.get(file.archivePath.toLowerCase()), readFileSync(file.path));
  const second = join(f.root, "second.zip"); packageFolder(f.folder, second); assert.deepEqual(readFileSync(second), readFileSync(f.output));
});
test("CLI validates a widget and creates an independently readable ZIP", (t) => {
  const f = fixture(t);
  for (const [tool, args] of [["validate-widget.mjs", [f.folder]], ["validate-package.mjs", [f.folder]], ["package.mjs", [f.folder, f.output]]]) {
    const result = spawnSync(process.execPath, [join(repository, "tools", tool), ...args], { encoding: "utf8" }); assert.equal(result.status, 0, result.stderr);
  }
  assert.ok(zipEntries(f.output).has("manifest.json"));
});
test("output cannot overwrite a file or be placed inside its input folder", (t) => {
  const f = fixture(t); writeFileSync(f.output, "existing"); assert.throws(() => packageFolder(f.folder, f.output), /EEXIST/);
  assert.equal(readFileSync(f.output, "utf8"), "existing"); assert.throws(() => packageFolder(f.folder, join(f.folder, "self.zip")), /outside/);
});
test("invalid input creates no ZIP and does not modify source content", (t) => {
  const f = fixture(t); f.mutate((json) => json.permissions = ["nativeApi"]); const before = readFileSync(join(f.folder, "manifest.json"));
  assert.throws(() => packageFolder(f.folder, f.output)); assert.equal(existsSync(f.output), false); assert.deepEqual(readFileSync(join(f.folder, "manifest.json")), before);
});
test("portable paths normalize safe backslashes and reject Windows aliases and traversal", () => {
  assert.equal(portablePath("assets\\art.svg"), "assets/art.svg");
  for (const path of ["../file.txt", "x/../file.txt", "x/./file.txt", "/absolute.txt", "C:\\file.txt", "x//file.txt", "CON.txt", "x/NUL", "x/file. ", "x/file:stream.txt", "x/a\n.txt"]) assert.throws(() => portablePath(path), undefined, path);
});
test("duplicate JSON names are rejected recursively and case insensitively", () => {
  for (const text of ['{"id":1,"ID":2}', '{"nested":{"value":1,"value":2}}', '{"list":[{"name":1,"Name":2}]}', '{"i\\u0064":1,"id":2}']) assert.throws(() => strictJson(text), /duplicate/);
  assert.deepEqual(strictJson('{"message":"escaped \\\" braces {}","a":[1,true,null,{"b":2}]}'), { message: 'escaped " braces {}', a: [1, true, null, { b: 2 }] });
});
test("blocked extensions and renamed PE, ELF, Mach-O payloads are rejected", (t) => {
  const f = fixture(t); mkdirSync(join(f.folder, "assets"));
  for (const name of ["run.exe", "native.dll", "install.ps1", "run.bat"]) { const path = join(f.folder, "assets", name); writeFileSync(path, "blocked"); assert.throws(() => validatePackage(f.folder), /extension/); rmSync(path); }
  const pe = Buffer.alloc(132); pe.write("MZ"); pe.writeUInt32LE(128, 0x3c); pe.writeUInt32LE(0x4550, 128);
  for (const data of [pe, Buffer.from([0x7f,0x45,0x4c,0x46]), Buffer.from([0xcf,0xfa,0xed,0xfe])]) { const path = join(f.folder, "assets/model.bin"); writeFileSync(path, data); assert.throws(() => validatePackage(f.folder), /native executable/); rmSync(path); }
});
test("directory links cannot import files outside the package", (t) => {
  const f = fixture(t); const outside = join(f.root, "outside"); mkdirSync(outside); writeFileSync(join(outside, "secret.txt"), "must stay outside");
  symlinkSync(outside, join(f.folder, "linked"), process.platform === "win32" ? "junction" : "dir");
  assert.throws(() => packageFolder(f.folder, f.output), /link/); assert.equal(existsSync(f.output), false); assert.equal(readFileSync(join(outside, "secret.txt"), "utf8"), "must stay outside");
});
test("permissions, metadata, paths, widget properties and file references are bounded", (t) => {
  const f = fixture(t); const original = readFileSync(join(f.folder, "manifest.json"));
  for (const change of [j=>j.permissions=["input","input"], j=>j.permissions=[999], j=>j.runtime="native", j=>j.version=0, j=>j.id="single", j=>j.author="a".repeat(129), j=>j.description="a".repeat(2001), j=>j.tags=["bad\nlabel"], j=>j.entryPoint="missing.html", j=>j.preview="missing.png", j=>j.defaultSize.width=31, j=>j.properties.value={type:"select",options:[]}, j=>j.properties.value={type:"number",min:2,max:1}]) {
    writeFileSync(join(f.folder, "manifest.json"), original); f.mutate(change); assert.throws(() => validatePackage(f.folder));
  }
  writeFileSync(join(f.folder, "manifest.json"), original); f.mutate(j=>{j.author="Original creator";j.license="MIT";j.description="Safe\nmultiline description";j.extensionHint={future:true};j.id="Creator.clock";}); assert.equal(validatePackage(f.folder).manifest.id,"Creator.clock");
});
test("JSON metadata limit is checked before parsing", (t) => {
  const f = fixture(t); writeFileSync(join(f.folder, "settings.json"), '"' + "x".repeat(limits.metadata) + '"'); assert.throws(() => validatePackage(f.folder), /2 MB/);
});
test("every component type validates known, unique string permissions", (t) => {
  const f = fixture(t);
  const common = { formatVersion: 1, id: "creator.permission-review", name: "Permission review", version: 1 };
  writeFileSync(join(f.folder, "art.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
  writeFileSync(join(f.folder, "sprite.png"), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  writeFileSync(join(f.folder, "effect.dseffect"), JSON.stringify({ formatVersion: 1, properties: { generator: "rain" } }));
  writeFileSync(join(f.folder, "scene.gltf"), JSON.stringify({ asset: { version: "2.0" }, scene: 0, scenes: [{}] }));
  writeFileSync(join(f.folder, "avatar.vrm"), Buffer.from("local-model-fixture"));
  const manifests = [
    { type: "widget", runtime: "dom", entryPoint: "index.html", defaultSize: { width: 100, height: 100 } },
    { type: "sticker", entryPoint: "art.svg" },
    { type: "wallpaper", entryPoint: "art.svg" },
    { type: "effect", entryPoint: "effect.dseffect" },
    { type: "companion", runtime: "sprite", model: { type: "image", asset: "sprite.png" }, defaultSize: { width: 100, height: 100 }, animations: { idle: { id: "idle", name: "Idle", duration: 1, loop: true, tracks: [] } } },
    ...["3d", "threeD", "threejs"].map((type) => ({ type, runtime: "threejs", model: { type: "gltf", asset: "scene.gltf" }, defaultSize: { width: 100, height: 100 } })),
    { type: "vrm", runtime: "vrm", model: { type: "vrm", asset: "avatar.vrm" }, defaultSize: { width: 100, height: 100 } }
  ];
  const invalid = [["nativeApi"], [1], [null], [true], [{ name: "audio" }], ["input", "input"], "audio", 1, Array(17).fill("audio")];
  for (const manifest of manifests) {
    for (const permissions of invalid) {
      writeFileSync(join(f.folder, "manifest.json"), JSON.stringify({ ...common, ...manifest, permissions }));
      assert.throws(() => validatePackage(f.folder), undefined, `${manifest.type}: ${JSON.stringify(permissions)}`);
    }
    for (const permissions of [[], ["audio", "systemMetrics", "input", "network", "storage"]]) {
      writeFileSync(join(f.folder, "manifest.json"), JSON.stringify({ ...common, ...manifest, permissions }));
      assert.deepEqual(validatePackage(f.folder).manifest.permissions, permissions, manifest.type);
    }
    for (const name of ["Permissions", "PERMISSIONS"]) {
      writeFileSync(join(f.folder, "manifest.json"), JSON.stringify({ ...common, ...manifest, [name]: ["audio"] }));
      assert.throws(() => validatePackage(f.folder), /canonical property name permissions/, manifest.type);
    }
  }
});
test("known manifest fields use canonical casing at root and nested schema levels", (t) => {
  const f = fixture(t); const widget = JSON.parse(readFileSync(join(f.folder, "manifest.json")));
  const renamed = (value, original, wrongCase) => { const copy = structuredClone(value); copy[wrongCase] = copy[original]; delete copy[original]; return copy; };
  const widgets = [
    renamed(widget, "runtime", "Runtime"),
    renamed(widget, "entryPoint", "entrypoint"),
    { ...widget, Author: "Creator" },
    { ...widget, defaultSize: renamed(widget.defaultSize, "width", "Width") },
    { ...widget, properties: { title: renamed(widget.properties.title, "type", "Type") } },
    { ...widget, properties: { title: renamed(widget.properties.title, "default", "Default") } }
  ];
  for (const manifest of widgets) {
    writeFileSync(join(f.folder, "manifest.json"), JSON.stringify(manifest));
    assert.throws(() => validatePackage(f.folder));
  }
  writeFileSync(join(f.folder, "scene.gltf"), JSON.stringify({ asset: { version: "2.0" } }));
  const model = { ...widget, type: "3d", runtime: "threejs", model: { type: "gltf", asset: "scene.gltf" }, defaults: { camera: { fov: 45 } } };
  for (const manifest of [
    renamed(model, "model", "Model"),
    { ...model, model: renamed(model.model, "type", "Type") },
    { ...model, model: renamed(model.model, "asset", "Asset") },
    { ...model, defaults: { Camera: { fov: 45 } } },
    { ...model, defaults: { camera: { Fov: 45 } } }
  ]) {
    writeFileSync(join(f.folder, "manifest.json"), JSON.stringify(manifest));
    assert.throws(() => validatePackage(f.folder));
  }
  // Unknown extension metadata remains available; prototype property names cannot bypass a closed object.
  writeFileSync(join(f.folder, "manifest.json"), JSON.stringify({ ...widget, futureMetadata: { Enabled: true } }));
  assert.equal(validatePackage(f.folder).manifest.futureMetadata.Enabled, true);
  writeFileSync(join(f.folder, "manifest.json"), JSON.stringify({ ...widget, type: "effect", entryPoint: "effect.dseffect" }));
  writeFileSync(join(f.folder, "effect.dseffect"), '{"formatVersion":1,"properties":{"constructor":true}}');
  assert.throws(() => validatePackage(f.folder));
});
test("nested GLTF resources stay local to the model directory or use embedded data", (t) => {
  const f = fixture(t); mkdirSync(join(f.folder, "models", "textures"), { recursive: true });
  writeFileSync(join(f.folder, "models", "buffer.bin"), Buffer.from([0, 0, 0, 0]));
  writeFileSync(join(f.folder, "models", "textures", "pixel.png"), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  writeFileSync(join(f.folder, "manifest.json"), JSON.stringify({ formatVersion: 1, id: "creator.local-model", name: "Local model", version: 1, type: "3d", runtime: "threejs", model: { type: "gltf", asset: "models/scene.gltf" }, defaultSize: { width: 100, height: 100 } }));
  const source = join(f.folder, "models", "scene.gltf");
  const scene = { asset: { version: "2.0" }, buffers: [{ uri: "buffer.bin", byteLength: 4 }], images: [{ uri: "textures/pixel.png" }] };
  writeFileSync(source, JSON.stringify(scene)); assert.equal(validatePackage(f.folder).manifest.type, "3d");
  for (const group of ["buffers", "images"]) {
    for (const uri of ["https://example.test/asset.bin", "//example.test/asset.bin", "file:///asset.bin", "/asset.bin", "C:\\asset.bin", "../index.html", "textures/../buffer.bin", "missing.bin", "", 1, null]) {
      const invalid = structuredClone(scene); invalid[group][0].uri = uri; writeFileSync(source, JSON.stringify(invalid));
      assert.throws(() => validatePackage(f.folder), undefined, `${group}: ${JSON.stringify(uri)}`);
    }
  }
  for (const uri of ["data:application/octet-stream;base64,AAAAAA==", "DATA:image/png;base64,iVBORw0KGgo="]) {
    writeFileSync(source, JSON.stringify({ asset: { version: "2.0" }, buffers: [{ uri }], images: [{ uri }] }));
    assert.equal(validatePackage(f.folder).manifest.type, "3d");
  }
  writeFileSync(source, JSON.stringify({ asset: { version: "2.0" }, images: [{ bufferView: 0, mimeType: "image/png" }] }));
  assert.equal(validatePackage(f.folder).manifest.type, "3d");
  for (const definition of [[], { buffers: {} }, { images: [null] }, { Buffers: [{ uri: "https://example.test/asset.bin" }] }, { images: [{ URI: "https://example.test/asset.png" }] }]) {
    writeFileSync(source, JSON.stringify(definition)); assert.throws(() => validatePackage(f.folder));
  }
});
test("sticker, wallpaper, effect, companion and 3D schemas accept usable creator fixtures", (t) => {
  const f = fixture(t); const common = {formatVersion:1,id:"creator.test.art",name:"Creator art",version:1,author:"Creator",license:"MIT"};
  writeFileSync(join(f.folder,"art.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
  for(const type of ["sticker","wallpaper"]) { writeFileSync(join(f.folder,"manifest.json"),JSON.stringify({...common,type,entryPoint:"art.svg"})); assert.equal(validatePackage(f.folder).manifest.type,type); }
  writeFileSync(join(f.folder,"effect.dseffect"),JSON.stringify({formatVersion:1,properties:{generator:"rain",density:.55,color:"#9caec7"}}));
  writeFileSync(join(f.folder,"manifest.json"),JSON.stringify({...common,type:"effect",entryPoint:"effect.dseffect"})); assert.equal(validatePackage(f.folder).manifest.type,"effect");
  writeFileSync(join(f.folder,"effect.dseffect"),JSON.stringify({formatVersion:1,properties:{density:99}})); assert.throws(()=>validatePackage(f.folder)); rmSync(join(f.folder,"effect.dseffect"));
  writeFileSync(join(f.folder,"sprite.png"),Buffer.from([137,80,78,71,13,10,26,10]));
  writeFileSync(join(f.folder,"manifest.json"),JSON.stringify({...common,type:"companion",runtime:"sprite",model:{type:"image",asset:"sprite.png"},defaultSize:{width:100,height:100},animations:{idle:{id:"idle",name:"Idle",duration:1,loop:true,tracks:[]}}})); assert.equal(validatePackage(f.folder).manifest.type,"companion");
  writeFileSync(join(f.folder,"scene.gltf"),JSON.stringify({asset:{version:"2.0"},scene:0,scenes:[{}]}));
  writeFileSync(join(f.folder,"manifest.json"),JSON.stringify({...common,type:"3d",runtime:"threejs",model:{type:"gltf",asset:"scene.gltf"},defaultSize:{width:320,height:420}})); assert.equal(validatePackage(f.folder).manifest.type,"3d");
  f.mutate(j=>j.runtime="vrm"); assert.throws(()=>validatePackage(f.folder));
});
