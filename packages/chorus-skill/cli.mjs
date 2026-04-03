#!/usr/bin/env node

import { readFileSync, mkdirSync, writeFileSync, existsSync, cpSync, rmSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8"));

const LANGS = ["en", "zh-CN"];
const DEFAULT_LANG = "en";
const TARGETS = ["local", "openclaw", "claude-user", "claude-project"];
const TEMPLATE_PACKAGE_SPEC_TOKEN = "__CHORUS_SKILL_PACKAGE_SPEC__";

const CHORUS_HOME = join(homedir(), ".chorus");
const AGENTS_DIR = join(CHORUS_HOME, "agents");
const CONFIG_PATH = join(CHORUS_HOME, "config.json");
const OPENCLAW_DIR = join(homedir(), ".openclaw");
const OPENCLAW_CONFIG_PATH = join(OPENCLAW_DIR, "openclaw.json");
const OPENCLAW_WORKSPACE_DIR = join(OPENCLAW_DIR, "workspace");
const WORKSPACE_CRED_PATH = join(OPENCLAW_WORKSPACE_DIR, "chorus-credentials.json");
const RESTART_GATE_PATH = join(CHORUS_HOME, "restart-consent.json");
const RESTART_GATE_TOOL = "gateway";
const RESTART_PROOF_FILENAME = "chorus-restart-proof.json";
const ACTIVATION_PROOF_SOURCE = "chorus-bridge/runtime-v2 activateBridge";
const EXPLICIT_RESTART_APPROVALS = new Set([
  "yes",
  "restart now",
  "please restart",
  "go ahead and restart",
  "restart",
  "现在重启",
  "现在重启吧",
  "重启",
  "好",
  "好的",
  "可以",
  "可以重启",
]);

const args = process.argv.slice(2);
const command = args[0];

function getFlag(name) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
}

function readJSON(jsonPath) {
  return JSON.parse(readFileSync(jsonPath, "utf8"));
}

function writeJSON(jsonPath, value) {
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(value, null, 4));
}

function resolveHelperPackageSpec(version = pkg.version) {
  return `${pkg.name}@${version}`;
}

function buildHelperCommand(subcommand, gate = null) {
  const version = gate?.packageVersion || pkg.version;
  return `npx ${resolveHelperPackageSpec(version)} ${subcommand}`;
}

function normalizeApprovalText(text) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function isExplicitRestartApproval(text) {
  return EXPLICIT_RESTART_APPROVALS.has(normalizeApprovalText(text));
}

function readRestartGate() {
  if (!existsSync(RESTART_GATE_PATH)) return null;
  return readJSON(RESTART_GATE_PATH);
}

function writeRestartGate(state) {
  writeJSON(RESTART_GATE_PATH, state);
}

function removeRestartGate() {
  rmSync(RESTART_GATE_PATH, { force: true });
}

function resolveCheckpointPath(workspaceDir) {
  return join(workspaceDir, "chorus-restart-checkpoint.md");
}

function resolveRestartProofPath(workspaceDir) {
  return join(workspaceDir, RESTART_PROOF_FILENAME);
}

function resolveAgentStateDir(agentId) {
  const shortName = String(agentId).split("@")[0];
  return join(CHORUS_HOME, "state", shortName);
}

function resolveActivationProofPath(agentId) {
  return join(resolveAgentStateDir(agentId), `activation-proof.${agentId}.json`);
}

function formatCheckpointValue(value) {
  return String(value ?? "").replace(/\r?\n+/g, " ").trim();
}

function buildRestartCheckpoint(fields) {
  return [
    `restart_required_for: ${formatCheckpointValue(fields.restartRequiredFor)}`,
    `user_goal: ${formatCheckpointValue(fields.userGoal)}`,
    `current_identity: ${formatCheckpointValue(fields.currentIdentity)}`,
    `completed_steps: ${formatCheckpointValue(fields.completedSteps)}`,
    `next_step_after_restart: ${formatCheckpointValue(fields.nextStepAfterRestart)}`,
    `pending_user_decision: restart_now`,
    `resume_message: ${formatCheckpointValue(fields.resumeMessage)}`,
    "",
  ].join("\n");
}

function ensureToolDenyList(config) {
  if (!config.tools) config.tools = {};
  if (!Array.isArray(config.tools.deny)) config.tools.deny = [];
  return config.tools.deny;
}

function readOpenClawConfig() {
  return readJSON(OPENCLAW_CONFIG_PATH);
}

function isValidAgentConfig(config) {
  return Boolean(config?.agent_id && config?.api_key && config?.hub_url);
}

