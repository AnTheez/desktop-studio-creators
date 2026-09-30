import { validatePackage } from "./package-lib.mjs";
try {
  if (!process.argv[2] || process.argv.length !== 3) throw new Error("Usage: node tools/validate-widget.mjs <widget-folder>");
  const result = validatePackage(process.argv[2]);
  if (result.manifest.type !== "widget") throw new Error("Expected a widget package");
  console.log(`Widget package is valid: ${result.root}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
