import { ArbitrageProduct } from '../types';

// Strict exclusion keyword list for Used, Restored, Returned, Display, and Recycled items
export const EXCLUDED_CONDITION_KEYWORDS: string[] = [
  // Used / Second-hand (중고 관련 키워드)
  '중고',
  '중고품',
  '중고제품',
  '구제',
  '중고나라',
  '당근',
  'used',
  'pre-owned',
  'preowned',
  'second-hand',
  'secondhand',
  '2nd hand',
  'previously owned',

  // Restored / Refurbished (리퍼비시/재생품 키워드)
  'restored',
  'restore',
  'refurbished',
  'refurb',
  'renewed',
  'reconditioned',
  '리퍼',
  '리퍼비시',
  '리퍼제품',
  '복원품',
  '재생품',

  // Returned / Open Box (반품/개봉품 키워드)
  'returned',
  'return',
  'open box',
  'open-box',
  'openbox',
  '반품',
  '반품제품',
  '반품상품',
  '개봉품',
  '단순개봉',
  '박스훼손',
  '미사용 반품',

  // Display / Floor models (전시/진열품 키워드)
  'display',
  'floor model',
  'floormodel',
  'demo',
  '전시',
  '전시품',
  '전시제품',
  '진열',
  '진열품',
  '진열상품',
  '매장전시',
  '매장진열',

  // Recycled (리사이클/재활용 키워드)
  'recycle',
  'recycled',
  '리사이클',
  '재활용'
];

/**
 * Checks if a given text contains any forbidden condition keywords (Used, Restored, Returned, Display, Recycled)
 */
export function containsExcludedCondition(text?: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return EXCLUDED_CONDITION_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

/**
 * Checks if a search query is asking for excluded condition goods
 */
export function isExcludedConditionSearch(query?: string): boolean {
  if (!query) return false;
  const clean = query.trim().toLowerCase();
  return EXCLUDED_CONDITION_KEYWORDS.some((kw) => clean.includes(kw.toLowerCase()));
}

/**
 * Validates whether a product is strictly 100% Brand New
 */
export function isStrictBrandNew(product: ArbitrageProduct): boolean {
  if (!product) return false;
  if (product.condition && product.condition !== 'BRAND_NEW') return false;
  if (containsExcludedCondition(product.title)) return false;
  if (containsExcludedCondition(product.riskDescription)) return false;
  if (containsExcludedCondition(product.demandDescription)) return false;
  return true;
}
