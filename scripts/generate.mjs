// Generates src/generated/openapi.ts from spec/openapi.json.
//   node scripts/generate.mjs           write the file
//   node scripts/generate.mjs --check   fail if the committed file is stale (CI)
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import openapiTS, { astToString } from "openapi-typescript";
import * as prettier from "prettier";

const root = new URL("..", import.meta.url);
const specPath = new URL("spec/openapi.json", root);
const outPath = new URL("src/generated/openapi.ts", root);

const spec = JSON.parse(await readFile(specPath, "utf8"));
const ast = await openapiTS(spec, { exportType: true, alphabetize: true });
const header =
  "// GENERATED from spec/openapi.json by scripts/generate.mjs. Do not edit by hand.\n" +
  `// OpenAPI document version: ${spec.info.version}\n\n` +
  `export const OPENAPI_VERSION = ${JSON.stringify(spec.info.version)};\n\n`;
const source = await prettier.format(header + astToString(ast), {
  parser: "typescript",
  printWidth: 100,
});

if (process.argv.includes("--check")) {
  const current = await readFile(outPath, "utf8").catch(() => "");
  if (current !== source) {
    console.error(
      "src/generated/openapi.ts is out of date with spec/openapi.json. Run `npm run generate`.",
    );
    process.exit(1);
  }
  console.log("Generated types are up to date (OpenAPI " + spec.info.version + ").");
} else {
  await writeFile(outPath, source);
  console.log("Wrote " + fileURLToPath(outPath) + " (OpenAPI " + spec.info.version + ").");
}
