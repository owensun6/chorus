#!/usr/bin/env bash
# Generate 24h summary report from probe log
# Usage: ./bin/alpha-probe-report.sh [logfile]
set -euo pipefail

LOGFILE="${1:-/tmp/chorus-alpha-probe.jsonl}"

if [ ! -f "$LOGFILE" ]; then
  echo "No probe log found at $LOGFILE"
  exit 1
fi

python3 - "$LOGFILE" <<'PYEOF'
import json, sys
from datetime import datetime, timedelta, timezone

logfile = sys.argv[1]
cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

total = 0
ok = 0
fail = 0
latencies = []
failures = []
longest_fail_streak = 0
current_fail_streak = 0

with open(logfile) as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            continue

        ts = datetime.fromisoformat(rec["ts"].replace("Z", "+00:00"))
        if ts < cutoff:
            continue

        total += 1
        http = rec.get("http", "0")
        status = rec.get("status", "error")

        try:
            lat = float(rec.get("latency_s", "0"))
            latencies.append(lat)
        except ValueError:
            pass

        if http == "200" and status == "ok":
            ok += 1
            current_fail_streak = 0
        else:
            fail += 1
            current_fail_streak += 1
            longest_fail_streak = max(longest_fail_streak, current_fail_streak)
            failures.append({"ts": rec["ts"], "http": http, "status": status})

if total == 0:
    print("No data in the last 24 hours.")
    sys.exit(0)

success_rate = ok / total * 100
latencies.sort()
p50 = latencies[len(latencies) // 2] if latencies else 0
p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0
p99 = latencies[int(len(latencies) * 0.99)] if latencies else 0

print("=" * 60)
print("  Chorus Alpha — 24h Probe Report")
print("=" * 60)
print(f"  Period:          last 24 hours")
print(f"  Total probes:    {total}")
print(f"  Successful:      {ok}")
print(f"  Failed:          {fail}")
print(f"  Success rate:    {success_rate:.2f}%")
print(f"  Latency p50:     {p50:.3f}s")
print(f"  Latency p95:     {p95:.3f}s")
print(f"  Latency p99:     {p99:.3f}s")
print(f"  Longest fail:    {longest_fail_streak} consecutive")
print()

if failures:
    print("  Failure samples (last 10):")
    for f in failures[-10:]:
        print(f"    {f['ts']}  http={f['http']}  status={f['status']}")
else:
    print("  No failures recorded.")

print("=" * 60)
PYEOF
