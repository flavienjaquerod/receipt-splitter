from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .debug import save_debug_artifacts
from .engine import TesseractConfig, TesseractEngine
from .extract import extract_items_and_total
from .lines import LineGroupingConfig, group_tokens_into_lines
from .preprocessing import PreprocessingConfig, load_image, preprocess_image
from .types import PipelineResult


@dataclass
class ReceiptOCRConfig:
    lang: str = "eng"
    psm: int = 6
    oem: int = 3
    min_confidence: float = 20.0
    tesseract_cmd: Optional[str] = None
    detect_receipt_boundary: bool = True
    deskew: bool = True
    denoise_h: int = 10
    adaptive_block_size: int = 31
    adaptive_c: int = 15


class ReceiptOCRPipeline:
    def __init__(self, config: Optional[ReceiptOCRConfig] = None) -> None:
        self.config = config or ReceiptOCRConfig()
        self.ocr_engine = TesseractEngine(
            TesseractConfig(
                lang=self.config.lang,
                psm=self.config.psm,
                oem=self.config.oem,
                min_confidence=self.config.min_confidence,
                tesseract_cmd=self.config.tesseract_cmd,
            )
        )

    def run(self, image_path: str, debug_dir: Optional[str] = None) -> PipelineResult:
        image = load_image(image_path)
        preprocessing_result = preprocess_image(
            image,
            PreprocessingConfig(
                detect_receipt_boundary=self.config.detect_receipt_boundary,
                deskew=self.config.deskew,
                denoise_h=self.config.denoise_h,
                adaptive_block_size=self.config.adaptive_block_size,
                adaptive_c=self.config.adaptive_c,
            ),
        )

        tokens = self.ocr_engine.extract_tokens(preprocessing_result.processed_image)
        lines = group_tokens_into_lines(tokens, LineGroupingConfig())
        extracted = extract_items_and_total(lines)

        result = PipelineResult(
            items=extracted["items"],
            total=extracted["total"],
            tokens=tokens,
            lines=lines,
            metadata=preprocessing_result.metadata,
        )

        if debug_dir:
            save_debug_artifacts(debug_dir=debug_dir, stages=preprocessing_result.stages, result=result)

        return result
