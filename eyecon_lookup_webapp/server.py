#!/usr/bin/env python3
"""Tiny local web UI for Eyecon's getnames.jsp (name + spam lookup).

Runs with Python's standard library only:
    python server.py
Then open http://127.0.0.1:8765

The API requires a clientId issued to a real Eyecon install. Paste yours
into the web form; the request is sent from this machine directly to
api.eyecon-app.com. Nothing is uploaded anywhere else.
"""

from __future__ import annotations

import json
import re
import ssl
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BASE_URL = "https://api.eyecon-app.com/app/getnames.jsp"
APSVERSION = "vc_785_vn_4.2026.08.27.2228_a"
AUTH_KEY = "PgdtSBeR0MumR7fO"  # hardcoded in NetworkHelper.java:42
USER_AGENT = "okhttp/4.12.0"
HOST, PORT = "127.0.0.1", 8765
ROOT = Path(__file__).resolve().parent


def normalise_number(raw: str) -> str:
    """Return digits only, including country code, like the app's cli param."""
    value = str(raw or "").strip()
    if value.startswith("00"):
        value = "+" + value[2:]
    digits = re.sub(r"\D", "", value)
    if not digits:
        raise ValueError("Enter a phone number including its country code.")
    return digits


def auth_checksum(cid: str) -> str:
    """Reimplementation of NetworkHelper.m15849f(): sum of first char of each
    hyphen-separated part, using Java Character.getNumericValue semantics."""
    total = 0
    for part in cid.split("-"):
        if not part:
            continue
        ch = part[0]
        if ch.isdigit():
            total += int(ch)
        elif "a" <= ch <= "f":
            total += 10 + ord(ch) - ord("a")
        elif "A" <= ch <= "F":
            total += 10 + ord(ch) - ord("A")
    return str(total)


def build_url(cli: str, mode: str, lang: str, source: str) -> str:
    params = {
        "cli": cli,
        "lang": lang or "en",
        "is_callerid": "true" if mode == "callerid" else "false",
        "is_ic": "false",
        "apsversion": APSVERSION,
        "requestApi": "okHttp" if mode == "callerid" else "URLconnection",
        "source": source or "local-webapp",
    }
    if mode == "search":
        params["is_search"] = "true"
    return BASE_URL + "?" + urlencode(params)


def parse_response(raw: str) -> dict:
    """Extract names and spam flags the same way the decompiled app does."""
    result = {"names": [], "spam_level": -1, "spam_text": "Unknown", "entries": []}
    try:
        data = json.loads(raw) if raw.strip() else []
    except json.JSONDecodeError as exc:
        result["spam_text"] = f"Unparseable response: {exc}"
        return result
    if isinstance(data, dict):
        data = [data]
    if not isinstance(data, list):
        result["spam_text"] = "Unexpected response shape"
        return result

    names: list[str] = []
    spam_level = 0
    for item in data:
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        if isinstance(name, str) and name.strip():
            clean = name.strip()
            if clean.lower() not in ("spam", "maybe spam") and clean not in names:
                names.append(clean)
        kind = ""
        for key in ("type", "class", "@type", "classDiscriminator"):
            if key in item:
                kind = str(item.get(key) or "").lower()
                break
        suspicious = item.get("suspicious_spam") is True
        if kind == "spam":
            spam_level = max(spam_level, 1)
        elif "maybe" in kind:
            spam_level = max(spam_level, 1)
        if suspicious:
            spam_level = max(spam_level, 2)
        result["entries"].append({"name": name, "type": kind, "suspicious_spam": suspicious})

    result["names"] = names
    result["spam_level"] = spam_level
    result["spam_text"] = {0: "Not flagged", 1: "Spam", 2: "Suspicious spam"}.get(
        spam_level, "Unknown"
    )
    return result


def call_api(cli: str, cid: str, mode: str, lang: str, source: str) -> dict:
    url = build_url(cli, mode, lang, source)
    headers = {
        "User-Agent": USER_AGENT,
        "accept": "application/json",
        "accept-charset": "UTF-8",
        "content-type": "application/x-www-form-urlencoded; charset=utf-8",
        "e-auth-v": "e1",
        "e-auth": cid,
        "e-auth-c": auth_checksum(cid),
        "e-auth-k": AUTH_KEY,
    }
    request = Request(url, headers=headers, method="GET")
    context = ssl.create_default_context()
    try:
        with urlopen(request, timeout=20, context=context) as response:
            status = response.status
            raw = response.read().decode("utf-8", "replace")
    except HTTPError as exc:
        status = exc.code
        raw = exc.read().decode("utf-8", "replace")
    except URLError as exc:
        return {"ok": False, "error": f"Network error: {exc}", "url": url, "status": None}

    parsed = parse_response(raw)
    if status != 200:
        parsed["spam_level"] = -1
        parsed["spam_text"] = "Unavailable"
    if status == 401:
        parsed["error"] = (
            "401 from Eyecon: the Client ID was rejected. Use the clientId from "
            "your own signed-in Eyecon app/device."
        )
    return {"ok": status == 200, "status": status, "url": url, "cli": cli, "raw": raw, **parsed}


class Handler(BaseHTTPRequestHandler):
    server_version = "EyeconLookup/1.0"

    def _send(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.path in ("/", "/index.html"):
            body = (ROOT / "index.html").read_bytes()
            self._send(200, body, "text/html; charset=utf-8")
        elif self.path == "/api/health":
            self._send(200, b'{"ok":true}', "application/json")
        else:
            self._send(404, b"Not found", "text/plain; charset=utf-8")

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/api/lookup":
            self._send(404, b"Not found", "text/plain; charset=utf-8")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            number = str(payload.get("number", ""))
            cid = str(payload.get("cid", "")).strip()
            mode = str(payload.get("mode", "callerid"))
            lang = str(payload.get("lang", "en"))
            source = str(payload.get("source", "local-webapp"))
            if mode not in ("callerid", "search"):
                raise ValueError("Invalid mode")
            if not cid:
                raise ValueError("Client ID (e-auth / clientId) is required")
            cli = normalise_number(number)
            result = call_api(cli, cid, mode, lang, source)
            self._send(200, json.dumps(result, ensure_ascii=False).encode("utf-8"), "application/json")
        except ValueError as exc:
            body = json.dumps({"ok": False, "error": str(exc)}).encode("utf-8")
            self._send(400, body, "application/json")
        except Exception as exc:  # keep the UI useful on unexpected failures
            body = json.dumps({"ok": False, "error": f"Server error: {exc}"}).encode("utf-8")
            self._send(500, body, "application/json")

    def log_message(self, fmt: str, *args: object) -> None:
        # Don't log request bodies (they contain the Client ID).
        print(f"[lookup-webapp] {self.address_string()} {fmt % args}")


if __name__ == "__main__":
    print(f"Eyecon lookup UI: http://{HOST}:{PORT}")
    print("Press Ctrl+C to stop.")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
