import { validatePackage } from "./package-lib.mjs";
try {
  if (!process.argv[2] || process.argv.length !== 3) throw new Error("Usage: node tools/validate-package.mjs <package-folder>");
  const result = validatePackage(process.argv[2]);
  console.log(`Valid ${result.manifest.type} package: ${result.manifest.id} (${result.files.length} files, ${result.bytes} bytes)`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
