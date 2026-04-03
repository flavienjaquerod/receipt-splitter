from __future__ import annotations

import re
import unicodedata
from typing import Dict, Iterable, List, Optional, Tuple

from .types import OCRLine

PRICE_REGEX = re.compile(r"(?<!\d)(\d{1,4}(?:[.,]\d{3})*[.,]\d{2})(?!\d)")

TOTAL_KEYWORDS = {
    "TOTAL",
    "GRAND TOTAL",
    "AMOUNT DUE",
    "TO PAY",
    "MONTANT",
    "SUMME",
    "A PAYER",
    "TOTAL TTC",
}

NON_ITEM_HINTS = {
    "SUBTOTAL",
    "TAX",
    "VAT",
    "TVA",
    "MWST",
    "CHANGE",
    "CASH",
    "CARD",
    "BALANCE",
    "DATE",
    "TIME",
    "RECEIPT",
    "TEL",
    "THANK",
    "WELCOME",
    "RUNDUNG",
    "SPAREN",
    "GESPART",
}


def _normalize_text(value: str) -> str:
    no_accents = "".join(
        char for char in unicodedata.normalize("NFKD", value) if not unicodedata.combining(char)
    )
    return re.sub(r"\s+", " ", no_accents.upper()).strip()


def normalize_item_name(value: str) -> str:
    normalized = _normalize_text(value)
    normalized = re.sub(r"[^A-Z0-9 ]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def parse_price(price_text: str) -> Optional[float]:
    clean = price_text.replace(" ", "").replace("'", "")

    if "," in clean and "." in clean:
        if clean.rfind(",") > clean.rfind("."):
            clean = clean.replace(".", "").replace(",", ".")
        else:
            clean = clean.replace(",", "")
    elif "," in clean and "." not in clean:
        last_part = clean.split(",")[-1]
        if len(last_part) in (1, 2):
            clean = clean.replace(",", ".")
        else:
            clean = clean.replace(",", "")

    clean = re.sub(r"[^0-9.\-]", "", clean)
    if clean in {"", ".", "-"}:
        return None

    try:
        value = abs(float(clean))
    except ValueError:
        return None

    return round(value, 2)


def _clean_item_prefix(prefix: str) -> str:
    cleaned = prefix.strip(" .:-*_")
    cleaned = re.sub(r"^\d+\s*[xX*]\s*", "", cleaned)
    cleaned = re.sub(r"(?:\d{1,4}[.,]\d{2}\s*)+$", "", cleaned).strip()
    cleaned = re.sub(r"[|I]\s*$", "", cleaned).strip()
    cleaned = re.sub(r"\b\d+\b$", "", cleaned).strip()
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _is_total_line(line_upper: str) -> bool:
    if any(keyword in line_upper for keyword in TOTAL_KEYWORDS):
        return True
    return False


def _looks_like_non_item(name_upper: str) -> bool:
    if any(hint in name_upper for hint in NON_ITEM_HINTS):
        return True
    if name_upper.startswith("TOTAL"):
        return True
    if re.fullmatch(r"[\d\W]+", name_upper):
        return True
    return False


def _extract_price_candidate(line_text: str) -> Optional[Tuple[str, float, int]]:
    matches = list(PRICE_REGEX.finditer(line_text))
    if not matches:
        return None

    match = matches[-1]
    price_value = parse_price(match.group(1))
    if price_value is None:
        return None

    return match.group(1), price_value, match.start()


def extract_items_and_total(lines: Iterable[OCRLine]) -> Dict[str, object]:
    items: List[Dict[str, object]] = []
    total_candidates: List[Tuple[float, int, str]] = []
    all_price_candidates: List[float] = []

    for line in lines:
        raw_line = line.text.strip()
        if not raw_line:
            continue

        extracted = _extract_price_candidate(raw_line)
        if not extracted:
            continue

        _, price, price_start = extracted
        all_price_candidates.append(price)

        prefix = _clean_item_prefix(raw_line[:price_start])
        line_upper = _normalize_text(raw_line)
        prefix_upper = _normalize_text(prefix)

        score = 0
        if _is_total_line(line_upper):
            score += 2
        if "GRAND" in line_upper or "DUE" in line_upper:
            score += 1
        if score > 0:
            total_candidates.append((price, score, raw_line))
            continue

        if not prefix or len(prefix) < 2:
            continue
        if _looks_like_non_item(prefix_upper):
            continue

        item = {
            "name": prefix,
            "price": price,
        }
        items.append(item)

    total: Optional[float] = None
    if total_candidates:
        total = sorted(total_candidates, key=lambda t: (t[1], t[0]))[-1][0]
    elif all_price_candidates and items:
        # Fallback when no explicit total keyword is detected.
        total = max(all_price_candidates)

    return {
        "items": items,
        "total": total,
    }
