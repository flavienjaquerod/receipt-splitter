from __future__ import annotations

import json
import os
from typing import Dict, Iterable

import cv2
import numpy as np

from .types import OCRLine, OCRToken, PipelineResult


def _ensure_color(image: np.ndarray) -> np.ndarray:
    if len(image.shape) == 2:
        return cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    return image.copy()


def draw_token_boxes(image: np.ndarray, tokens: Iterable[OCRToken]) -> np.ndarray:
    overlay = _ensure_color(image)
    for token in tokens:
        x, y, w, h = token.bbox.x, token.bbox.y, token.bbox.w, token.bbox.h
        cv2.rectangle(overlay, (x, y), (x + w, y + h), (0, 200, 0), 1)
    return overlay


def draw_line_boxes(image: np.ndarray, lines: Iterable[OCRLine]) -> np.ndarray:
    overlay = _ensure_color(image)
    for line in lines:
        x, y, w, h = line.bbox.x, line.bbox.y, line.bbox.w, line.bbox.h
        cv2.rectangle(overlay, (x, y), (x + w, y + h), (220, 120, 0), 2)
    return overlay


def save_debug_artifacts(
    debug_dir: str,
    stages: Dict[str, np.ndarray],
    result: PipelineResult,
) -> None:
    os.makedirs(debug_dir, exist_ok=True)

    for stage_name, stage_image in stages.items():
        output_path = os.path.join(debug_dir, f"{stage_name}.png")
        cv2.imwrite(output_path, stage_image)

    if "deskewed" in stages:
        base_image = stages["deskewed"]
    elif "noise_removed" in stages:
        base_image = stages["noise_removed"]
    else:
        base_image = next(iter(stages.values()))

    token_overlay = draw_token_boxes(base_image, result.tokens)
    line_overlay = draw_line_boxes(base_image, result.lines)
    cv2.imwrite(os.path.join(debug_dir, "tokens_overlay.png"), token_overlay)
    cv2.imwrite(os.path.join(debug_dir, "lines_overlay.png"), line_overlay)

    with open(os.path.join(debug_dir, "tokens.json"), "w", encoding="utf-8") as handle:
        json.dump([token.to_dict() for token in result.tokens], handle, indent=2)

    with open(os.path.join(debug_dir, "lines.json"), "w", encoding="utf-8") as handle:
        json.dump([line.to_dict() for line in result.lines], handle, indent=2)

    with open(os.path.join(debug_dir, "result.json"), "w", encoding="utf-8") as handle:
        json.dump(result.to_dict(), handle, indent=2)
