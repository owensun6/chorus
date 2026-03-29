import {
  buildTrustBoundary,
  neutralizeRemoteSlash,
} from "../../packages/chorus-skill/templates/bridge/guard";

describe("bridge guard helpers", () => {
  it("neutralizeRemoteSlash prefixes slash-like remote text", () => {
    expect(neutralizeRemoteSlash("  /rm -rf /tmp")).toEqual({
      text: "[remote]   /rm -rf /tmp",
      slashNeutralized: true,
    });
  });

  it("neutralizeRemoteSlash leaves normal text untouched", () => {
    expect(neutralizeRemoteSlash("hello")).toEqual({
      text: "hello",
      slashNeutralized: false,
    });
  });

  it("buildTrustBoundary returns machine-readable remote-untrusted flags", () => {
    expect(buildTrustBoundary("/danger")).toEqual({
      trust_level: "remote_untrusted",
      allow_local_control: false,
      allow_tool_execution: false,
      allow_side_effects: false,
      source_channel: "chorus",
      _slash_neutralized: true,
      original_text: "[remote] /danger",
    });
  });
});
