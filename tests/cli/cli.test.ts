// Author: qa-01
import { execFileSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const CLI_PATH = join(__dirname, "../../packages/chorus-skill/cli.mjs");
const PACKAGE_VERSION = JSON.parse(
  readFileSync(join(__dirname, "../../packages/chorus-skill/package.json"), "utf8"),
).version;

// Derive bridge file list from CLI source — single source of truth.
// If cli.mjs changes BRIDGE_REQUIRED_FILES, this test automatically follows.
const BRIDGE_REQUIRED_FILES: string[] = (() => {
  const src = readFileSync(CLI_PATH, "utf8");
  const match = src.match(/const BRIDGE_REQUIRED_FILES\s*=\s*\[([\s\S]*?)\]/);
  if (!match) throw new Error("Cannot find BRIDGE_REQUIRED_FILES in cli.mjs — test source derivation broken");
  return match[1]
    .split(",")
    .map((s) => s.replace(/["\s]/g, ""))
    .filter(Boolean);
})();

const openClawConfigPath = (home: string) => join(home, ".openclaw", "openclaw.json");
const restartGatePath = (home: string) => join(home, ".chorus", "restart-consent.json");
const workspaceDir = (home: string) => join(home, ".openclaw", "workspace");
const activationProofPath = (home: string, agentId: string) =>
  join(home, ".chorus", "state", agentId.split("@")[0], `activation-proof.${agentId}.json`);

const clearRestartGate = (home: string) => {
  const config = JSON.parse(readFileSync(openClawConfigPath(home), "utf8"));
  if (Array.isArray(config.tools?.deny)) {
    config.tools.deny = config.tools.deny.filter((entry: string) => entry !== "gateway");
    if (config.tools.deny.length === 0) {
      delete config.tools.deny;
    }
    if (config.tools && Object.keys(config.tools).length === 0) {
      delete config.tools;
    }
  }
  writeFileSync(openClawConfigPath(home), JSON.stringify(config));
  rmSync(restartGatePath(home), { force: true });
};

const writeWorkspaceCredential = (home: string, agentId = "ws-test@agchorus") => {
  const wsDir = workspaceDir(home);
  mkdirSync(wsDir, { recursive: true });
  writeFileSync(join(wsDir, "chorus-credentials.json"), JSON.stringify({
    agent_id: agentId,
    api_key: "ca_workspace123",
    hub_url: "https://agchorus.com",
  }));
  return wsDir;
};

const writeActivationProof = (home: string, agentId: string, activatedAt: string) => {
  const proofPath = activationProofPath(home, agentId);
  mkdirSync(join(home, ".chorus", "state", agentId.split("@")[0]), { recursive: true });
  writeFileSync(proofPath, JSON.stringify({
    schema_version: 1,
    agent_id: agentId,
    activated_at: activatedAt,
    proof_source: "chorus-bridge/runtime-v2 activateBridge",
    state_dir: join(home, ".chorus", "state", agentId.split("@")[0]),
  }));
  return proofPath;
};

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
      expect(stdout).toContain("Skill installed");

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

      // Verify no orphan files were left behind
      const skillDir = join(fakeHome, ".openclaw", "skills", "chorus");
      expect(existsSync(skillDir)).toBe(false);
    });
  });

  describe("init --target openclaw (corrupt config)", () => {
    const fakeHome = join(tmpdir(), "chorus-cli-corrupt-" + process.pid);

    beforeAll(() => {
      mkdirSync(join(fakeHome, ".openclaw"), { recursive: true });
      writeFileSync(join(fakeHome, ".openclaw", "openclaw.json"), "NOT VALID JSON{{{");
    });

    afterAll(() => {
      rmSync(fakeHome, { recursive: true, force: true });
    });

    it("exits 1 and rolls back skill + bridge when openclaw.json is corrupt", () => {
      const { stderr, exitCode } = run(
        ["init", "--target", "openclaw"],
        { env: { HOME: fakeHome } },
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Registration error");
      expect(stderr).toContain("Rolled back");

      // Verify rollback: no orphan skill or bridge dirs
      const skillDir = join(fakeHome, ".openclaw", "skills", "chorus");
      const bridgeDir = join(fakeHome, ".openclaw", "extensions", "chorus-bridge");
      expect(existsSync(skillDir)).toBe(false);
      expect(existsSync(bridgeDir)).toBe(false);

      // openclaw.json must be untouched (still corrupt, not overwritten)
      const content = readFileSync(join(fakeHome, ".openclaw", "openclaw.json"), "utf8");
      expect(content).toBe("NOT VALID JSON{{{");
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

    it("succeeds and writes skill + bridge + registers both in openclaw.json", () => {
      const { stdout, exitCode } = run(
        ["init", "--target", "openclaw"],
        { env: { HOME: fakeHome } },
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("Skill installed");
      expect(stdout).toContain("Bridge installed");
      expect(stdout).toContain("Registered skill + bridge");

      // Verify skill files exist
      const skillDir = join(fakeHome, ".openclaw", "skills", "chorus");
      expect(existsSync(join(skillDir, "SKILL.md"))).toBe(true);
      expect(existsSync(join(skillDir, "PROTOCOL.md"))).toBe(true);
      expect(existsSync(join(skillDir, "envelope.schema.json"))).toBe(true);

      // Verify complete bridge file set — list derived from cli.mjs, not hand-copied
      const bridgeDir = join(fakeHome, ".openclaw", "extensions", "chorus-bridge");
      for (const file of BRIDGE_REQUIRED_FILES) {
        expect(existsSync(join(bridgeDir, file))).toBe(true);
      }

      // Verify registration in config
      const config = JSON.parse(readFileSync(join(configDir, "openclaw.json"), "utf8"));
      expect(config.skills.entries.chorus.enabled).toBe(true);
      expect(config.plugins.entries["chorus-bridge"].enabled).toBe(true);
      expect(config.plugins.allow).toContain("chorus-bridge");
      expect(config.tools.deny).toContain("gateway");

      const gate = JSON.parse(readFileSync(restartGatePath(fakeHome), "utf8"));
      expect(gate.status).toBe("armed");
      expect(gate.toolName).toBe("gateway");
      expect(gate.packageVersion).toBe(PACKAGE_VERSION);
      expect(stdout).toContain("Restart consent gate armed");

      const installedSkill = readFileSync(join(skillDir, "SKILL.md"), "utf8");
      expect(installedSkill).toContain(`npx @chorus-protocol/skill@${PACKAGE_VERSION} restart-consent request`);
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

    it("reports restart gate when install is pending approval", () => {
      const fakeHome = join(tmpdir(), "chorus-cli-verifyok-" + process.pid);
      const configDir = join(fakeHome, ".openclaw");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, "openclaw.json"), JSON.stringify({ skills: {} }));

      try {
        run(["init", "--target", "openclaw"], { env: { HOME: fakeHome } });

        const { stdout, stderr, exitCode } = run(
          ["verify", "--target", "openclaw"],
          { env: { HOME: fakeHome } },
        );
        expect(exitCode).toBe(1);
        expect(stdout).toContain("SKILL.md exists");
        expect(stdout).toContain("chorus-bridge complete");
        expect(stderr).toContain("Restart consent gate active");
      } finally {
        rmSync(fakeHome, { recursive: true, force: true });
      }
    });

    it("succeeds when gateway is already loaded and credentials are present", () => {
      const fakeHome = join(tmpdir(), "chorus-cli-verifycred-" + process.pid);
      const configDir = join(fakeHome, ".openclaw");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, "openclaw.json"), JSON.stringify({ skills: {} }));

      try {
        run(["init", "--target", "openclaw"], { env: { HOME: fakeHome } });
        clearRestartGate(fakeHome);

        const agentsDir = join(fakeHome, ".chorus", "agents");
        mkdirSync(agentsDir, { recursive: true });
        writeFileSync(join(agentsDir, "test.json"), JSON.stringify({
          agent_id: "test@agchorus",
          api_key: "ca_test123",
          hub_url: "https://agchorus.com",
        }));

        const { stdout, exitCode } = run(
          ["verify", "--target", "openclaw"],
          { env: { HOME: fakeHome } },
        );
        expect(exitCode).toBe(0);
        expect(stdout).toContain("SKILL.md exists");
        expect(stdout).toContain("chorus-bridge complete");
        expect(stdout).toContain("agent config");
        expect(stdout).toContain("bridge ready");
      } finally {
        rmSync(fakeHome, { recursive: true, force: true });
      }
    });

    it("succeeds when workspace chorus-credentials.json has valid credentials and no restart gate is pending", () => {
      const fakeHome = join(tmpdir(), "chorus-cli-verifywscred-" + process.pid);
      const configDir = join(fakeHome, ".openclaw");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, "openclaw.json"), JSON.stringify({ skills: {} }));

      try {
        run(["init", "--target", "openclaw"], { env: { HOME: fakeHome } });
        clearRestartGate(fakeHome);

        // Write credentials to workspace path (primary activation path)
        writeWorkspaceCredential(fakeHome);

        const { stdout, exitCode } = run(
          ["verify", "--target", "openclaw"],
          { env: { HOME: fakeHome } },
        );
        expect(exitCode).toBe(0);
        expect(stdout).toContain("agent config");
        expect(stdout).toContain("bridge ready");
      } finally {
        rmSync(fakeHome, { recursive: true, force: true });
      }
    });

    it("credentials-only path: verify reports missing credentials without triggering restart gate", () => {
      const fakeHome = join(tmpdir(), "chorus-cli-credonly-" + process.pid);
      const configDir = join(fakeHome, ".openclaw");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, "openclaw.json"), JSON.stringify({ skills: {} }));

      try {
        // Install and then clear the restart gate (simulates completed restart consent flow)
        run(["init", "--target", "openclaw"], { env: { HOME: fakeHome } });
        clearRestartGate(fakeHome);

        // Do NOT write any credentials — this is the credentials-only path

        const { stdout, stderr, exitCode } = run(
          ["verify", "--target", "openclaw"],
          { env: { HOME: fakeHome } },
        );
        expect(exitCode).toBe(1);
        expect(stdout).toContain("Installation integrity");
        expect(stderr).toContain("Bridge standby");
        expect(stderr).toContain("no valid agent credentials found");
        // Must NOT mention restart gate
        expect(stderr).not.toContain("Restart consent gate");
        expect(stderr).not.toContain("restart-consent");
      } finally {
        rmSync(fakeHome, { recursive: true, force: true });
      }
    });

    it("fails when bridge directory is missing", () => {
      const fakeHome = join(tmpdir(), "chorus-cli-vnobridge-" + process.pid);
      const configDir = join(fakeHome, ".openclaw");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, "openclaw.json"), JSON.stringify({ skills: {} }));

      try {
        // Init to get everything
        run(["init", "--target", "openclaw"], { env: { HOME: fakeHome } });

        // Delete bridge directory to simulate partial install
        const bridgeDir = join(fakeHome, ".openclaw", "extensions", "chorus-bridge");
        rmSync(bridgeDir, { recursive: true });

        // Verify should fail on missing bridge
        const { stderr, exitCode } = run(
          ["verify", "--target", "openclaw"],
          { env: { HOME: fakeHome } },
        );
        expect(exitCode).toBe(1);
        expect(stderr).toContain("chorus-bridge not found");
      } finally {
        rmSync(fakeHome, { recursive: true, force: true });
      }
    });

    it.each(BRIDGE_REQUIRED_FILES)(
      "verify fails with full error when bridge file %s is missing",
      (missingFile) => {
        const fakeHome = join(tmpdir(), `chorus-cli-vmiss-${missingFile}-${process.pid}`);
        const configDir = join(fakeHome, ".openclaw");
        mkdirSync(configDir, { recursive: true });
        writeFileSync(join(configDir, "openclaw.json"), JSON.stringify({ skills: {} }));

        try {
          run(["init", "--target", "openclaw"], { env: { HOME: fakeHome } });

          // Delete exactly one bridge file
          const bridgeDir = join(fakeHome, ".openclaw", "extensions", "chorus-bridge");
          rmSync(join(bridgeDir, missingFile));

          const { stderr, exitCode } = run(
            ["verify", "--target", "openclaw"],
            { env: { HOME: fakeHome } },
          );

          // Three assertions per missing file — no partial coverage
          expect(exitCode).toBe(1);
          expect(stderr).toContain(`chorus-bridge incomplete — missing: ${missingFile}`);
          expect(stderr).toContain(
            `npx @chorus-protocol/skill@${PACKAGE_VERSION} uninstall --target openclaw && npx @chorus-protocol/skill@${PACKAGE_VERSION} init --target openclaw`,
          );
        } finally {
          rmSync(fakeHome, { recursive: true, force: true });
        }
      },
    );
  });

  describe("init --target openclaw (no openclaw.json → fail fast, no half-install)", () => {
    it("leaves no skill or bridge files when openclaw.json is absent", () => {
      const fakeHome = join(tmpdir(), "chorus-cli-failfast-" + process.pid);
      mkdirSync(fakeHome, { recursive: true });

      try {
        const { stderr, exitCode } = run(
          ["init", "--target", "openclaw"],
          { env: { HOME: fakeHome } },
        );
        expect(exitCode).toBe(1);
        expect(stderr).toContain("OpenClaw config not found");

        // Neither skill nor bridge should exist
        expect(existsSync(join(fakeHome, ".openclaw", "skills", "chorus"))).toBe(false);
        expect(existsSync(join(fakeHome, ".openclaw", "extensions", "chorus-bridge"))).toBe(false);
      } finally {
        rmSync(fakeHome, { recursive: true, force: true });
      }
    });
  });

  describe("restart-consent", () => {
    const fakeHome = join(tmpdir(), "chorus-cli-restart-gate-" + process.pid);
    const configDir = join(fakeHome, ".openclaw");

    beforeEach(() => {
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, "openclaw.json"), JSON.stringify({ skills: {} }));
      run(["init", "--target", "openclaw"], { env: { HOME: fakeHome } });
    });

    afterEach(() => {
      rmSync(fakeHome, { recursive: true, force: true });
    });

    it("writes checkpoint before emitting blocked state", () => {
      const wsDir = workspaceDir(fakeHome);
      const checkpointPath = join(wsDir, "chorus-restart-checkpoint.md");

      const { stdout, stderr, exitCode } = run(
        [
          "restart-consent",
          "request",
          "--workspace",
          wsDir,
          "--restart-required-for",
          "gateway needs to load chorus-bridge plugin after install",
          "--user-goal",
          "activate Chorus",
          "--current-identity",
          "unknown",
          "--completed-steps",
          "skill installed; bridge installed",
          "--next-step-after-restart",
          "verify bridge activation",
          "--resume-message",
          "Resuming Chorus activation after restart.",
        ],
        { env: { HOME: fakeHome } },
      );

      expect(exitCode).toBe(1);
      expect(stdout).toContain("Restart checkpoint written");
      expect(stderr).toContain("Restart blocked pending explicit approval");
      expect(existsSync(checkpointPath)).toBe(true);
      const gate = JSON.parse(readFileSync(restartGatePath(fakeHome), "utf8"));
      expect(gate.status).toBe("awaiting_approval");
      expect(gate.checkpointPath).toBe(checkpointPath);
    });

    it("does not unlock restart on ambiguous approval", () => {
      const wsDir = workspaceDir(fakeHome);
      run(
        [
          "restart-consent",
          "request",
          "--workspace",
          wsDir,
          "--restart-required-for",
          "gateway needs to load chorus-bridge plugin after install",
          "--user-goal",
          "activate Chorus",
          "--current-identity",
          "unknown",
          "--completed-steps",
          "skill installed; bridge installed",
          "--next-step-after-restart",
          "verify bridge activation",
          "--resume-message",
          "Resuming Chorus activation after restart.",
        ],
        { env: { HOME: fakeHome } },
      );

      const { stderr, exitCode } = run(
        ["restart-consent", "approve", "--reply", "maybe later"],
        { env: { HOME: fakeHome } },
      );

      expect(exitCode).toBe(1);
      expect(stderr).toContain("Restart remains blocked");
      const config = JSON.parse(readFileSync(openClawConfigPath(fakeHome), "utf8"));
      expect(config.tools.deny).toContain("gateway");
    });

    it("keeps gate active when complete has no post-restart proof", () => {
      const wsDir = workspaceDir(fakeHome);

      run(
        [
          "restart-consent",
          "request",
          "--workspace",
          wsDir,
          "--restart-required-for",
          "gateway needs to load chorus-bridge plugin after install",
          "--user-goal",
          "activate Chorus",
          "--current-identity",
          "unknown",
          "--completed-steps",
          "skill installed; bridge installed",
          "--next-step-after-restart",
          "verify bridge activation",
          "--resume-message",
          "Resuming Chorus activation after restart.",
        ],
        { env: { HOME: fakeHome } },
      );

      run(
        ["restart-consent", "approve", "--reply", "yes"],
        { env: { HOME: fakeHome } },
      );

      writeWorkspaceCredential(fakeHome, "no-proof@agchorus");

      const complete = run(
        ["restart-consent", "complete"],
        { env: { HOME: fakeHome } },
      );

      expect(complete.exitCode).toBe(1);
      expect(complete.stderr).toContain("post-restart proof missing");
      expect(complete.stderr).toContain("bridge activation proof missing");
      expect(existsSync(restartGatePath(fakeHome))).toBe(true);
      const configAfterFailedComplete = JSON.parse(readFileSync(openClawConfigPath(fakeHome), "utf8"));
      expect(configAfterFailedComplete.tools?.deny ?? []).toContain("gateway");

      const verify = run(
        ["verify", "--target", "openclaw"],
        { env: { HOME: fakeHome } },
      );
      expect(verify.exitCode).toBe(1);
      expect(verify.stderr).toContain("Restart consent gate active");
    });

    it("keeps gate active when workspace proof identity mismatches checkpoint identity", () => {
      const wsDir = workspaceDir(fakeHome);

      run(
        [
          "restart-consent",
          "request",
          "--workspace",
          wsDir,
          "--restart-required-for",
          "gateway needs to load chorus-bridge plugin after install",
          "--user-goal",
          "activate Chorus",
          "--current-identity",
          "expected@agchorus",
          "--completed-steps",
          "skill installed; bridge installed",
          "--next-step-after-restart",
          "verify bridge activation",
          "--resume-message",
          "Resuming Chorus activation after restart.",
        ],
        { env: { HOME: fakeHome } },
      );

      const approve = run(
        ["restart-consent", "approve", "--reply", "yes"],
        { env: { HOME: fakeHome } },
      );
      expect(approve.exitCode).toBe(0);

      const approvedGate = JSON.parse(readFileSync(restartGatePath(fakeHome), "utf8"));
      writeWorkspaceCredential(fakeHome, "other@agchorus");
      writeActivationProof(
        fakeHome,
        "other@agchorus",
        new Date(Date.parse(approvedGate.approvedAt) + 1_000).toISOString(),
      );

      const complete = run(
        ["restart-consent", "complete"],
        { env: { HOME: fakeHome } },
      );

      expect(complete.exitCode).toBe(1);
      expect(complete.stderr).toContain("workspace credential agent_id other@agchorus does not match checkpoint identity expected@agchorus");
      expect(existsSync(restartGatePath(fakeHome))).toBe(true);

      const verify = run(
        ["verify", "--target", "openclaw"],
        { env: { HOME: fakeHome } },
      );
      expect(verify.exitCode).toBe(1);
      expect(verify.stderr).toContain("Restart consent gate active");
    });

    it("records approval without touching openclaw config and clears the deferred deny on complete once proof exists", () => {
      const wsDir = workspaceDir(fakeHome);
      const checkpointPath = join(wsDir, "chorus-restart-checkpoint.md");

      run(
        [
          "restart-consent",
          "request",
          "--workspace",
          wsDir,
          "--restart-required-for",
          "gateway needs to load chorus-bridge plugin after install",
          "--user-goal",
          "activate Chorus",
          "--current-identity",
          "unknown",
          "--completed-steps",
          "skill installed; bridge installed",
          "--next-step-after-restart",
          "verify bridge activation",
          "--resume-message",
          "Resuming Chorus activation after restart.",
        ],
        { env: { HOME: fakeHome } },
      );

      const configBeforeApproveRaw = readFileSync(openClawConfigPath(fakeHome), "utf8");
      const approve = run(
        ["restart-consent", "approve", "--reply", "yes"],
        { env: { HOME: fakeHome } },
      );
      expect(approve.exitCode).toBe(0);
      expect(approve.stdout).toContain("Restart approved");
      expect(approve.stdout).toContain("do not call gateway.restart");
      expect(approve.stdout).toContain("restart-consent complete");

      const configAfterApproveRaw = readFileSync(openClawConfigPath(fakeHome), "utf8");
      expect(configAfterApproveRaw).toBe(configBeforeApproveRaw);
      const configAfterApprove = JSON.parse(readFileSync(openClawConfigPath(fakeHome), "utf8"));
      expect(configAfterApprove.tools?.deny ?? []).toContain("gateway");

      const approvedGate = JSON.parse(readFileSync(restartGatePath(fakeHome), "utf8"));
      const agentId = "proof-agent@agchorus";
      writeWorkspaceCredential(fakeHome, agentId);
      const runtimeProofPath = writeActivationProof(
        fakeHome,
        agentId,
        new Date(Date.parse(approvedGate.approvedAt) + 1_000).toISOString(),
      );

      const complete = run(
        ["restart-consent", "complete"],
        { env: { HOME: fakeHome } },
      );
      expect(complete.exitCode).toBe(0);
      expect(complete.stdout).toContain("Restart recovery completed");
      expect(complete.stdout).toContain("chorus-restart-proof.json");
      expect(existsSync(checkpointPath)).toBe(false);
      expect(existsSync(restartGatePath(fakeHome))).toBe(false);
      expect(existsSync(join(wsDir, "chorus-restart-proof.json"))).toBe(true);
      const configAfterComplete = JSON.parse(readFileSync(openClawConfigPath(fakeHome), "utf8"));
      expect(configAfterComplete.tools?.deny ?? []).not.toContain("gateway");
      const completionProof = JSON.parse(readFileSync(join(wsDir, "chorus-restart-proof.json"), "utf8"));
      expect(completionProof.activation_proof_path).toBe(runtimeProofPath);
      expect(completionProof.helper_package_spec).toBe(`@chorus-protocol/skill@${PACKAGE_VERSION}`);
      expect(completionProof.checkpoint_identity).toBe("unknown");
      expect(completionProof.resolved_proof_agent_id).toBe(agentId);
    });

    it("resumes complete cleanup after a partial failure that happens after openclaw.json is updated", () => {
      const wsDir = workspaceDir(fakeHome);
      const checkpointPath = join(wsDir, "chorus-restart-checkpoint.md");

      run(
        [
          "restart-consent",
          "request",
          "--workspace",
          wsDir,
          "--restart-required-for",
          "gateway needs to load chorus-bridge plugin after install",
          "--user-goal",
          "activate Chorus",
          "--current-identity",
          "unknown",
          "--completed-steps",
          "skill installed; bridge installed",
          "--next-step-after-restart",
          "verify bridge activation",
          "--resume-message",
          "Resuming Chorus activation after restart.",
        ],
        { env: { HOME: fakeHome } },
      );

      run(
        ["restart-consent", "approve", "--reply", "yes"],
        { env: { HOME: fakeHome } },
      );

      const approvedGate = JSON.parse(readFileSync(restartGatePath(fakeHome), "utf8"));
      const agentId = "retry-complete@agchorus";
      writeWorkspaceCredential(fakeHome, agentId);
      writeActivationProof(
        fakeHome,
        agentId,
        new Date(Date.parse(approvedGate.approvedAt) + 1_000).toISOString(),
      );

      const failedComplete = run(
        ["restart-consent", "complete"],
        {
          env: {
            HOME: fakeHome,
            CHORUS_DEBUG_RESTART_COMPLETE_FAIL_AT: "after_config_write",
          },
        },
      );

      expect(failedComplete.exitCode).toBe(1);
      expect(failedComplete.stderr).toContain("Restart recovery cleanup failed");
      const gateAfterFailure = JSON.parse(readFileSync(restartGatePath(fakeHome), "utf8"));
      expect(gateAfterFailure.status).toBe("completing");
      const configAfterFailure = JSON.parse(readFileSync(openClawConfigPath(fakeHome), "utf8"));
      expect(configAfterFailure.tools?.deny ?? []).not.toContain("gateway");
      expect(existsSync(checkpointPath)).toBe(true);
      expect(existsSync(join(wsDir, "chorus-restart-proof.json"))).toBe(true);

      const retriedComplete = run(
        ["restart-consent", "complete"],
        { env: { HOME: fakeHome } },
      );

      expect(retriedComplete.exitCode).toBe(0);
      expect(existsSync(restartGatePath(fakeHome))).toBe(false);
      expect(existsSync(checkpointPath)).toBe(false);
    });

    it("preserves a user-defined gateway deny through complete", () => {
      rmSync(fakeHome, { recursive: true, force: true });
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, "openclaw.json"), JSON.stringify({
        skills: {},
        tools: { deny: ["gateway"] },
      }));
      run(["init", "--target", "openclaw"], { env: { HOME: fakeHome } });

      const wsDir = workspaceDir(fakeHome);
      run(
        [
          "restart-consent",
          "request",
          "--workspace",
          wsDir,
          "--restart-required-for",
          "gateway needs to load chorus-bridge plugin after install",
          "--user-goal",
          "activate Chorus",
          "--current-identity",
          "unknown",
          "--completed-steps",
          "skill installed; bridge installed",
          "--next-step-after-restart",
          "verify bridge activation",
          "--resume-message",
          "Resuming Chorus activation after restart.",
        ],
        { env: { HOME: fakeHome } },
      );

      const approve = run(
        ["restart-consent", "approve", "--reply", "yes"],
        { env: { HOME: fakeHome } },
      );

      expect(approve.exitCode).toBe(0);
      const configAfterApprove = JSON.parse(readFileSync(openClawConfigPath(fakeHome), "utf8"));
      expect(configAfterApprove.tools?.deny ?? []).toContain("gateway");

      const approvedGate = JSON.parse(readFileSync(restartGatePath(fakeHome), "utf8"));
      const agentId = "preexisting-deny@agchorus";
      writeWorkspaceCredential(fakeHome, agentId);
      writeActivationProof(
        fakeHome,
        agentId,
        new Date(Date.parse(approvedGate.approvedAt) + 1_000).toISOString(),
      );

      const complete = run(
        ["restart-consent", "complete"],
        { env: { HOME: fakeHome } },
      );

      expect(complete.exitCode).toBe(0);
      const configAfterComplete = JSON.parse(readFileSync(openClawConfigPath(fakeHome), "utf8"));
      expect(configAfterComplete.tools?.deny ?? []).toContain("gateway");
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
    it("removes skill + bridge and unregisters both from openclaw.json", () => {
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
        const bridgeDir = join(fakeHome, ".openclaw", "extensions", "chorus-bridge");
        expect(existsSync(skillDir)).toBe(true);
        expect(existsSync(bridgeDir)).toBe(true);

        // Then uninstall
        const { stdout, exitCode } = run(
          ["uninstall", "--target", "openclaw"],
          { env: { HOME: fakeHome } },
        );
        expect(exitCode).toBe(0);
        expect(stdout).toContain("Removed");
        expect(existsSync(skillDir)).toBe(false);
        expect(existsSync(bridgeDir)).toBe(false);

        // Verify both unregistered
        const config = JSON.parse(readFileSync(join(configDir, "openclaw.json"), "utf8"));
        expect(config.skills?.entries?.chorus).toBeUndefined();
        expect(config.plugins?.entries?.["chorus-bridge"]).toBeUndefined();
      } finally {
        rmSync(fakeHome, { recursive: true, force: true });
      }
    });
  });
});
