// Installs the packed tarball into a fresh project and uses it the way a customer would:
// ESM import, CommonJS require, and TypeScript under both `node16` and `bundler` resolution.
// Run after `npm run build`. Exits non-zero on any failure.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const dir = mkdtempSync(join(tmpdir(), "edgaze-smoke-"));
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: dir, stdio: "inherit", ...opts });

try {
  execFileSync("npm", ["pack", "--pack-destination", dir], { cwd: root, stdio: "ignore" });
  const tarball = readdirSync(dir).find((f) => f.endsWith(".tgz"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "smoke", private: true }));
  run("npm", [
    "install",
    "--no-audit",
    "--no-fund",
    "--silent",
    `./${tarball}`,
    "typescript@5",
    "@types/node@22",
  ]);

  // A fake fetch so the smoke test needs no network; it checks the request the SDK builds.
  const fakeFetch = `async (url, init) => {
    const h = new Headers(init.headers);
    if (h.get("authorization") !== "Bearer sk_smoke") throw new Error("auth header missing");
    if (!String(url).endsWith("/v1/runs/r1")) throw new Error("bad url " + url);
    return new Response(JSON.stringify({ id: "r1", status: "completed", outputs: [] }), {
      status: 200, headers: { "content-type": "application/json" } });
  }`;

  writeFileSync(
    join(dir, "esm.mjs"),
    `import Edgaze, { Edgaze as Named, APIError, unwrapWebhook, VERSION } from "edgaze";
     if (Edgaze !== Named) throw new Error("default export mismatch");
     if (typeof unwrapWebhook !== "function" || typeof APIError !== "function") throw new Error("exports");
     const client = new Edgaze({ apiKey: "sk_smoke", baseURL: "https://x.test/v1", fetch: ${fakeFetch} });
     const run = await client.runs.retrieve("r1");
     if (run.status !== "completed") throw new Error("bad run");
     console.log("ESM ok", VERSION);`,
  );
  writeFileSync(
    join(dir, "cjs.cjs"),
    `const { Edgaze, NotFoundError, VERSION } = require("edgaze");
     const Default = require("edgaze").default;
     if (Default !== Edgaze || typeof NotFoundError !== "function") throw new Error("exports");
     const client = new Edgaze({ apiKey: "sk_smoke", baseURL: "https://x.test/v1", fetch: ${fakeFetch} });
     client.runs.retrieve("r1").then((run) => {
       if (run.status !== "completed") throw new Error("bad run");
       console.log("CJS ok", VERSION);
     }).catch((e) => { console.error(e); process.exit(1); });`,
  );
  const ts = `import Edgaze, { type Run, type RunStreamMessage, APIError } from "edgaze";
    const client = new Edgaze({ apiKey: "sk" });
    async function main(): Promise<Run> {
      const { run } = await client.runs.create({ workflow: "w", inputs: { a: 1 } });
      for await (const m of client.runs.stream(run.id)) {
        const msg: RunStreamMessage = m;
        if (msg.kind === "event" && msg.event.type === "node.output.delta") {
          const text: string | undefined = msg.event.data?.text;
          void text;
        }
      }
      for await (const r of client.runs.list({ status: "failed" })) void r.id;
      try {
        return await client.runs.wait(run.id);
      } catch (err) {
        if (err instanceof APIError) console.log(err.code, err.requestId);
        throw err;
      }
    }
    void main;
  `;
  writeFileSync(join(dir, "consumer.ts"), ts);
  for (const [module, moduleResolution] of [
    ["node16", "node16"],
    ["esnext", "bundler"],
  ]) {
    writeFileSync(
      join(dir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          module,
          moduleResolution,
          target: "es2022",
          lib: ["es2022", "dom"],
          types: ["node"],
          exactOptionalPropertyTypes: true,
        },
        files: ["consumer.ts"],
      }),
    );
    run("npx", ["tsc", "-p", "."]);
    console.log(`TypeScript ok (${moduleResolution})`);
  }

  run("node", ["esm.mjs"]);
  run("node", ["cjs.cjs"]);
  console.log("Package smoke test passed.");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
