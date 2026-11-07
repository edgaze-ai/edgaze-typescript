import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  Edgaze,
  signWebhookPayload,
  unwrapWebhook,
  verifyWebhookSignature,
  WebhookVerificationError,
} from "../../src/index.js";

const SECRET = "whsec_test_8f2d1c";
const NOW = 1_800_000_000;
const BODY = JSON.stringify({
  type: "run.completed",
  runId: "11111111-1111-4111-8111-111111111111",
  status: "completed",
  outcome: "completed",
  reason: null,
  runUrl: "https://api.edgaze.ai/v1/runs/11111111-1111-4111-8111-111111111111",
  occurredAt: "2027-01-15T08:00:00.000Z",
});

/** Signs exactly like the Edgaze server (src/lib/api-keys/webhook-signing.ts). */
function serverSign(payload: string, secret: string, t: number) {
  const v1 = createHmac("sha256", secret).update(`${t}.${payload}`, "utf8").digest("hex");
  return `t=${t},v1=${v1}`;
}

function headers(signature: string, extra: Record<string, string> = {}) {
  return new Headers({
    "edgaze-signature": signature,
    "edgaze-webhook-id": "33333333-3333-4333-8333-333333333333",
    "edgaze-delivery-id": "44444444-4444-4444-8444-444444444444",
    "edgaze-attempt": "2",
    "edgaze-event": "run.completed",
    ...extra,
  });
}

