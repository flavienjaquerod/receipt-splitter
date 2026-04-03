export const CATEGORIES = {
  food: { label: 'Food', light: '#10B981', dark: '#34D399' },
  beverage: { label: 'Beverage', light: '#3B82F6', dark: '#60A5FA' },
  snack: { label: 'Snack', light: '#F59E0B', dark: '#FBBF24' },
  household: { label: 'Household', light: '#8B5CF6', dark: '#A78BFA' },
  personal_care: { label: 'Care', light: '#EC4899', dark: '#F472B6' },
  other: { label: 'Other', light: '#6B7280', dark: '#9CA3AF' },
};

const CATEGORY_KEYWORDS = {
  food: [
    // English
    'milk', 'egg', 'eggs', 'bread', 'butter', 'cheese', 'yogurt', 'yoghurt', 'meat',
    'chicken', 'beef', 'pork', 'lamb', 'fish', 'salmon', 'tuna', 'shrimp', 'rice',
    'pasta', 'noodle', 'flour', 'sugar', 'salt', 'pepper', 'oil', 'vinegar', 'sauce',
    'tomato', 'potato', 'onion', 'carrot', 'lettuce', 'spinach', 'apple', 'banana',
    'orange', 'lemon', 'grape', 'strawberry', 'berry', 'mushroom', 'garlic', 'cream',
    'ham', 'bacon', 'sausage', 'salad', 'soup', 'broth', 'mayonnaise', 'mustard',
    'ketchup', 'jam', 'honey', 'oats', 'cereal', 'corn', 'bean', 'lentil', 'avocado',
    'cucumber', 'broccoli', 'cauliflower', 'zucchini', 'tofu', 'mozzarella', 'gouda',
    // German
    'milch', 'eier', 'brot', 'käse', 'joghurt', 'fleisch', 'huhn', 'hühnchen',
    'rindfleisch', 'schweinefleisch', 'fisch', 'lachs', 'thunfisch', 'garnele', 'reis',
    'nudeln', 'mehl', 'zucker', 'salz', 'pfeffer', 'öl', 'essig', 'soße', 'tomate',
    'kartoffel', 'zwiebel', 'möhre', 'karotte', 'salat', 'spinat', 'apfel', 'banane',
    'orange', 'zitrone', 'traube', 'erdbeere', 'pilz', 'knoblauch', 'sahne', 'schinken',
    'speck', 'wurst', 'senf', 'marmelade', 'honig', 'haferflocken', 'gurke', 'brokkoli',
    'blumenkohl', 'zucchini', 'paprika', 'rind', 'hähnchen',
  ],
  beverage: [
    // English
    'water', 'juice', 'beer', 'wine', 'coffee', 'tea', 'soda', 'cola', 'drink',
    'mineral', 'sparkling', 'lemonade', 'smoothie', 'cider', 'spirits', 'whiskey', 'vodka', 'rum',
    // German
    'wasser', 'saft', 'bier', 'wein', 'kaffee', 'tee', 'limonade', 'cola', 'getränk',
    'sprudel', 'smoothie', 'cider', 'schnaps', 'whisky',
  ],
  snack: [
    // English
    'chip', 'chips', 'cookie', 'cookies', 'candy', 'chocolate', 'cracker', 'nut',
    'nuts', 'popcorn', 'pretzel', 'gummy', 'cake', 'biscuit', 'wafer', 'snack',
    'sweets', 'gum', 'peanut', 'almond', 'cashew', 'pistachio', 'granola', 'raisin',
    // German
    'chips', 'keks', 'kekse', 'bonbon', 'schokolade', 'cracker', 'nuss', 'nüsse',
    'popcorn', 'brezel', 'kuchen', 'riegel', 'gebäck', 'süßigkeit', 'gummibär',
    'erdnuss', 'mandel', 'rosine', 'müsli',
  ],
  household: [
    // English
    'detergent', 'cleaning', 'bleach', 'sponge', 'toilet', 'tissue', 'garbage',
    'trash', 'wrap', 'foil', 'brush', 'mop', 'spray', 'cleaner', 'dishwasher',
    'laundry', 'softener', 'candle', 'matches', 'lighter', 'battery', 'lightbulb',
    // German
    'waschmittel', 'reiniger', 'schwamm', 'toilettenpapier', 'müllbeutel', 'folie',
    'bürste', 'spülmittel', 'weichspüler', 'kerze', 'streichholz', 'feuerzeug',
    'batterie', 'glühbirne', 'küchentuch', 'haushalt',
  ],
  personal_care: [
    // English
    'toothpaste', 'toothbrush', 'lotion', 'cream', 'makeup', 'razor', 'deodorant',
    'perfume', 'moisturizer', 'sunscreen', 'shampoo', 'conditioner', 'soap', 'bodywash',
    'shower gel', 'nail', 'lipstick', 'mascara',
    // German
    'zahncreme', 'zahnpasta', 'zahnbürste', 'creme', 'rasier', 'deo', 'parfum',
    'shampoo', 'duschgel', 'nagel', 'lippenstift', 'seife', 'hautcreme',
  ],
};

export function detectCategory(name, translatedName = '') {
  const combined = `${name} ${translatedName}`.toLowerCase();
  if (!combined.trim()) return 'other';

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => combined.includes(kw))) {
      return category;
    }
  }

  return 'other';
}
