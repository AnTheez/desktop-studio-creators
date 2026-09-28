import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, normalize, relative, resolve } from "node:path";

const packageRoot = resolve(process.argv[2] ?? "");
const manifestPath = join(packageRoot, "manifest.json");
const errors = [];

if (!existsSync(manifestPath)) {
  errors.push("manifest.json is missing");
} else {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    errors.push(`manifest.json is invalid JSON: ${error.message}`);
  }

  if (manifest) {
    const required = ["formatVersion", "id", "type", "name", "version", "entryPoint", "defaultSize"];
    for (const key of required) {
      if (manifest[key] === undefined || manifest[key] === null || manifest[key] === "") {
        errors.push(`manifest.${key} is required`);
      }
    }

    if (manifest.formatVersion !== 1) errors.push("manifest.formatVersion must be 1");
    if (manifest.type !== "widget") errors.push('manifest.type must be "widget"');
    if (manifest.runtime !== undefined && manifest.runtime !== "dom") {
      errors.push('only the "dom" runtime is currently available');
    }
    if (!Number.isInteger(manifest.version) || manifest.version < 1) {
      errors.push("manifest.version must be a positive integer");
    }
    if (typeof manifest.id !== "string" || !/^[a-z0-9]+(?:[._-][a-z0-9]+)+$/.test(manifest.id)) {
      errors.push("manifest.id must be a stable lowercase namespaced identifier");
    }

    const checkRelativeFile = (value, label) => {
      if (value === undefined || value === null) return;
      if (typeof value !== "string" || value.length === 0 || isAbsolute(value)) {
        errors.push(`${label} must be a non-empty relative path`);
        return;
      }
      const target = resolve(packageRoot, normalize(value));
      const inside = relative(packageRoot, target);
      if (inside.startsWith("..") || isAbsolute(inside)) {
        errors.push(`${label} escapes the package root`);
      } else if (!existsSync(target) || !statSync(target).isFile()) {
        errors.push(`${label} does not reference a local file: ${value}`);
      }
    };

    checkRelativeFile(manifest.entryPoint, "manifest.entryPoint");
    checkRelativeFile(manifest.preview, "manifest.preview");
    checkRelativeFile(manifest.settings, "manifest.settings");

    const size = manifest.defaultSize;
    for (const axis of ["width", "height"]) {
      const value = Number(size?.[axis]);
      if (!Number.isFinite(value) || value <= 0 || value > 8192) {
        errors.push(`manifest.defaultSize.${axis} must be between 0 and 8192`);
      }
    }

    const permissions = manifest.permissions ?? [];
    const knownPermissions = new Set(["audio", "systemMetrics", "input", "network", "storage"]);
    if (!Array.isArray(permissions) || permissions.some((item) => !knownPermissions.has(item))) {
      errors.push("manifest.permissions contains an unknown value");
    }

    for (const [name, property] of Object.entries(manifest.properties ?? {})) {
      if (!name || name.length > 64) errors.push(`property name "${name}" is invalid`);
      const kinds = new Set(["slider", "color", "boolean", "number", "text", "select"]);
      if (!kinds.has(property?.type)) errors.push(`property "${name}" has an unknown type`);
      if (property?.type === "select" && (!Array.isArray(property.options) || property.options.length === 0)) {
        errors.push(`select property "${name}" requires options`);
      }
      if (property?.min !== undefined && property?.max !== undefined && property.min > property.max) {
        errors.push(`property "${name}" has min greater than max`);
      }
      if (property?.step !== undefined && (!Number.isFinite(property.step) || property.step <= 0)) {
        errors.push(`property "${name}" has an invalid step`);
      }
    }
  }
}

if (errors.length) {
  console.error(`Widget validation failed for ${packageRoot}:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Widget package is valid: ${packageRoot}`);
}

