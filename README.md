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

## To do list
- [ ] Fix colors in payment display 
- [ ] Implement language selection (both target and original)
- [ ] Implement backend for history and login
- [x] Fix bug of progress bar > 100% when uploading a new receipt
- [ ] Integrate twint 
- [ ] Add better form sharing  