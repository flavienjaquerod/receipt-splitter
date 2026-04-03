# Standalone Receipt OCR Pipeline

This folder contains a standalone, local-first OCR pipeline for receipt images.
It does not require any changes in the web application code.

## OCR Engine Comparison

### 1) Tesseract
- Pros:
  - Fully local and CPU friendly.
  - Mature, easy to install, very lightweight runtime.
  - Provides word-level bounding boxes via `image_to_data`.
- Cons:
  - Less robust than deep learning OCR on very noisy or curved receipts.

### 2) EasyOCR
- Pros:
  - Better robustness than Tesseract on some low-quality images.
  - Returns text with bounding boxes out of the box.
- Cons:
  - Depends on PyTorch and larger model weights.
  - Heavier startup and memory footprint on CPU-only machines.

### 3) DocTR (and similar modern OCR models)
- Pros:
  - Strong modern OCR quality and end-to-end document understanding potential.
- Cons:
  - Heavier dependencies and generally slower CPU performance.
  - More complex setup for a simple baseline requirement.

## Selected Baseline

This baseline uses Tesseract because it is lightweight, local-first, and easy to debug on CPU while still giving usable bounding boxes and text for rule-based line/item extraction.

## Folder Structure

- `preprocessing.py`: grayscale, adaptive thresholding, denoise, optional boundary detection, deskew.
- `engine.py`: OCR extraction with text + bounding boxes using Tesseract.
- `lines.py`: reconstruct lines from OCR tokens.
- `extract.py`: item and total extraction using regex + heuristics.
- `pipeline.py`: orchestration of preprocessing -> OCR -> lines -> extraction.
- `debug.py`: overlays and intermediate artifact export.
- `evaluation.py`: dataset loading + metrics (SROIE required, CORD optional, manifest supported).
- `cli.py`: command line entrypoint.

## Installation

1. Install Python dependencies:

```bash
pip install -r scripts/ocr/requirements.txt
```

2. Install Tesseract OCR on your machine:
- Windows: install from UB Mannheim build or official package and ensure `tesseract` is on PATH.
- Linux: `sudo apt-get install tesseract-ocr`
- macOS: `brew install tesseract`

## Run on One Image

```bash
python -m scripts.ocr.cli run "receipts/your-image.jpg" --debug-dir .ocr-debug/sample
```

Output JSON format:

```json
{
  "items": [
    {"name": "Coffee", "price": 3.5}
  ],
  "total": 42.8
}
```

## Evaluate on SROIE

```bash
python -m scripts.ocr.cli evaluate --dataset-type sroie --dataset-path path/to/sroie --split train
```

SROIE loader expects typical split folders with image and key/entity files:
- `train/img` or `train/images`
- `train/entities` or `train/key`

## Evaluate on CORD (Optional)

```bash
python -m scripts.ocr.cli evaluate --dataset-type cord --dataset-path path/to/cord --split train
```

## Evaluate on Custom Manifest

Create a JSON file:

```json
{
  "samples": [
    {
      "image": "receipts/sample.jpg",
      "items": [{"name": "Milk", "price": 2.5}],
      "total": 12.9
    }
  ]
}
```

Run:

```bash
python -m scripts.ocr.cli evaluate --dataset-type manifest --dataset-path path/to/manifest.json
```

## Tune Preprocessing Hyperparameters

Use a labeled subset (SROIE, CORD, or manifest) to tune preprocessing parameters with grid search.

Example on CORD test with 30 shuffled samples:

```bash
python -m scripts.ocr.cli tune-preprocessing \
  --dataset-type cord \
  --dataset-path datasets/CORD/CORD \
  --split test \
  --max-samples 30 \
  --shuffle-samples \
  --sample-seed 42 \
  --denoise-values 5,10,15 \
  --block-size-values 21,31,41 \
  --adaptive-c-values 10,15,20 \
  --deskew-values true,false \
  --boundary-values true,false \
  --tesseract-cmd "C:\\Program Files\\Tesseract-OCR\\tesseract.exe" \
  --json-out .ocr-debug/eval/cord_tuning.json
```

The command prints the best configuration and top-ranked candidates by objective score:
- Item F1 when item ground truth is available (for example CORD)
- Otherwise total extraction quality (accuracy with MAE penalty)

Then reuse the best parameters in normal evaluation:

```bash
python -m scripts.ocr.cli evaluate \
  --dataset-type cord \
  --dataset-path datasets/CORD/CORD \
  --split test \
  --denoise-h 10 \
  --adaptive-block-size 31 \
  --adaptive-c 15 \
  --tesseract-cmd "C:\\Program Files\\Tesseract-OCR\\tesseract.exe"
```

## Standalone Parsing Module (Rule-Based)

This project also includes a dedicated text parsing module for semi-structured receipts:

- `parsing/cleaning.py`: OCR cleanup, noise normalization, irrelevant line filtering
- `parsing/line_grouping.py`: line reconstruction from text or word boxes + visualization
- `parsing/price_extraction.py`: robust price regex + conversion to float
- `parsing/parser.py`: end-to-end extraction of `items` and `total`

Example usage (text-only):

```python
from scripts.ocr.parsing import parse_receipt

result = parse_receipt(raw_text="""
COFFEE 3.50
SANDWICH 8.90
TOTAL 12.40
""")

print(result["items"], result["total"])
```

Example usage (words + boxes preferred):

```python
from scripts.ocr.parsing import parse_receipt

words = [
    {"text": "COFFEE", "x": 10, "y": 100, "w": 80, "h": 20},
    {"text": "3.50", "x": 200, "y": 100, "w": 40, "h": 20},
    {"text": "TOTAL", "x": 10, "y": 220, "w": 70, "h": 20},
    {"text": "12.40", "x": 200, "y": 220, "w": 50, "h": 20},
]

result = parse_receipt(words_with_boxes=words)
```

Debug examples:

```bash
python -m scripts.ocr.parsing.test_parsing_examples
```

Run parser debug on a real image (includes line-grouping visualization):

```bash
python -m scripts.ocr.parsing.debug_receipt_example receipts/sample.jpg --tesseract-cmd "C:\\Program Files\\Tesseract-OCR\\tesseract.exe"
```
