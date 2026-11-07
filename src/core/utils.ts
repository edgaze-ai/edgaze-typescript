import { APIUserAbortError } from "./errors.js";

/** Resolves after `ms`, or rejects with APIUserAbortError as soon as `signal` aborts. */
export function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new APIUserAbortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new APIUserAbortError());
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** RFC 4122 v4 id from the platform's crypto (Node 18+, browsers, Deno, Bun, edge runtimes). */
export function randomId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  if (c && typeof c.getRandomValues === "function") {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6]! & 0x0f) | 0x40;
    b[8] = (b[8]! & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  throw new Error("No secure random source is available (globalThis.crypto is missing).");
}

/** Reads an environment variable on runtimes that have one, without crashing on those that don't. */
export function readEnv(name: string): string | undefined {
  const g = globalThis as {
    process?: { env?: Record<string, string | undefined> };
    Deno?: { env?: { get?: (k: string) => string | undefined } };
  };
  try {
    const value = g.process?.env?.[name] ?? g.Deno?.env?.get?.(name);
    return value?.trim() || undefined;
  } catch {
    return undefined; // Deno without --allow-env throws.
  }
}

export function isAbortError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    ((err as { name: unknown }).name === "AbortError" ||
      (err as { name: unknown }).name === "TimeoutError")
  );
}

/** Encodes a path segment. Ids are UUIDs, but never let a caller's string reshape the URL. */
export function pathSegment(value: string, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  return encodeURIComponent(value);
}
