from __future__ import annotations

import re
import unicodedata
from typing import Dict, Iterable, List

IRRELEVANT_PHRASES = {
    "THANK YOU",
    "THANKS",
    "VISIT AGAIN",
    "HAVE A NICE DAY",
    "CUSTOMER COPY",
    "STORE COPY",
}

ADDRESS_HINTS = {
    "STREET",
    "STRASSE",
    "ROAD",
    "AVE",
    "AVENUE",
    "BLVD",
    "ZIP",
    "PLZ",
    "CITY",
}


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value or "")
    normalized = normalized.replace("\u00a0", " ")
    normalized = re.sub(r"[\t\r]+", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def fix_numeric_ocr_noise(value: str) -> str:
    text = value
    text = re.sub(r"(?<=\d)[Oo](?=[\d.,])", "0", text)
    text = re.sub(r"(?<=[\d.,])[Oo](?=\d)", "0", text)
    text = re.sub(r"(?<=\d)[Il](?=[\d.,])", "1", text)
    text = re.sub(r"(?<=[\d.,])[Il](?=\d)", "1", text)
    return text


def normalize_line(value: str) -> str:
    line = normalize_text(value)
    line = line.replace("|", " ")
    line = re.sub(r"\.{2,}", " ", line)
    line = re.sub(r"[_=~]{2,}", " ", line)
    line = fix_numeric_ocr_noise(line)
    line = re.sub(r"\s+", " ", line).strip()
    return line.upper()


def _looks_like_phone_or_url(line: str) -> bool:
    if re.search(r"(?:\+?\d[\d\s\-/]{7,}\d)", line):
        return True
    if "WWW." in line or "HTTP" in line or "@" in line:
        return True
    return False


def _looks_like_address(line: str) -> bool:
    if any(hint in line for hint in ADDRESS_HINTS):
        return True
    # Typical house number + text pattern.
    if re.search(r"\b\d{1,4}\s+[A-Z]{3,}", line):
        return True
    return False


def is_irrelevant_line(line: str) -> bool:
    if not line:
        return True
    if line in IRRELEVANT_PHRASES:
        return True
    if _looks_like_phone_or_url(line):
        return True
    if _looks_like_address(line) and not re.search(r"\d+[.,]\d{2}", line):
        return True
    return False


def clean_lines(lines: Iterable[str]) -> List[str]:
    cleaned: List[str] = []
    for line in lines:
        normalized = normalize_line(line)
        if not normalized:
            continue
        if is_irrelevant_line(normalized):
            continue
        cleaned.append(normalized)
    return cleaned


def clean_word_entries(words: Iterable[Dict[str, object]]) -> List[Dict[str, object]]:
    cleaned: List[Dict[str, object]] = []
    for word in words:
        text = normalize_text(str(word.get("text", "")))
        text = fix_numeric_ocr_noise(text)
        text = re.sub(r"\s+", " ", text).strip()
        if not text:
            continue

        x = float(word.get("x", 0))
        y = float(word.get("y", 0))
        w = float(word.get("w", max(len(text) * 8, 8)))
        h = float(word.get("h", 16))

        cleaned.append(
            {
                "text": text,
                "x": x,
                "y": y,
                "w": w,
                "h": h,
            }
        )

    return cleaned
