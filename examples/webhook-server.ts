// A minimal webhook receiver using only Node's http module.
//   EDGAZE_WEBHOOK_SECRET=… npx tsx examples/webhook-server.ts
import { createServer } from "node:http";
import { unwrapWebhook, WebhookVerificationError } from "../src/index.js";

const secret = process.env.EDGAZE_WEBHOOK_SECRET;
if (!secret) throw new Error("Set EDGAZE_WEBHOOK_SECRET");
const seen = new Set<string>(); // use your database in production

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  try {
    const { event, deliveryId } = await unwrapWebhook({
      payload: Buffer.concat(chunks),
      headers: req.headers,
      secret,
    });
    const dedupeKey = deliveryId ?? ("runId" in event ? `${event.runId}:${event.type}` : null);
    if (dedupeKey && seen.has(dedupeKey)) return void res.writeHead(200).end();
    if (dedupeKey) seen.add(dedupeKey);
    console.log("Received", event.type, "runId" in event ? event.runId : "");
    res.writeHead(200).end();
  } catch (err) {
    if (err instanceof WebhookVerificationError) return void res.writeHead(400).end();
    console.error(err);
    res.writeHead(500).end();
  }
}).listen(3000, () => console.log("Listening on http://localhost:3000"));
