// Author: qa-01
import { execFileSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const CLI_PATH = join(__dirname, "../../packages/chorus-skill/cli.mjs");

const run = (
  args: string[],
  opts: { env?: Record<string, string>; cwd?: string } = {},
): { stdout: string; stderr: string; exitCode: number } => {
  try {
    const stdout = execFileSync("node", [CLI_PATH, ...args], {
      encoding: "utf8",
      env: { ...process.env, ...opts.env },
      cwd: opts.cwd,
      timeout: 10_000,
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: e.stdout || "",
      stderr: e.stderr || "",
      exitCode: e.status ?? 1,
    };
  }
};

describe("CLI: chorus-skill", () => {
  describe("help", () => {
    it("shows usage with openclaw as primary target", () => {
      const { stdout, exitCode } = run([]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("init --target openclaw");
      expect(stdout).toContain("verify --target openclaw");
      expect(stdout).not.toContain("claude-user");
      expect(stdout).toContain("--help-all");
    });

    it("shows alternative targets with --help-all", () => {
      const { stdout, exitCode } = run(["--help-all"]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("claude-user");
      expect(stdout).toContain("claude-project");
      expect(stdout).toContain("local");
    });
  });

  describe("init --target local", () => {
    const tmpBase = join(tmpdir(), "chorus-cli-local-" + process.pid);

    beforeEach(() => {
      mkdirSync(tmpBase, { recursive: true });
    });

    afterEach(() => {
      rmSync(tmpBase, { recursive: true, force: true });
    });

    it("creates skill files in cwd/chorus", () => {
      const { stdout, exitCode } = run(["init", "--target", "local"], { cwd: tmpBase });
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Files installed");

      const targetDir = join(tmpBase, "chorus");
      expect(existsSync(join(targetDir, "SKILL.md"))).toBe(true);
      expect(existsSync(join(targetDir, "PROTOCOL.md"))).toBe(true);
      expect(existsSync(join(targetDir, "envelope.schema.json"))).toBe(true);
    });
  });

  describe("init --target validation", () => {
    it("rejects invalid target", () => {
      const { stderr, exitCode } = run(["init", "--target", "bogus"]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Unsupported target: bogus");
    });

    it("rejects invalid language", () => {
      const { stderr, exitCode } = run(["init", "--lang", "klingon", "--target", "local"]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Unsupported language: klingon");
    });
  });

  describe("init --target openclaw (missing config)", () => {
    const fakeHome = join(tmpdir(), "chorus-cli-nohome-" + process.pid);

    beforeEach(() => {
      mkdirSync(fakeHome, { recursive: true });
    });

    afterEach(() => {
      rmSync(fakeHome, { recursive: true, force: true });
    });

    it("exits 1 and does NOT write files when openclaw.json is missing", () => {
      const { stderr, exitCode } = run(
        ["init", "--target", "openclaw"],
        { env: { HOME: fakeHome } },
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain("OpenClaw config not found");
      expect(stderr).toContain("files were NOT written");

      // Verify no orphan files were left behind
      const skillDir = join(fakeHome, ".openclaw", "skills", "chorus");
      expect(existsSync(skillDir)).toBe(false);
    });
  });

  describe("init --target openclaw (with config)", () => {
    const fakeHome = join(tmpdir(), "chorus-cli-oc-" + process.pid);
    const configDir = join(fakeHome, ".openclaw");

    beforeEach(() => {
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, "openclaw.json"), JSON.stringify({ skills: {} }));
    });

    afterEach(() => {
      rmSync(fakeHome, { recursive: true, force: true });
    });

    it("succeeds and writes files + registers in openclaw.json", () => {
      const { stdout, exitCode } = run(
        ["init", "--target", "openclaw"],
        { env: { HOME: fakeHome } },
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Files installed");
      expect(stdout).toContain("Registered in");

      // Verify files exist
      const skillDir = join(fakeHome, ".openclaw", "skills", "chorus");
      expect(existsSync(join(skillDir, "SKILL.md"))).toBe(true);
      expect(existsSync(join(skillDir, "PROTOCOL.md"))).toBe(true);
      expect(existsSync(join(skillDir, "envelope.schema.json"))).toBe(true);

      // Verify registration in config
      const config = JSON.parse(readFileSync(join(configDir, "openclaw.json"), "utf8"));
      expect(config.skills.entries.chorus.enabled).toBe(true);
    });
  });

  describe("verify --target", () => {
    it("rejects unknown target with exit 1", () => {
      const { stderr, exitCode } = run(["verify", "--target", "typo"]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Unknown target: typo");
    });

    it("fails when SKILL.md does not exist", () => {
      const fakeHome = join(tmpdir(), "chorus-cli-verify-" + process.pid);
      mkdirSync(fakeHome, { recursive: true });

      try {
        const { stderr, exitCode } = run(
          ["verify", "--target", "openclaw"],
          { env: { HOME: fakeHome } },
        );
        expect(exitCode).toBe(1);
        expect(stderr).toContain("SKILL.md not found");
      } finally {
        rmSync(fakeHome, { recursive: true, force: true });
      }
    });

    it("succeeds for a valid openclaw installation", () => {
      const fakeHome = join(tmpdir(), "chorus-cli-verifyok-" + process.pid);
      const configDir = join(fakeHome, ".openclaw");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, "openclaw.json"), JSON.stringify({ skills: {} }));

      try {
        // First init
        const initResult = run(
          ["init", "--target", "openclaw"],
          { env: { HOME: fakeHome } },
        );
        expect(initResult.exitCode).toBe(0);

        // Then verify
        const { stdout, exitCode } = run(
          ["verify", "--target", "openclaw"],
          { env: { HOME: fakeHome } },
        );
        expect(exitCode).toBe(0);
        expect(stdout).toContain("SKILL.md exists");
        expect(stdout).toContain("chorus registered and enabled");
        expect(stdout).toContain("Installation verified");
      } finally {
        rmSync(fakeHome, { recursive: true, force: true });
      }
    });
  });

  describe("verify --envelope", () => {
    it("validates a correct envelope", () => {
      const envelope = JSON.stringify({
        chorus_version: "0.4",
        sender_id: "a@b",
        original_text: "hello",
        sender_culture: "en",
      });
      const { stdout, exitCode } = run(["verify", "--envelope", envelope]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Valid Chorus envelope");
    });

    it("rejects an incomplete envelope (missing required fields)", () => {
      const envelope = JSON.stringify({ chorus_version: "0.4" });
      const { stderr, exitCode } = run(["verify", "--envelope", envelope]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("missing required fields");
    });

    it("rejects invalid JSON", () => {
      const { stderr, exitCode } = run(["verify", "--envelope", "not-json"]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Invalid JSON");
    });

    it("rejects invalid chorus_version (schema enum)", () => {
      const envelope = JSON.stringify({
        chorus_version: "9.9",
        sender_id: "a@b",
        original_text: "hello",
        sender_culture: "en",
      });
      const { stderr, exitCode } = run(["verify", "--envelope", envelope]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("chorus_version");
    });

    it("rejects turn_number: 0 (schema minimum: 1)", () => {
      const envelope = JSON.stringify({
        chorus_version: "0.4",
        sender_id: "a@b",
        original_text: "hello",
        sender_culture: "en",
        turn_number: 0,
      });
      const { stderr, exitCode } = run(["verify", "--envelope", envelope]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("turn_number");
    });

    it("rejects too-short cultural_context (schema minLength: 10)", () => {
      const envelope = JSON.stringify({
        chorus_version: "0.4",
        sender_id: "a@b",
        original_text: "hello",
        sender_culture: "en",
        cultural_context: "short",
      });
      const { stderr, exitCode } = run(["verify", "--envelope", envelope]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("cultural_context");
    });

    it("counts Unicode code points, not UTF-16 units (emoji minLength)", () => {
      // 5 emoji = 5 code points but 10 UTF-16 code units — must fail minLength: 10
      const envelope = JSON.stringify({
        chorus_version: "0.4",
        sender_id: "a@b",
        original_text: "hello",
        sender_culture: "en",
        cultural_context: "\u{1F600}\u{1F600}\u{1F600}\u{1F600}\u{1F600}",
      });
      const { stderr, exitCode } = run(["verify", "--envelope", envelope]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("cultural_context");
      expect(stderr).toContain("5 code points");
    });

    it("accepts BCP 47 culture tags like zh-Hant and zh-Hant-TW", () => {
      for (const culture of ["zh-Hant", "zh-Hant-TW", "en-US", "ja", "yue-HK"]) {
        const envelope = JSON.stringify({
          chorus_version: "0.4",
          sender_id: "a@b",
          original_text: "hello",
          sender_culture: culture,
        });
        const { exitCode } = run(["verify", "--envelope", envelope]);
        expect(exitCode).toBe(0);
      }
    });

    it("rejects malformed sender_culture", () => {
      const envelope = JSON.stringify({
        chorus_version: "0.4",
        sender_id: "a@b",
        original_text: "hello",
        sender_culture: "BAD_CULTURE",
      });
      const { stderr, exitCode } = run(["verify", "--envelope", envelope]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("sender_culture");
    });
  });

  describe("uninstall --target openclaw", () => {
    it("removes files and unregisters from openclaw.json", () => {
      const fakeHome = join(tmpdir(), "chorus-cli-uninst-" + process.pid);
      const configDir = join(fakeHome, ".openclaw");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, "openclaw.json"), JSON.stringify({ skills: {} }));

      try {
        // Init first
        run(
          ["init", "--target", "openclaw"],
          { env: { HOME: fakeHome } },
        );
        const skillDir = join(fakeHome, ".openclaw", "skills", "chorus");
        expect(existsSync(skillDir)).toBe(true);

        // Then uninstall
        const { stdout, exitCode } = run(
          ["uninstall", "--target", "openclaw"],
          { env: { HOME: fakeHome } },
        );
        expect(exitCode).toBe(0);
        expect(stdout).toContain("Removed");
        expect(existsSync(skillDir)).toBe(false);

        // Verify unregistered
        const config = JSON.parse(readFileSync(join(configDir, "openclaw.json"), "utf8"));
        expect(config.skills?.entries?.chorus).toBeUndefined();
      } finally {
        rmSync(fakeHome, { recursive: true, force: true });
      }
    });
  });
});
