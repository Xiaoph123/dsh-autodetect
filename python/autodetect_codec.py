#!/usr/bin/env python3
"""Binary-safe Windows text detection and round-trip encoding helper."""

from __future__ import annotations

import base64
import hashlib
import json
import re
import sys
import tempfile
from pathlib import Path

from charset_normalizer import from_bytes


if hasattr(sys.stdin, "reconfigure"):
    sys.stdin.reconfigure(encoding="utf-8", errors="strict")
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="strict")


BOMS = (
    (b"\xff\xfe\x00\x00", "utf-32-le"),
    (b"\x00\x00\xfe\xff", "utf-32-be"),
    (b"\xff\xfe", "utf-16-le"),
    (b"\xfe\xff", "utf-16-be"),
    (b"\xef\xbb\xbf", "utf-8"),
)

SUPPORTED_TEXT_EXTENSIONS = {".bat", ".cmd", ".ini", ".vbs", ".ps1"}
COMMON_ENCODINGS = {"utf-8", "gbk", "gb18030", "utf-16-le", "utf-16-be", "utf-32-le", "utf-32-be", "cp1252", "shift-jis"}


def detect(data: bytes) -> tuple[str, bool, bytes]:
    for marker, encoding in BOMS:
        if data.startswith(marker):
            return encoding, True, data[len(marker):]
    if not data:
        return "utf-8", False, data
    if _is_valid(data, "utf-8"):
        return "utf-8", False, data
    # A BOM-less UTF-16 file can otherwise look like valid UTF-8 containing NULs.
    for encoding in ("utf-16-le", "utf-16-be"):
        if _looks_like_bomless_utf16(data, encoding):
            return encoding, False, data
    # GBK is a strict subset of GB18030. Prefer GBK when the bytes round-trip
    # through it; only use GB18030 when the file contains four-byte sequences
    # that GBK cannot represent.
    if _is_valid(data, "gbk"):
        return "gbk", False, data
    if _is_valid(data, "gb18030"):
        return "gb18030", False, data
    match = from_bytes(data).best()
    detected = (match.encoding if match else "utf-8").lower().replace("_", "-")
    aliases = {
        "cp936": "gbk",
        "ms936": "gbk",
        "gb2312": "gb18030",
        "ascii": "utf-8",
        "932": "shift-jis",
        "sjis": "shift-jis",
        "windows-1252": "cp1252",
    }
    encoding = aliases.get(detected, detected)
    if encoding not in COMMON_ENCODINGS:
        encoding = "utf-8"
    return encoding, False, data


def _is_valid(data: bytes, encoding: str) -> bool:
    try:
        text = data.decode(encoding, errors="strict")
        return text.encode(encoding, errors="strict") == data
    except UnicodeError:
        return False


def _looks_like_bomless_utf16(data: bytes, encoding: str) -> bool:
    if len(data) < 16 or len(data) % 2:
        return False
    even_nuls = sum(data[index] == 0 for index in range(0, len(data), 2))
    odd_nuls = sum(data[index] == 0 for index in range(1, len(data), 2))
    half = len(data) // 2
    skewed = (encoding == "utf-16-le" and odd_nuls * 10 >= half * 3 and even_nuls * 20 <= half) or (encoding == "utf-16-be" and even_nuls * 10 >= half * 3 and odd_nuls * 20 <= half)
    if not skewed:
        return False
    try:
        text = data.decode(encoding, errors="strict")
        return "\ufffd" not in text
    except UnicodeError:
        return False


def is_binary(data: bytes, encoding: str, bom: bool) -> bool:
    if not data:
        return False
    if encoding.startswith("utf-16") or encoding.startswith("utf-32"):
        return False
    if b"\x00" in data:
        return True
    controls = sum(byte < 8 or 14 <= byte < 32 for byte in data)
    return controls / len(data) > 0.02


def newline_of(text: str) -> str:
    match = re.search(r"\r\n|\r|\n", text)
    return {"\r\n": "crlf", "\r": "cr", "\n": "lf"}.get(match.group(0), "lf") if match else "lf"


def to_editor_text(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n")


def encode_text(content: str, encoding: str, bom: bool, newline: str) -> bytes:
    separator = {"crlf": "\r\n", "cr": "\r", "lf": "\n"}.get(newline, "\n")
    normalized = content.replace("\r\n", "\n").replace("\r", "\n")
    text = normalized.replace("\n", separator)
    raw = text.encode(encoding, errors="strict")
    if bom:
        marker = {
            "utf-8": b"\xef\xbb\xbf",
            "utf-16-le": b"\xff\xfe",
            "utf-16-be": b"\xfe\xff",
            "utf-32-le": b"\xff\xfe\x00\x00",
            "utf-32-be": b"\x00\x00\xfe\xff",
        }.get(encoding, b"")
        raw = marker + raw
    return raw


def read_file(path: Path) -> dict[str, object]:
    data = path.read_bytes()
    encoding, bom, body = detect(data)
    binary = is_binary(data, encoding, bom)
    if binary:
        return {
            "content": "",
            "encoding": encoding,
            "bom": bom,
            "newline": "lf",
            "size": len(data),
            "sha256": hashlib.sha256(data).hexdigest(),
            "binary": True,
            "extension": path.suffix.lower(),
        }
    text = body.decode(encoding, errors="strict")
    return {
        "content": to_editor_text(text),
        "encoding": encoding,
        "bom": bom,
        "newline": newline_of(text),
        "size": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "binary": binary,
        "extension": path.suffix.lower(),
    }


def atomic_write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp", delete=False) as file:
        temporary = Path(file.name)
        file.write(data)
        file.flush()
        import os
        os.fsync(file.fileno())
    try:
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def main(payload: dict[str, object]) -> dict[str, object]:
    action = payload.get("action")
    if action == "read":
        path = Path(str(payload["path"]))
        if path.suffix.lower() not in SUPPORTED_TEXT_EXTENSIONS:
            raise ValueError(f"unsupported file extension: {path.suffix or '<none>'}")
        return read_file(path)
    if action == "encode":
        raw = encode_text(str(payload.get("content", "")), str(payload.get("encoding", "utf-8")), bool(payload.get("bom", False)), str(payload.get("newline", "lf")))
        return {"bytes": base64.b64encode(raw).decode("ascii"), "size": len(raw)}
    if action == "write":
        path = Path(str(payload["path"]))
        if path.suffix.lower() not in SUPPORTED_TEXT_EXTENSIONS:
            raise ValueError(f"unsupported file extension: {path.suffix or '<none>'}")
        current = path.read_bytes()
        expected = str(payload.get("expectedSha256", ""))
        actual = hashlib.sha256(current).hexdigest()
        if expected and expected != actual:
            raise RuntimeError("file changed on disk; reload before saving")
        raw = encode_text(str(payload.get("content", "")), str(payload.get("encoding", "utf-8")), bool(payload.get("bom", False)), str(payload.get("newline", "lf")))
        atomic_write(path, raw)
        return {"ok": True, "size": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
    raise ValueError(f"unknown action: {action}")


if __name__ == "__main__":
    try:
        request = json.load(sys.stdin)
        # Keep the JSON transport ASCII-only so it is independent of the
        # Windows console code page used by the hosting Python process.
        json.dump(main(request), sys.stdout, ensure_ascii=True)
    except Exception as error:
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        raise SystemExit(1)