function loadValidAgentConfigs() {
  const configs = [];

  if (existsSync(WORKSPACE_CRED_PATH)) {
    try {
      const config = readJSON(WORKSPACE_CRED_PATH);
      if (isValidAgentConfig(config)) {
        configs.push({
          source: "workspace",
          path: WORKSPACE_CRED_PATH,
          agentId: config.agent_id,
        });
      }
    } catch { /* skip malformed */ }
  }

  if (existsSync(AGENTS_DIR)) {
    const files = readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      try {
        const config = readJSON(join(AGENTS_DIR, file));
        if (isValidAgentConfig(config)) {
          configs.push({
            source: "agents",
            path: join(AGENTS_DIR, file),
            agentId: config.agent_id,
          });
        }
      } catch { /* skip malformed */ }
    }
  }

  if (configs.length === 0 && existsSync(CONFIG_PATH)) {
    try {
      const config = readJSON(CONFIG_PATH);
      if (isValidAgentConfig(config)) {
        configs.push({
          source: "legacy",
          path: CONFIG_PATH,
          agentId: config.agent_id,
        });
      }
    } catch { /* skip malformed */ }
  }

  return configs;
}

function applyRestartGateBlock(config) {
  const deny = ensureToolDenyList(config);
  const alreadyDenied = deny.includes(RESTART_GATE_TOOL);
  if (!alreadyDenied) deny.push(RESTART_GATE_TOOL);
  return { alreadyDenied };
}

function restoreRestartGateBlock(config, gate) {
  if (gate?.hadGatewayToolDenied) return;
  const deny = config.tools?.deny;
  if (!Array.isArray(deny)) return;
  const nextDeny = deny.filter((entry) => entry !== RESTART_GATE_TOOL);
  if (nextDeny.length > 0) {
    config.tools.deny = nextDeny;
    return;
  }
  delete config.tools.deny;
  if (Object.keys(config.tools).length === 0) {
    delete config.tools;
  }
}

function resolveTargetDir(target) {
  if (target === "openclaw") return join(homedir(), ".openclaw", "skills", "chorus");
  if (target === "claude-user") return join(homedir(), ".claude", "skills", "chorus");
  if (target === "claude-project") return join(process.cwd(), ".claude", "skills", "chorus");
  return join(process.cwd(), "chorus");
}

function renderTemplateFile(sourcePath) {
  const content = readFileSync(sourcePath, "utf8");
  return content.split(TEMPLATE_PACKAGE_SPEC_TOKEN).join(resolveHelperPackageSpec());
}

function resolveBridgeDir() {
  return join(OPENCLAW_DIR, "extensions", "chorus-bridge");
}

function copySkillFiles(targetDir, lang) {
  const templateDir = join(__dirname, "templates", lang);
  const sharedDir = join(__dirname, "templates", "shared");
  const protocolFile = lang === "en" ? "PROTOCOL.md" : `PROTOCOL.${lang}.md`;
  const skillFile = lang === "en" ? "SKILL.md" : `SKILL.${lang}.md`;

  mkdirSync(targetDir, { recursive: true });
  mkdirSync(join(targetDir, "examples"), { recursive: true });

  writeFileSync(join(targetDir, "PROTOCOL.md"), renderTemplateFile(join(templateDir, protocolFile)));
  writeFileSync(join(targetDir, "SKILL.md"), renderTemplateFile(join(templateDir, skillFile)));
  writeFileSync(join(targetDir, "TRANSPORT.md"), renderTemplateFile(join(sharedDir, "TRANSPORT.md")));
  writeFileSync(join(targetDir, "envelope.schema.json"), readFileSync(join(sharedDir, "envelope.schema.json")));
  cpSync(join(sharedDir, "examples"), join(targetDir, "examples"), { recursive: true });
}

function registerOpenClaw() {
  if (!existsSync(OPENCLAW_CONFIG_PATH)) {
    console.error(`\nERROR: OpenClaw config not found at ${OPENCLAW_CONFIG_PATH}`);
    console.error(`\nPossible causes:`);
    console.error(`  1. OpenClaw is not installed — install it first: https://openclaw.com`);
    console.error(`  2. OpenClaw config is in a non-standard location`);
    console.error(`\nTroubleshooting: https://github.com/owensun6/chorus/blob/main/docs/distribution/openclaw-install.md#troubleshooting`);
    return false;
  }
  const previousRaw = readFileSync(OPENCLAW_CONFIG_PATH, "utf8");
  const config = JSON.parse(previousRaw);
  const previousGate = readRestartGate();

  // Register skill
  if (!config.skills) config.skills = {};
  if (!config.skills.entries) config.skills.entries = {};
  config.skills.entries.chorus = { enabled: true };

  // Register bridge plugin
  if (!config.plugins) config.plugins = {};
  if (!config.plugins.entries) config.plugins.entries = {};
  config.plugins.entries["chorus-bridge"] = { enabled: true };
  if (!config.plugins.allow) config.plugins.allow = [];
  if (!config.plugins.allow.includes("chorus-bridge")) {
    config.plugins.allow.push("chorus-bridge");
  }

  const blockState = applyRestartGateBlock(config);
  const gateState = {
    version: 2,
    packageVersion: pkg.version,
    toolName: RESTART_GATE_TOOL,
    status: "armed",
    hadGatewayToolDenied: previousGate?.toolName === RESTART_GATE_TOOL
      ? previousGate.hadGatewayToolDenied === true
      : blockState.alreadyDenied,
    armedAt: new Date().toISOString(),
    checkpointPath: null,
    workspaceDir: null,
    currentIdentity: null,
    checkpointWrittenAt: null,
    approvedAt: null,
    completionProofPath: null,
    completionProofRecordedAt: null,
  };

  try {
    writeJSON(OPENCLAW_CONFIG_PATH, config);
    writeRestartGate(gateState);
  } catch (err) {
    writeFileSync(OPENCLAW_CONFIG_PATH, previousRaw);
    if (!previousGate) {
      removeRestartGate();
    } else {
      writeRestartGate(previousGate);
    }
    throw err;
  }
  return true;
}

