const NON_ITEM_PATTERNS = [
  /\b(total|summe|totale|subtotal|mwst|tva|tax|visa|mastercard|change|cash|zahlung|payment)\b/i,
  /\b(rundung|rounding|rabatt|discount|sparen|artikelbezeichnung|thank\s*you|merci|grazie)\b/i,
  /^\s*[-=*]{2,}\s*$/,
];

const TOTAL_PATTERNS = [
  /\b(total|summe|totale|gesamt|amount\s*due)\b[^\d]{0,12}(\d{1,4}[.,]\d{2})/i,
  /\bzu\s*zahlen\b[^\d]{0,12}(\d{1,4}[.,]\d{2})/i,
];

const STOP_WORDS = new Set([
  'bio',
  'aktion',
  'promo',
  'angebot',
  'small',
  'large',
  'klein',
  'gross',
  'grande',
  'piccolo',
  'stuk',
  'stuck',
  'stk',
  'x',
]);

const PRODUCT_SYNONYMS = {
  coffee: ['coffee', 'cafe', 'cafee', 'kaffee', 'espresso', 'americano', 'latte', 'cappuccino'],
  milk: ['milk', 'milch', 'lait', 'latte'],
  bread: ['bread', 'brot', 'pain', 'pane', 'baguette'],
  water: ['water', 'wasser', 'eau', 'acqua'],
  pasta: ['pasta', 'spaghetti', 'penne'],
  apple: ['apple', 'apfel', 'pomme', 'mela'],
  banana: ['banana', 'banane'],
};

const CATEGORY_KEYWORDS = {
  food: [
    'bread',
    'milk',
    'pasta',
    'rice',
    'cheese',
    'yogurt',
    'egg',
    'vegetable',
    'fruit',
    'apple',
    'banana',
    'meat',
    'chicken',
    'beef',
    'brot',
    'milch',
    'apfel',
    'banane',
    'fromage',
    'pane',
  ],
  beverages: [
    'coffee',
    'tea',
    'water',
    'juice',
    'cola',
    'beer',
    'wine',
    'kaffee',
    'wasser',
    'bier',
    'vin',
    'vino',
  ],
  household: [
    'soap',
    'detergent',
    'cleaner',
    'toilet',
    'paper',
    'napkin',
    'foil',
    'spulmittel',
    'reiniger',
    'papier',
  ],
  transport: [
    'ticket',
    'train',
    'bus',
    'tram',
    'uber',
    'taxi',
    'fuel',
    'benzin',
    'essence',
    'carburante',
  ],
  leisure: [
    'cinema',
    'movie',
    'game',
    'netflix',
    'spotify',
    'bar',
    'concert',
  ],
};

function toNumber(rawAmount) {
  if (!rawAmount) return NaN;
  return parseFloat(String(rawAmount).replace(',', '.'));
}

function titleCase(value) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function simplifyText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findCanonicalSynonym(normalized) {
  const tokens = normalized.split(' ');

  for (const [canonical, values] of Object.entries(PRODUCT_SYNONYMS)) {
    const hasMatch = values.some((variant) => tokens.includes(variant) || normalized.includes(variant));
    if (hasMatch) {
      return canonical;
    }
  }

  return null;
}

export function normalizeProductName(rawName) {
  const simplified = simplifyText(rawName)
    .split(' ')
    .filter((token) => token && !STOP_WORDS.has(token) && !/^\d+$/.test(token))
    .join(' ');

  if (!simplified) {
    return 'Unclassified Item';
  }

  const canonical = findCanonicalSynonym(simplified);
  if (canonical) {
    return titleCase(canonical);
  }

  return titleCase(simplified);
}

export function categorizeProduct(rawName) {
  const normalized = simplifyText(rawName);

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const match = keywords.some((keyword) => normalized.includes(keyword));
    if (match) {
      return category;
    }
  }

  return 'other';
}

function parseQuantityAndName(rawName) {
  const match = rawName.match(/^\s*(\d+(?:[.,]\d+)?)\s*(x|pcs?|piece|stk|st|kg|g|l|ml)?\s+(.+)$/i);

  if (!match) {
    return { quantity: 1, name: rawName.trim() };
  }

  const quantity = toNumber(match[1]);
  if (Number.isNaN(quantity) || quantity <= 0 || quantity > 500) {
    return { quantity: 1, name: rawName.trim() };
  }

  return {
    quantity,
    name: (match[3] || rawName).trim(),
  };
}

