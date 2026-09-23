import React, { useState, useMemo } from 'react';
import {
  Download,
  List,
  LayoutGrid,
  ArrowUpDown,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Sliders,
  Sparkles,
  Search,
  ExternalLink,
  Building2,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Coins
} from 'lucide-react';
import { ArbitrageProduct, ActiveTab, SourceMarket } from '../types';
import { isStrictBrandNew, isExcludedConditionSearch } from '../utils/filterUtils';

interface ArbitrageTableTabProps {
  products: ArbitrageProduct[];
  onSelectProduct: (product: ArbitrageProduct) => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onToggleWatchlist: (productId: string) => void;
  onShowToast: (msg: string) => void;
  usdKrw: number;
  jpyKrw: number;
}

type SortField = 'margin' | 'capital' | 'risk';

const HUB_FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'US-WALMART', label: '미국 월마트' },
  { id: 'US-TARGET', label: '타겟' },
  { id: 'US-EBAY', label: '이베이' },
  { id: 'US-AMZN', label: '아마존 미국' },
  { id: 'JP-AMZN', label: '아마존 재팬' },
  { id: 'RAKUTEN', label: '라쿠텐' },
  { id: 'JP-YAHOO', label: '야후 쇼핑' }
];

export const ArbitrageTableTab: React.FC<ArbitrageTableTabProps> = ({
  products,
  onSelectProduct,
  onNavigateTab,
  onToggleWatchlist,
  onShowToast,
  usdKrw,
  jpyKrw
}) => {
  const [sortField, setSortField] = useState<SortField>('margin');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMarket, setSelectedMarket] = useState<string>('all');

  // Persistent Sourcing Cost Range (KRW) from localStorage (10,000 KRW ~ 20,000,000 KRW)
  const [minCostKrw, setMinCostKrw] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('arbiscan_min_cost_krw');
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 10000 && parsed <= 20000000) return parsed;
      }
    } catch {}
    return 10000;
  });

  const [maxCostKrw, setMaxCostKrw] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('arbiscan_max_cost_krw');
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 10000 && parsed <= 20000000) return parsed;
      }
    } catch {}
    return 20000000;
  });

  const [minCostInput, setMinCostInput] = useState<string>(() => minCostKrw.toLocaleString());
  const [maxCostInput, setMaxCostInput] = useState<string>(() => maxCostKrw.toLocaleString());

  const handleUpdateMinCost = (val: number) => {
    const clamped = Math.max(10000, Math.min(val, maxCostKrw));
    setMinCostKrw(clamped);
    setMinCostInput(clamped.toLocaleString());
    try {
      localStorage.setItem('arbiscan_min_cost_krw', clamped.toString());
    } catch {}
  };

  const handleUpdateMaxCost = (val: number) => {
    const clamped = Math.min(20000000, Math.max(val, minCostKrw));
    setMaxCostKrw(clamped);
    setMaxCostInput(clamped.toLocaleString());
    try {
      localStorage.setItem('arbiscan_max_cost_krw', clamped.toString());
    } catch {}
  };

  const handleResetCostFilter = () => {
    setMinCostKrw(10000);
    setMaxCostKrw(20000000);
    setMinCostInput('10,000');
    setMaxCostInput('20,000,000');
    try {
      localStorage.setItem('arbiscan_min_cost_krw', '10000');
      localStorage.setItem('arbiscan_max_cost_krw', '20000000');
    } catch {}
    onShowToast('매입원가 조건이 기본값(1만원 ~ 2,000만원)으로 초기화되었습니다.');
  };

  const formatKrwKorean = (amount: number): string => {
    if (amount >= 100000000) {
      return `${(amount / 100000000).toFixed(1)}억원`;
    }
    if (amount >= 10000) {
      const man = Math.floor(amount / 10000);
      const remainder = amount % 10000;
      if (remainder === 0) return `${man.toLocaleString()}만원`;
      return `${man}만 ${remainder.toLocaleString()}원`;
    }
    return `${amount.toLocaleString()}원`;
  };

  // Check if search query targets excluded condition goods (Restored/Returned/Display/Recycle/Used)
  const isExcludedSearch = useMemo(() => {
    return isExcludedConditionSearch(searchQuery);
  }, [searchQuery]);

  const sortedProducts = useMemo(() => {
    // If search specifically queries excluded conditions, return empty to block used/refurbished goods
    if (isExcludedSearch) {
      return [];
    }

    let list = [...products];

    // Strict Condition filter: Exclude ALL Used, Restored, Returned, Display, Recycled
    list = list.filter((p) => isStrictBrandNew(p));

    // Sourcing Cost Range filter (KRW)
    list = list.filter((p) => {
      const cost =
        p.sourceCurrency === 'JPY'
          ? Math.round(p.sourcePrice * (jpyKrw))
          : Math.round(p.sourcePrice * usdKrw);
      return cost >= minCostKrw && cost <= maxCostKrw;
    });

    // Hub filter
    if (selectedMarket !== 'all') {
      list = list.filter((p) => p.sourceMarket === selectedMarket);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.asin.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.sourceMarket.toLowerCase().includes(q)
      );
    }

    if (sortField === 'margin') {
      list.sort((a, b) => b.roiPercent - a.roiPercent);
    } else if (sortField === 'capital') {
      list.sort((a, b) => {
        const costA =
          a.sourceCurrency === 'JPY' ? a.sourcePrice * (jpyKrw) : a.sourcePrice * usdKrw;
        const costB =
          b.sourceCurrency === 'JPY' ? b.sourcePrice * (jpyKrw) : b.sourcePrice * usdKrw;
        return costA - costB;
      });
    } else if (sortField === 'risk') {
      const riskOrder: Record<string, number> = { very_low: 1, low: 2, amber: 3, high: 4 };
      list.sort((a, b) => (riskOrder[a.riskLevel] || 3) - (riskOrder[b.riskLevel] || 3));
    }

    return list;
  }, [products, sortField, searchQuery, selectedMarket, minCostKrw, maxCostKrw, usdKrw, jpyKrw, isExcludedSearch]);

  const getMarketName = (market: SourceMarket) => {
    switch (market) {
      case 'US-WALMART':
        return '미국 월마트';
      case 'US-TARGET':
        return '미국 타겟';
      case 'US-EBAY':
        return '이베이 공식';
      case 'US-AMZN':
        return '미국 아마존';
      case 'JP-AMZN':
        return '일본 아마존';
      case 'RAKUTEN':
        return '라쿠텐 이치바';
      case 'JP-YAHOO':
        return '야후 쇼핑';
      default:
        return market;
    }
  };

  const handleOpenSourceSite = (product: ArbitrageProduct, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    window.open(product.sourceUrl, '_blank', 'noopener,noreferrer');
    const priceStr =
      product.sourceCurrency === 'JPY'
        ? `¥${product.sourcePrice.toLocaleString()}`
        : `$${product.sourcePrice.toLocaleString()}`;
    onShowToast(
      `[${getMarketName(product.sourceMarket)}] ${priceStr} 실제 상품 구매 페이지로 연결되었습니다 (100% 미개봉 신품)`
    );
  };

  const handleOpenResaleSite = (product: ArbitrageProduct, e: React.MouseEvent) => {
    e.stopPropagation();
    if (product.resaleUrl) {
      window.open(product.resaleUrl, '_blank', 'noopener,noreferrer');
      onShowToast(
        `[${product.resaleStoreName || '국내 최저가'}] ${product.naverLowestKrw.toLocaleString()}원 실제 상품 구매/결제 페이지로 연결되었습니다`
      );
    }
  };

  const handleExportCsv = () => {
    const headers = 'ASIN,상품명,상태,카테고리,소싱처,실제판매URL,소싱원가(외화),소싱원가(KRW),국내최저가(KRW),예상순익(KRW),ROI(%),위험도\n';
    const rows = sortedProducts
      .map((p) => {
        const sourcingKrw =
          p.sourceCurrency === 'JPY'
            ? Math.round(p.sourcePrice * (jpyKrw))
            : Math.round(p.sourcePrice * usdKrw);
        const foreignCost = `${p.sourceCurrency === 'JPY' ? '¥' : '$'}${p.sourcePrice}`;
        return `"${p.asin}","${p.title.replace(/"/g, '""')}","미개봉 신품","${p.category}","${p.sourceMarket}","${p.sourceUrl}",${foreignCost},${sourcingKrw},${p.naverLowestKrw},${p.netProfitKrw},${p.roiPercent},"${p.riskTitle}"`;
      })
      .join('\n');

    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ArbiScan_신품차익분석표_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast(`미개봉 신품 차익 분석표 ${sortedProducts.length}건 CSV 다운로드 완료`);
  };

  const handleOpenCalculator = (product: ArbitrageProduct, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    onSelectProduct(product);
    onNavigateTab('calculator');
    onShowToast(`'${product.title}' 마진 계산기 연동 완료`);
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-3 sm:px-4 py-3 gap-3 pb-28">
      {/* Top Search Controls & CSV Export */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="상품명, 모델명(다이슨, 스탠리, 보스 등), ASIN, 카테고리 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#161b29] border border-[#242a38] rounded-xl pl-8 pr-3 py-2 text-xs font-['JetBrains_Mono'] text-[#dde2f5] placeholder-[#849588] focus:border-[#00f59b] focus:outline-none"
          />
          <Search className="w-3.5 h-3.5 text-[#849588] absolute left-2.5 top-1/2 -translate-y-1/2" />
        </div>

        <button
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#242a38] hover:bg-[#2f3543] text-[#00f59b] border border-[#00f59b]/30 rounded-xl active:scale-95 transition-all text-xs font-['JetBrains_Mono'] font-bold shrink-0 shadow-sm"
        >
          <Download className="w-3.5 h-3.5 text-[#00f59b]" />
          <span>CSV EXPORT</span>
        </button>
      </div>

      {/* Strict New-Only Notice or Safety Indicator */}
      {isExcludedSearch ? (
        <div className="flex items-center gap-2 p-2.5 bg-[#f5a623]/10 border border-[#f5a623]/30 rounded-xl text-xs font-['JetBrains_Mono'] text-[#f5a623] shadow-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>[중고/리퍼 배제 필터 가동]</strong> 중고 · 리퍼(Restored) · 반품(Open-box) · 전시품 · 리사이클 제품은 검색에서 원천 배제되었습니다. <strong>100% 미개봉 새 제품만 표시</strong>됩니다.
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#121927] border border-[#00f59b]/30 rounded-xl text-[11px] font-['JetBrains_Mono']">
          <div className="flex items-center gap-1.5 text-[#00f59b]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="font-bold">100% 무조건 새 제품(신품) 전용 검색</span>
            <span className="text-[#849588] text-[10px] hidden sm:inline">
              | 중고 · 리퍼 · 반품 · 전시 완전 배제
            </span>
          </div>
          <span className="text-[10px] text-[#00f59b] bg-[#00f59b]/15 px-1.5 py-0.2 rounded font-bold border border-[#00f59b]/30">
            ✓ 미개봉 신품 보장
          </span>
        </div>
      )}

      {/* Sourcing Hub Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {HUB_FILTERS.map((hub) => {
          const isSelected = selectedMarket === hub.id;
          const isNew = ['US-WALMART', 'US-TARGET', 'US-EBAY'].includes(hub.id);
          return (
            <button
              key={hub.id}
              onClick={() => {
                setSelectedMarket(hub.id);
                onShowToast(`판매처 필터: ${hub.label}`);
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-['JetBrains_Mono'] whitespace-nowrap transition-all flex items-center gap-1 shrink-0 ${
                isSelected
                  ? 'bg-[#00f59b] text-[#003920] font-bold shadow-sm'
                  : 'bg-[#161b29] border border-[#242a38] text-[#b9cbbd] hover:text-[#dde2f5] hover:bg-[#242a38]'
              }`}
            >
              <span>{hub.label}</span>
              {isNew && !isSelected && (
                <span className="text-[8px] bg-[#00f59b]/20 text-[#00f59b] px-1 py-0.2 rounded font-bold">
                  NEW
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sourcing Cost Adjustment Menu (매입원가 KRW 1만원 ~ 2,000만원 필터) */}
      <div className="flex flex-col gap-2 p-3 bg-[#121927] border border-[#242a38] rounded-xl shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <div className="flex items-center gap-1.5 font-['JetBrains_Mono'] text-xs font-bold text-[#dde2f5]">
            <Coins className="w-3.5 h-3.5 text-[#00f59b]" />
            <span>매입원가(KRW) 필터</span>
            <span className="text-[10px] text-[#849588] font-normal">(1만원 ~ 2,000만원)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#00f59b] font-['JetBrains_Mono'] font-bold">
              {formatKrwKorean(minCostKrw)} ~ {formatKrwKorean(maxCostKrw)}
            </span>
            {(minCostKrw !== 10000 || maxCostKrw !== 20000000) && (
              <button
                onClick={handleResetCostFilter}
                className="text-[10px] text-[#849588] hover:text-[#ff7875] underline font-['JetBrains_Mono'] transition-colors"
              >
                기본값 복원
              </button>
            )}
          </div>
        </div>

        {/* Direct Number Inputs for Sourcing Cost */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#849588] font-['JetBrains_Mono'] flex items-center justify-between">
              <span>최소 매입원가 (직접 입력)</span>
              <span className="text-[#00f59b] font-semibold">{formatKrwKorean(minCostKrw)}</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={minCostInput}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setMinCostInput(raw ? parseInt(raw, 10).toLocaleString() : '');
                }}
                onBlur={() => {
                  const num = parseInt(minCostInput.replace(/[^0-9]/g, ''), 10);
                  if (isNaN(num) || num < 10000) {
                    handleUpdateMinCost(10000);
                  } else if (num > 20000000) {
                    handleUpdateMinCost(20000000);
                  } else {
                    handleUpdateMinCost(num);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="10,000"
                className="w-full bg-[#0d1320] border border-[#242a38] rounded-lg px-3 py-1.5 text-xs font-['JetBrains_Mono'] text-[#00f59b] font-bold focus:border-[#00f59b] focus:outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#849588]">원</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#849588] font-['JetBrains_Mono'] flex items-center justify-between">
              <span>최대 매입원가 (직접 입력)</span>
              <span className="text-[#00f59b] font-semibold">{formatKrwKorean(maxCostKrw)}</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={maxCostInput}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setMaxCostInput(raw ? parseInt(raw, 10).toLocaleString() : '');
                }}
                onBlur={() => {
                  const num = parseInt(maxCostInput.replace(/[^0-9]/g, ''), 10);
                  if (isNaN(num) || num > 20000000) {
                    handleUpdateMaxCost(20000000);
                  } else if (num < 10000) {
                    handleUpdateMaxCost(10000);
                  } else {
                    handleUpdateMaxCost(num);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder="20,000,000"
                className="w-full bg-[#0d1320] border border-[#242a38] rounded-lg px-3 py-1.5 text-xs font-['JetBrains_Mono'] text-[#00f59b] font-bold focus:border-[#00f59b] focus:outline-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#849588]">원</span>
            </div>
          </div>
        </div>

        {/* Quick Preset Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          <span className="text-[9px] text-[#849588] uppercase shrink-0 font-['JetBrains_Mono']">빠른 설정:</span>
          {[
            { label: '전체 (1만~2천만)', min: 10000, max: 20000000 },
            { label: '10만 이하', min: 10000, max: 100000 },
            { label: '30만 이하', min: 10000, max: 300000 },
            { label: '50만 이하', min: 10000, max: 500000 },
            { label: '100만 이하', min: 10000, max: 1000000 },
            { label: '300만 이하', min: 10000, max: 3000000 },
            { label: '500만 이하', min: 10000, max: 5000000 },
            { label: '1,000만 이하', min: 10000, max: 10000000 }
          ].map((preset) => {
            const isPresetActive = minCostKrw === preset.min && maxCostKrw === preset.max;
            return (
              <button
                key={preset.label}
                onClick={() => {
                  handleUpdateMinCost(preset.min);
                  handleUpdateMaxCost(preset.max);
                  onShowToast(`매입원가 범위 설정: ${preset.label}`);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-['JetBrains_Mono'] whitespace-nowrap transition-all shrink-0 ${
                  isPresetActive
                    ? 'bg-[#00f59b] text-[#003920] font-bold shadow-sm'
                    : 'bg-[#1a1f2d] text-[#b6c7e8] hover:bg-[#242a38]'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sort & View Mode Switcher */}
      <div className="flex items-center justify-between border-b border-[#242a38] pb-2 text-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSortField('margin')}
            className={`px-2.5 py-1 rounded-lg font-['JetBrains_Mono'] transition-colors ${
              sortField === 'margin'
                ? 'bg-[#1a1f2d] text-[#00f59b] font-bold border border-[#00f59b]/30'
                : 'text-[#849588] hover:text-[#dde2f5]'
            }`}
          >
            순마진율순 ↓
          </button>
          <button
            onClick={() => setSortField('capital')}
            className={`px-2.5 py-1 rounded-lg font-['JetBrains_Mono'] transition-colors ${
              sortField === 'capital'
                ? 'bg-[#1a1f2d] text-[#00f59b] font-bold border border-[#00f59b]/30'
                : 'text-[#849588] hover:text-[#dde2f5]'
            }`}
          >
            초기자본 낮은순 ↑
          </button>
          <button
            onClick={() => setSortField('risk')}
            className={`px-2.5 py-1 rounded-lg font-['JetBrains_Mono'] transition-colors ${
              sortField === 'risk'
                ? 'bg-[#1a1f2d] text-[#00f59b] font-bold border border-[#00f59b]/30'
                : 'text-[#849588] hover:text-[#dde2f5]'
            }`}
          >
            안전통관순
          </button>
        </div>

        <div className="flex items-center gap-1 bg-[#161b29] p-0.5 rounded-lg border border-[#242a38]">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1 rounded ${
              viewMode === 'list' ? 'bg-[#242a38] text-[#00f59b]' : 'text-[#849588]'
            }`}
            title="리스트 뷰"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1 rounded ${
              viewMode === 'grid' ? 'bg-[#242a38] text-[#00f59b]' : 'text-[#849588]'
            }`}
            title="그리드 뷰"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Table / Grid View */}
      {sortedProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-10 bg-[#161b29] border border-[#242a38] rounded-xl text-center gap-2">
          <ShieldAlert className="w-8 h-8 text-[#f5a623]" />
          <span className="text-sm font-bold text-[#dde2f5] font-['Space_Grotesk']">
            검색 결과에 맞는 미개봉 새 제품이 없습니다.
          </span>
          <span className="text-xs text-[#849588] font-['JetBrains_Mono']">
            중고 · 리퍼 · 반품 · 전시 품목은 자동 제외되었으며, 100% 신품만 제공됩니다.
          </span>
        </div>
      ) : viewMode === 'list' ? (
        <div className="flex flex-col divide-y divide-[#242a38] bg-[#161b29] border border-[#242a38] rounded-xl overflow-hidden shadow-md">
          {sortedProducts.map((p) => {
            const sourcingKrw =
              p.sourceCurrency === 'JPY'
                ? Math.round(p.sourcePrice * (jpyKrw))
                : Math.round(p.sourcePrice * usdKrw);
            const foreignPriceFormatted =
              p.sourceCurrency === 'JPY'
                ? `¥${p.sourcePrice.toLocaleString()}`
                : `$${p.sourcePrice.toLocaleString()}`;

            return (
              <div
                key={p.id}
                onClick={() => handleOpenSourceSite(p)}
                className="group flex items-center justify-between p-3 sm:p-3.5 hover:bg-[#1a1f2d] transition-colors gap-3 cursor-pointer"
              >
                {/* Left: Thumbnail & Essential Identifiers */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative shrink-0">
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      className="w-14 h-14 rounded-lg object-cover bg-[#242a38] border border-[#242a38] group-hover:scale-105 transition-transform"
                    />
                    <span className="absolute -bottom-1 -right-1 p-0.5 bg-[#080e1b] rounded text-[#00f59b] border border-[#242a38] opacity-90 group-hover:opacity-100">
                      <ExternalLink className="w-2.5 h-2.5" />
                    </span>
                  </div>

                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-['JetBrains_Mono'] text-[9px] bg-[#1a1f2d] group-hover:bg-[#00f59b]/20 text-[#b6c7e8] group-hover:text-[#00f59b] px-1.5 py-0.2 rounded font-bold uppercase border border-[#242a38] transition-colors">
                        {p.sourceMarket}
                      </span>
                      <span className="font-['JetBrains_Mono'] text-[9px] text-[#00f59b] bg-[#00f59b]/15 border border-[#00f59b]/30 px-1 py-0.2 rounded font-bold">
                        100% 미개봉 신품
                      </span>
                      <span className="font-['JetBrains_Mono'] text-[9px] text-[#849588]">
                        경쟁 {p.competitorsCount}인
                      </span>
                      {p.fastTurnover && (
                        <span className="font-['JetBrains_Mono'] text-[9px] bg-[#00f59b]/15 text-[#00f59b] px-1 py-0.2 rounded font-semibold">
                          빠른회전
                        </span>
                      )}
                    </div>
                    <h3 className="font-['Space_Grotesk'] text-xs sm:text-sm font-bold text-[#dde2f5] group-hover:text-[#00f59b] truncate mt-0.5 transition-colors">
                      {p.title}
                    </h3>
                    <div className="flex items-center gap-2 text-[10px] font-['JetBrains_Mono'] text-[#849588] mt-0.5 flex-wrap">
                      <span>
                        소싱: {foreignPriceFormatted} ({sourcingKrw.toLocaleString()}원)
                      </span>
                      <span className="text-[#3b4a3f]">|</span>
                      <span>
                        국내 최저가: <b className="text-[#dde2f5]">{p.naverLowestKrw.toLocaleString()}원</b>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Profit & Direct Action buttons */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0 flex-wrap justify-end">
                  <div className="flex flex-col items-end">
                    <span className="font-['JetBrains_Mono'] text-xs sm:text-sm font-bold text-[#dde2f5]">
                      {p.targetSellingKrw.toLocaleString()}원
                    </span>
                    <span className="font-['JetBrains_Mono'] text-[10px] text-[#00f59b] font-bold">
                      +{p.roiPercent}% ROI
                    </span>
                    <span className="font-['JetBrains_Mono'] text-[9px] text-[#849588]">
                      순익 +{p.netProfitKrw.toLocaleString()}원
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Domestic lowest price check */}
                    {p.resaleUrl && (
                      <button
                        onClick={(e) => handleOpenResaleSite(p, e)}
                        className="px-2.5 py-1 bg-[#1a1f2d] hover:bg-[#242a38] text-[#b6c7e8] hover:text-[#00f59b] border border-[#242a38] hover:border-[#00f59b]/40 rounded-lg font-['JetBrains_Mono'] text-[10px] flex items-center gap-1 transition-colors whitespace-nowrap"
                        title="국내 실시간 최저가 판매 페이지 바로가기"
                      >
                        <span>국내 최저가 {p.naverLowestKrw.toLocaleString()}원</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    )}

                    {/* Direct verified store purchase button with foreign price */}
                    <a
                      href={p.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onShowToast(
                          `[${getMarketName(p.sourceMarket)}] ${foreignPriceFormatted} 실제 구매 페이지로 연결되었습니다 (100% 미개봉 신품)`
                        );
                      }}
                      className="px-2.5 py-1 bg-[#242a38] hover:bg-[#00f59b] text-[#00f59b] hover:text-[#003920] border border-[#00f59b]/40 hover:border-[#00f59b] rounded-lg font-['JetBrains_Mono'] text-[10px] font-bold flex items-center gap-1 transition-all whitespace-nowrap shadow-sm"
                      title={`${getMarketName(p.sourceMarket)} ${foreignPriceFormatted} 실제 상품 상세/구매 페이지 열기`}
                    >
                      <span>실제구매처 {foreignPriceFormatted}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWatchlist(p.id);
                        onShowToast(
                          p.isWatchlisted
                            ? `'${p.title}' 관심 상품 해제`
                            : `'${p.title}' 관심 상품 등록`
                        );
                      }}
                      className="p-1.5 text-[#849588] hover:text-[#00f59b]"
                      title="관심 상품 저장"
                    >
                      {p.isWatchlisted ? (
                        <BookmarkCheck className="w-4 h-4 text-[#00f59b]" />
                      ) : (
                        <Bookmark className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={(e) => handleOpenCalculator(p, e)}
                      className="hidden md:flex items-center gap-1 px-2.5 py-1 bg-[#00f59b] hover:bg-[#00d885] text-[#003920] rounded-lg font-['JetBrains_Mono'] text-[10px] font-bold active:scale-95 transition-all shadow-sm"
                    >
                      <span>마진 계산</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Grid Mode */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sortedProducts.map((p) => {
            const sourcingKrw =
              p.sourceCurrency === 'JPY'
                ? Math.round(p.sourcePrice * (jpyKrw))
                : Math.round(p.sourcePrice * usdKrw);
            const foreignPriceFormatted =
              p.sourceCurrency === 'JPY'
                ? `¥${p.sourcePrice.toLocaleString()}`
                : `$${p.sourcePrice.toLocaleString()}`;

            return (
              <div
                key={p.id}
                onClick={() => handleOpenSourceSite(p)}
                className="group flex flex-col bg-[#161b29] border border-[#242a38] hover:border-[#00f59b]/50 rounded-xl p-3 gap-2.5 transition-all shadow-md cursor-pointer relative"
              >
                <div className="flex items-start gap-2.5">
                  <div className="relative shrink-0">
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      className="w-14 h-14 rounded-lg object-cover bg-[#242a38] border border-[#242a38] group-hover:scale-105 transition-transform"
                    />
                    <span className="absolute -bottom-1 -right-1 p-0.5 bg-[#080e1b] rounded text-[#00f59b] border border-[#242a38]">
                      <ExternalLink className="w-2.5 h-2.5" />
                    </span>
                  </div>

                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <div className="flex items-center gap-1">
                        <span className="font-['JetBrains_Mono'] text-[9px] bg-[#1a1f2d] group-hover:bg-[#00f59b]/20 text-[#b6c7e8] group-hover:text-[#00f59b] px-1.5 py-0.2 rounded font-bold uppercase border border-[#242a38] transition-colors">
                          {p.sourceMarket}
                        </span>
                        <span className="font-['JetBrains_Mono'] text-[9px] text-[#00f59b] bg-[#00f59b]/15 border border-[#00f59b]/30 px-1 py-0.2 rounded font-bold">
                          신품
                        </span>
                      </div>
                      <span className="font-['Space_Grotesk'] text-xs font-bold text-[#00f59b]">
                        +{p.roiPercent}% ROI
                      </span>
                    </div>
                    <h4 className="font-['Space_Grotesk'] text-xs font-bold text-[#dde2f5] group-hover:text-[#00f59b] truncate mt-1 transition-colors">
                      {p.title}
                    </h4>
                    <span className="font-['JetBrains_Mono'] text-[9px] text-[#849588] truncate">
                      ASIN: {p.asin}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-[#1a1f2d] p-2 rounded-lg font-['JetBrains_Mono'] text-[10px]">
                  <div className="flex flex-col">
                    <span className="text-[#849588]">소싱 원가 ({foreignPriceFormatted})</span>
                    <span className="text-[#dde2f5] font-semibold">{sourcingKrw.toLocaleString()}원</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[#849588]">국내 최저가</span>
                    <span className="text-[#00f59b] font-bold">{p.naverLowestKrw.toLocaleString()}원</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 flex-wrap gap-1.5">
                  <span className="font-['JetBrains_Mono'] text-[9px] text-[#b9cbbd]">
                    예상 순익: <b className="text-[#00f59b]">+{p.netProfitKrw.toLocaleString()}원</b>
                  </span>

                  <div className="flex items-center gap-1">
                    {/* Domestic price button */}
                    {p.resaleUrl && (
                      <button
                        onClick={(e) => handleOpenResaleSite(p, e)}
                        className="px-2 py-1 bg-[#1a1f2d] hover:bg-[#242a38] text-[#b6c7e8] hover:text-[#00f59b] border border-[#242a38] rounded font-['JetBrains_Mono'] text-[9px] flex items-center gap-0.5"
                        title="국내 최저가 바로가기"
                      >
                        <span>국내 {p.naverLowestKrw.toLocaleString()}원</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    )}

                    {/* Direct Overseas Buy Button with Price */}
                    <a
                      href={p.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onShowToast(
                          `[${getMarketName(p.sourceMarket)}] ${foreignPriceFormatted} 실제 구매 페이지로 이동합니다`
                        );
                      }}
                      className="px-2 py-1 bg-[#242a38] hover:bg-[#00f59b] text-[#00f59b] hover:text-[#003920] border border-[#00f59b]/30 rounded font-['JetBrains_Mono'] text-[9px] font-bold flex items-center gap-1 transition-colors shadow-sm"
                      title={`${getMarketName(p.sourceMarket)} 실제 판매 페이지 열기`}
                    >
                      <span>{getMarketName(p.sourceMarket)} {foreignPriceFormatted}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWatchlist(p.id);
                        onShowToast(
                          p.isWatchlisted
                            ? `'${p.title}' 관심 상품 등록 해제`
                            : `'${p.title}' 관심 상품 등록 완료`
                        );
                      }}
                      className="p-1 text-[#849588] hover:text-[#00f59b]"
                    >
                      {p.isWatchlisted ? (
                        <BookmarkCheck className="w-4 h-4 text-[#00f59b]" />
                      ) : (
                        <Bookmark className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={(e) => handleOpenCalculator(p, e)}
                      className="px-2 py-1 bg-[#00f59b] text-[#003920] rounded font-['JetBrains_Mono'] text-[10px] font-bold flex items-center gap-1 active:scale-95"
                    >
                      <span>계산</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
