from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Tuple

import cv2


@dataclass
class LineGroupingConfig:
    y_tolerance_ratio: float = 0.6


def reconstruct_lines_from_text(raw_text: str) -> Tuple[List[str], List[Dict[str, object]]]:
    lines = [line.strip() for line in (raw_text or "").splitlines() if line.strip()]
    return lines, [{"text": line} for line in lines]


def _line_bbox(words: List[Dict[str, object]]) -> Dict[str, int]:
    x_min = min(int(word["x"]) for word in words)
    y_min = min(int(word["y"]) for word in words)
    x_max = max(int(word["x"] + word["w"]) for word in words)
    y_max = max(int(word["y"] + word["h"]) for word in words)
    return {"x": x_min, "y": y_min, "w": x_max - x_min, "h": y_max - y_min}


def reconstruct_lines_from_words(
    words: Iterable[Dict[str, object]],
    config: LineGroupingConfig | None = None,
) -> Tuple[List[str], List[Dict[str, object]]]:
    cfg = config or LineGroupingConfig()
    word_list = list(words)
    if not word_list:
        return [], []

    sorted_words = sorted(word_list, key=lambda word: (float(word["y"]), float(word["x"])))
    buckets: List[Dict[str, object]] = []

    for word in sorted_words:
        cy = float(word["y"]) + (float(word["h"]) / 2.0)
        h = float(word["h"])
        assigned = False

        for bucket in buckets:
            center_y = float(bucket["center_y"])
            avg_height = float(bucket["avg_height"])
            tolerance = max(avg_height, h) * cfg.y_tolerance_ratio
            if abs(cy - center_y) <= tolerance:
                bucket_words = bucket["words"]
                assert isinstance(bucket_words, list)
                bucket_words.append(word)
                heights = [float(item["h"]) for item in bucket_words]
                centers = [float(item["y"]) + (float(item["h"]) / 2.0) for item in bucket_words]
                bucket["avg_height"] = sum(heights) / len(heights)
                bucket["center_y"] = sum(centers) / len(centers)
                assigned = True
                break

        if not assigned:
            buckets.append(
                {
                    "words": [word],
                    "center_y": cy,
                    "avg_height": h,
                }
            )

    grouped: List[Dict[str, object]] = []
    for bucket in sorted(buckets, key=lambda b: float(b["center_y"])):
        bucket_words = bucket["words"]
        assert isinstance(bucket_words, list)
        row_words = sorted(bucket_words, key=lambda word: float(word["x"]))
        line_text = " ".join(str(word["text"]) for word in row_words).strip()
        if not line_text:
            continue
        grouped.append(
            {
                "text": line_text,
                "words": row_words,
                "bbox": _line_bbox(row_words),
            }
        )

    return [line["text"] for line in grouped], grouped


def visualize_line_grouping(
    image_path: str,
    grouped_lines: List[Dict[str, object]],
    output_path: str,
) -> None:
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Could not read image at path: {image_path}")

    palette = [
        (255, 0, 0),
        (0, 200, 0),
        (0, 120, 255),
        (180, 0, 200),
        (0, 200, 200),
        (200, 200, 0),
    ]

    for index, line in enumerate(grouped_lines):
        color = palette[index % len(palette)]
        bbox = line.get("bbox", {})
        x = int(bbox.get("x", 0))
        y = int(bbox.get("y", 0))
        w = int(bbox.get("w", 0))
        h = int(bbox.get("h", 0))
        cv2.rectangle(image, (x, y), (x + w, y + h), color, 2)

        for word in line.get("words", []):
            wx = int(word.get("x", 0))
            wy = int(word.get("y", 0))
            ww = int(word.get("w", 0))
            wh = int(word.get("h", 0))
            cv2.rectangle(image, (wx, wy), (wx + ww, wy + wh), color, 1)

    cv2.imwrite(output_path, image)
