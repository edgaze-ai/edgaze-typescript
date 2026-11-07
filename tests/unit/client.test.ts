import { afterEach, describe, expect, it } from "vitest";
import {
  APIError,
  BadRequestError,
  ConflictError,
  DEFAULT_BASE_URL,
  Edgaze,
  EdgazeError,
  InternalServerError,
  NotFoundError,
  PayloadTooLargeError,
  PaymentRequiredError,
  PermissionDeniedError,
  RateLimitError,
  AuthenticationError,
  UnprocessableEntityError,
} from "../../src/index.js";
import { parseRetryAfter } from "../../src/core/errors.js";
import { RUN_ID, runBody } from "../helpers/server.js";

afterEach(() => {
  delete process.env.EDGAZE_API_KEY;
  delete process.env.EDGAZE_BASE_URL;
  delete (globalThis as { window?: unknown }).window;
  delete (globalThis as { document?: unknown }).document;
});

describe("constructor", () => {
  it("requires an API key and explains where to get one", () => {
    expect(() => new Edgaze()).toThrow(EdgazeError);
    expect(() => new Edgaze()).toThrow(/EDGAZE_API_KEY/);
  });

  it("reads EDGAZE_API_KEY and EDGAZE_BASE_URL", async () => {
    process.env.EDGAZE_API_KEY = "env_key";
    process.env.EDGAZE_BASE_URL = "https://staging.example.test/v1/";
    let seen: { url: string; auth: string | null } | undefined;
    const client = new Edgaze({
      fetch: async (url, init) => {
        seen = { url: String(url), auth: new Headers(init?.headers).get("authorization") };
        return new Response(JSON.stringify(runBody("running")), { status: 200 });
      },
    });
    expect(client.baseURL).toBe("https://staging.example.test/v1");
    await client.runs.retrieve(RUN_ID);
    expect(seen).toEqual({
      url: `https://staging.example.test/v1/runs/${RUN_ID}`,
      auth: "Bearer env_key",
    });
  });

  it("defaults to the production API", () => {
    expect(new Edgaze({ apiKey: "k" }).baseURL).toBe(DEFAULT_BASE_URL);
    expect(DEFAULT_BASE_URL).toBe("https://api.edgaze.ai/v1");
  });

  it("rejects bad options", () => {
    expect(() => new Edgaze({ apiKey: "k", timeout: 0 })).toThrow(/timeout/);
    expect(() => new Edgaze({ apiKey: "k", maxRetries: -1 })).toThrow(/maxRetries/);
    expect(() => new Edgaze({ apiKey: "k", maxRetries: 1.5 })).toThrow(/maxRetries/);
    expect(() => new Edgaze({ apiKey: "k", baseURL: "not a url" })).toThrow(/baseURL/);
  });

  it("refuses to run in a browser unless explicitly allowed", () => {
    (globalThis as { window?: unknown }).window = {};
    (globalThis as { document?: unknown }).document = {};
    expect(() => new Edgaze({ apiKey: "k" })).toThrow(/browser/);
    expect(() => new Edgaze({ apiKey: "k", dangerouslyAllowBrowser: true })).not.toThrow();
  });

  it("does not send User-Agent from a browser", async () => {
    (globalThis as { window?: unknown }).window = {};
    (globalThis as { document?: unknown }).document = {};
    let ua: string | null = "unset";
    const client = new Edgaze({
      apiKey: "k",
      dangerouslyAllowBrowser: true,
      fetch: async (_url, init) => {
        ua = new Headers(init?.headers).get("user-agent");
        return new Response("{}", { status: 200 });
      },
    });
    await client.runs.retrieve(RUN_ID);
    expect(ua).toBeNull();
  });
});

describe("APIError.from", () => {
  const cases: [number, new (...args: never[]) => APIError][] = [
    [400, BadRequestError],
    [401, AuthenticationError],
    [402, PaymentRequiredError],
    [403, PermissionDeniedError],
    [404, NotFoundError],
    [409, ConflictError],
    [413, PayloadTooLargeError],
    [422, UnprocessableEntityError],
    [429, RateLimitError],
    [500, InternalServerError],
    [503, InternalServerError],
  ];
  for (const [status, cls] of cases) {
    it(`maps ${status} to ${cls.name}`, () => {
      const err = APIError.from(status, new Headers(), { error: { code: "c", message: "m" } });
      expect(err).toBeInstanceOf(cls);
      expect(err).toBeInstanceOf(APIError);
      expect(err).toBeInstanceOf(EdgazeError);
      expect(err.name).toBe(cls.name);
    });
  }

  it("falls back to a plain APIError for other statuses", () => {
    const err = APIError.from(418, new Headers(), null);
    expect(err.constructor).toBe(APIError);
    expect(err.code).toBe("http_error");
  });

  it("ignores details that are not an array", () => {
    const err = APIError.from(400, new Headers(), {
      error: { code: "x", message: "m", details: "no" },
    });
    expect(err.details).toBeUndefined();
  });
});

describe("parseRetryAfter", () => {
  it("parses seconds, fractional seconds and HTTP dates", () => {
    expect(parseRetryAfter("2")).toBe(2000);
    expect(parseRetryAfter("0.5")).toBe(500);
    expect(parseRetryAfter("0")).toBe(0);
    const now = Date.parse("2026-11-07T10:00:00Z");
    expect(parseRetryAfter("Sat, 07 Nov 2026 10:00:30 GMT", now)).toBe(30_000);
    expect(parseRetryAfter("Sat, 07 Nov 2026 09:00:00 GMT", now)).toBe(0);
  });

  it("returns null for missing or invalid values", () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("")).toBeNull();
    expect(parseRetryAfter("soon")).toBeNull();
    expect(parseRetryAfter("-1")).toBeNull();
  });
});
