#!/usr/bin/env node
// Minimal echo receiver for Chorus demo agent testing.
// Accepts POST, logs envelope, returns {"status":"ok"}.

import { createServer } from "node:http";

const PORT = process.env.PORT || 4000;

const server = createServer((req, res) => {
  if (req.method === "POST") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString();
      console.log(`[${new Date().toISOString()}] POST ${req.url}`);
      console.log(body);
      console.log("---");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
    });
    return;
  }
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Chorus echo receiver running\n");
});

server.listen(PORT, () => console.log(`Echo receiver on :${PORT}`));
