export const CATEGORIES = {
  food: { label: 'Food', light: '#10B981', dark: '#34D399' },
  beverage: { label: 'Beverage', light: '#3B82F6', dark: '#60A5FA' },
  snack: { label: 'Snack', light: '#F59E0B', dark: '#FBBF24' },
  household: { label: 'Household', light: '#8B5CF6', dark: '#A78BFA' },
  personal_care: { label: 'Care', light: '#EC4899', dark: '#F472B6' },
  other: { label: 'Other', light: '#6B7280', dark: '#9CA3AF' },
};

async function classifySingle(text) {
  try {
    // Ask our own secure backend instead of Hugging Face directly
    const res = await fetch('/api/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) return 'other';
    
    const data = await res.json();
    return data.category || 'other';
  } catch (err) {
    console.error("Failed to fetch category from backend:", err);
    return 'other';
  }
}

export async function detectCategoriesBatch(items) {
  if (!items || items.length === 0) return {};

  const results = await Promise.allSettled(
    items.map(item => classifySingle(item.name))
  );

  const categories = {};
  results.forEach((result, i) => {
    categories[items[i].id] = result.status === 'fulfilled' ? result.value : 'other';
  });
  return categories;
}