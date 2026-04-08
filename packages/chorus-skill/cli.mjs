#!/usr/bin/env node

import { readFileSync, mkdirSync, writeFileSync, existsSync, cpSync, rmSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import { execFileSync } from "child_process";

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
const WORKSPACE_CRED_FILENAME = "chorus-credentials.json";
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

function buildApprovedRestartInstructions(gate) {
  return [
    `Restart OpenClaw now outside the gateway tool path (relaunch the app/process; do not call gateway.restart).`,
    `After OpenClaw returns and bridge activation succeeds, run: ${buildHelperCommand("restart-consent complete", gate)}`,
  ];
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

function maybeInjectRestartCompleteFailure(stage) {
  if (process.env.CHORUS_DEBUG_RESTART_COMPLETE_FAIL_AT === stage) {
    throw new Error(`debug injected restart-consent complete failure at ${stage}`);
  }
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

// List per-agent OpenClaw workspaces (~/.openclaw/workspace-*/).
// Mirrors bridge runtime-v2.ts listPerAgentWorkspaceDirs() so `verify` output
// matches what the bridge will actually load at activation time.
function listPerAgentWorkspaceDirs() {
  if (!existsSync(OPENCLAW_DIR)) return [];
  let entries;
  try {
    entries = readdirSync(OPENCLAW_DIR);
  } catch {
    return [];
  }
  const out = [];
  for (const name of entries) {
    if (!name.startsWith("workspace-")) continue;
    const abs = join(OPENCLAW_DIR, name);
    try {
      if (statSync(abs).isDirectory()) out.push(abs);
    } catch { /* skip unstatable */ }
  }
  return out;
}

function loadValidAgentConfigs() {
  const configs = [];
  const seenAgentIds = new Set();

  function tryAdd(source, path) {
    if (!existsSync(path)) return;
    try {
      const config = readJSON(path);
      if (!isValidAgentConfig(config)) return;
      if (seenAgentIds.has(config.agent_id)) return;
      seenAgentIds.add(config.agent_id);
      configs.push({ source, path, agentId: config.agent_id });
    } catch { /* skip malformed */ }
  }

  tryAdd("workspace", WORKSPACE_CRED_PATH);

  // Per-agent OpenClaw workspaces — installer agents running in workspace-<name>/
  // write their credentials here rather than in the default workspace.
  for (const wsDir of listPerAgentWorkspaceDirs()) {
    tryAdd("workspace-per-agent", join(wsDir, WORKSPACE_CRED_FILENAME));
  }

  if (existsSync(AGENTS_DIR)) {
    const files = readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      tryAdd("agents", join(AGENTS_DIR, file));
    }
  }

  if (configs.length === 0) {
    tryAdd("legacy", CONFIG_PATH);
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

  // CRITICAL: OpenClaw treats `plugins.allow` as a strict allowlist that
  // also gates `channels.<name>` instances. If we push only "chorus-bridge"
  // into a previously empty/missing allow list, every existing enabled
  // channel (telegram, discord, openclaw-weixin, …) gets locked out at the
  // next supervisor restart — its provider never starts and the user loses
  // their primary inbound surface. (This is the IMPL-EXP03-04 root cause
  // discovered in EXP-03 Run 4: chorus install made MacBook's @Nannnnnno_bot
  // telegram channel disappear because the user's plugins.allow had never
  // contained "telegram" before.)
  //
  // Defensive merge: before adding chorus-bridge, scan `config.channels.*`
  // for enabled channel adapters and ensure each one is also present in
  // plugins.allow. This preserves the user's existing inbound surface
  // regardless of how their allow list was previously populated.
  const channelEntries = (config.channels && typeof config.channels === "object")
    ? config.channels
    : {};
  for (const [channelName, channelCfg] of Object.entries(channelEntries)) {
    if (!channelCfg || typeof channelCfg !== "object") continue;
    if (channelCfg.enabled === false) continue;
    if (!config.plugins.allow.includes(channelName)) {
      config.plugins.allow.push(channelName);
    }
  }

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

// Normalize macOS AppleLanguages entries like "zh-Hans-CN", "zh-Hans-US",
// "zh-Hant-TW", "en-US" into BCP 47 culture tags agents can use at
// registration: zh-Hans-* → zh-CN, zh-Hant-* → zh-TW, plain "xx-YY" preserved,
// bare "xx" preserved. Unknown shapes return null.
function normalizeAppleLanguageTag(raw) {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith("zh-Hans")) return "zh-CN";
  if (trimmed.startsWith("zh-Hant")) return "zh-TW";
  const m = trimmed.match(/^([a-z]{2,3})(?:-([A-Z]{2}))?$/);
  if (m) return m[2] ? `${m[1]}-${m[2]}` : m[1];
  return null;
}

// Normalize `LANG` / `LC_ALL` style values like "zh_CN.UTF-8", "en_US.UTF-8",
// "ja_JP", "en" into BCP 47 culture tags.
function normalizePosixLocale(raw) {
  if (typeof raw !== "string" || raw.length === 0) return null;
  const head = raw.split(".")[0].split("@")[0].trim();
  if (!head) return null;
  const m = head.match(/^([a-z]{2,3})(?:[_-]([A-Za-z]{2,4}))?$/);
  if (!m) return null;
  if (!m[2]) return m[1];
  return `${m[1]}-${m[2].toUpperCase()}`;
}

// Detect the user's preferred culture from OS-level signals. Returns
// `{ culture, source, rawDetection }` on success or `null` when no signal
// is available. Uses OS-native probes in priority order:
// 1. macOS: `defaults read -g AppleLanguages` (authoritative system-selected
//    interface language — reflects the user's actual choice, not terminal LANG)
// 2. Linux: `/etc/locale.conf` LANG field, then `locale` command
// 3. Windows: `(Get-Culture).Name` via PowerShell
// 4. Fallback: POSIX-style LANG / LC_ALL environment variables
// 5. Fallback: Node Intl API (derives from LANG, least reliable)
function detectUserCulture() {
  const platform = process.platform;

  // 1. macOS AppleLanguages
  if (platform === "darwin") {
    try {
      const out = execFileSync("defaults", ["read", "-g", "AppleLanguages"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const match = out.match(/"([A-Za-z-]+)"/);
      if (match) {
        const normalized = normalizeAppleLanguageTag(match[1]);
        if (normalized) {
          return {
            culture: normalized,
            source: "macOS AppleLanguages",
            rawDetection: match[1],
          };
        }
      }
    } catch { /* defaults unavailable or no entry */ }
  }

  // 2. Linux locale.conf
  if (platform === "linux") {
    try {
      if (existsSync("/etc/locale.conf")) {
        const content = readFileSync("/etc/locale.conf", "utf8");
        const m = content.match(/^LANG=(.+)$/m);
        if (m) {
          const normalized = normalizePosixLocale(m[1].replace(/^["']|["']$/g, ""));
          if (normalized) {
            return {
              culture: normalized,
              source: "Linux /etc/locale.conf",
              rawDetection: m[1],
            };
          }
        }
      }
    } catch { /* file unreadable */ }
  }

  // 3. Windows Get-Culture
  if (platform === "win32") {
    try {
      const out = execFileSync("powershell", ["-NoProfile", "-Command", "(Get-Culture).Name"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      if (out) {
        return {
          culture: out,
          source: "Windows Get-Culture",
          rawDetection: out,
        };
      }
    } catch { /* powershell unavailable */ }
  }

  // 4. Fallback: LANG / LC_ALL env vars
  const envLang = process.env.LC_ALL || process.env.LANG;
  if (envLang) {
    const normalized = normalizePosixLocale(envLang);
    if (normalized && normalized !== "en" && normalized !== "C" && normalized !== "POSIX") {
      return {
        culture: normalized,
        source: `env ${process.env.LC_ALL ? "LC_ALL" : "LANG"}`,
        rawDetection: envLang,
      };
    }
  }

  return null;
}

const OPERATOR_HINTS_PATH = join(CHORUS_HOME, "operator-hints.json");

// Write the detected culture signal to a well-known file under ~/.chorus/.
// Agents are expected to read this at registration time as the highest-
// priority source for `user_culture` (see SKILL.md Activation sequence).
// If detection failed (`detection === null`), write a hints file that
// records the negative result so agents know detection was attempted.
function writeOperatorHints(detection) {
  const payload = {
    schema_version: 1,
    written_at: new Date().toISOString(),
    detection_performed: true,
    suggested_user_culture: detection?.culture ?? null,
    detection_source: detection?.source ?? null,
    raw_detection: detection?.rawDetection ?? null,
    platform: process.platform,
    notes: detection
      ? "This is the highest-priority hint for user_culture when registering your chorus agent on the hub. See SKILL.md Activation sequence for the full priority ordering."
      : "Automatic detection found no reliable OS-level culture signal. Fall back to lower-priority inference sources (recent conversation language, OpenClaw user config, interactive prompt).",
  };
  mkdirSync(CHORUS_HOME, { recursive: true });
  writeFileSync(OPERATOR_HINTS_PATH, JSON.stringify(payload, null, 2));
  return payload;
}

function describeRestartGateStatus(status) {
  if (status === "awaiting_approval") return "checkpoint written; explicit approval still required";
  if (status === "approved") return "approved; restart OpenClaw outside the gateway tool path, then finish recovery";
  if (status === "completing") return "restart observed; cleanup is resumable via restart-consent complete";
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

  // Detect user_culture from OS-level signals and write ~/.chorus/operator-hints.json.
  // Agents must read this file at registration time — it is the most
  // authoritative inference source for user_culture (see SKILL.md).
  const cultureUserFlag = getFlag("--user-culture");
  let cultureDetection = null;
  if (cultureUserFlag) {
    cultureDetection = { culture: cultureUserFlag, source: "--user-culture flag", rawDetection: cultureUserFlag };
  } else {
    cultureDetection = detectUserCulture();
  }
  const hintsPayload = writeOperatorHints(cultureDetection);
  if (cultureDetection) {
    console.log(`✓ Detected user_culture hint: ${cultureDetection.culture} (from ${cultureDetection.source})`);
    console.log(`  Written to ${OPERATOR_HINTS_PATH}`);
    console.log(`  Agents MUST use this when registering. If wrong, pass --user-culture <locale> on next init, or edit the file.`);
  } else {
    console.log(`⚠ No reliable user_culture signal detected on this platform (${process.platform}).`);
    console.log(`  Agents will need to infer from other sources (recent conversation, OpenClaw user config, ask user).`);
    console.log(`  Override with: chorus-skill init --target openclaw --user-culture <locale>  (e.g. zh-CN, en, ja)`);
  }

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
    console.log(`✓ Restart consent gate armed — gateway tool remains blocked until restart recovery is completed`);

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
    if (gate.status === "approved" || gate.status === "completing") {
      for (const line of buildApprovedRestartInstructions(gate)) {
        console.log(`  ${line}`);
      }
    }
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

    // IMPL-EXP03-09: re-requesting invalidates any prior approval.
    // Without this reset, calling `request` a second time (e.g. after a
    // previous `approve` succeeded but needs re-checkpointing) would leave
    // the prior `approvedAt` + `approvalReply` fields in place while the
    // status gets demoted back to "awaiting_approval", producing the
    // inconsistent half-state observed on MacBook in EXP-03 Run 4.
    writeRestartGate({
      ...gate,
      status: "awaiting_approval",
      workspaceDir,
      currentIdentity,
      checkpointPath,
      checkpointWrittenAt: new Date().toISOString(),
      approvedAt: null,
      approvalReply: null,
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

    // IMPL-EXP03-09 recovery path: detect a pre-existing half-state gate
    // (approvedAt or approvalReply set from a prior buggy CLI version, but
    // status still < "approved"). A checkpoint must still exist for recovery
    // to be valid — without a checkpoint we have no proof the agent actually
    // prepared for restart.
    const hasStaleApprovalFields = Boolean(gate.approvedAt || gate.approvalReply);
    const isBelowApproved = gate.status !== "approved";
    const hasCheckpoint = Boolean(gate.checkpointPath) && existsSync(gate.checkpointPath);
    if (hasStaleApprovalFields && isBelowApproved && hasCheckpoint) {
      if (!isExplicitRestartApproval(reply)) {
        console.error(`✗ Restart remains blocked — explicit approval required (recovery path detected)`);
        console.error(`  Accepted examples: yes | restart now | 现在重启`);
        process.exit(1);
      }
      writeRestartGate({
        ...gate,
        status: "approved",
        approvedAt: gate.approvedAt || new Date().toISOString(),
        approvalReply: gate.approvalReply || reply,
      });
      console.log(`✓ Recovered from previously-inconsistent gate state — status transitioned to approved`);
      console.log(`  (Pre-existing approvedAt=${gate.approvedAt || "<new>"}, approvalReply=${gate.approvalReply || "<new>"})`);
      for (const line of buildApprovedRestartInstructions(gate)) {
        console.log(`  ${line}`);
      }
      process.exit(0);
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

    writeRestartGate({
      ...gate,
      status: "approved",
      approvedAt: new Date().toISOString(),
      approvalReply: reply,
    });

    console.log(`✓ Restart approved — consent recorded; restart OpenClaw outside the gateway tool path`);
    for (const line of buildApprovedRestartInstructions(gate)) {
      console.log(`  ${line}`);
    }
    process.exit(0);
  }

  if (!["approved", "completing"].includes(gate.status)) {
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

  const completionProofPath = gate.completionProofPath || resolveRestartProofPath(gate.workspaceDir || process.cwd());
  const completingGate = {
    ...gate,
    status: "completing",
    completionProofPath,
    completionProofRecordedAt: new Date().toISOString(),
  };

  try {
    writeRestartGate(completingGate);
    writeJSON(completionProofPath, {
      schema_version: 1,
      package_name: pkg.name,
      package_version: gate.packageVersion || pkg.version,
      helper_package_spec: resolveHelperPackageSpec(gate.packageVersion || pkg.version),
      proof_recorded_at: completingGate.completionProofRecordedAt,
      gate_approved_at: gate.approvedAt,
      checkpoint_identity: gate.currentIdentity || null,
      resolved_proof_agent_id: proofResult.resolvedProofAgentId || proofResult.agentId,
      agent_id: proofResult.agentId,
      activation_proof_path: proofResult.activationProofPath,
      activation_proof: proofResult.activationProof,
      checkpoint_path: gate.checkpointPath,
      proof_source: ACTIVATION_PROOF_SOURCE,
    });
    maybeInjectRestartCompleteFailure("after_proof_write");

    const config = readOpenClawConfig();
    restoreRestartGateBlock(config, gate);
    writeJSON(OPENCLAW_CONFIG_PATH, config);
    maybeInjectRestartCompleteFailure("after_config_write");

    if (gate.checkpointPath && existsSync(gate.checkpointPath)) {
      rmSync(gate.checkpointPath, { force: true });
    }
    maybeInjectRestartCompleteFailure("after_checkpoint_clear");

    removeRestartGate();
  } catch (err) {
    console.error(`✗ Restart recovery cleanup failed — ${err.message}`);
    console.error(`  Fix the underlying issue, then retry: ${buildHelperCommand("restart-consent complete", completingGate)}`);
    process.exit(1);
  }
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
        } else if (restartGate.status === "approved" || restartGate.status === "completing") {
          for (const line of buildApprovedRestartInstructions(restartGate)) {
            console.error(`  ${line}`);
          }
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
        console.error(`    # Replace <YOUR_USER_CULTURE> with your user's BCP 47 tag (e.g. en, zh-CN, ja).`);
        console.error(`    # Do NOT copy the placeholders verbatim — wrong culture breaks every subsequent message.`);
        console.error(`    curl -X POST https://agchorus.com/register -H "Content-Type: application/json" \\`);
        console.error(`      -d '{"agent_id":"name@agchorus","agent_card":{"card_version":"0.3","user_culture":"<YOUR_USER_CULTURE>","supported_languages":["<YOUR_USER_LANG>"]}}'`);
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
