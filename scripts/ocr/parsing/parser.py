from __future__ import annotations

from dataclasses import dataclass
import json
import re
from typing import Dict, Iterable, List, Optional

from .cleaning import clean_lines, clean_word_entries, normalize_line
from .line_grouping import (
    LineGroupingConfig,
    reconstruct_lines_from_text,
    reconstruct_lines_from_words,
    visualize_line_grouping,
)
from .price_extraction import detect_prices, extract_last_price

TOTAL_KEYWORDS = {"TOTAL", "AMOUNT", "SUM", "TO PAY", "GRAND TOTAL"}
NON_ITEM_HINTS = {
    "VAT",
    "TVA",
    "TAX",
    "SUBTOTAL",
    "DISCOUNT",
    "RABATT",
    "CHANGE",
    "CASH",
    "CARD",
    "PAYMENT",
}


@dataclass
class ParserConfig:
    y_tolerance_ratio: float = 0.6


def _contains_total_keyword(line: str) -> bool:
    line_upper = line.upper()
    return any(keyword in line_upper for keyword in TOTAL_KEYWORDS)


def _looks_like_non_item(name: str) -> bool:
    upper = name.upper()
    if any(hint in upper for hint in NON_ITEM_HINTS):
        return True
    if re.fullmatch(r"[\W\d_]+", upper):
        return True
    return False


def _clean_item_name(name: str) -> str:
    cleaned = normalize_line(name)
    cleaned = re.sub(r"\.{2,}", " ", cleaned)
    cleaned = re.sub(r"\b\d+\s*[Xx]\s*$", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned.title()


def _extract_total(lines: List[str]) -> Optional[float]:
    candidates: List[float] = []
    all_prices: List[float] = []

    for line in lines:
        prices = detect_prices(line)
        all_prices.extend([price for _, price, _ in prices])
        if not prices:
            continue

        if _contains_total_keyword(line):
            candidates.append(prices[-1][1])

    if candidates:
        return candidates[-1]
    if all_prices:
        return max(all_prices)
    return None


def _extract_items(lines: List[str]) -> List[Dict[str, object]]:
    items: List[Dict[str, object]] = []
    pending_name_parts: List[str] = []

    for raw_line in lines:
        line = normalize_line(raw_line)
        if not line:
            continue

        maybe_price = extract_last_price(line)
        if not maybe_price:
            # Consider as potential multiline name part.
            if len(line) >= 3 and not _contains_total_keyword(line) and not _looks_like_non_item(line):
                pending_name_parts.append(line)
            continue

        _, price, price_start = maybe_price
        left = line[:price_start]
        left = re.sub(r"[._\-\s]+$", "", left).strip()

        if _contains_total_keyword(line):
            continue

        name_parts = []
        if pending_name_parts:
            name_parts.extend(pending_name_parts)
            pending_name_parts = []
        if left:
            name_parts.append(left)

        if not name_parts:
            continue

        name = _clean_item_name(" ".join(name_parts))
        if not name or _looks_like_non_item(name):
            continue

        items.append({"name": name, "price": price})

    # Remove exact duplicates while preserving order.
    deduped: List[Dict[str, object]] = []
    seen = set()
    for item in items:
        key = (item["name"].upper(), float(item["price"]))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)

    return deduped


def parse_receipt(
    raw_text: Optional[str] = None,
    words_with_boxes: Optional[Iterable[Dict[str, object]]] = None,
    config: Optional[ParserConfig] = None,
) -> Dict[str, object]:
    cfg = config or ParserConfig()

    debug: Dict[str, object] = {
        "input_mode": "words" if words_with_boxes else "text",
    }

    reconstructed_lines: List[str]
    grouped_lines_debug: List[Dict[str, object]]

    if words_with_boxes:
        cleaned_words = clean_word_entries(words_with_boxes)
        reconstructed_lines, grouped_lines_debug = reconstruct_lines_from_words(
            cleaned_words,
            LineGroupingConfig(y_tolerance_ratio=cfg.y_tolerance_ratio),
        )
        debug["cleaned_words"] = cleaned_words
    else:
        reconstructed_lines, grouped_lines_debug = reconstruct_lines_from_text(raw_text or "")

    cleaned_lines = clean_lines(reconstructed_lines)
    price_debug = {line: detect_prices(line) for line in cleaned_lines}

    items = _extract_items(cleaned_lines)
    total = _extract_total(cleaned_lines)

    result = {
        "items": items,
        "total": total,
        "debug": {
            **debug,
            "reconstructed_lines": reconstructed_lines,
            "cleaned_lines": cleaned_lines,
            "detected_prices": price_debug,
            "grouped_lines": grouped_lines_debug,
        },
    }

    return result


def print_debug_steps(parsed_output: Dict[str, object]) -> None:
    debug = parsed_output.get("debug", {})
    print("=== CLEANED LINES ===")
    for line in debug.get("cleaned_lines", []):
        print(f"- {line}")

    print("\n=== DETECTED PRICES ===")
    for line, prices in debug.get("detected_prices", {}).items():
        print(f"- {line}: {prices}")

    print("\n=== FINAL STRUCTURED OUTPUT ===")
    print(json.dumps({"items": parsed_output.get("items"), "total": parsed_output.get("total")}, indent=2))


def save_line_grouping_visualization(
    image_path: str,
    parsed_output: Dict[str, object],
    output_path: str,
) -> None:
    grouped_lines = parsed_output.get("debug", {}).get("grouped_lines", [])
    if not grouped_lines:
        raise ValueError("No grouped line data available. Parse with words_with_boxes input.")
    visualize_line_grouping(image_path=image_path, grouped_lines=grouped_lines, output_path=output_path)