function parseTotalLine(text) {
  for (const pattern of TOTAL_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[2]) {
      const amount = toNumber(match[2]);
      if (!Number.isNaN(amount)) {
        return amount;
      }
    }

    if (match && match[1] && !match[2]) {
      const amount = toNumber(match[1]);
      if (!Number.isNaN(amount)) {
        return amount;
      }
    }
  }

  return null;
}

function parseItemLine(text) {
  const amountMatches = [...text.matchAll(/(\d{1,4}[.,]\d{2})/g)];
  if (amountMatches.length === 0) {
    return null;
  }

  const lastAmount = amountMatches[amountMatches.length - 1];
  const price = toNumber(lastAmount[1]);

  if (Number.isNaN(price) || price <= 0 || price > 10000) {
    return null;
  }

  const firstAmountIndex = amountMatches[0].index ?? text.length;
  const rawLabel = text
    .slice(0, firstAmountIndex)
    .replace(/[|:;\-\s]+$/g, '')
    .trim();

  if (!rawLabel || rawLabel.length < 2) {
    return null;
  }

  const { quantity, name } = parseQuantityAndName(rawLabel);
  const normalizedName = normalizeProductName(name);

  return {
    name,
    normalizedName,
    category: categorizeProduct(normalizedName),
    quantity,
    originalPrice: price,
    currentPrice: price,
  };
}

export function parseReceiptLines(lines, { showTranslated = false } = {}) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return { items: [], ticketTotals: {} };
  }

  const grouped = lines.reduce((acc, line) => {
    const source = line.sourceFile || 'unknown';
    if (!acc[source]) {
      acc[source] = [];
    }
    acc[source].push(line);
    return acc;
  }, {});

  const parsedItems = [];
  const ticketTotals = {};
  const seenItems = new Set();

  Object.entries(grouped).forEach(([sourceFile, sourceLines]) => {
    sourceLines.forEach((line, index) => {
      const text = (showTranslated && line.translatedText ? line.translatedText : line.text || '').trim();
      if (!text) {
        return;
      }

      const total = parseTotalLine(text);
      if (total !== null) {
        ticketTotals[sourceFile] = total;
        return;
      }

      if (NON_ITEM_PATTERNS.some((pattern) => pattern.test(text))) {
        return;
      }

      const parsed = parseItemLine(text);
      if (!parsed) {
        return;
      }

      const dedupeKey = [
        sourceFile,
        simplifyText(parsed.normalizedName),
        parsed.currentPrice.toFixed(2),
      ].join('::');

      if (seenItems.has(dedupeKey)) {
        return;
      }
      seenItems.add(dedupeKey);

      parsedItems.push({
        id: `${sourceFile}-${index}-${parsedItems.length}`,
        ...parsed,
        assignedTo: [],
        confidence: line.confidence,
        sourceFile,
        sourceIndex: line.sourceIndex || 0,
      });
    });
  });

  return {
    items: parsedItems,
    ticketTotals,
  };
}

export function buildSpendingInsights(items) {
  const validItems = (items || []).filter((item) => !Number.isNaN(item.currentPrice) && item.currentPrice > 0);

  const totalsByCategory = {};
  const totalsByProduct = {};
  let totalSpent = 0;

  validItems.forEach((item) => {
    const amount = item.currentPrice;
    const category = item.category || 'other';
    const productKey = simplifyText(item.normalizedName || item.name || 'other');
    const productLabel = item.normalizedName || item.name || 'Unknown Item';

    totalsByCategory[category] = (totalsByCategory[category] || 0) + amount;

    if (!totalsByProduct[productKey]) {
      totalsByProduct[productKey] = {
        name: productLabel,
        category,
        count: 0,
        amount: 0,
      };
    }

    totalsByProduct[productKey].count += 1;
    totalsByProduct[productKey].amount += amount;

    totalSpent += amount;
  });

  const topCategories = Object.entries(totalsByCategory)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const topProducts = Object.values(totalsByProduct)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const frequentProducts = Object.values(totalsByProduct)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const opportunities = [];

  topProducts.forEach((product) => {
    if (product.amount >= 20 && product.count >= 2) {
      opportunities.push(
        `You spent CHF ${product.amount.toFixed(2)} on ${product.name} across ${product.count} items in this upload.`
      );
    }
  });

  if ((totalsByCategory.beverages || 0) >= 30) {
    opportunities.push(
      `Beverages account for CHF ${(totalsByCategory.beverages || 0).toFixed(2)}. Consider bulk buying to reduce cost.`
    );
  }

  return {
    totalSpent,
    topCategories,
    topProducts,
    frequentProducts,
    opportunities,
  };
}
