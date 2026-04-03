from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, Tuple

import cv2
import numpy as np

from .types import PreprocessingResult


@dataclass
class PreprocessingConfig:
    detect_receipt_boundary: bool = True
    deskew: bool = True
    denoise_h: int = 10
    adaptive_block_size: int = 31
    adaptive_c: int = 15


def load_image(image_path: str) -> np.ndarray:
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Could not read image at path: {image_path}")
    return image


def _order_points(points: np.ndarray) -> np.ndarray:
    rect = np.zeros((4, 2), dtype="float32")
    s = points.sum(axis=1)
    diff = np.diff(points, axis=1)
    rect[0] = points[np.argmin(s)]
    rect[2] = points[np.argmax(s)]
    rect[1] = points[np.argmin(diff)]
    rect[3] = points[np.argmax(diff)]
    return rect


def _four_point_transform(image: np.ndarray, points: np.ndarray) -> np.ndarray:
    rect = _order_points(points)
    (tl, tr, br, bl) = rect

    width_a = np.linalg.norm(br - bl)
    width_b = np.linalg.norm(tr - tl)
    max_width = int(max(width_a, width_b))

    height_a = np.linalg.norm(tr - br)
    height_b = np.linalg.norm(tl - bl)
    max_height = int(max(height_a, height_b))

    dst = np.array(
        [
            [0, 0],
            [max_width - 1, 0],
            [max_width - 1, max_height - 1],
            [0, max_height - 1],
        ],
        dtype="float32",
    )

    matrix = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(image, matrix, (max_width, max_height))


def _detect_receipt_contour(gray: np.ndarray) -> Optional[np.ndarray]:
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150)
    edges = cv2.dilate(edges, np.ones((3, 3), np.uint8), iterations=1)

    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    image_area = float(gray.shape[0] * gray.shape[1])
    for contour in sorted(contours, key=cv2.contourArea, reverse=True)[:15]:
        area = cv2.contourArea(contour)
        if area < image_area * 0.15:
            continue

        perimeter = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
        if len(approx) == 4:
            return approx.reshape(4, 2).astype("float32")

    return None


def _estimate_skew_angle(binary_image: np.ndarray) -> float:
    inverted = cv2.bitwise_not(binary_image)
    coords = np.column_stack(np.where(inverted > 0))
    if coords.shape[0] < 100:
        return 0.0

    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = 90 + angle
    return -float(angle)


def _rotate_image(image: np.ndarray, angle_degrees: float) -> np.ndarray:
    if abs(angle_degrees) < 0.05:
        return image.copy()

    height, width = image.shape[:2]
    center = (width // 2, height // 2)
    matrix = cv2.getRotationMatrix2D(center, angle_degrees, 1.0)
    return cv2.warpAffine(
        image,
        matrix,
        (width, height),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )


def preprocess_image(
    image: np.ndarray,
    config: Optional[PreprocessingConfig] = None,
) -> PreprocessingResult:
    cfg = config or PreprocessingConfig()

    stages: Dict[str, np.ndarray] = {"original": image.copy()}
    working = image.copy()

    gray = cv2.cvtColor(working, cv2.COLOR_BGR2GRAY)
    stages["grayscale"] = gray.copy()

    boundary_detected = False
    if cfg.detect_receipt_boundary:
        contour = _detect_receipt_contour(gray)
        if contour is not None:
            working = _four_point_transform(working, contour)
            gray = cv2.cvtColor(working, cv2.COLOR_BGR2GRAY)
            stages["receipt_cropped"] = working.copy()
            stages["grayscale"] = gray.copy()
            boundary_detected = True

    denoised = cv2.fastNlMeansDenoising(gray, None, cfg.denoise_h, 7, 21)
    stages["denoised"] = denoised.copy()

    block_size = cfg.adaptive_block_size if cfg.adaptive_block_size % 2 == 1 else cfg.adaptive_block_size + 1
    binary = cv2.adaptiveThreshold(
        denoised,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        max(block_size, 3),
        cfg.adaptive_c,
    )
    stages["adaptive_threshold"] = binary.copy()

    cleaned = cv2.medianBlur(binary, 3)
    stages["noise_removed"] = cleaned.copy()

    skew_angle = 0.0
    if cfg.deskew:
        skew_angle = _estimate_skew_angle(cleaned)
        cleaned = _rotate_image(cleaned, skew_angle)
    stages["deskewed"] = cleaned.copy()

    metadata = {
        "boundary_detected": boundary_detected,
        "skew_angle_degrees": round(float(skew_angle), 4),
    }

    return PreprocessingResult(
        original_image=image,
        processed_image=cleaned,
        stages=stages,
        metadata=metadata,
    )