describe("unwrapWebhook", () => {
  it("accepts a delivery signed by the server and returns the event and delivery info", async () => {
    const delivery = await unwrapWebhook({
      payload: BODY,
      headers: headers(serverSign(BODY, SECRET, NOW)),
      secret: SECRET,
      now: NOW + 10,
    });
    expect(delivery.event).toEqual(JSON.parse(BODY));
    expect(delivery.deliveryId).toBe("44444444-4444-4444-8444-444444444444");
    expect(delivery.webhookId).toBe("33333333-3333-4333-8333-333333333333");
    expect(delivery.attempt).toBe(2);
  });

  it("verifies bytes exactly, including non-ASCII bodies", async () => {
    const body = JSON.stringify({ type: "webhook.test", message: "Grüße 👋", occurredAt: "x" });
    const sig = serverSign(body, SECRET, NOW);
    const asBuffer = Buffer.from(body, "utf8");
    for (const payload of [
      body,
      asBuffer,
      new Uint8Array(asBuffer),
      asBuffer.buffer.slice(asBuffer.byteOffset, asBuffer.byteOffset + asBuffer.byteLength),
    ]) {
      const { event } = await unwrapWebhook({
        payload,
        headers: headers(sig),
        secret: SECRET,
        now: NOW,
      });
      expect(event.type).toBe("webhook.test");
    }
  });

  it("rejects a tampered body", async () => {
    const sig = serverSign(BODY, SECRET, NOW);
    await expect(
      unwrapWebhook({
        payload: BODY.replace("completed", "failed"),
        headers: headers(sig),
        secret: SECRET,
        now: NOW,
      }),
    ).rejects.toThrow(/does not match/);
  });

  it("rejects re-serialized JSON", async () => {
    const pretty = JSON.stringify(JSON.parse(BODY), null, 2);
    await expect(
      unwrapWebhook({
        payload: pretty,
        headers: headers(serverSign(BODY, SECRET, NOW)),
        secret: SECRET,
        now: NOW,
      }),
    ).rejects.toBeInstanceOf(WebhookVerificationError);
  });

  it("rejects the wrong secret", async () => {
    await expect(
      unwrapWebhook({
        payload: BODY,
        headers: headers(serverSign(BODY, "other", NOW)),
        secret: SECRET,
        now: NOW,
      }),
    ).rejects.toThrow(/does not match/);
  });

  it("rejects stale and future timestamps outside the tolerance", async () => {
    const sig = serverSign(BODY, SECRET, NOW);
    await expect(
      unwrapWebhook({ payload: BODY, headers: headers(sig), secret: SECRET, now: NOW + 301 }),
    ).rejects.toThrow(/tolerance/);
    await expect(
      unwrapWebhook({ payload: BODY, headers: headers(sig), secret: SECRET, now: NOW - 301 }),
    ).rejects.toThrow(/tolerance/);
    await expect(
      unwrapWebhook({ payload: BODY, headers: headers(sig), secret: SECRET, now: NOW + 300 }),
    ).resolves.toBeTruthy();
    await expect(
      unwrapWebhook({
        payload: BODY,
        headers: headers(sig),
        secret: SECRET,
        now: NOW + 1000,
        toleranceSeconds: 2000,
      }),
    ).resolves.toBeTruthy();
  });

  it("rejects a timestamp swapped onto a valid signature", async () => {
    const sig = serverSign(BODY, SECRET, NOW).replace(`t=${NOW}`, `t=${NOW + 5}`);
    await expect(
      unwrapWebhook({ payload: BODY, headers: headers(sig), secret: SECRET, now: NOW }),
    ).rejects.toThrow(/does not match/);
  });

  it("rejects missing and malformed signature headers", async () => {
    const noSig = new Headers({ "edgaze-webhook-id": "x" });
    await expect(
      unwrapWebhook({ payload: BODY, headers: noSig, secret: SECRET, now: NOW }),
    ).rejects.toThrow(/Missing/);
    for (const bad of ["garbage", "t=abc,v1=00", `t=${NOW}`, `v1=abcd`, `t=${NOW},v1=zz`]) {
      await expect(
        unwrapWebhook({ payload: BODY, headers: headers(bad), secret: SECRET, now: NOW }),
        bad,
      ).rejects.toBeInstanceOf(WebhookVerificationError);
    }
  });

  it("accepts any matching v1 when several are present", async () => {
    const good = serverSign(BODY, SECRET, NOW).split(",v1=")[1];
    const sig = `t=${NOW},v1=${"0".repeat(64)},v1=${good}`;
    await expect(
      verifyWebhookSignature({ payload: BODY, headers: headers(sig), secret: SECRET, now: NOW }),
    ).resolves.toBeUndefined();
  });

  it("requires a secret", async () => {
    await expect(
      unwrapWebhook({
        payload: BODY,
        headers: headers(serverSign(BODY, SECRET, NOW)),
        secret: "",
        now: NOW,
      }),
    ).rejects.toThrow(/secret/);
  });

  it("reads headers from Node-style objects, arrays and iterables, case-insensitively", async () => {
    const sig = serverSign(BODY, SECRET, NOW);
    const variants = [
      { "edgaze-signature": sig, "edgaze-delivery-id": "d1" },
      { "Edgaze-Signature": [sig], "EDGAZE-DELIVERY-ID": ["d1"] },
      [
        ["edgaze-signature", sig],
        ["edgaze-delivery-id", "d1"],
      ] as [string, string][],
      new Map([
        ["edgaze-signature", sig],
        ["edgaze-delivery-id", "d1"],
      ]),
    ];
    for (const h of variants) {
      const d = await unwrapWebhook({ payload: BODY, headers: h, secret: SECRET, now: NOW });
      expect(d.deliveryId).toBe("d1");
      expect(d.attempt).toBeNull();
    }
  });

  it("rejects a signed body that is not a JSON event", async () => {
    for (const body of ["not json", "[1,2]", '{"no":"type"}']) {
      await expect(
        unwrapWebhook({
          payload: body,
          headers: headers(serverSign(body, SECRET, NOW)),
          secret: SECRET,
          now: NOW,
        }),
      ).rejects.toBeInstanceOf(WebhookVerificationError);
    }
  });

  it("signWebhookPayload matches the server's signature", async () => {
    expect(await signWebhookPayload({ payload: BODY, secret: SECRET, timestamp: NOW })).toBe(
      serverSign(BODY, SECRET, NOW),
    );
    const sig = await signWebhookPayload({ payload: BODY, secret: SECRET });
    await expect(
      unwrapWebhook({ payload: BODY, headers: headers(sig), secret: SECRET }),
    ).resolves.toBeTruthy();
  });
});

describe("client.webhooks.unwrap", () => {
  it("uses the client's webhookSecret", async () => {
    const client = new Edgaze({ apiKey: "k", webhookSecret: SECRET });
    const sig = await signWebhookPayload({ payload: BODY, secret: SECRET });
    const { event } = await client.webhooks.unwrap(BODY, headers(sig));
    expect(event.type).toBe("run.completed");
  });

  it("reads EDGAZE_WEBHOOK_SECRET", async () => {
    process.env.EDGAZE_WEBHOOK_SECRET = SECRET;
    try {
      const client = new Edgaze({ apiKey: "k" });
      const sig = await signWebhookPayload({ payload: BODY, secret: SECRET });
      await expect(client.webhooks.unwrap(BODY, headers(sig))).resolves.toBeTruthy();
    } finally {
      delete process.env.EDGAZE_WEBHOOK_SECRET;
    }
  });

  it("rejects clearly without a secret", async () => {
    const client = new Edgaze({ apiKey: "k" });
    await expect(client.webhooks.unwrap(BODY, headers("t=1,v1=00"))).rejects.toThrow(
      /webhook secret/,
    );
  });
});
