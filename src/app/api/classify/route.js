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

export async function POST(request) {
  try {
    const { text } = await request.json();
    const token = process.env.HF_TOKEN;

    if (!token) {
      console.error("HF_TOKEN is missing from environment variables.");
      return NextResponse.json({ category: 'other' }, { status: 500 });
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    let response = await fetch(MODEL_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        inputs: text,
        parameters: { candidate_labels: CANDIDATE_LABELS },
      }),
    });

    // Handle HF Cold Start (503)
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

    if (!response.ok) throw new Error(`HF API Error: ${response.status}`);

    const data = await response.json();
    
    // Safely parse the array format
    const topLabel = Array.isArray(data) ? data[0]?.label : data.labels?.[0];
    const category = LABEL_TO_CATEGORY[topLabel] || 'other';

    return NextResponse.json({ category });

  } catch (error) {
    console.error('Classification routing error:', error);
    return NextResponse.json({ category: 'other' });
  }
}