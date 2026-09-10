import base64
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / "python" / "autodetect_codec.py"


def run_helper(payload):
    result = subprocess.run(
        [sys.executable, str(HELPER)],
        input=json.dumps(payload, ensure_ascii=False),
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=False,
    )
    if result.returncode:
        raise AssertionError(result.stderr or result.stdout)
    return json.loads(result.stdout)


class CodecTests(unittest.TestCase):
    def test_reads_gbk_without_mojibake_and_remembers_format(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sample.bat"
            path.write_bytes("@echo 中文\r\n".encode("gbk"))
            value = run_helper({"action": "read", "path": str(path)})
            self.assertEqual(value["encoding"], "gbk")
            self.assertEqual(value["newline"], "crlf")
            self.assertEqual(value["content"], "@echo 中文\n")

    def test_writes_back_gbk_and_crlf_with_original_bom_state(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sample.ps1"
            path.write_bytes("Write-Output 中文\r\n".encode("gbk"))
            run_helper({"action": "read", "path": str(path)})
            run_helper({
                "action": "write",
                "path": str(path),
                "content": "Write-Output 修改\n",
                "encoding": "gbk",
                "bom": False,
                "newline": "crlf",
            })
            self.assertEqual(path.read_bytes(), "Write-Output 修改\r\n".encode("gbk"))

    def test_preserves_utf8_bom(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sample.cmd"
            path.write_bytes(b"\xef\xbb\xbf" + "@echo 中文\r\n".encode("utf-8"))
            value = run_helper({"action": "read", "path": str(path)})
            self.assertEqual(value["encoding"], "utf-8")
            self.assertTrue(value["bom"])
            encoded = run_helper({
                "action": "encode",
                "content": value["content"],
                "encoding": value["encoding"],
                "bom": value["bom"],
                "newline": value["newline"],
            })
            self.assertEqual(base64.b64decode(encoded["bytes"]), path.read_bytes())

    def test_detects_utf16le_without_bom_and_round_trips(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sample.ini"
            original = "[配置]\r\n名称=中文\r\n"
            path.write_bytes(original.encode("utf-16-le"))
            value = run_helper({"action": "read", "path": str(path)})
            self.assertEqual(value["encoding"], "utf-16-le")
            self.assertFalse(value["bom"])
            self.assertEqual(value["content"], original.replace("\r\n", "\n"))
            run_helper({
                "action": "write",
                "path": str(path),
                "content": value["content"],
                "encoding": value["encoding"],
                "bom": value["bom"],
                "newline": value["newline"],
                "expectedSha256": value["sha256"],
            })
            self.assertEqual(path.read_bytes(), original.encode("utf-16-le"))

    def test_detects_gb18030_four_byte_text(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sample.cmd"
            path.write_bytes("echo 𠀀\r\n".encode("gb18030"))
            value = run_helper({"action": "read", "path": str(path)})
            self.assertEqual(value["encoding"], "gb18030")
            self.assertEqual(value["content"], "echo 𠀀\n")

    def test_rejects_binary_content(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sample.ps1"
            path.write_bytes(b"MZ\x00\x01\x02\x03\x00\xff")
            value = run_helper({"action": "read", "path": str(path)})
            self.assertTrue(value["binary"])

    def test_refuses_external_modification(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sample.vbs"
            path.write_bytes("原始\r\n".encode("gbk"))
            value = run_helper({"action": "read", "path": str(path)})
            path.write_bytes("外部修改\r\n".encode("gbk"))
            result = subprocess.run(
                [sys.executable, str(HELPER)],
                input=json.dumps({
                    "action": "write", "path": str(path), "content": "覆盖",
                    "encoding": "gbk", "bom": False, "newline": "crlf",
                    "expectedSha256": value["sha256"],
                }),
                text=True, encoding="utf-8", capture_output=True, check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("changed on disk", result.stderr)
            self.assertEqual(path.read_bytes(), "外部修改\r\n".encode("gbk"))


if __name__ == "__main__":
    unittest.main()
