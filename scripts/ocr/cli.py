from __future__ import annotations

import argparse
import json
from pathlib import Path
import random
import sys
from typing import List

from .evaluation import evaluate_samples, load_cord_samples, load_manifest_samples, load_sroie_samples
from .pipeline import ReceiptOCRConfig, ReceiptOCRPipeline
from .tuning import PreprocessingGrid, tune_preprocessing


def _build_pipeline(args: argparse.Namespace) -> ReceiptOCRPipeline:
    config = ReceiptOCRConfig(
        lang=args.lang,
        psm=args.psm,
        oem=args.oem,
        min_confidence=args.min_confidence,
        tesseract_cmd=args.tesseract_cmd,
        detect_receipt_boundary=not args.no_receipt_boundary,
        deskew=not args.no_deskew,
        denoise_h=getattr(args, "denoise_h", 10),
        adaptive_block_size=getattr(args, "adaptive_block_size", 31),
        adaptive_c=getattr(args, "adaptive_c", 15),
    )
    return ReceiptOCRPipeline(config)


def _parse_int_list(value: str) -> List[int]:
    entries = [part.strip() for part in value.split(",") if part.strip()]
    if not entries:
        raise ValueError("Expected at least one integer value.")
    return [int(part) for part in entries]


def _parse_bool_list(value: str) -> List[bool]:
    mapping = {
        "1": True,
        "0": False,
        "true": True,
        "false": False,
        "yes": True,
        "no": False,
        "on": True,
        "off": False,
    }
    entries = [part.strip().lower() for part in value.split(",") if part.strip()]
    if not entries:
        raise ValueError("Expected at least one boolean value.")

    parsed = []
    for entry in entries:
        if entry not in mapping:
            raise ValueError(f"Invalid boolean token: {entry}")
        parsed.append(mapping[entry])
    return parsed


def _load_samples(dataset_type: str, dataset_path: str, split: str):
    if dataset_type == "sroie":
        return load_sroie_samples(dataset_path, split=split)
    if dataset_type == "cord":
        return load_cord_samples(dataset_path, split=split)
    return load_manifest_samples(dataset_path)


def _print_json(payload: object) -> None:
    print(json.dumps(payload, indent=2, ensure_ascii=False))


def _print_intermediate(payload: dict) -> None:
    metadata = payload.get("metadata", {})
    tokens = payload.get("tokens", [])
    lines = payload.get("lines", [])
    items = payload.get("items", [])

    print("\n=== PREPROCESSING ===")
    print(json.dumps(metadata, indent=2, ensure_ascii=False))

    print("\n=== OCR TOKENS ===")
    print(f"token_count: {len(tokens)}")
    for token in tokens[:20]:
        text = str(token.get("text", "")).strip()
        conf = token.get("confidence")
        bbox = token.get("bbox")
        print(f"- text={text!r} conf={conf} bbox={bbox}")
    if len(tokens) > 20:
        print(f"... {len(tokens) - 20} more tokens")

    print("\n=== RECONSTRUCTED LINES ===")
    for line in lines:
        print(f"- {line.get('text', '')}")

    print("\n=== EXTRACTED ITEMS ===")
    for item in items:
        print(f"- {item}")
    print(f"\nTOTAL: {payload.get('total')}")


def run_single(args: argparse.Namespace) -> None:
    pipeline = _build_pipeline(args)
    result = pipeline.run(args.image, debug_dir=args.debug_dir)
    payload = result.to_dict()
    if args.print_intermediate:
        _print_intermediate(payload)
    _print_json(payload)

    if args.json_out:
        output_path = Path(args.json_out)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def run_evaluation(args: argparse.Namespace) -> None:
    pipeline = _build_pipeline(args)
    samples = _load_samples(args.dataset_type, args.dataset_path, args.split)

    report = evaluate_samples(
        samples=samples,
        pipeline=pipeline,
        debug_root=args.debug_root,
        max_samples=args.max_samples,
        show_progress=not args.no_progress,
    )

    _print_json(report)

    if args.json_out:
        output_path = Path(args.json_out)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")


