import sys

from scripts.ocr.cli import main


if __name__ == "__main__":
    main(["evaluate", *sys.argv[1:]])
