// Downloads the published OpenAPI document into spec/openapi.json.
// Source: https://github.com/edgaze-ai/edgaze-openapi (published from the Edgaze API on every release).
import { readFile, writeFile } from "node:fs/promises";

const SPEC_URL =
  process.env.EDGAZE_OPENAPI_URL ??
  "https://raw.githubusercontent.com/edgaze-ai/edgaze-openapi/main/openapi.json";
const outPath = new URL("../spec/openapi.json", import.meta.url);

const res = await fetch(SPEC_URL);
if (!res.ok) {
  console.error(`Could not download ${SPEC_URL}: HTTP ${res.status}`);
  process.exit(1);
}
const spec = await res.json();
if (typeof spec?.openapi !== "string" || typeof spec?.info?.version !== "string") {
  console.error("The downloaded file is not an OpenAPI document.");
  process.exit(1);
}
const next = JSON.stringify(spec, null, 2) + "\n";
const current = await readFile(outPath, "utf8").catch(() => "");
if (current === next) {
  console.log(`spec/openapi.json is already current (OpenAPI ${spec.info.version}).`);
} else {
  await writeFile(outPath, next);
  console.log(`Updated spec/openapi.json to OpenAPI ${spec.info.version}.`);
}
