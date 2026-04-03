from __future__ import annotations

import argparse
from pathlib import Path

from ..engine import TesseractConfig, TesseractEngine
from ..preprocessing import load_image, preprocess_image
from .parser import parse_receipt, print_debug_steps, save_line_grouping_visualization


def main() -> None:
    parser = argparse.ArgumentParser(description="Run parsing debug flow on one receipt image")
    parser.add_argument("image", help="Path to receipt image")
    parser.add_argument("--lang", default="eng", help="Tesseract language")
    parser.add_argument("--tesseract-cmd", default=None, help="Path to tesseract executable")
    parser.add_argument("--out-dir", default=".ocr-debug/parsing-demo", help="Output debug directory")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    image = load_image(args.image)
    prep = preprocess_image(image)

    engine = TesseractEngine(
        TesseractConfig(
            lang=args.lang,
            tesseract_cmd=args.tesseract_cmd,
            min_confidence=20.0,
            psm=6,
            oem=3,
        )
    )
    tokens = engine.extract_tokens(prep.processed_image)

    words = [
        {
            "text": token.text,
            "x": token.bbox.x,
            "y": token.bbox.y,
            "w": token.bbox.w,
            "h": token.bbox.h,
        }
        for token in tokens
    ]

    parsed = parse_receipt(words_with_boxes=words)
    print_debug_steps(parsed)

    grouped_path = out_dir / "line_grouping.png"
    save_line_grouping_visualization(
        image_path=args.image,
        parsed_output=parsed,
        output_path=str(grouped_path),
    )

    print(f"Saved line grouping visualization to: {grouped_path}")


if __name__ == "__main__":
    main()
