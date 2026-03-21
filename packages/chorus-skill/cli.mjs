#!/usr/bin/env node

import { readFileSync, mkdirSync, writeFileSync, existsSync, cpSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8"));

const LANGS = ["en", "zh-CN"];
const DEFAULT_LANG = "en";
const TARGETS = ["local", "openclaw", "claude-user", "claude-project"];

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
  if (!config.skills) config.skills = {};
  if (!config.skills.entries) config.skills.entries = {};
  config.skills.entries.chorus = { enabled: true };
  writeFileSync(configPath, JSON.stringify(config, null, 4));
  return true;
}

function unregisterOpenClaw() {
  const configPath = join(homedir(), ".openclaw", "openclaw.json");
  if (!existsSync(configPath)) return false;
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  if (config.skills?.entries?.chorus) {
    delete config.skills.entries.chorus;
    writeFileSync(configPath, JSON.stringify(config, null, 4));
    return true;
  }
  return false;
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

  copySkillFiles(targetDir, lang);

  console.log(`✓ Files installed to ${targetDir} (${lang})`);

  if (target === "openclaw") {
    const registered = registerOpenClaw();
    if (!registered) {
      process.exit(1);
    }
    console.log(`✓ Registered in ~/.openclaw/openclaw.json`);
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

  const { rmSync } = await import("fs");
  rmSync(targetDir, { recursive: true });
  console.log(`Removed ${targetDir}`);

  if (target === "openclaw") {
    const removed = unregisterOpenClaw();
    if (removed) {
      console.log(`  Unregistered from ~/.openclaw/openclaw.json`);
    }
  }

} else if (command === "verify") {
  const envelopeJson = getFlag("--envelope");

  if (envelopeJson) {
    const REQUIRED_FIELDS = ["chorus_version", "sender_id", "original_text", "sender_culture"];
    try {
      const envelope = JSON.parse(envelopeJson);
      const missing = REQUIRED_FIELDS.filter((k) => !envelope[k]);
      if (missing.length === 0) {
        console.log(`✓ Valid Chorus envelope (${REQUIRED_FIELDS.length}/${REQUIRED_FIELDS.length} required fields present)`);
      } else {
        console.error(`✗ Invalid envelope — missing fields: ${missing.join(", ")}`);
        process.exit(1);
      }
    } catch {
      console.error(`✗ Invalid JSON`);
      process.exit(1);
    }
  } else {
    const target = getFlag("--target") || "openclaw";
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

    // Check 2: openclaw.json registration (only for openclaw target)
    if (target === "openclaw") {
      const configPath = join(homedir(), ".openclaw", "openclaw.json");
      if (!existsSync(configPath)) {
        console.error(`✗ openclaw.json not found at ${configPath}`);
        process.exit(1);
      }
      const config = JSON.parse(readFileSync(configPath, "utf8"));
      if (config.skills?.entries?.chorus?.enabled === true) {
        console.log(`✓ openclaw.json: chorus registered and enabled`);
      } else {
        console.error(`✗ openclaw.json: chorus not registered or not enabled`);
        process.exit(1);
      }
    }

    console.log(`\nEnvelope test — ask your agent:`);
    console.log(`  "Compose a Chorus envelope from a Japanese agent to a Chinese agent, saying 'Let's discuss the project schedule.'"`);
    console.log(`\nThen validate the output:`);
    console.log(`  npx @chorus-protocol/skill verify --envelope '{"chorus_version":"0.4",...}'`);
  }
} else {
  console.log(`@chorus-protocol/skill v${pkg.version}`);
  console.log(`\nUsage:`);
  console.log(`  chorus-skill init [--lang en|zh-CN] [--target local|openclaw|claude-user|claude-project]`);
  console.log(`  chorus-skill uninstall --target openclaw|claude-user|claude-project`);
  console.log(`  chorus-skill verify --target openclaw`);
  console.log(`  chorus-skill verify --envelope '<json>'`);
  console.log(`\nExamples:`);
  console.log(`  npx @chorus-protocol/skill init --target openclaw      # Install (recommended)`);
  console.log(`  npx @chorus-protocol/skill verify --target openclaw    # Verify installation`);
  console.log(`  npx @chorus-protocol/skill init --target claude-user   # Alternative: Claude Code user skill`);
  console.log(`  npx @chorus-protocol/skill init --lang zh-CN           # Chinese variant`);
}
