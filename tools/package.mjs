import { packageFolder } from "./package-lib.mjs";
try {
  if (!process.argv[2] || !process.argv[3] || process.argv.length !== 4) throw new Error("Usage: node tools/package.mjs <package-folder> <output.zip>");
  const result = packageFolder(process.argv[2], process.argv[3]);
  console.log(`Created ${result.output}: ${result.manifest.id} (${result.files.length} files)`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
