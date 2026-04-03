export const CATEGORIES = {
  food: { label: 'Food', light: '#10B981', dark: '#34D399' },
  beverage: { label: 'Beverage', light: '#3B82F6', dark: '#60A5FA' },
  snack: { label: 'Snack', light: '#F59E0B', dark: '#FBBF24' },
  household: { label: 'Household', light: '#8B5CF6', dark: '#A78BFA' },
  personal_care: { label: 'Care', light: '#EC4899', dark: '#F472B6' },
  other: { label: 'Other', light: '#6B7280', dark: '#9CA3AF' },
};

/**
 * Detect categories for a list of items in a single request to the backend.
 * The backend classifies all items concurrently and caches results.
 *
 * @param {Array<{id: string, name: string}>} items
 * @returns {Promise<Object>} map of item id → category key
 */
export async function detectCategoriesBatch(items) {
  if (!items || items.length === 0) return {};

  try {
    const texts = items.map(item => item.name);

    const res = await fetch('/api/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts }),
    });

    if (!res.ok) throw new Error(`API ${res.status}`);

    const data = await res.json();
    const categoryByText = data.categories || {};

    const categories = {};
    items.forEach(item => {
      categories[item.id] = categoryByText[item.name] || 'other';
    });
    return categories;

  } catch (err) {
    console.error('Category detection failed:', err);
    const fallback = {};
    items.forEach(item => { fallback[item.id] = 'other'; });
    return fallback;
  }
}
