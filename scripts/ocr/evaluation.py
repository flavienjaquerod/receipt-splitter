from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
import importlib
import json
from pathlib import Path
import re
from typing import Dict, Iterable, List, Optional, Tuple

tqdm_module = importlib.util.find_spec("tqdm")
if tqdm_module is not None:
    tqdm = importlib.import_module("tqdm").tqdm
else:
    tqdm = None

from .extract import normalize_item_name, parse_price
from .pipeline import ReceiptOCRPipeline


@dataclass
class EvaluationMetrics:
    item_precision: Optional[float]
    item_recall: Optional[float]
    item_f1: Optional[float]
    total_accuracy: Optional[float]
    total_mae: Optional[float]
    total_prediction_rate: Optional[float]
    total_samples: int

    def to_dict(self) -> Dict[str, Optional[float]]:
        return {
            "item_precision": self.item_precision,
            "item_recall": self.item_recall,
            "item_f1": self.item_f1,
            "total_accuracy": self.total_accuracy,
            "total_mae": self.total_mae,
            "total_prediction_rate": self.total_prediction_rate,
            "total_samples": self.total_samples,
        }


def _read_json(path: Path) -> Dict[str, object]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _extract_total_from_entity_content(content: str) -> Optional[float]:
    content = content.strip()
    if not content:
        return None

    parsed: Dict[str, object] = {}
    try:
        decoded = json.loads(content)
        if isinstance(decoded, dict):
            parsed = decoded
    except json.JSONDecodeError:
        for line in content.splitlines():
            line = line.strip().strip(",")
            if not line:
                continue
            match = re.match(r"\"?([A-Za-z_ ]+)\"?\s*[:=]\s*\"?(.*?)\"?$", line)
            if not match:
                continue
            key = match.group(1).strip()
            value = match.group(2).strip().strip("\",")
            parsed[key] = value

    if not parsed:
        return None

    for key, value in parsed.items():
        if "total" in key.lower():
            amount = parse_price(str(value))
            if amount is not None:
                return amount

    return None


def load_manifest_samples(manifest_path: str) -> List[Dict[str, object]]:
    path = Path(manifest_path)
    if not path.exists():
        raise FileNotFoundError(f"Manifest not found: {manifest_path}")

    payload = _read_json(path)
    records = payload.get("samples") if isinstance(payload, dict) else None
    if not isinstance(records, list):
        raise ValueError("Manifest format invalid. Expected {'samples': [...]}.")

    samples: List[Dict[str, object]] = []
    for index, record in enumerate(records):
        if not isinstance(record, dict):
            continue
        image_raw = record.get("image")
        if not isinstance(image_raw, str):
            continue
        image_path = Path(image_raw)
        if not image_path.is_absolute():
            candidate_manifest_relative = (path.parent / image_path).resolve()
            candidate_cwd_relative = (Path.cwd() / image_path).resolve()
            if candidate_manifest_relative.exists():
                image_path = candidate_manifest_relative
            elif candidate_cwd_relative.exists():
                image_path = candidate_cwd_relative
            else:
                image_path = candidate_manifest_relative

        items = record.get("items") if isinstance(record.get("items"), list) else []
        total = record.get("total")
        parsed_total = parse_price(str(total)) if total is not None else None

        samples.append(
            {
                "id": str(record.get("id", index)),
                "image_path": str(image_path),
                "items": items,
                "total": parsed_total,
            }
        )

    return samples


def _find_dir(base: Path, candidates: Iterable[str]) -> Optional[Path]:
    for candidate in candidates:
        maybe = base / candidate
        if maybe.exists() and maybe.is_dir():
            return maybe
    return None


