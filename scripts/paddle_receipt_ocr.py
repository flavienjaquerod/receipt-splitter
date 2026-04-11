from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional


REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


LANG_ALIASES = {
    "latin": "eng",
}


def _parse_min_token_score(value: str) -> float:
    parsed = float(value)
    if parsed < 0:
        raise ValueError("min-token-score must be >= 0")
    if parsed <= 1:
        parsed *= 100.0
    return min(parsed, 100.0)


def _resolve_lang(value: str) -> str:
    normalized = (value or "").strip().lower()
    if not normalized:
        return "eng"
    return LANG_ALIASES.get(normalized, normalized)


def _load_product_lexicon(path: Optional[str]) -> Optional[List[str]]:
    if not path:
        return None

    lexicon_path = Path(path)
    if not lexicon_path.exists():
        raise FileNotFoundError(f"product lexicon file does not exist: {path}")

    with lexicon_path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    if not isinstance(payload, list) or any(not isinstance(item, str) for item in payload):
        raise ValueError("product lexicon must be a JSON array of strings")

    return [item.strip() for item in payload if item.strip()]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Compatibility wrapper for the local receipt OCR pipeline",
    )
    parser.add_argument("image_path", help="Path to the receipt image")
    parser.add_argument("--lang", default="latin", help="OCR language (default: latin)")
    parser.add_argument(
        "--min-token-score",
        default="0.35",
        help="Minimum token score in [0,1] or [0,100] (default: 0.35)",
    )
    parser.add_argument("--debug-dir", default=None, help="Optional directory for debug artifacts")
    parser.add_argument("--product-lexicon", default=None, help="Optional JSON file with product names")
    parser.add_argument("--tesseract-cmd", default=None, help="Optional path to tesseract executable")
    parser.add_argument("--psm", default=6, type=int, help="Tesseract page segmentation mode")
    parser.add_argument("--oem", default=3, type=int, help="Tesseract OCR engine mode")
    return parser


def _extract_line_confidence(line: Dict[str, Any]) -> float:
    raw_conf = line.get("confidence")
    if isinstance(raw_conf, (int, float)):
        return float(raw_conf)

    token_confidences: List[float] = []
    tokens = line.get("tokens")
    if isinstance(tokens, list):
        for token in tokens:
            if not isinstance(token, dict):
                continue
            value = token.get("confidence")
            if isinstance(value, (int, float)):
                token_confidences.append(float(value))

    if not token_confidences:
        return 0.0
    return sum(token_confidences) / len(token_confidences)


def _normalize_lines(lines: Any) -> List[Dict[str, Any]]:
    if not isinstance(lines, list):
        return []

    normalized: List[Dict[str, Any]] = []
    for line in lines:
        if not isinstance(line, dict):
            continue
        item = dict(line)
        item["confidence"] = round(_extract_line_confidence(item), 4)
        normalized.append(item)
    return normalized


def _build_response_payload(
    result_dict: Dict[str, Any],
    image_path: str,
    lexicon_size: Optional[int],
    selected_lang: str,
    min_confidence: float,
) -> Dict[str, Any]:
    normalized_lines = _normalize_lines(result_dict.get("lines", []))
    metadata = dict(result_dict.get("metadata") or {})
    metadata.setdefault("source_image", image_path)
    metadata.setdefault("product_lexicon_size", lexicon_size or 0)
    metadata.setdefault("lang", selected_lang)
    metadata.setdefault("min_confidence", round(min_confidence, 4))

    payload: Dict[str, Any] = {
        "success": True,
        "items": result_dict.get("items", []),
        "total": result_dict.get("total"),
        "tokens": result_dict.get("tokens", []),
        "lines": normalized_lines,
        "metadata": metadata,
    }

    # Keep backward compatibility with existing frontend parsing.
    payload["receiptItems"] = payload["items"]
    payload["rawText"] = "\n".join(
        str(line.get("text", "")).strip() for line in payload["lines"] if isinstance(line, dict)
    ).strip()
    payload["detectedLanguage"] = selected_lang or metadata.get("lang", "unknown")
    payload["meta"] = metadata

    return payload


def _run_pipeline(
    image_path: str,
    *,
    lang: str,
    min_confidence: float,
    psm: int,
    oem: int,
    tesseract_cmd: Optional[str],
    debug_dir: Optional[str],
):
    from scripts.ocr.pipeline import ReceiptOCRConfig, ReceiptOCRPipeline

    config = ReceiptOCRConfig(
        lang=lang,
        psm=psm,
        oem=oem,
        min_confidence=min_confidence,
        tesseract_cmd=tesseract_cmd,
    )
    pipeline = ReceiptOCRPipeline(config=config)
    return pipeline.run(image_path, debug_dir=debug_dir)


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(sys.argv[1:] if argv is None else argv)

    try:
        image_path = Path(args.image_path)
        if not image_path.exists() or not image_path.is_file():
            raise FileNotFoundError(f"image file does not exist: {args.image_path}")

        min_confidence = _parse_min_token_score(str(args.min_token_score))
        lexicon = _load_product_lexicon(args.product_lexicon)

        selected_lang = _resolve_lang(args.lang)

        result = _run_pipeline(
            str(image_path),
            lang=selected_lang,
            min_confidence=min_confidence,
            psm=args.psm,
            oem=args.oem,
            tesseract_cmd=args.tesseract_cmd,
            debug_dir=args.debug_dir,
        )

        payload = _build_response_payload(
            result.to_dict(),
            image_path=str(image_path),
            lexicon_size=len(lexicon) if lexicon is not None else None,
            selected_lang=selected_lang,
            min_confidence=min_confidence,
        )
        print(json.dumps(payload, ensure_ascii=False))
        return 0
    except Exception as exc:
        error_payload = {
            "success": False,
            "error": str(exc),
            "errorType": exc.__class__.__name__,
        }
        print(json.dumps(error_payload, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())