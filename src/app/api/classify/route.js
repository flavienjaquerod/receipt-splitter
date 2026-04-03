import { NextResponse } from 'next/server';

const MODEL_URL = 'https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli';
const CANDIDATE_LABELS = [
  'food or grocery item',
  'drink or beverage',
  'snack or sweet',
  'household or cleaning product',
  'personal care or hygiene product',
];

const LABEL_TO_CATEGORY = {
  'food or grocery item': 'food',
  'drink or beverage': 'beverage',
  'snack or sweet': 'snack',
  'household or cleaning product': 'household',
  'personal care or hygiene product': 'personal_care',
};

// Simple in-memory cache — persists across requests within the same server process.
const cache = new Map();

async function classifyOne(text, headers) {
  const key = text.toLowerCase().trim();
  if (cache.has(key)) return cache.get(key);

  let response = await fetch(MODEL_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      inputs: text,
      parameters: { candidate_labels: CANDIDATE_LABELS },
    }),
  });

  // Handle HF cold start (503)
  if (response.status === 503) {
    const data = await response.json().catch(() => ({}));
    const wait = Math.min((data.estimated_time || 10) * 1000, 15000);
    await new Promise(r => setTimeout(r, wait));
    response = await fetch(MODEL_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        inputs: text,
        parameters: { candidate_labels: CANDIDATE_LABELS },
      }),
    });
  }

  if (!response.ok) throw new Error(`HF API ${response.status}`);

  const data = await response.json();
  const topLabel = Array.isArray(data) ? data[0]?.label : data.labels?.[0];
  const category = LABEL_TO_CATEGORY[topLabel] || 'other';

  cache.set(key, category);
  return category;
}

export async function POST(request) {
  const token = process.env.HF_TOKEN;
  if (!token) {
    console.error('HF_TOKEN is missing from environment variables.');
    return NextResponse.json({ error: 'Missing HF_TOKEN' }, { status: 500 });
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  try {
    const body = await request.json();

    // Batch mode: { texts: string[] } → { categories: { [text]: category } }
    if (Array.isArray(body.texts)) {
      const results = await Promise.allSettled(
        body.texts.map(text => classifyOne(text, headers))
      );

      const categories = {};
      body.texts.forEach((text, i) => {
        categories[text] = results[i].status === 'fulfilled' ? results[i].value : 'other';
      });

      return NextResponse.json({ categories });
    }

    // Single-item mode: { text: string } → { category: string }
    const category = await classifyOne(body.text, headers);
    return NextResponse.json({ category });

  } catch (error) {
    console.error('Classification error:', error);
    return NextResponse.json({ category: 'other', categories: {} });
  }
}
