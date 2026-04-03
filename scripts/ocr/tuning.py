from __future__ import annotations

from dataclasses import asdict, dataclass
import importlib
import itertools
from typing import Dict, Iterable, List

from .evaluation import evaluate_samples
from .pipeline import ReceiptOCRConfig, ReceiptOCRPipeline


tqdm_module = importlib.util.find_spec("tqdm")
if tqdm_module is not None:
    tqdm = importlib.import_module("tqdm").tqdm
else:
    tqdm = None


@dataclass
class PreprocessingGrid:
    denoise_values: List[int]
    adaptive_block_sizes: List[int]
    adaptive_cs: List[int]
    deskew_values: List[bool]
    boundary_values: List[bool]


def _to_odd(value: int) -> int:
    return value if value % 2 == 1 else value + 1


def _objective(metrics: Dict[str, object]) -> float:
    item_f1 = metrics.get("item_f1")
    total_accuracy = metrics.get("total_accuracy")
    total_mae = metrics.get("total_mae")
    total_prediction_rate = metrics.get("total_prediction_rate")

    secondary = 0.0
    if isinstance(total_accuracy, (int, float)) and isinstance(total_prediction_rate, (int, float)):
        secondary = 0.7 * float(total_accuracy) + 0.3 * float(total_prediction_rate)
        if isinstance(total_mae, (int, float)):
            mae_penalty = float(total_mae) / (1.0 + float(total_mae))
            secondary -= 0.15 * mae_penalty

    if isinstance(item_f1, (int, float)):
        # Item F1 is the primary objective, with a small tie-breaker on totals.
        return float(item_f1) + 0.01 * secondary

    if isinstance(total_accuracy, (int, float)) and isinstance(total_prediction_rate, (int, float)):
        return secondary
    if isinstance(total_accuracy, (int, float)):
        return float(total_accuracy)
    if isinstance(total_prediction_rate, (int, float)):
        return 0.3 * float(total_prediction_rate)
    if isinstance(total_mae, (int, float)):
        return -float(total_mae)

    return float("-inf")


def _iter_with_progress(items: List[tuple], show_progress: bool) -> Iterable[tuple]:
    if not show_progress:
        return items

    if tqdm is not None:
        return tqdm(items, desc="Tuning preprocessing", unit="config")

    total = len(items)

    def _fallback() -> Iterable[tuple]:
        width = 30
        for index, item in enumerate(items, start=1):
            filled = int(width * index / max(total, 1))
            bar = "#" * filled + "-" * (width - filled)
            print(f"\rTuning preprocessing: [{bar}] {index}/{total}", end="", flush=True)
            yield item
        print()

    return _fallback()


def tune_preprocessing(
    samples: List[Dict[str, object]],
    base_config: ReceiptOCRConfig,
    grid: PreprocessingGrid,
    show_progress: bool = True,
) -> Dict[str, object]:
    combinations = list(
        itertools.product(
            sorted(set(int(v) for v in grid.denoise_values)),
            sorted(set(_to_odd(int(v)) for v in grid.adaptive_block_sizes if int(v) >= 3)),
            sorted(set(int(v) for v in grid.adaptive_cs)),
            list(dict.fromkeys(bool(v) for v in grid.deskew_values)),
            list(dict.fromkeys(bool(v) for v in grid.boundary_values)),
        )
    )

    if not combinations:
        raise ValueError("No preprocessing parameter combinations were generated.")

    results: List[Dict[str, object]] = []

    for denoise_h, block_size, adaptive_c, deskew, boundary in _iter_with_progress(combinations, show_progress):
        config = ReceiptOCRConfig(
            lang=base_config.lang,
            psm=base_config.psm,
            oem=base_config.oem,
            min_confidence=base_config.min_confidence,
            tesseract_cmd=base_config.tesseract_cmd,
            detect_receipt_boundary=boundary,
            deskew=deskew,
            denoise_h=denoise_h,
            adaptive_block_size=block_size,
            adaptive_c=adaptive_c,
        )

        report = evaluate_samples(
            samples=samples,
            pipeline=ReceiptOCRPipeline(config),
            debug_root=None,
            max_samples=None,
            show_progress=False,
        )
        metrics = report["metrics"]
        objective = _objective(metrics)

        results.append(
            {
                "objective": objective,
                "params": {
                    "denoise_h": denoise_h,
                    "adaptive_block_size": block_size,
                    "adaptive_c": adaptive_c,
                    "deskew": deskew,
                    "detect_receipt_boundary": boundary,
                },
                "metrics": metrics,
                "evaluated_samples": report.get("evaluated_samples"),
            }
        )

    ranked = sorted(results, key=lambda row: row["objective"], reverse=True)
    best = ranked[0]

    return {
        "search_space": asdict(grid),
        "tested_combinations": len(combinations),
        "best": best,
        "ranked": ranked,
    }
