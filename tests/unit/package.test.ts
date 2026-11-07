import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { VERSION } from "../../src/index.js";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

describe("package", () => {
  it("VERSION matches package.json", () => {
    expect(VERSION).toBe(pkg.version);
  });

  it("has no runtime dependencies", () => {
    expect(pkg.dependencies ?? {}).toEqual({});
  });

  it("the changelog has an entry for this version", () => {
    const changelog = readFileSync(new URL("../../CHANGELOG.md", import.meta.url), "utf8");
    expect(changelog).toContain(`## ${pkg.version}`);
  });
});
