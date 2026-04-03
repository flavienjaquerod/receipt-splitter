from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

import pytesseract
from pytesseract import Output

from .types import BBox, OCRToken


@dataclass
class TesseractConfig:
    lang: str = "eng"
    psm: int = 6
    oem: int = 3
    min_confidence: float = 20.0
    tesseract_cmd: Optional[str] = None


class TesseractEngine:
    def __init__(self, config: Optional[TesseractConfig] = None) -> None:
        self.config = config or TesseractConfig()
        if self.config.tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = self.config.tesseract_cmd

    def extract_tokens(self, image) -> List[OCRToken]:
        custom_config = f"--oem {self.config.oem} --psm {self.config.psm}"
        data = pytesseract.image_to_data(
            image,
            lang=self.config.lang,
            output_type=Output.DICT,
            config=custom_config,
        )

        tokens: List[OCRToken] = []
        count = len(data.get("text", []))

        for i in range(count):
            text = (data["text"][i] or "").strip()
            if not text:
                continue

            try:
                confidence = float(data["conf"][i])
            except (ValueError, TypeError):
                confidence = -1.0

            if confidence < self.config.min_confidence:
                continue

            token = OCRToken(
                text=text,
                confidence=confidence,
                bbox=BBox(
                    x=int(data["left"][i]),
                    y=int(data["top"][i]),
                    w=int(data["width"][i]),
                    h=int(data["height"][i]),
                ),
            )
            tokens.append(token)

        return tokens
