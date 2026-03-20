#!/usr/bin/env python3
"""Chorus Receive Endpoint for xiaov@localhost"""
from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import sys

received_messages = []

class ReceiveHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)
        try:
            data = json.loads(body)
            print("=" * 50, flush=True)
            print("RECEIVED MESSAGE:", flush=True)
            print(json.dumps(data, indent=2, ensure_ascii=False), flush=True)
            print("=" * 50, flush=True)
            received_messages.append(data)
            
            # Send OK response per protocol
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            response = {"status": "ok"}
            self.wfile.write(json.dumps(response).encode())
        except Exception as e:
            print(f"Error: {e}", flush=True)
            self.send_response(500)
            self.end_headers()
    
    def log_message(self, format, *args):
        print(f"{self.address_string} - {format % args}", flush=True)

if __name__ == "__main__":
    port = 3005
    server = HTTPServer(('localhost', port), ReceiveHandler)
    print(f"Chorus receiver xiaov@localhost listening on http://localhost:{port}/receive", flush=True)
    server.serve_forever()
