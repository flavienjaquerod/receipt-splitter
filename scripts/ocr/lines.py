from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

from .types import BBox, OCRLine, OCRToken


@dataclass
class LineGroupingConfig:
    y_tolerance_ratio: float = 0.6


def _merge_bbox(tokens: List[OCRToken]) -> BBox:
    x_min = min(token.bbox.x for token in tokens)
    y_min = min(token.bbox.y for token in tokens)
    x_max = max(token.bbox.x2 for token in tokens)
    y_max = max(token.bbox.y2 for token in tokens)
    return BBox(x=x_min, y=y_min, w=x_max - x_min, h=y_max - y_min)


def group_tokens_into_lines(
    tokens: List[OCRToken],
    config: LineGroupingConfig | None = None,
) -> List[OCRLine]:
    cfg = config or LineGroupingConfig()
    if not tokens:
        return []

    buckets: List[Dict[str, object]] = []
    sorted_tokens = sorted(tokens, key=lambda token: (token.bbox.cy, token.bbox.x))

    for token in sorted_tokens:
        assigned = False
        for bucket in buckets:
            center_y = float(bucket["center_y"])
            avg_height = float(bucket["avg_height"])
            tolerance = max(avg_height, float(token.bbox.h)) * cfg.y_tolerance_ratio
            if abs(token.bbox.cy - center_y) <= tolerance:
                bucket_tokens = bucket["tokens"]
                assert isinstance(bucket_tokens, list)
                bucket_tokens.append(token)

                heights = [t.bbox.h for t in bucket_tokens]
                centers = [t.bbox.cy for t in bucket_tokens]
                bucket["avg_height"] = float(sum(heights) / len(heights))
                bucket["center_y"] = float(sum(centers) / len(centers))

                assigned = True
                break

        if not assigned:
            buckets.append(
                {
                    "tokens": [token],
                    "center_y": float(token.bbox.cy),
                    "avg_height": float(token.bbox.h),
                }
            )

    lines: List[OCRLine] = []
    sorted_buckets = sorted(buckets, key=lambda bucket: float(bucket["center_y"]))
    for bucket in sorted_buckets:
        bucket_tokens = bucket["tokens"]
        assert isinstance(bucket_tokens, list)
        bucket_tokens = sorted(bucket_tokens, key=lambda token: token.bbox.x)
        line_text = " ".join(token.text for token in bucket_tokens).strip()
        if not line_text:
            continue
        lines.append(
            OCRLine(
                text=line_text,
                tokens=bucket_tokens,
                bbox=_merge_bbox(bucket_tokens),
            )
        )

    return lines