function unregisterOpenClaw() {
  if (!existsSync(OPENCLAW_CONFIG_PATH)) {
    removeRestartGate();
    return false;
  }
  const config = readOpenClawConfig();
  const gate = readRestartGate();
  let changed = false;

  if (config.skills?.entries?.chorus) {
    delete config.skills.entries.chorus;
    changed = true;
  }
  if (config.plugins?.entries?.["chorus-bridge"]) {
    delete config.plugins.entries["chorus-bridge"];
    changed = true;
  }
  if (Array.isArray(config.plugins?.allow)) {
    const idx = config.plugins.allow.indexOf("chorus-bridge");
    if (idx !== -1) {
      config.plugins.allow.splice(idx, 1);
      changed = true;
    }
  }

  if (gate?.toolName === RESTART_GATE_TOOL) {
    const before = JSON.stringify(config.tools ?? null);
    restoreRestartGateBlock(config, gate);
    if (JSON.stringify(config.tools ?? null) !== before) {
      changed = true;
    }
    removeRestartGate();
  }

  if (changed) {
    writeJSON(OPENCLAW_CONFIG_PATH, config);
  }
  return changed;
}

const BRIDGE_REQUIRED_FILES = [
  "index.ts",
  "runtime-v2.ts",
  "guard.ts",
  "resolve.ts",
  "relay.ts",
  "router-hook.ts",
  "openclaw.plugin.json",
  "package.json",
  "runtime/types.ts",
  "runtime/route-key.ts",
  "runtime/shared-types.ts",
  "runtime/shared-log.ts",
  "runtime/state.ts",
  "runtime/hub-client.ts",
  "runtime/inbound.ts",
  "runtime/outbound.ts",
  "runtime/recovery.ts",
];

function installBridge() {
  const bridgeDir = resolveBridgeDir();
  const templateDir = join(__dirname, "templates", "bridge");
  mkdirSync(bridgeDir, { recursive: true });
  for (const file of BRIDGE_REQUIRED_FILES) {
    const src = join(templateDir, file);
    if (!existsSync(src)) {
      console.error(`✗ Bridge template missing: ${file}`);
      process.exit(1);
    }
    const dest = join(bridgeDir, file);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, readFileSync(src));
  }
}

function removeBridge() {
  const bridgeDir = resolveBridgeDir();
  if (!existsSync(bridgeDir)) return false;
  rmSync(bridgeDir, { recursive: true });
  return true;
}

// Bridge reads agent configs from (in priority order):
//   1. ~/.openclaw/workspace/chorus-credentials.json  (workspace — primary)
//   2. ~/.chorus/agents/*.json                        (multi-agent — compat)
//   3. ~/.chorus/config.json                          (legacy single — compat)
// Returns count of valid configs found.
function countAgentConfigs() {
  return loadValidAgentConfigs().length;
}

function ensureChorusDirs() {
  mkdirSync(join(CHORUS_HOME, "history"), { recursive: true });
  mkdirSync(AGENTS_DIR, { recursive: true });
}

function describeRestartGateStatus(status) {
  if (status === "awaiting_approval") return "checkpoint written; explicit approval still required";
  if (status === "approved") return "approved; waiting for post-restart proof + recovery completion";
  return "fresh install pending checkpoint + approval";
}

function selectProofAgent(gate) {
  const validConfigs = loadValidAgentConfigs();
  const checkpointIdentity = gate?.currentIdentity && gate.currentIdentity !== "unknown"
    ? gate.currentIdentity
    : null;
  const workspaceConfig = validConfigs.find((config) => config.source === "workspace");
  const matchedConfig = checkpointIdentity
    ? validConfigs.find((config) => config.agentId === checkpointIdentity) || null
    : null;

  if (checkpointIdentity) {
    return {
      source: matchedConfig?.source || "checkpoint",
      path: matchedConfig?.path || gate.checkpointPath,
      agentId: checkpointIdentity,
      checkpointIdentity,
      workspaceConfig: workspaceConfig || null,
    };
  }

  if (workspaceConfig) {
    return {
      ...workspaceConfig,
      checkpointIdentity: null,
      workspaceConfig,
    };
  }

  if (validConfigs.length === 1) {
    return {
      ...validConfigs[0],
      checkpointIdentity: null,
      workspaceConfig: null,
    };
  }

  return null;
}

