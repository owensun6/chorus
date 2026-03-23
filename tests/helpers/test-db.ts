// Test helper: creates an in-memory SQLite database for tests
import { initDb } from "../../src/server/db";

const createTestDb = () => initDb(":memory:");

export { createTestDb };
