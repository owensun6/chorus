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

const CHORUS_HOME = join(homedir(), ".chorus");
const AGENTS_DIR = join(CHORUS_HOME, "agents");
const CONFIG_PATH = join(CHORUS_HOME, "config.json");
const WORKSPACE_CRED_PATH = join(homedir(), ".openclaw", "workspace", "chorus-credentials.json");

const args = process.argv.slice(2);
const command = args[0];

function getFlag(name) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
}

function resolveTargetDir(target) {
  if (target === "openclaw") return join(homedir(), ".openclaw", "skills", "chorus");
  if (target === "claude-user") return join(homedir(), ".claude", "skills", "chorus");
  if (target === "claude-project") return join(process.cwd(), ".claude", "skills", "chorus");
  return join(process.cwd(), "chorus");
}

function resolveBridgeDir() {
  return join(homedir(), ".openclaw", "extensions", "chorus-bridge");
}

function copySkillFiles(targetDir, lang) {
  const templateDir = join(__dirname, "templates", lang);
  const sharedDir = join(__dirname, "templates", "shared");
  const protocolFile = lang === "en" ? "PROTOCOL.md" : `PROTOCOL.${lang}.md`;
  const skillFile = lang === "en" ? "SKILL.md" : `SKILL.${lang}.md`;

  mkdirSync(targetDir, { recursive: true });
  mkdirSync(join(targetDir, "examples"), { recursive: true });

  writeFileSync(join(targetDir, "PROTOCOL.md"), readFileSync(join(templateDir, protocolFile)));
  writeFileSync(join(targetDir, "SKILL.md"), readFileSync(join(templateDir, skillFile)));
  writeFileSync(join(targetDir, "TRANSPORT.md"), readFileSync(join(sharedDir, "TRANSPORT.md")));
  writeFileSync(join(targetDir, "envelope.schema.json"), readFileSync(join(sharedDir, "envelope.schema.json")));
  cpSync(join(sharedDir, "examples"), join(targetDir, "examples"), { recursive: true });
}

function registerOpenClaw() {
  const configPath = join(homedir(), ".openclaw", "openclaw.json");
  if (!existsSync(configPath)) {
    console.error(`\nERROR: OpenClaw config not found at ${configPath}`);
    console.error(`\nPossible causes:`);
    console.error(`  1. OpenClaw is not installed — install it first: https://openclaw.com`);
    console.error(`  2. OpenClaw config is in a non-standard location`);
    console.error(`\nTroubleshooting: https://github.com/owensun6/chorus/blob/main/docs/distribution/openclaw-install.md#troubleshooting`);
    return false;
  }
  const config = JSON.parse(readFileSync(configPath, "utf8"));

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

  writeFileSync(configPath, JSON.stringify(config, null, 4));
  return true;
}

function unregisterOpenClaw() {
  const configPath = join(homedir(), ".openclaw", "openclaw.json");
  if (!existsSync(configPath)) return false;
  const config = JSON.parse(readFileSync(configPath, "utf8"));
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

  if (changed) {
    writeFileSync(configPath, JSON.stringify(config, null, 4));
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
    writeFileSync(join(bridgeDir, file), readFileSync(src));
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
  let count = 0;
  if (existsSync(WORKSPACE_CRED_PATH)) {
    try {
      const cfg = JSON.parse(readFileSync(WORKSPACE_CRED_PATH, "utf8"));
      if (cfg?.agent_id && cfg?.api_key && cfg?.hub_url) count++;
    } catch { /* skip malformed */ }
  }
  if (existsSync(AGENTS_DIR)) {
    const files = readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      try {
        const cfg = JSON.parse(readFileSync(join(AGENTS_DIR, file), "utf8"));
        if (cfg?.agent_id && cfg?.api_key && cfg?.hub_url) count++;
      } catch { /* skip malformed */ }
    }
  }
  if (count === 0 && existsSync(CONFIG_PATH)) {
    try {
      const cfg = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
      if (cfg?.agent_id && cfg?.api_key && cfg?.hub_url) count++;
    } catch { /* skip malformed */ }
  }
  return count;
}

