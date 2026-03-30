---
id: gene-20260322-migration-before-schema-edit
trigger: 'when modifying a database table schema that already has a version-tracked migration system'
action: 'do add a NEW migration version instead of editing the existing migration SQL in-place'
confidence: 0.9
topic: 'architecture'
universality: 'global'
project_types: []
role_binding: 'be-domain-modeler'
source: 'session'
campaign_id: 'chorus'
created: '2026-03-22'
updated: '2026-03-22'
graduated: true
graduated_date: '2026-03-30'
evidence:
  - date: '2026-03-22'
    context: 'Changed api_keys column from api_key to api_key_hash by editing MIGRATIONS[0] in-place. Existing v1 databases already had the old schema applied and recorded version=1, so the migration system skipped the change. Commander caught this in review — new code queried a non-existent column on existing DBs.'
---

# Never Edit Shipped Migrations In-Place

## Action

When a migration has been applied to any database (including production), treat its SQL as immutable history. Schema changes must always be a new migration at a new version number. The old migration stays as-is to represent the historical state.

## Evidence

- 2026-03-22: Chorus `api_keys` table needed column rename (`api_key` → `api_key_hash`). Initial implementation edited MIGRATIONS[0] directly. Schema version was still 1, so `initDb` saw `currentVersion === SCHEMA_VERSION` and skipped migration. Result: `SELECT agent_id FROM api_keys WHERE api_key_hash = ?` hit a non-existent column on any pre-existing database. Fix: restore MIGRATIONS[0] to original, add MIGRATIONS[1] with DROP+CREATE, bump SCHEMA_VERSION to 2.