def run_tune_preprocessing(args: argparse.Namespace) -> None:
    samples = _load_samples(args.dataset_type, args.dataset_path, args.split)

    if args.shuffle_samples:
        rng = random.Random(args.sample_seed)
        rng.shuffle(samples)

    if args.max_samples is not None:
        samples = samples[: args.max_samples]

    base_config = ReceiptOCRConfig(
        lang=args.lang,
        psm=args.psm,
        oem=args.oem,
        min_confidence=args.min_confidence,
        tesseract_cmd=args.tesseract_cmd,
        detect_receipt_boundary=True,
        deskew=True,
        denoise_h=args.denoise_h,
        adaptive_block_size=args.adaptive_block_size,
        adaptive_c=args.adaptive_c,
    )

    grid = PreprocessingGrid(
        denoise_values=_parse_int_list(args.denoise_values),
        adaptive_block_sizes=_parse_int_list(args.block_size_values),
        adaptive_cs=_parse_int_list(args.adaptive_c_values),
        deskew_values=_parse_bool_list(args.deskew_values),
        boundary_values=_parse_bool_list(args.boundary_values),
    )

    report = tune_preprocessing(
        samples=samples,
        base_config=base_config,
        grid=grid,
        show_progress=not args.no_progress,
    )

    top_k = max(1, args.top_k)
    payload = {
        "tested_combinations": report["tested_combinations"],
        "search_space": report["search_space"],
        "best": report["best"],
        "top": report["ranked"][:top_k],
    }

    _print_json(payload)

    if args.json_out:
        output_path = Path(args.json_out)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Standalone receipt OCR pipeline")
    subparsers = parser.add_subparsers(dest="command", required=True)

    base_parser = argparse.ArgumentParser(add_help=False)
    base_parser.add_argument("--lang", default="eng", help="Tesseract language model (default: eng)")
    base_parser.add_argument("--psm", default=6, type=int, help="Tesseract page segmentation mode")
    base_parser.add_argument("--oem", default=3, type=int, help="Tesseract OCR engine mode")
    base_parser.add_argument("--min-confidence", default=20.0, type=float, help="Minimum OCR token confidence")
    base_parser.add_argument("--tesseract-cmd", default=None, help="Path to tesseract executable")
    base_parser.add_argument("--no-deskew", action="store_true", help="Disable deskew stage")
    base_parser.add_argument(
        "--no-receipt-boundary",
        action="store_true",
        help="Disable receipt boundary detection and perspective crop",
    )
    base_parser.add_argument("--denoise-h", default=10, type=int, help="OpenCV non-local means denoising strength")
    base_parser.add_argument("--adaptive-block-size", default=31, type=int, help="Adaptive threshold block size")
    base_parser.add_argument("--adaptive-c", default=15, type=int, help="Adaptive threshold subtraction constant")

    run_parser = subparsers.add_parser("run", parents=[base_parser], help="Run OCR on one image")
    run_parser.add_argument("image", help="Path to receipt image")
    run_parser.add_argument("--debug-dir", default=None, help="Directory to save debug artifacts")
    run_parser.add_argument(
        "--print-intermediate",
        action="store_true",
        help="Print preprocessing metadata, OCR tokens, reconstructed lines, and extracted items",
    )
    run_parser.add_argument("--json-out", default=None, help="Optional path to save result JSON")
    run_parser.set_defaults(func=run_single)

    eval_parser = subparsers.add_parser("evaluate", parents=[base_parser], help="Evaluate on a dataset")
    eval_parser.add_argument("--dataset-type", choices=["sroie", "cord", "manifest"], required=True)
    eval_parser.add_argument("--dataset-path", required=True, help="Path to dataset root or manifest JSON")
    eval_parser.add_argument("--split", default="train", help="Dataset split for sroie/cord")
    eval_parser.add_argument("--max-samples", default=None, type=int, help="Limit number of evaluated samples")
    eval_parser.add_argument("--debug-root", default=None, help="Save per-sample debug artifacts under this folder")
    eval_parser.add_argument("--no-progress", action="store_true", help="Disable evaluation progress bar")
    eval_parser.add_argument("--json-out", default=None, help="Optional path to save report JSON")
    eval_parser.set_defaults(func=run_evaluation)

    tune_parser = subparsers.add_parser(
        "tune-preprocessing",
        parents=[base_parser],
        help="Grid-search preprocessing parameters on a labeled dataset subset",
    )
    tune_parser.add_argument("--dataset-type", choices=["sroie", "cord", "manifest"], required=True)
    tune_parser.add_argument("--dataset-path", required=True, help="Path to dataset root or manifest JSON")
    tune_parser.add_argument("--split", default="train", help="Dataset split for sroie/cord")
    tune_parser.add_argument("--max-samples", default=30, type=int, help="How many labeled samples to tune on")
    tune_parser.add_argument("--shuffle-samples", action="store_true", help="Shuffle samples before taking max-samples")
    tune_parser.add_argument("--sample-seed", default=42, type=int, help="Random seed used with --shuffle-samples")
    tune_parser.add_argument("--denoise-values", default="5,10,15", help="Comma-separated denoise_h values")
    tune_parser.add_argument("--block-size-values", default="21,31,41", help="Comma-separated adaptive block sizes")
    tune_parser.add_argument("--adaptive-c-values", default="10,15,20", help="Comma-separated adaptive C values")
    tune_parser.add_argument("--deskew-values", default="true,false", help="Comma-separated booleans")
    tune_parser.add_argument("--boundary-values", default="true,false", help="Comma-separated booleans")
    tune_parser.add_argument("--top-k", default=5, type=int, help="Number of best configurations to display")
    tune_parser.add_argument("--no-progress", action="store_true", help="Disable tuning progress bar")
    tune_parser.add_argument("--json-out", default=None, help="Optional path to save tuning report JSON")
    tune_parser.set_defaults(func=run_tune_preprocessing)

    return parser


def main(argv: List[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(sys.argv[1:] if argv is None else argv)
    args.func(args)


if __name__ == "__main__":
    main()
