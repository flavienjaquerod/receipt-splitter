# 🧾 Receipt Splitter

A smart web app that uses OCR to automatically split receipt costs between roommates. Simply take a photo of your receipt, and the app will extract items, prices, and help you fairly divide expenses.

[Receipt Splitter Demo](https://receipt-splitter-henna.vercel.app/)

## Features

- **🔍 OCR Text Recognition** - Automatically extracts items and prices from receipt images
- **🌍 Multi-language Support** - Supports German and English with automatic translation
- **👥 Roommate Management** - Add, edit, and manage multiple roommates
- **💰 Smart Cost Splitting** - Assign items to specific people or split evenly
- **📊 Balance Calculation** - Automatically calculates who owes what to whom
- **📱 Mobile Responsive** - Works perfectly on phones, tablets, and desktop
- **⚡ Real-time Updates** - Live calculation updates as you make changes
- **✏️ Manual Editing** - Edit item names, prices, and assignments as needed

## 🚀 Quick Start

### Prerequisites
- Node.js 16.8+ 
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/receipt-splitter.git
   cd receipt-splitter
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000) to see the app in action!

## 📖 How to Use

### 1. Upload Receipt
- Click "Upload Receipt" and select an image file
- Supported formats: JPG, PNG, WEBP
- The app will automatically process the image using OCR

### 2. Manage Roommates
- Add roommates using the "Add" button
- Edit names by clicking the edit icon
- Set who paid for the receipt

### 3. Review & Edit Items
- **Desktop**: Use the table view to see all items at once
- **Mobile**: Card-based layout for easy touch interaction
- Edit prices by clicking the edit icon next to any amount
- Items are automatically parsed from the receipt text

### 4. Assign Items
- Click on roommate buttons to assign/unassign items to people
- Use "Toggle All" to quickly assign items to everyone
- Each person can be assigned to multiple items

### 5. View Balances
- See who owes what in the "Balance Summary" section
- Automatic calculation of splits and debts
- Clear breakdown of payments and amounts owed


## 🌍 Language Support

- **German** - Primary OCR language for Swiss/German receipts
- **English** - Translation target language
- **Auto-detection** - Automatically detects and translates text (To be implemented)
- **Confidence scores** - Shows OCR accuracy for each detected item

## PaddleOCR Setup (Receipt Focus)

This project now includes a server-side PaddleOCR pipeline for printed receipts.

### 1. Create a Python environment

```bash
python -m venv .venv
```

Windows PowerShell:

```bash
.\.venv\Scripts\Activate.ps1
```

Linux/macOS:

```bash
source .venv/bin/activate
```

### 2. Install OCR dependencies

```bash
pip install -r scripts/requirements-paddle-ocr.txt
```

### 3. Run the app

```bash
npm run dev
```

The OCR flow will try PaddleOCR first through `POST /api/ocr/paddle`, and fallback to Tesseract if Paddle is unavailable.

### 4. Optional environment variables

- `PADDLE_OCR_PYTHON`: custom Python executable path
- `PADDLE_OCR_MODEL_LANG`: Paddle model language (`latin` default)

## Dataset Evaluation (Item + Price Pairs)

Use `scripts/evaluate_receipt_pairs.py` to score extraction quality.

Dataset format:

```json
{
   "samples": [
      {
         "image": "receipts/sample1.jpg",
         "items": [
            { "name": "Coffee", "price": 3.5 },
            { "name": "Bread", "price": 2.9 }
         ]
      }
   ]
}
```

Run evaluation:

```bash
python scripts/evaluate_receipt_pairs.py --dataset path/to/dataset.json --lang latin
```

Main metric is pair-level F1 (correct item name + correct price), which is the right metric for receipt splitting.

### Advanced Receipt OCR Pipeline (Local)

The Paddle pipeline in this project is now split into modular stages under `scripts/receipt_ocr/`:

- `preprocessing.py`: receipt boundary detection, perspective crop, denoise, adaptive threshold, deskew, scaling
- `structuring.py`: row grouping, right-price-column detection, item-price reconstruction, multiline item merge
- `postprocess.py`: OCR text cleanup, non-item filtering, product normalization, optional lexicon matching
- `visualize.py`: debug overlays for tokens, rows, price column, and final extracted items

Main entrypoint remains `scripts/paddle_receipt_ocr.py` and can run standalone.

### Debug intermediate OCR stages

Generate debug overlays for one image:

```bash
python scripts/paddle_receipt_ocr.py receipts/sample1.jpg --lang latin --debug-dir .ocr-debug/sample1
```

This produces stage outputs (original, cropped, enhanced, binary, token boxes, row+item overlays).

### Product normalization lexicon (optional)

You can pass a local JSON file containing canonical product names:

```json
[
   "Coca Cola 1L",
   "Espresso",
   "Whole Milk"
]
```

Run with:

```bash
python scripts/paddle_receipt_ocr.py receipts/sample1.jpg --product-lexicon data/products_lexicon.json
```

### Suggested public datasets (downloadable, local)

- SROIE (receipt OCR + key information extraction)
- CORD (receipt-level structured extraction)
- RVL-CDIP (document classification; useful only for broad document-type filtering, not item-price extraction)

For item-level extraction quality, prioritize SROIE/CORD plus a custom dataset from your own stores.

### Evaluation metrics to track

- Pair-level Precision/Recall/F1: correct item name + correct price
- Key-value accuracy: matched item-price pairs over expected pairs
- Line accuracy: expected lines matched to predicted lines
- Word accuracy: expected words recovered from OCR lines
- Price MAE: average absolute error on matched prices

Example with debug output for each sample:

```bash
python scripts/evaluate_receipt_pairs.py --dataset path/to/dataset.json --lang latin --debug-root .ocr-debug/eval-run-001
```

## To do list
- [ ] Fix colors in payment display 
- [ ] Implement language selection (both target and original)
- [ ] Implement backend for history and login
- [x] Fix bug of progress bar > 100% when uploading a new receipt
- [ ] Integrate twint 
- [ ] Add better form sharing  