function ensureChorusDirs() {
  mkdirSync(join(CHORUS_HOME, "history"), { recursive: true });
  mkdirSync(AGENTS_DIR, { recursive: true });
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
    const oclawConfigPath = join(homedir(), ".openclaw", "openclaw.json");
    if (!existsSync(oclawConfigPath)) {
      console.error(`\nERROR: OpenClaw config not found at ${oclawConfigPath}`);
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

    // Report activation readiness
    const configCount = countAgentConfigs();
    if (configCount > 0) {
      console.log(`✓ ${configCount} agent config(s) found — bridge will activate on next OpenClaw start`);
    } else {
      console.log(`\n⚠ No agent configs found yet. Bridge is installed but will start in standby mode.`);
      console.log(`  To activate: register your agent on the hub, then save credentials to:`);
      console.log(`    ${WORKSPACE_CRED_PATH}  (primary — bridge watches this path)`);
      console.log(`    ${AGENTS_DIR}/<name>.json  (also supported)`);
      console.log(`  File format: {"agent_id":"...","api_key":"ca_...","hub_url":"https://agchorus.com"}`);
    }

    console.log(`\nNext: verify installation`);
    console.log(`  npx @chorus-protocol/skill verify --target openclaw`);
  } else {
    console.log(`\nFiles created:`);
    console.log(`  PROTOCOL.md      — Protocol specification`);
    console.log(`  SKILL.md         — Agent learning document`);
    console.log(`  TRANSPORT.md     — Default transport profile (optional)`);
    console.log(`  envelope.schema.json`);
    console.log(`  examples/`);
    console.log(`\nGive your agent SKILL.md to teach it the Chorus protocol.`);
  }

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
      console.error(`\n  Run: npx @chorus-protocol/skill init --target ${target}`);
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
        console.error(`\n  Run: npx @chorus-protocol/skill init --target openclaw`);
        process.exit(1);
      }
      const missingBridge = BRIDGE_REQUIRED_FILES.filter(f => !existsSync(join(bridgeDir, f)));
      if (missingBridge.length > 0) {
        console.error(`✗ chorus-bridge incomplete — missing: ${missingBridge.join(", ")}`);
        console.error(`\n  Run: npx @chorus-protocol/skill uninstall --target openclaw && npx @chorus-protocol/skill init --target openclaw`);
        process.exit(1);
      }
      console.log(`✓ chorus-bridge complete (${BRIDGE_REQUIRED_FILES.length} files)`);

      // Check 3: openclaw.json has skill + bridge registered
      const configPath = join(homedir(), ".openclaw", "openclaw.json");
      if (!existsSync(configPath)) {
        console.error(`✗ openclaw.json not found at ${configPath}`);
        process.exit(1);
      }
      const config = JSON.parse(readFileSync(configPath, "utf8"));
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
  console.log(`  chorus-skill verify --target openclaw`);
  console.log(`  chorus-skill verify --envelope '<json>'`);
  console.log(`  chorus-skill uninstall --target openclaw`);
  console.log(`\nExamples:`);
  console.log(`  npx @chorus-protocol/skill init --target openclaw      # Install`);
  console.log(`  npx @chorus-protocol/skill verify --target openclaw    # Verify installation`);
  console.log(`  npx @chorus-protocol/skill init --target openclaw --lang zh-CN`);

  if (args.includes("--help-all")) {
    console.log(`\nAlternative targets (advanced):`);
    console.log(`  --target local           Copy to ./chorus (manual integration)`);
    console.log(`  --target claude-user     Install to ~/.claude/skills/chorus`);
    console.log(`  --target claude-project  Install to ./.claude/skills/chorus`);
  } else {
    console.log(`\nRun with --help-all to see alternative install targets.`);
  }
}
