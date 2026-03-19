// Author: be-api-router
import { parseDemoArgs } from "../../src/demo/index";

// ---------------------------------------------------------------------------
// parseDemoArgs
// ---------------------------------------------------------------------------

describe("parseDemoArgs", () => {
  it("parses --port argument", () => {
    const result = parseDemoArgs(["--port", "8080"]);
    expect(result.webPort).toBe(8080);
  });

  it("defaults to port 5000 when no --port provided", () => {
    const result = parseDemoArgs([]);
    expect(result.webPort).toBe(5000);
  });

  it("defaults to 5000 for NaN port values", () => {
    const result = parseDemoArgs(["--port", "abc"]);
    expect(result.webPort).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// startDemo — integration tests would require full server infrastructure
// These are covered by the web.test.ts unit tests and manual E2E
// ---------------------------------------------------------------------------

describe("startDemo (module exports)", () => {
  it("exports startDemo function", () => {
    const mod = require("../../src/demo/index");
    expect(typeof mod.startDemo).toBe("function");
  });

  it("exports parseDemoArgs function", () => {
    const mod = require("../../src/demo/index");
    expect(typeof mod.parseDemoArgs).toBe("function");
  });
});
