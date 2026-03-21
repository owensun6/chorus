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
    console.log(`  OpenClaw config not found at ${configPath} — skipping registration`);
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

  console.log(`Chorus Skill installed to ${targetDir} (${lang})`);

  if (target === "openclaw") {
    const registered = registerOpenClaw();
    if (registered) {
      console.log(`  Registered in ~/.openclaw/openclaw.json`);
    }
  }

  console.log(`\nFiles created:`);
  console.log(`  PROTOCOL.md      — Protocol specification`);
  console.log(`  SKILL.md         — Agent learning document`);
  console.log(`  TRANSPORT.md     — Default transport profile (optional)`);
  console.log(`  envelope.schema.json`);
  console.log(`  examples/`);
  console.log(`\nGive your agent SKILL.md to teach it the Chorus protocol.`);

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

} else {
  console.log(`@chorus-protocol/skill v${pkg.version}`);
  console.log(`\nUsage:`);
  console.log(`  chorus-skill init [--lang en|zh-CN] [--target local|openclaw|claude-user|claude-project]`);
  console.log(`  chorus-skill uninstall --target openclaw|claude-user|claude-project`);
  console.log(`\nExamples:`);
  console.log(`  npx @chorus-protocol/skill init                        # ./chorus/`);
  console.log(`  npx @chorus-protocol/skill init --target openclaw      # ~/.openclaw/skills/chorus/`);
  console.log(`  npx @chorus-protocol/skill init --target claude-user   # ~/.claude/skills/chorus/`);
  console.log(`  npx @chorus-protocol/skill init --lang zh-CN`);
}
