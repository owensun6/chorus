# Chorus Verification Checklist

Verify the full register → send → receive path works end-to-end. Run these checks in order after starting the server and agents.

## Prerequisites

- Server running: `CHORUS_API_KEYS=test-key PORT=3000 npm start`
- At least one agent running (or use curl to simulate — see integration-guide.md)

---

## 1. Server is up

```bash
curl -s http://localhost:3000/health
```

Expected:
```json
{"success": true, "data": {"status": "ok"}, "metadata": {"timestamp": "..."}}
```

## 2. Discovery endpoint works

```bash
curl -s http://localhost:3000/.well-known/chorus.json
```

Expected:
```json
{"chorus_version": "0.4", "server_name": "Chorus Hub", "endpoints": {"register": "/agents", "discover": "/agents", "send": "/messages", "health": "/health"}}
```

## 3. Agent is registered

```bash
curl -s http://localhost:3000/agents
```

Expected: an array containing your agent(s) with `agent_id`, `endpoint`, `agent_card`, and `registered_at`.

## 4. Message delivered

```bash
curl -s http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-key" \
  -d '{
    "receiver_id": "agent-zh-CN@localhost",
    "envelope": {
      "chorus_version": "0.4",
      "sender_id": "agent-ja@localhost",
      "original_text": "プロジェクトの進捗を確認しましょう。",
      "sender_culture": "ja"
    }
  }'
```

Expected (if receiver is running):
```json
{"success": true, "data": {"delivery": "delivered", "receiver_response": {"status": "ok"}}, "metadata": {"timestamp": "..."}}
```

## 5. Receiver got the message

Check the receiving agent's terminal output. Expected:
```
[agent-zh-CN@localhost] Message from agent-ja@localhost:
[agent-zh-CN@localhost]   Original: プロジェクトの進捗を確認しましょう。
[agent-zh-CN@localhost]   Adapted:  让我们确认一下项目的进展情况。
```

The adapted text will vary (it's LLM-generated), but it should be a culturally appropriate Chinese rendering of the Japanese original.

## 6. Logs are clean

Check each terminal for errors:
- **Server (Terminal 1)**: No unhandled errors or crash traces
- **Agent A (Terminal 2)**: Shows "Message from..." when receiving
- **Agent B (Terminal 3)**: Shows "Message sent to..." after sending

---

## Summary

| # | Check | Command | Pass criteria |
|---|-------|---------|---------------|
| 1 | Server health | `GET /health` | `"status": "ok"` |
| 2 | Discovery | `GET /.well-known/chorus.json` | `"chorus_version": "0.4"` |
| 3 | Registration | `GET /agents` | Agent appears in list |
| 4 | Delivery | `POST /messages` | `"delivery": "delivered"` |
| 5 | Adaptation | Agent stdout | Adapted text in receiver's language |
| 6 | Clean logs | All terminals | No errors |
