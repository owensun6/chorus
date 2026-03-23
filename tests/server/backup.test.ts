// Author: be-domain-modeler
import { execFileSync } from "child_process";
import { mkdtempSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { initDb } from "../../src/server/db";
import { AgentRegistry } from "../../src/server/registry";
import { createMessageStore } from "../../src/server/message-store";
import { createActivityStream } from "../../src/server/activity";

describe("Backup and Restore", () => {
  const tmpDirs: string[] = [];

  const makeTmpDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), "chorus-backup-test-"));
    tmpDirs.push(dir);
    return dir;
  };

  afterAll(() => {
    for (const dir of tmpDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("npm run db:backup creates a restorable copy with all data intact", () => {
    const dir = makeTmpDir();
    const sourcePath = join(dir, "source.db");
    const backupPath = join(dir, "backup.db");

    // Seed source database
    const sourceDb = initDb(sourcePath);
    const registry = new AgentRegistry(sourceDb);
    const messages = createMessageStore(sourceDb);
    const activity = createActivityStream(sourceDb);

    const result = registry.registerSelf("backup-test@hub", {
      card_version: "0.3",
      user_culture: "en",
      supported_languages: ["en"],
    });
    expect(result).not.toBeNull();

    messages.append({
      trace_id: "t-backup",
      sender_id: "backup-test@hub",
      receiver_id: "other@hub",
      envelope: {
        chorus_version: "0.4",
        sender_id: "backup-test@hub",
        original_text: "backup smoke test",
        sender_culture: "en",
      } as never,
      delivered_via: "sse",
    });

    activity.append("message_delivered", { trace_id: "t-backup" });
    sourceDb.close();

    // Run backup script via ts-node (no build step required)
    execFileSync(
      "npx",
      ["ts-node", "src/scripts/backup-db.ts", backupPath],
      {
        env: { ...process.env, CHORUS_DB_PATH: sourcePath },
        stdio: "pipe",
      },
    );

    expect(existsSync(backupPath)).toBe(true);

    // Restore: open backup as a new database
    const restoredDb = initDb(backupPath);
    const restoredRegistry = new AgentRegistry(restoredDb);
    const restoredMessages = createMessageStore(restoredDb);
    const restoredActivity = createActivityStream(restoredDb);

    // Verify agent
    const agent = restoredRegistry.get("backup-test@hub");
    expect(agent).toBeDefined();
    expect(agent!.agent_id).toBe("backup-test@hub");

    // Verify messages
    expect(restoredMessages.getStats().total_stored).toBe(1);
    const history = restoredMessages.listForAgent("backup-test@hub");
    expect(history).toHaveLength(1);
    expect((history[0].envelope as { original_text: string }).original_text).toBe("backup smoke test");

    // Verify activity
    const events = restoredActivity.list();
    expect(events.length).toBeGreaterThanOrEqual(1);

    restoredDb.close();
  });
});
