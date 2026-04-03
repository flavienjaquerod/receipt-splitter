from __future__ import annotations

import json

from .parser import parse_receipt, print_debug_steps


def run_text_only_example() -> None:
    raw = """
    COFFEE........3.50
    BIG SANDWICH
    WITH CHEESE 8.90
    TOTAL 12.40
    THANK YOU
    """

    parsed = parse_receipt(raw_text=raw)
    print("\nTEXT-ONLY INPUT RESULT")
    print(json.dumps({"items": parsed["items"], "total": parsed["total"]}, indent=2))
    print_debug_steps(parsed)


def run_words_with_boxes_example() -> None:
    words = [
        {"text": "COFFEE", "x": 10, "y": 100, "w": 80, "h": 20},
        {"text": "3.5O", "x": 210, "y": 101, "w": 40, "h": 20},
        {"text": "BIG", "x": 10, "y": 130, "w": 40, "h": 20},
        {"text": "SANDWICH", "x": 60, "y": 130, "w": 100, "h": 20},
        {"text": "WITH", "x": 10, "y": 160, "w": 45, "h": 20},
        {"text": "CHEESE", "x": 60, "y": 160, "w": 70, "h": 20},
        {"text": "8.90", "x": 210, "y": 161, "w": 40, "h": 20},
        {"text": "TOTAL", "x": 10, "y": 200, "w": 60, "h": 20},
        {"text": "12.40", "x": 210, "y": 200, "w": 50, "h": 20},
    ]

    parsed = parse_receipt(words_with_boxes=words)
    print("\nWORDS+BOXES INPUT RESULT")
    print(json.dumps({"items": parsed["items"], "total": parsed["total"]}, indent=2))
    print_debug_steps(parsed)


def main() -> None:
    run_text_only_example()
    run_words_with_boxes_example()


if __name__ == "__main__":
    main()