function collectPostRestartProof(gate) {
  const selectedAgent = selectProofAgent(gate);
  if (!selectedAgent) {
    const validConfigs = loadValidAgentConfigs();
    if (validConfigs.length > 1) {
      return {
        ok: false,
        reason: "multiple_agent_configs",
        detail: `multiple valid agent configs found (${validConfigs.map((config) => config.agentId).join(", ")}); checkpoint identity is missing or ambiguous`,
      };
    }
    return {
      ok: false,
      reason: "missing_agent_identity",
      detail: "no valid agent identity found for post-restart proof",
    };
  }

  if (
    selectedAgent.checkpointIdentity &&
    selectedAgent.workspaceConfig &&
    selectedAgent.workspaceConfig.agentId !== selectedAgent.checkpointIdentity
  ) {
    return {
      ok: false,
      reason: "workspace_identity_mismatch",
      detail: `workspace credential agent_id ${selectedAgent.workspaceConfig.agentId} does not match checkpoint identity ${selectedAgent.checkpointIdentity}`,
      checkpointIdentity: selectedAgent.checkpointIdentity,
      resolvedProofAgentId: selectedAgent.workspaceConfig.agentId,
    };
  }

  const activationProofPath = resolveActivationProofPath(selectedAgent.agentId);
  if (!existsSync(activationProofPath)) {
    return {
      ok: false,
      reason: "missing_activation_proof",
      detail: `bridge activation proof missing at ${activationProofPath}`,
      agentId: selectedAgent.agentId,
      activationProofPath,
      checkpointIdentity: selectedAgent.checkpointIdentity || null,
      resolvedProofAgentId: selectedAgent.agentId,
    };
  }

  let activationProof;
  try {
    activationProof = readJSON(activationProofPath);
  } catch (err) {
    return {
      ok: false,
      reason: "invalid_activation_proof",
      detail: `bridge activation proof is unreadable at ${activationProofPath}: ${err.message}`,
      agentId: selectedAgent.agentId,
      activationProofPath,
      checkpointIdentity: selectedAgent.checkpointIdentity || null,
      resolvedProofAgentId: selectedAgent.agentId,
    };
  }

  if (activationProof?.agent_id !== selectedAgent.agentId || !activationProof?.activated_at) {
    return {
      ok: false,
      reason: "invalid_activation_proof",
      detail: `bridge activation proof is incomplete at ${activationProofPath}`,
      agentId: selectedAgent.agentId,
      activationProofPath,
      checkpointIdentity: selectedAgent.checkpointIdentity || null,
      resolvedProofAgentId: selectedAgent.agentId,
    };
  }

  if (gate?.approvedAt && activationProof.activated_at < gate.approvedAt) {
    return {
      ok: false,
      reason: "stale_activation_proof",
      detail: `bridge activation proof predates approval (${activationProof.activated_at} < ${gate.approvedAt})`,
      agentId: selectedAgent.agentId,
      activationProofPath,
      checkpointIdentity: selectedAgent.checkpointIdentity || null,
      resolvedProofAgentId: selectedAgent.agentId,
    };
  }

  return {
    ok: true,
    agentId: selectedAgent.agentId,
    activationProofPath,
    activationProof,
    selectedSource: selectedAgent.source,
    checkpointIdentity: selectedAgent.checkpointIdentity || null,
    resolvedProofAgentId: selectedAgent.agentId,
  };
}