def load_sroie_samples(dataset_root: str, split: str = "train") -> List[Dict[str, object]]:
    root = Path(dataset_root)
    if not root.exists():
        raise FileNotFoundError(f"SROIE path not found: {dataset_root}")

    split_root = root / split if (root / split).exists() else root

    image_dir = _find_dir(split_root, ["img", "images", "image"])
    entity_dir = _find_dir(split_root, ["entities", "entity", "key", "keys"])

    if image_dir is None:
        raise ValueError("Could not find SROIE image directory (img/images/image).")
    if entity_dir is None:
        raise ValueError("Could not find SROIE entity directory (entities/key).")

    samples: List[Dict[str, object]] = []
    image_paths = sorted(
        [p for p in image_dir.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"}]
    )

    for image_path in image_paths:
        stem = image_path.stem
        entity_file = None
        for ext in (".txt", ".json"):
            candidate = entity_dir / f"{stem}{ext}"
            if candidate.exists():
                entity_file = candidate
                break

        if entity_file is None:
            continue

        total = _extract_total_from_entity_content(entity_file.read_text(encoding="utf-8", errors="ignore"))

        samples.append(
            {
                "id": stem,
                "image_path": str(image_path),
                "items": [],
                "total": total,
            }
        )

    if not samples:
        raise ValueError("No evaluable SROIE samples found.")

    return samples


def _words_to_text(words_obj: object) -> str:
    if isinstance(words_obj, list):
        parts = []
        for token in words_obj:
            if isinstance(token, dict) and "text" in token:
                parts.append(str(token["text"]))
            elif isinstance(token, str):
                parts.append(token)
        return " ".join(parts).strip()
    if isinstance(words_obj, str):
        return words_obj.strip()
    return ""


def load_cord_samples(dataset_root: str, split: str = "train") -> List[Dict[str, object]]:
    root = Path(dataset_root)
    split_root = root / split if (root / split).exists() else root
    json_dir = _find_dir(split_root, ["json", "annotations"])
    image_dir = _find_dir(split_root, ["image", "images", "img"])

    if json_dir is None or image_dir is None:
        raise ValueError("CORD format not found. Expected split/json and split/image directories.")

    samples: List[Dict[str, object]] = []
    for json_path in sorted(json_dir.glob("*.json")):
        payload = _read_json(json_path)
        lines = payload.get("valid_line", []) if isinstance(payload, dict) else []

        names: Dict[str, str] = {}
        prices: Dict[str, float] = {}
        total: Optional[float] = None

        if isinstance(lines, list):
            for line in lines:
                if not isinstance(line, dict):
                    continue
                category = str(line.get("category", ""))
                group_id = str(line.get("group_id", ""))
                text = _words_to_text(line.get("words", ""))

                if "menu.nm" in category:
                    names[group_id] = text
                elif "menu.price" in category:
                    parsed = parse_price(text)
                    if parsed is not None:
                        prices[group_id] = parsed
                elif "total" in category and "price" in category:
                    parsed_total = parse_price(text)
                    if parsed_total is not None:
                        total = parsed_total

        items = []
        for group_id, name in names.items():
            if group_id in prices and name:
                items.append({"name": name, "price": prices[group_id]})

        image_stem = json_path.stem
        image_path = None
        for ext in (".png", ".jpg", ".jpeg"):
            candidate = image_dir / f"{image_stem}{ext}"
            if candidate.exists():
                image_path = candidate
                break

        if image_path is None:
            continue

        samples.append(
            {
                "id": image_stem,
                "image_path": str(image_path),
                "items": items,
                "total": total,
            }
        )

    if not samples:
        raise ValueError("No evaluable CORD samples found.")

    return samples


def _item_counter(items: Iterable[Dict[str, object]]) -> Counter:
    counts = Counter()
    for item in items:
        if not isinstance(item, dict):
            continue
        name = normalize_item_name(str(item.get("name", "")))
        price = parse_price(str(item.get("price", "")))
        if not name or price is None:
            continue
        counts[(name, round(price, 2))] += 1
    return counts


def _pair_scores(
    truth_items: Iterable[Dict[str, object]],
    predicted_items: Iterable[Dict[str, object]],
) -> Tuple[int, int, int]:
    truth = _item_counter(truth_items)
    pred = _item_counter(predicted_items)

    tp = 0
    for key, pred_count in pred.items():
        tp += min(pred_count, truth.get(key, 0))

    fp = sum(pred.values()) - tp
    fn = sum(truth.values()) - tp
    return tp, fp, fn


def evaluate_samples(
    samples: List[Dict[str, object]],
    pipeline: ReceiptOCRPipeline,
    debug_root: Optional[str] = None,
    max_samples: Optional[int] = None,
    show_progress: bool = True,
) -> Dict[str, object]:
    sample_list = samples[: max_samples or len(samples)]

    item_tp = 0
    item_fp = 0
    item_fn = 0

    total_count = 0
    total_correct = 0
    total_abs_error = 0.0
    total_pred_count = 0

    per_sample: List[Dict[str, object]] = []

    if show_progress:
        if tqdm is not None:
            iterable: Iterable[Dict[str, object]] = tqdm(sample_list, desc="Evaluating", unit="sample")
        else:
            total = len(sample_list)

            def _fallback_progress() -> Iterable[Dict[str, object]]:
                width = 30
                for idx, sample in enumerate(sample_list, start=1):
                    filled = int(width * idx / max(total, 1))
                    bar = "#" * filled + "-" * (width - filled)
                    print(f"\rEvaluating: [{bar}] {idx}/{total}", end="", flush=True)
                    yield sample
                print()

            iterable = _fallback_progress()
    else:
        iterable = sample_list

    for index, sample in enumerate(iterable):
        image_path = str(sample["image_path"])
        sample_id = str(sample.get("id", index))

        sample_debug_dir = None
        if debug_root:
            sample_debug_dir = str(Path(debug_root) / sample_id)

        prediction = pipeline.run(image_path, debug_dir=sample_debug_dir)
        prediction_dict = prediction.to_dict()

        truth_items = sample.get("items") if isinstance(sample.get("items"), list) else []
        pred_items = prediction_dict.get("items") if isinstance(prediction_dict.get("items"), list) else []

        if truth_items:
            tp, fp, fn = _pair_scores(truth_items, pred_items)
            item_tp += tp
            item_fp += fp
            item_fn += fn

        truth_total = sample.get("total")
        truth_total_parsed = parse_price(str(truth_total)) if truth_total is not None else None
        pred_total = prediction_dict.get("total")
        pred_total_parsed = parse_price(str(pred_total)) if pred_total is not None else None

        sample_total_error = None
        sample_total_correct = None
        if truth_total_parsed is not None:
            total_count += 1
            if pred_total_parsed is not None:
                sample_total_error = abs(pred_total_parsed - truth_total_parsed)
                total_abs_error += sample_total_error
                total_pred_count += 1
                sample_total_correct = sample_total_error <= 0.01
                if sample_total_correct:
                    total_correct += 1
            else:
                sample_total_correct = False

        per_sample.append(
            {
                "id": sample_id,
                "image_path": image_path,
                "truth_total": truth_total_parsed,
                "pred_total": pred_total_parsed,
                "total_error": sample_total_error,
                "total_correct": sample_total_correct,
                "truth_item_count": len(truth_items),
                "pred_item_count": len(pred_items),
            }
        )

    item_precision = None
    item_recall = None
    item_f1 = None
    if (item_tp + item_fp) > 0:
        item_precision = item_tp / float(item_tp + item_fp)
    elif (item_tp + item_fn) > 0:
        item_precision = 0.0
    if (item_tp + item_fn) > 0:
        item_recall = item_tp / float(item_tp + item_fn)
    if item_precision is not None and item_recall is not None:
        if (item_precision + item_recall) > 0:
            item_f1 = 2 * item_precision * item_recall / (item_precision + item_recall)
        else:
            item_f1 = 0.0

    total_accuracy = (total_correct / float(total_count)) if total_count > 0 else None
    total_mae = (total_abs_error / float(total_pred_count)) if total_pred_count > 0 else None
    total_prediction_rate = (total_pred_count / float(total_count)) if total_count > 0 else None

    metrics = EvaluationMetrics(
        item_precision=item_precision,
        item_recall=item_recall,
        item_f1=item_f1,
        total_accuracy=total_accuracy,
        total_mae=total_mae,
        total_prediction_rate=total_prediction_rate,
        total_samples=total_count,
    )

    return {
        "metrics": metrics.to_dict(),
        "per_sample": per_sample,
        "evaluated_samples": len(sample_list),
    }
