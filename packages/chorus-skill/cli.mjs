#!/usr/bin/env node

import { readFileSync, mkdirSync, writeFileSync, existsSync, cpSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const LANGS = ["en", "zh-CN"];
const DEFAULT_LANG = "en";

const args = process.argv.slice(2);
const command = args[0];

if (command === "init") {
  const langFlag = args.indexOf("--lang");
  const lang = langFlag !== -1 && args[langFlag + 1] ? args[langFlag + 1] : DEFAULT_LANG;

  if (!LANGS.includes(lang)) {
    console.error(`Unsupported language: ${lang}. Available: ${LANGS.join(", ")}`);
    process.exit(1);
  }

  const targetDir = join(process.cwd(), "chorus");

  if (existsSync(targetDir)) {
    console.error(`Directory "chorus/" already exists. Remove it first or choose a different location.`);
    process.exit(1);
  }

  mkdirSync(targetDir, { recursive: true });
  mkdirSync(join(targetDir, "examples"), { recursive: true });

  const templateDir = join(__dirname, "templates", lang);
  const sharedDir = join(__dirname, "templates", "shared");

  const protocolFile = lang === "en" ? "PROTOCOL.md" : `PROTOCOL.${lang}.md`;
  const skillFile = lang === "en" ? "SKILL.md" : `SKILL.${lang}.md`;

  writeFileSync(
    join(targetDir, "PROTOCOL.md"),
    readFileSync(join(templateDir, protocolFile))
  );
  writeFileSync(
    join(targetDir, "SKILL.md"),
    readFileSync(join(templateDir, skillFile))
  );
  writeFileSync(
    join(targetDir, "TRANSPORT.md"),
    readFileSync(join(sharedDir, "TRANSPORT.md"))
  );
  writeFileSync(
    join(targetDir, "envelope.schema.json"),
    readFileSync(join(sharedDir, "envelope.schema.json"))
  );

  cpSync(join(sharedDir, "examples"), join(targetDir, "examples"), { recursive: true });

  console.log(`Chorus Skill package initialized in ./chorus/ (${lang})`);
  console.log(`\nFiles created:`);
  console.log(`  chorus/PROTOCOL.md      — Protocol specification`);
  console.log(`  chorus/SKILL.md         — Agent learning document`);
  console.log(`  chorus/TRANSPORT.md     — Default transport profile (optional)`);
  console.log(`  chorus/envelope.schema.json`);
  console.log(`  chorus/examples/`);
  console.log(`\nGive your agent chorus/SKILL.md to teach it the Chorus protocol.`);
} else {
  console.log(`@chorus-protocol/skill v0.4.0`);
  console.log(`\nUsage:`);
  console.log(`  chorus-skill init [--lang en|zh-CN]    Initialize Chorus Skill package`);
  console.log(`\nExamples:`);
  console.log(`  npx @chorus-protocol/skill init`);
  console.log(`  npx @chorus-protocol/skill init --lang zh-CN`);
}