if (command === "init") {
  const lang = getFlag("--lang") || DEFAULT_LANG;
  const target = getFlag("--target") || "local";

  if (!LANGS.includes(lang)) {
    console.error(`Unsupported language: ${lang}. Available: ${LANGS.join(", ")}`);
    process.exit(1);
  }

  if (!TARGETS.includes(target)) {
    console.error(`Unsupported target: ${target}. Available: ${TARGETS.join(", ")}`);
    process.exit(1);
  }

  const targetDir = resolveTargetDir(target);

  if (existsSync(targetDir)) {
    console.error(`Directory "${targetDir}" already exists. Remove it first or use "chorus-skill uninstall --target ${target}".`);
    process.exit(1);
  }

  if (target === "openclaw") {
    // Pre-flight: verify openclaw.json is readable (but don't write to it yet)
    if (!existsSync(OPENCLAW_CONFIG_PATH)) {
      console.error(`\nERROR: OpenClaw config not found at ${OPENCLAW_CONFIG_PATH}`);
      console.error(`\nPossible causes:`);
      console.error(`  1. OpenClaw is not installed — install it first: https://openclaw.com`);
      console.error(`  2. OpenClaw config is in a non-standard location`);
      console.error(`\nTroubleshooting: https://github.com/owensun6/chorus/blob/main/docs/distribution/openclaw-install.md#troubleshooting`);
      process.exit(1);
    }
  }

  // === Phase 1: Write all files (no config mutation yet) ===

  copySkillFiles(targetDir, lang);
  console.log(`✓ Skill installed to ${targetDir} (${lang})`);

  if (target === "openclaw") {
    // Always install bridge — overwrite if already present (upgrade path)
    const bridgeDir = resolveBridgeDir();
    const isUpgrade = existsSync(bridgeDir);
    installBridge();
    console.log(`✓ Bridge ${isUpgrade ? "updated" : "installed"} at ${bridgeDir}`);
  }

  // Create ~/.chorus/agents/ and ~/.chorus/history/ so bridge Gate 1 passes
  ensureChorusDirs();
  console.log(`✓ Chorus dirs initialized (${CHORUS_HOME})`);

  // === Phase 2: Register in openclaw.json AFTER files are written ===
  // Rollback boundary: any failure in registerOpenClaw() (return false OR throw)
  // must clean up files written in Phase 1.

  if (target === "openclaw") {
    let registered = false;
    try {
      registered = registerOpenClaw();
    } catch (err) {
      console.error(`\n✗ Registration error: ${err.message}`);
    }
    if (!registered) {
      rmSync(targetDir, { recursive: true, force: true });
      removeBridge();
      console.error(`✗ Rolled back skill and bridge files.`);
      process.exit(1);
    }
    console.log(`✓ Registered skill + bridge in ~/.openclaw/openclaw.json`);
    console.log(`✓ Restart consent gate armed — gateway tool blocked until checkpoint + explicit approval`);

    // Report activation readiness
    const configCount = countAgentConfigs();
    if (configCount > 0) {
      console.log(`✓ ${configCount} agent config(s) found — bridge can activate after consent-gated restart`);
    } else {
      console.log(`\n⚠ No agent configs found yet. Bridge is installed, but activation is still blocked on restart consent.`);
      console.log(`  To activate: register your agent on the hub, then save credentials to:`);
      console.log(`    ${WORKSPACE_CRED_PATH}  (primary — bridge watches this path)`);
      console.log(`    ${AGENTS_DIR}/<name>.json  (also supported)`);
      console.log(`  File format: {"agent_id":"...","api_key":"ca_...","hub_url":"https://agchorus.com"}`);
    }

    console.log(`\nNext: verify installation`);
    console.log(`  ${buildHelperCommand("verify --target openclaw")}`);
    console.log(`\nWhen restart is required, use the gate helper:`);
    console.log(`  ${buildHelperCommand("restart-consent status")}`);
  } else {
    console.log(`\nFiles created:`);
    console.log(`  PROTOCOL.md      — Protocol specification`);
    console.log(`  SKILL.md         — Agent learning document`);
    console.log(`  TRANSPORT.md     — Default transport profile (optional)`);
    console.log(`  envelope.schema.json`);
    console.log(`  examples/`);
    console.log(`\nGive your agent SKILL.md to teach it the Chorus protocol.`);
  }

} else if (command === "restart-consent") {
  const action = args[1];
  const gate = readRestartGate();

  if (!action || !["status", "request", "approve", "complete"].includes(action)) {
    console.error(`Usage:`);
    console.error(`  chorus-skill restart-consent status`);
    console.error(`  chorus-skill restart-consent request --workspace <dir> --restart-required-for <text> --user-goal <text> --current-identity <text> --completed-steps <text> --next-step-after-restart <text> --resume-message <text>`);
    console.error(`  chorus-skill restart-consent approve --reply <text>`);
    console.error(`  chorus-skill restart-consent complete`);
    process.exit(1);
  }

  if (action === "status") {
    if (!gate) {
      console.log(`✓ Restart consent gate not armed — no restart approval required.`);
      process.exit(0);
    }
    console.log(`✗ Restart consent gate active: ${gate.status}`);
    console.log(`  Status: ${describeRestartGateStatus(gate.status)}`);
    if (gate.workspaceDir) console.log(`  Workspace: ${gate.workspaceDir}`);
    if (gate.checkpointPath) console.log(`  Checkpoint: ${gate.checkpointPath}`);
    process.exit(1);
  }

  if (!gate) {
    console.log(`✓ Restart consent gate not armed — no restart approval required.`);
    process.exit(0);
  }

  if (action === "request") {
    const workspaceDir = getFlag("--workspace") || process.cwd();
    const restartRequiredFor = getFlag("--restart-required-for");
    const userGoal = getFlag("--user-goal");
    const currentIdentity = getFlag("--current-identity");
    const completedSteps = getFlag("--completed-steps");
    const nextStepAfterRestart = getFlag("--next-step-after-restart");
    const resumeMessage = getFlag("--resume-message");

    const required = [
      ["--restart-required-for", restartRequiredFor],
      ["--user-goal", userGoal],
      ["--current-identity", currentIdentity],
      ["--completed-steps", completedSteps],
      ["--next-step-after-restart", nextStepAfterRestart],
      ["--resume-message", resumeMessage],
    ].filter(([, value]) => !value);

    if (required.length > 0) {
      console.error(`✗ restart-consent request missing required flags: ${required.map(([name]) => name).join(", ")}`);
      process.exit(1);
    }

    const checkpointPath = resolveCheckpointPath(workspaceDir);
    mkdirSync(workspaceDir, { recursive: true });
    writeFileSync(checkpointPath, buildRestartCheckpoint({
      restartRequiredFor,
      userGoal,
      currentIdentity,
      completedSteps,
      nextStepAfterRestart,
      resumeMessage,
    }));

    writeRestartGate({
      ...gate,
      status: "awaiting_approval",
      workspaceDir,
      currentIdentity,
      checkpointPath,
      checkpointWrittenAt: new Date().toISOString(),
    });

    console.log(`✓ Restart checkpoint written: ${checkpointPath}`);
    console.error(`✗ Restart blocked pending explicit approval`);
    console.error(`  Ask the user: Chorus is installed. To make the bridge take effect, OpenClaw Gateway needs a restart. I saved the current task first. Do you want me to restart now?`);
    console.error(`  After an explicit yes, run: ${buildHelperCommand('restart-consent approve --reply "yes"', gate)}`);
    process.exit(1);
  }

  if (action === "approve") {
    const reply = getFlag("--reply");
    if (!reply) {
      console.error(`✗ restart-consent approve requires --reply <text>`);
      process.exit(1);
    }
    if (gate.status !== "awaiting_approval" || !gate.checkpointPath) {
      console.error(`✗ Restart approval blocked — checkpoint must be written first via restart-consent request`);
      process.exit(1);
    }
    if (!existsSync(gate.checkpointPath)) {
      console.error(`✗ Restart approval blocked — checkpoint missing at ${gate.checkpointPath}`);
      process.exit(1);
    }
    if (!isExplicitRestartApproval(reply)) {
      console.error(`✗ Restart remains blocked — explicit approval required`);
      console.error(`  Accepted examples: yes | restart now | 现在重启`);
      process.exit(1);
    }

    const config = readOpenClawConfig();
    restoreRestartGateBlock(config, gate);
    writeJSON(OPENCLAW_CONFIG_PATH, config);
    writeRestartGate({
      ...gate,
      status: "approved",
      approvedAt: new Date().toISOString(),
      approvalReply: reply,
    });

    console.log(`✓ Restart approved — gateway tool unlocked for this recovery step`);
    process.exit(0);
  }

  if (gate.status !== "approved") {
    console.error(`✗ Cannot complete restart recovery while gate status is "${gate.status}"`);
    process.exit(1);
  }

  const proofResult = collectPostRestartProof(gate);
  if (!proofResult.ok) {
    console.error(`✗ Restart recovery still blocked — post-restart proof missing`);
    console.error(`  ${proofResult.detail}`);
    if (proofResult.activationProofPath) {
      console.error(`  Expected runtime proof: ${proofResult.activationProofPath}`);
    }
    process.exit(1);
  }

  const completionProofPath = resolveRestartProofPath(gate.workspaceDir || process.cwd());
  writeJSON(completionProofPath, {
    schema_version: 1,
    package_name: pkg.name,
    package_version: gate.packageVersion || pkg.version,
    helper_package_spec: resolveHelperPackageSpec(gate.packageVersion || pkg.version),
    proof_recorded_at: new Date().toISOString(),
    gate_approved_at: gate.approvedAt,
    checkpoint_identity: gate.currentIdentity || null,
    resolved_proof_agent_id: proofResult.resolvedProofAgentId || proofResult.agentId,
    agent_id: proofResult.agentId,
    activation_proof_path: proofResult.activationProofPath,
    activation_proof: proofResult.activationProof,
    checkpoint_path: gate.checkpointPath,
    proof_source: ACTIVATION_PROOF_SOURCE,
  });

  if (gate.checkpointPath && existsSync(gate.checkpointPath)) {
    rmSync(gate.checkpointPath, { force: true });
  }
  removeRestartGate();
  console.log(`✓ Restart recovery completed — proof recorded at ${completionProofPath}`);
  console.log(`✓ Checkpoint cleared and gate closed`);
  process.exit(0);

} else if (command === "uninstall") {
  const target = getFlag("--target");

  if (!target || !TARGETS.includes(target) || target === "local") {
    console.error(`Usage: chorus-skill uninstall --target openclaw|claude-user|claude-project`);
    process.exit(1);
  }

  const targetDir = resolveTargetDir(target);

  if (!existsSync(targetDir)) {
    console.error(`Not installed at ${targetDir}`);
    process.exit(1);
  }

  rmSync(targetDir, { recursive: true });
  console.log(`Removed ${targetDir}`);

  if (target === "openclaw") {
    removeBridge();
    console.log(`Removed chorus-bridge`);
    const removed = unregisterOpenClaw();
    if (removed) {
      console.log(`Unregistered skill + bridge from ~/.openclaw/openclaw.json`);
    }
  }

} else if (command === "verify") {
  const envelopeJson = getFlag("--envelope");

  if (envelopeJson) {
    const schema = JSON.parse(readFileSync(join(__dirname, "envelope.schema.json"), "utf8"));

    // Minimal JSON Schema validator — covers the subset used by envelope.schema.json
    const validateField = (value, name, propSchema) => {
      const errors = [];
      if (propSchema.type === "string") {
        if (typeof value !== "string") { errors.push(`${name}: expected string, got ${typeof value}`); return errors; }
        if (propSchema.enum && !propSchema.enum.includes(value)) { errors.push(`${name}: must be one of [${propSchema.enum.join(", ")}], got "${value}"`); }
        if (propSchema.pattern && !new RegExp(propSchema.pattern).test(value)) { errors.push(`${name}: "${value}" does not match pattern ${propSchema.pattern}`); }
        const codePoints = [...value].length;
        if (propSchema.minLength != null && codePoints < propSchema.minLength) { errors.push(`${name}: too short (${codePoints} code points, min ${propSchema.minLength})`); }
        if (propSchema.maxLength != null && codePoints > propSchema.maxLength) { errors.push(`${name}: too long (${codePoints} code points, max ${propSchema.maxLength})`); }
      } else if (propSchema.type === "integer") {
        if (typeof value !== "number" || !Number.isInteger(value)) { errors.push(`${name}: expected integer, got ${typeof value}`); return errors; }
        if (propSchema.minimum != null && value < propSchema.minimum) { errors.push(`${name}: must be >= ${propSchema.minimum}, got ${value}`); }
      }
      return errors;
    };

    try {
      const envelope = JSON.parse(envelopeJson);
      if (typeof envelope !== "object" || envelope === null || Array.isArray(envelope)) {
        console.error(`✗ Invalid envelope — expected a JSON object`);
        process.exit(1);
      }

      const allErrors = [];
      const missing = (schema.required || []).filter((k) => envelope[k] === undefined || envelope[k] === null);
      if (missing.length > 0) {
        allErrors.push(`missing required fields: ${missing.join(", ")}`);
      }

      for (const [field, propSchema] of Object.entries(schema.properties || {})) {
        if (envelope[field] !== undefined && envelope[field] !== null) {
          allErrors.push(...validateField(envelope[field], field, propSchema));
        }
      }

      if (allErrors.length > 0) {
        console.error(`✗ Invalid envelope:\n  ${allErrors.join("\n  ")}`);
        process.exit(1);
      }
      console.log(`✓ Valid Chorus envelope (schema: ${schema.$id})`);
    } catch (e) {
      if (e.code === "ERR_MODULE_NOT_FOUND" || e.code === "ENOENT") throw e;
      console.error(`✗ Invalid JSON: ${e.message}`);
      process.exit(1);
    }
  } else {
    const target = getFlag("--target") || "openclaw";

    if (!TARGETS.includes(target)) {
      console.error(`✗ Unknown target: ${target}. Available: ${TARGETS.join(", ")}`);
      process.exit(1);
    }

    const targetDir = resolveTargetDir(target);
    const skillPath = join(targetDir, "SKILL.md");

    // Check 1: SKILL.md exists and is non-empty
    if (!existsSync(skillPath)) {
      console.error(`✗ SKILL.md not found at ${skillPath}`);
      console.error(`\n  Run: ${buildHelperCommand(`init --target ${target}`)}`);
      process.exit(1);
    }
    const stat = (await import("fs")).statSync(skillPath);
    if (stat.size === 0) {
      console.error(`✗ SKILL.md exists but is empty at ${skillPath}`);
      process.exit(1);
    }
    console.log(`✓ SKILL.md exists (${(stat.size / 1024).toFixed(1)} KB)`);

    if (target === "openclaw") {
      // Check 2: bridge required files are all present
      const bridgeDir = resolveBridgeDir();
      if (!existsSync(bridgeDir)) {
        console.error(`✗ chorus-bridge not found at ${bridgeDir}`);
        console.error(`\n  Run: ${buildHelperCommand("init --target openclaw")}`);
        process.exit(1);
      }
      const missingBridge = BRIDGE_REQUIRED_FILES.filter(f => !existsSync(join(bridgeDir, f)));
      if (missingBridge.length > 0) {
        console.error(`✗ chorus-bridge incomplete — missing: ${missingBridge.join(", ")}`);
        console.error(`\n  Run: ${buildHelperCommand("uninstall --target openclaw")} && ${buildHelperCommand("init --target openclaw")}`);
        process.exit(1);
      }
      console.log(`✓ chorus-bridge complete (${BRIDGE_REQUIRED_FILES.length} files)`);

      // Check 3: openclaw.json has skill + bridge registered
      if (!existsSync(OPENCLAW_CONFIG_PATH)) {
        console.error(`✗ openclaw.json not found at ${OPENCLAW_CONFIG_PATH}`);
        process.exit(1);
      }
      const config = readOpenClawConfig();
      if (config.skills?.entries?.chorus?.enabled === true) {
        console.log(`✓ openclaw.json: chorus skill enabled`);
      } else {
        console.error(`✗ openclaw.json: chorus skill not registered or not enabled`);
        process.exit(1);
      }
      if (config.plugins?.entries?.["chorus-bridge"]?.enabled === true) {
        console.log(`✓ openclaw.json: chorus-bridge plugin enabled`);
      } else {
        console.error(`✗ openclaw.json: chorus-bridge plugin not registered or not enabled`);
        process.exit(1);
      }

      // — Installation integrity passed —
      console.log(`\n✓ Installation integrity: all files present, skill and bridge registered.`);

      const restartGate = readRestartGate();
      if (restartGate) {
        console.error(`\n✗ Restart consent gate active — ${describeRestartGateStatus(restartGate.status)}`);
        if (restartGate.checkpointPath) {
          console.error(`  Checkpoint: ${restartGate.checkpointPath}`);
        } else {
          console.error(`  Write checkpoint first with:`);
          console.error(`    ${buildHelperCommand('restart-consent request --workspace <dir> --restart-required-for "gateway needs to load chorus-bridge plugin after install" --user-goal "<goal>" --current-identity "<agent_id|unknown>" --completed-steps "<what is done>" --next-step-after-restart "<first action>" --resume-message "<first sentence after resume>"', restartGate)}`);
        }
        if (restartGate.status === "awaiting_approval") {
          console.error(`  Approval helper: ${buildHelperCommand('restart-consent approve --reply "yes"', restartGate)}`);
        }
        process.exit(1);
      }

      // Check 4: activation readiness (determines bridge activation state)
      const configCount = countAgentConfigs();
      if (configCount > 0) {
        console.log(`✓ ${configCount} agent config(s) found — bridge will activate`);
        console.log(`\n✓ Activation ready — bridge ready.`);
      } else {
        console.error(`\n✗ Bridge standby — no valid agent credentials found`);
        console.error(`  To activate, save credentials to:`);
        console.error(`    ${WORKSPACE_CRED_PATH}  (primary — bridge watches this path)`);
        console.error(`    ${AGENTS_DIR}/<name>.json  (also supported)`);
        console.error(`  Format: {"agent_id":"...","api_key":"ca_...","hub_url":"https://agchorus.com"}`);
        console.error(`\n  Register on the hub first if you don't have credentials:`);
        console.error(`    curl -X POST https://agchorus.com/register -H "Content-Type: application/json" \\`);
        console.error(`      -d '{"agent_id":"name@agchorus","agent_card":{"card_version":"0.3","user_culture":"en","supported_languages":["en"]}}'`);
        process.exit(1);
      }
    } else {
      console.log(`\n✓ Installation verified.`);
    }
  }
} else {
  console.log(`@chorus-protocol/skill v${pkg.version}`);
  console.log(`\nUsage:`);
  console.log(`  chorus-skill init --target openclaw [--lang en|zh-CN]`);
  console.log(`  chorus-skill restart-consent status|request|approve|complete`);
  console.log(`  chorus-skill verify --target openclaw`);
  console.log(`  chorus-skill verify --envelope '<json>'`);
  console.log(`  chorus-skill uninstall --target openclaw`);
  console.log(`\nExamples:`);
  console.log(`  ${buildHelperCommand("init --target openclaw")}      # Install`);
  console.log(`  ${buildHelperCommand("restart-consent status")}      # Inspect restart gate`);
  console.log(`  ${buildHelperCommand("verify --target openclaw")}    # Verify installation`);
  console.log(`  ${buildHelperCommand("init --target openclaw --lang zh-CN")}`);

  if (args.includes("--help-all")) {
    console.log(`\nAlternative targets (advanced):`);
    console.log(`  --target local           Copy to ./chorus (manual integration)`);
    console.log(`  --target claude-user     Install to ~/.claude/skills/chorus`);
    console.log(`  --target claude-project  Install to ./.claude/skills/chorus`);
  } else {
    console.log(`\nRun with --help-all to see alternative install targets.`);
  }
}
