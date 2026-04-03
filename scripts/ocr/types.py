from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class BBox:
    x: int
    y: int
    w: int
    h: int

    @property
    def x2(self) -> int:
        return self.x + self.w

    @property
    def y2(self) -> int:
        return self.y + self.h

    @property
    def cx(self) -> float:
        return self.x + (self.w / 2.0)

    @property
    def cy(self) -> float:
        return self.y + (self.h / 2.0)

    def to_dict(self) -> Dict[str, int]:
        return {"x": self.x, "y": self.y, "w": self.w, "h": self.h}


@dataclass
class OCRToken:
    text: str
    confidence: float
    bbox: BBox

    def to_dict(self) -> Dict[str, Any]:
        return {
            "text": self.text,
            "confidence": round(float(self.confidence), 4),
            "bbox": self.bbox.to_dict(),
        }


@dataclass
class OCRLine:
    text: str
    tokens: List[OCRToken]
    bbox: BBox

    def to_dict(self) -> Dict[str, Any]:
        return {
            "text": self.text,
            "bbox": self.bbox.to_dict(),
            "tokens": [token.to_dict() for token in self.tokens],
        }


@dataclass
class PreprocessingResult:
    original_image: Any
    processed_image: Any
    stages: Dict[str, Any]
    metadata: Dict[str, Any]


@dataclass
class PipelineResult:
    items: List[Dict[str, Any]]
    total: Optional[float]
    tokens: List[OCRToken]
    lines: List[OCRLine]
    metadata: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "items": self.items,
            "total": self.total,
            "tokens": [token.to_dict() for token in self.tokens],
            "lines": [line.to_dict() for line in self.lines],
            "metadata": self.metadata,
        }
