from __future__ import annotations

import re
from typing import List, Optional, Tuple

PRICE_REGEX = re.compile(r"(?<!\d)([\$€£]?[0-9OIl]{1,4}(?:[.,][0-9OIl]{2}))(?!\d)")


def normalize_price_token(token: str) -> str:
    value = token.strip().upper()
    value = value.replace("$", "").replace("€", "").replace("£", "")
    value = value.replace("O", "0").replace("I", "1").replace("L", "1")
    value = value.replace(" ", "")

    if "," in value and "." in value:
        if value.rfind(",") > value.rfind("."):
            value = value.replace(".", "").replace(",", ".")
        else:
            value = value.replace(",", "")
    elif "," in value and "." not in value:
        value = value.replace(",", ".")

    value = re.sub(r"[^0-9.\-]", "", value)
    return value


def parse_price(token: str) -> Optional[float]:
    normalized = normalize_price_token(token)
    if not normalized or normalized in {".", "-"}:
        return None

    try:
        return round(abs(float(normalized)), 2)
    except ValueError:
        return None


def detect_prices(line: str) -> List[Tuple[str, float, int]]:
    prices: List[Tuple[str, float, int]] = []
    for match in PRICE_REGEX.finditer(line):
        token = match.group(1)
        value = parse_price(token)
        if value is None:
            continue
        prices.append((token, value, match.start()))
    return prices


def extract_last_price(line: str) -> Optional[Tuple[str, float, int]]:
    detected = detect_prices(line)
    if not detected:
        return None
    return detected[-1]
