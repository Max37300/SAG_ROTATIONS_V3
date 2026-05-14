#!/usr/bin/env python3
"""
Serveur local SAG Rotations V3
Lancer avec : python3 server.py
Puis ouvrir : http://localhost:8080
"""

import http.server
import json
import os
import sys
import urllib.parse
from pathlib import Path

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
PORT = 8080


class SAGHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def log_message(self, format, *args):
        print(f"  [{self.command}] {self.path}")

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path.startswith("/api/data/"):
            filename = parsed.path[len("/api/data/"):]
            self._read_json(filename)
        elif parsed.path == "/api/files":
            self._list_files()
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path.startswith("/api/data/"):
            filename = parsed.path[len("/api/data/"):]
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            self._write_json(filename, body)
        else:
            self._send_json({"error": "Route inconnue"}, 404)

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors_headers()
        self.end_headers()

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, data, code=200):
        body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", len(body))
        self._cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self, filename):
        if not filename.endswith(".json") or ".." in filename or "/" in filename:
            self._send_json({"error": "Fichier invalide"}, 400)
            return
        filepath = DATA_DIR / filename
        if not filepath.exists():
            self._send_json({"error": "Fichier introuvable"}, 404)
            return
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            self._send_json(data)
        except Exception as e:
            self._send_json({"error": str(e)}, 500)

    def _write_json(self, filename, body):
        if not filename.endswith(".json") or ".." in filename or "/" in filename:
            self._send_json({"error": "Fichier invalide"}, 400)
            return
        try:
            data = json.loads(body.decode("utf-8"))
            filepath = DATA_DIR / filename
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            self._send_json({"ok": True, "file": filename})
        except json.JSONDecodeError as e:
            self._send_json({"error": f"JSON invalide : {e}"}, 400)
        except Exception as e:
            self._send_json({"error": str(e)}, 500)

    def _list_files(self):
        files = [f.name for f in DATA_DIR.glob("*.json")]
        self._send_json({"files": sorted(files)})


if __name__ == "__main__":
    DATA_DIR.mkdir(exist_ok=True)
    print("=" * 50)
    print("  SAG Rotations V3 — Serveur local")
    print(f"  http://localhost:{PORT}")
    print("  Ctrl+C pour arrêter")
    print("=" * 50)
    try:
        server = http.server.HTTPServer(("localhost", PORT), SAGHandler)
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Serveur arrêté.")
        sys.exit(0)
