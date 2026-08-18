import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(repositoryRoot, "src");
const sourceExtensions = new Set([".ts", ".tsx"]);
const violations = [];

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectSourceFiles(absolutePath);
      return sourceExtensions.has(path.extname(entry.name)) ? [absolutePath] : [];
    }),
  );
  return nested.flat();
}

function report(file, line, message) {
  violations.push(`${path.relative(repositoryRoot, file)}:${line}: ${message}`);
}

function validateImport(file, line, specifier) {
  const relativeFile = path.relative(sourceRoot, file).split(path.sep).join("/");

  if (relativeFile.startsWith("base/") && /^@\/(platform|workbench)\//.test(specifier)) {
    report(file, line, `base must not depend on higher layer '${specifier}'`);
  }

  if (relativeFile.startsWith("platform/") && specifier.startsWith("@/workbench/")) {
    report(file, line, `platform must not depend on workbench '${specifier}'`);
  }

  const importsEnvironmentImplementation =
    specifier.includes("/tauri/") || (specifier.includes("/browser/") && !specifier.includes("/common/"));
  if (relativeFile.includes("/common/") && importsEnvironmentImplementation) {
    report(file, line, `common code must not depend on environment-specific module '${specifier}'`);
  }
}

for (const file of await collectSourceFiles(sourceRoot)) {
  const source = await readFile(file, "utf8");
  const importPattern = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;
  for (const match of source.matchAll(importPattern)) {
    const line = source.slice(0, match.index).split("\n").length;
    validateImport(file, line, match[1]);
  }
}

if (violations.length > 0) {
  process.stderr.write("Architecture dependency violations:\n\n");
  for (const violation of violations) process.stderr.write(`- ${violation}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Architecture dependency check passed.\n");
}
