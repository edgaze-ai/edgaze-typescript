// Runs the built ESM bundle under Deno: a request through a fake fetch, and webhook verification
// with Web Crypto. `deno run scripts/smoke-deno.ts` after `npm run build`.
import Edgaze, { signWebhookPayload, unwrapWebhook } from "../dist/index.js";

const client = new Edgaze({
  apiKey: "sk_deno",
  baseURL: "https://x.test/v1",
  fetch: async (url: string | URL | Request) =>
    new Response(JSON.stringify({ id: "r1", status: "running", url: String(url) }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
});
const run = await client.runs.retrieve("r1");
if (run.status !== "running") throw new Error("request failed");

const payload = JSON.stringify({ type: "webhook.test", message: "hi", occurredAt: "x" });
const signature = await signWebhookPayload({ payload, secret: "s" });
const { event } = await unwrapWebhook({
  payload,
  headers: new Headers({ "edgaze-signature": signature }),
  secret: "s",
});
if (event.type !== "webhook.test") throw new Error("webhook failed");
console.log("Deno ok");
