export type SourceMarket =
  | 'JP-AMZN'
  | 'US-AMZN'
  | 'DE-AMZN'
  | 'JP-YAHOO'
  | 'RAKUTEN'
  | 'US-WALMART'
  | 'US-TARGET'
  | 'US-EBAY';

export type RiskLevel = 'very_low' | 'low' | 'amber' | 'medium';

export interface ArbitrageProduct {
  id: string;
  asin: string;
  title: string;
  category: string;
  imageUrl: string;
  sourceMarket: SourceMarket;
  sourceUrl: string;
  resaleUrl?: string;
  resaleStoreName?: string;
  sourceCurrency: 'JPY' | 'USD';
  sourcePrice: number; // in foreign currency (e.g. 15400 for ¥15,400 or 69 for $69.00)
  targetSellingKrw: number;
  naverLowestKrw: number;
  weightKg: number;
  competitorsCount: number;
  riskLevel: RiskLevel;
  riskTitle: string;
  riskDescription: string;
  roiPercent: number;
  netProfitKrw: number;
  searchVolume: string; // e.g. "월 5.4만회"
  searchGrowth: string; // e.g. "▲ 218% 급증"
  soldLast48h: string; // e.g. "48시간 142건"
  wishlistCount: string; // e.g. "찜 1,840회"
  kcStatus: string;
  kcDescription: string;
  monthlyDemand: string;
  demandDescription: string;
  sellerCompDesc: string;
  isWatchlisted: boolean;
  stockCount: number;
  matchScore: number;
  fastTurnover?: boolean;
  condition?: 'BRAND_NEW';
  conditionLabel?: string;
}

export type ActiveTab = 'scanner' | 'table' | 'calculator' | 'watchlist';

export type FilterPreset = 'all' | 'margin40' | 'capital10' | 'comp3';

export interface LogisticsOption {
  id: string;
  name: string;
  costKrw: number;
  tag: string;
}

export interface PlatformFeeOption {
  id: string;
  name: string;
  rate: number;
  description: string;
}
