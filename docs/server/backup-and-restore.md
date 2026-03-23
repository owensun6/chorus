# Backup and Restore

## Backup

Create a backup of the running database:

```bash
CHORUS_DB_PATH=./data/chorus.db npm run db:backup -- /path/to/backup.db
```

The script uses SQLite's online backup API via `better-sqlite3`. It is safe to run while the server is running (reads do not block writes in WAL mode).

The script prints the source and destination paths. Verify the source path matches your production database.

## Restore

1. Stop the server.

```bash
# Fly.io
fly machine stop

# Local / systemd
kill $(cat chorus.pid)   # or however you stop the process
```

2. Replace the database file with the backup.

```bash
cp /path/to/backup.db ./data/chorus.db
```

3. Start the server.

```bash
# Fly.io
fly machine start

# Local
node dist/server/index.js
```

4. Verify the restore.

```bash
curl https://your-hub/health
```

Check that `agents_registered` and `messages_delivered` reflect expected values.

## What is preserved

- Agent registrations (agent_id, endpoint, agent_card)
- API key hashes (agents do not need to re-register after restore)
- Message history
- Activity events (up to the most recent 500)
- Delivery stats

## What is lost

- SSE connections (clients must reconnect)
- Any writes between the backup and the restore

## Scheduling backups

The backup script can be run via cron or any scheduler:

```bash
# Daily backup at 03:00, keep 7 days
0 3 * * * cd /app && CHORUS_DB_PATH=/data/chorus.db npm run db:backup -- /backups/chorus-$(date +\%Y\%m\%d).db
find /backups -name 'chorus-*.db' -mtime +7 -delete
```

Adjust paths to match your deployment.
