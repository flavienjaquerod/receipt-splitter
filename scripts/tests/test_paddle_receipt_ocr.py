from __future__ import annotations

import io
import json
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch

from scripts import paddle_receipt_ocr


class _FakeResult:
    def to_dict(self):
        return {
            "items": [{"name": "Coffee", "price": 3.5}],
            "total": 3.5,
            "tokens": [{"text": "Coffee", "confidence": 98.0, "bbox": {"x": 1, "y": 2, "w": 10, "h": 4}}],
            "lines": [{"text": "Coffee 3.50", "bbox": {"x": 1, "y": 2, "w": 30, "h": 6}, "tokens": []}],
            "metadata": {"lang": "eng"},
        }


class PaddleReceiptOcrWrapperTests(unittest.TestCase):
    def test_resolve_tesseract_cmd_prefers_explicit(self):
        self.assertEqual(
            paddle_receipt_ocr._resolve_tesseract_cmd("C:/custom/tesseract.exe"),
            "C:/custom/tesseract.exe",
        )

    def test_resolve_tesseract_cmd_reads_environment(self):
        with patch("scripts.paddle_receipt_ocr.os.getenv") as getenv:
            getenv.side_effect = lambda key: "C:/env/tesseract.exe" if key == "PADDLE_OCR_TESSERACT_CMD" else None
            self.assertEqual(
                paddle_receipt_ocr._resolve_tesseract_cmd(None),
                "C:/env/tesseract.exe",
            )

    def test_main_success_outputs_expected_contract(self):
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as handle:
            image_path = Path(handle.name)

        self.addCleanup(lambda: image_path.unlink(missing_ok=True))

        stdout_buffer = io.StringIO()
        stderr_buffer = io.StringIO()

        with (
            patch("scripts.paddle_receipt_ocr._run_pipeline") as run_pipeline,
            redirect_stdout(stdout_buffer),
            redirect_stderr(stderr_buffer),
        ):
            run_pipeline.return_value = _FakeResult()

            code = paddle_receipt_ocr.main(
                [
                    str(image_path),
                    "--lang",
                    "latin",
                    "--min-token-score",
                    "0.35",
                ]
            )

        self.assertEqual(code, 0)
        self.assertEqual(stderr_buffer.getvalue(), "")

        payload = json.loads(stdout_buffer.getvalue())
        self.assertTrue(payload["success"])
        self.assertIn("items", payload)
        self.assertIn("total", payload)
        self.assertIn("tokens", payload)
        self.assertIn("lines", payload)
        self.assertIn("metadata", payload)
        self.assertEqual(payload["receiptItems"], payload["items"])
        self.assertEqual(payload["metadata"]["lang"], "eng")
        self.assertIn("confidence", payload["lines"][0])
        self.assertEqual(payload["detectedLanguage"], "eng")

    def test_main_failure_returns_non_zero_and_structured_error(self):
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as handle:
            image_path = Path(handle.name)

        self.addCleanup(lambda: image_path.unlink(missing_ok=True))

        stdout_buffer = io.StringIO()
        stderr_buffer = io.StringIO()

        with (
            patch("scripts.paddle_receipt_ocr._run_pipeline") as run_pipeline,
            redirect_stdout(stdout_buffer),
            redirect_stderr(stderr_buffer),
        ):
            run_pipeline.side_effect = RuntimeError("boom")
            code = paddle_receipt_ocr.main([str(image_path)])

        self.assertEqual(code, 1)
        self.assertEqual(stdout_buffer.getvalue(), "")

        error_payload = json.loads(stderr_buffer.getvalue())
        self.assertFalse(error_payload["success"])
        self.assertEqual(error_payload["error"], "boom")
        self.assertEqual(error_payload["errorType"], "RuntimeError")


if __name__ == "__main__":
    unittest.main()