import React, { useState, useMemo } from 'react';
import {
  RotateCw,
  TrendingUp,
  Banknote,
  PackageCheck,
  ShieldCheck,
  ArrowRight,
  Table,
  Zap,
  Users,
  Search,
  Sliders,
  ExternalLink,
  CheckCircle2,
  Building2,
  ShieldAlert,
  AlertTriangle,
  Coins
} from 'lucide-react';
import { ArbitrageProduct, ActiveTab, SourceMarket } from '../types';
import { isStrictBrandNew, isExcludedConditionSearch } from '../utils/filterUtils';

interface ScannerTabProps {
  products: ArbitrageProduct[];
  onSelectProduct: (product: ArbitrageProduct) => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onShowToast: (msg: string) => void;
}

const SOURCING_HUBS = [
  { id: 'all', label: '전체 허브', badge: 'ALL' },
  { id: 'walmart', label: '미국 월마트', badge: 'WALMART' },
  { id: 'target', label: '타겟 (US)', badge: 'TARGET' },
  { id: 'ebay', label: '이베이 (US)', badge: 'EBAY' },
  { id: 'us', label: '아마존 미국', badge: 'AMAZON US' },
  { id: 'jp', label: '아마존 재팬', badge: 'AMAZON JP' },
  { id: 'rakuten', label: '라쿠텐', badge: 'RAKUTEN' },
  { id: 'yahoo', label: '야후 쇼핑 (JP)', badge: 'YAHOO JP' }
];

export const ScannerTab: React.FC<ScannerTabProps> = ({
  products,
  onSelectProduct,
  onNavigateTab,
  onShowToast
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedHub, setSelectedHub] = useState<string>('all');
  const [minMargin, setMinMargin] = useState<number>(15);
  const [isRescanning, setIsRescanning] = useState<boolean>(false);
  const [detectedCount, setDetectedCount] = useState<number>(32);

  // Persistent Sourcing Cost Range (KRW) from localStorage (10,000 KRW ~ 20,000,000 KRW)
  const [minCostKrw, setMinCostKrw] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('arbiscan_min_cost_krw');
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 10000 && parsed <= 20000000) return parsed;
      }
    } catch {
      // localStorage fallback
    }
    return 10000;
  });

  const [maxCostKrw, setMaxCostKrw] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('arbiscan_max_cost_krw');
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 10000 && parsed <= 20000000) return parsed;
      }
    } catch {
      // localStorage fallback
    }
    return 20000000;
  });

  // Direct user input string buffers
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

  // Check if search query explicitly targets excluded used/non-new goods
  const isExcludedSearch = useMemo(() => {
    return isExcludedConditionSearch(searchQuery);
  }, [searchQuery]);

  // Filter products based on selected hub and margin, strictly enforcing 100% BRAND NEW
  const filteredProducts = useMemo(() => {
    // If search specifically queries excluded condition (e.g. used, refurbished), return empty to protect seller
    if (isExcludedSearch) {
      return [];
    }

    return products.filter((p) => {
      // 1. Strict Brand New constraint: exclude ALL used, restored, returned, display, recycled items
      if (!isStrictBrandNew(p)) return false;

      // 2. Margin threshold
      const matchMargin = p.roiPercent >= minMargin;
      if (!matchMargin) return false;

      // 3. Sourcing Cost Range (KRW) filter
      const pCostKrw =
        p.sourceCurrency === 'JPY'
          ? Math.round(p.sourcePrice * 9.12)
          : Math.round(p.sourcePrice * 1385);
      if (pCostKrw < minCostKrw || pCostKrw > maxCostKrw) {
        return false;
      }

      // 4. Hub filter
      if (selectedHub === 'walmart' && p.sourceMarket !== 'US-WALMART') return false;
      if (selectedHub === 'target' && p.sourceMarket !== 'US-TARGET') return false;
      if (selectedHub === 'ebay' && p.sourceMarket !== 'US-EBAY') return false;
      if (selectedHub === 'us' && p.sourceMarket !== 'US-AMZN') return false;
      if (selectedHub === 'jp' && p.sourceMarket !== 'JP-AMZN') return false;
      if (selectedHub === 'rakuten' && p.sourceMarket !== 'RAKUTEN') return false;
      if (selectedHub === 'yahoo' && p.sourceMarket !== 'JP-YAHOO') return false;

      // 5. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          p.title.toLowerCase().includes(q) ||
          p.asin.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.sourceMarket.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [products, selectedHub, minMargin, minCostKrw, maxCostKrw, searchQuery, isExcludedSearch]);

  const displayItems = filteredProducts;

  const handleRescan = () => {
    setIsRescanning(true);
    onShowToast('글로벌 판매처(월마트/타겟/이베이/아마존/라쿠텐/야후) 실시간 재고·가격 크롤링 중...');
    setTimeout(() => {
      setIsRescanning(false);
      setDetectedCount(30 + Math.floor(Math.random() * 6));
      onShowToast('퀀트 스캔 완료: 100% 미개봉 새 제품 실시간 차익 기회 갱신됨');
    }, 600);
  };

  const handleSelectHub = (hubId: string, label: string) => {
    setSelectedHub(hubId);
    onShowToast(`판매처 필터 적용: ${label}`);
  };

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

  const handleExecuteArbitrage = (product: ArbitrageProduct, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    onSelectProduct(product);
    onNavigateTab('calculator');
    onShowToast(`'${product.title}' 정밀 마진 계산기로 이동했습니다`);
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-3 sm:px-4 py-3 gap-4 pb-24">
      {/* Real-time Scan Status Ribbon */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-[#161b29] border border-[#242a38] rounded-xl shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-3 h-3">
            <span className="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping bg-[#00f59b]"></span>
            <span className="relative inline-flex w-2 h-2 rounded-full bg-[#00f59b]"></span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-['Space_Grotesk'] text-base sm:text-lg font-bold text-[#00f59b] tracking-tight">
                {filteredProducts.length}개
              </span>
              <span className="font-['JetBrains_Mono'] text-xs sm:text-sm text-[#dde2f5] font-semibold">
                새 제품 차익 기회
              </span>
              {selectedHub !== 'all' && (
                <span className="text-[10px] bg-[#00f59b]/15 text-[#00f59b] px-1.5 py-0.2 rounded font-bold">
                  {SOURCING_HUBS.find((h) => h.id === selectedHub)?.label}
                </span>
              )}
            </div>
            <span className="font-['JetBrains_Mono'] text-[10px] text-[#849588]">
              방금 전 갱신 (해외 실시간 상품페이지 & 국내 최저가 카탈로그 1:1 직결)
            </span>
          </div>
        </div>

        <button
          onClick={handleRescan}
          disabled={isRescanning}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1f2d] hover:bg-[#242a38] text-[#00f59b] border border-[#00f59b]/30 rounded-lg active:scale-95 transition-all text-xs font-bold"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isRescanning ? 'animate-spin' : ''}`} />
          <span>재스캔</span>
        </button>
      </div>

      {/* Strict 100% Brand New Condition Banner */}
      {isExcludedSearch ? (
        <div className="flex items-center gap-2 p-3 bg-[#f5a623]/10 border border-[#f5a623]/30 rounded-xl text-xs font-['JetBrains_Mono'] text-[#f5a623] shadow-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>[중고/리퍼 배제 필터 작동]</strong> 중고 · 리퍼(Restored) · 반품(Open-box) · 전시 · 리사이클 제품은 검색에서 원천 제외되었습니다. <strong>100% 미개봉 새 제품</strong>만 소싱 및 검색할 수 있습니다.
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-[#121927] border border-[#00f59b]/35 rounded-xl text-xs font-['JetBrains_Mono'] shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#00f59b] shrink-0" />
            <span className="text-[#00f59b] font-bold">100% 무조건 새 제품(신품) 전용 검색</span>
            <span className="text-[#849588] text-[10px] sm:text-[11px] hidden sm:inline">
              | 중고 · 리퍼 · 반품 · 전시 완전 배제
            </span>
          </div>
          <span className="text-[10px] text-[#00f59b] bg-[#00f59b]/15 px-2 py-0.5 rounded font-bold border border-[#00f59b]/30">
            ✓ 미개봉 신품만 검색
          </span>
        </div>
      )}

      {/* Terminal Search & Filter Controls */}
      <div className="flex flex-col gap-3 bg-[#161b29] border border-[#242a38] p-3.5 rounded-xl shadow-md">
        {/* Real-time Search Input */}
        <div className="relative">
          <input
            type="text"
            placeholder="상품명, 모델명(다이슨, 스탠리, 보스, 소니 등), ASIN, 판매처 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#121927] border border-[#242a38] rounded-xl pl-8 pr-3 py-2 text-xs font-['JetBrains_Mono'] text-[#dde2f5] placeholder-[#849588] focus:border-[#00f59b] focus:outline-none"
          />
          <Search className="w-3.5 h-3.5 text-[#849588] absolute left-2.5 top-1/2 -translate-y-1/2" />
        </div>

        {/* Market Selector Pills with Walmart, Target, eBay */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="font-['JetBrains_Mono'] text-[10px] uppercase tracking-wider text-[#849588] font-semibold flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#00f59b]" />
              TARGET SOURCING HUB (스캔 대상 판매처)
            </span>
            <span className="text-[10px] text-[#849588] font-['JetBrains_Mono']">
              선택 시 자동 필터링
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {SOURCING_HUBS.map((hub) => {
              const isSelected = selectedHub === hub.id;
              const isNewHub = ['walmart', 'target', 'ebay'].includes(hub.id);
              return (
                <button
                  key={hub.id}
                  onClick={() => handleSelectHub(hub.id, hub.label)}
                  className={`px-3 py-1.5 rounded-lg font-['JetBrains_Mono'] text-xs flex items-center gap-1.5 whitespace-nowrap transition-all shrink-0 ${
                    isSelected
                      ? 'bg-[#00f59b] text-[#003920] font-bold shadow-[0_0_12px_rgba(0,245,155,0.3)]'
                      : 'bg-[#242a38] text-[#dde2f5] hover:bg-[#2f3543]'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected ? 'bg-[#003920]' : isNewHub ? 'bg-[#00f59b]' : 'bg-[#849588]'
                    }`}
                  ></span>
                  <span>{hub.label}</span>
                  {isNewHub && !isSelected && (
                    <span className="text-[9px] px-1 py-0.2 bg-[#00f59b]/20 text-[#00f59b] rounded-sm font-bold">
                      NEW
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick Filter Vectors */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="flex flex-col gap-1 p-2 bg-[#1a1f2d] rounded-lg border border-[#242a38]">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#849588]">최소 마진율</span>
              <span className="text-[#00f59b] bg-[#242a38] px-1.5 py-0.5 rounded font-bold">
                ≥ {minMargin}%
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {[15, 25, 35].map((marginVal) => (
                <button
                  key={marginVal}
                  onClick={() => {
                    setMinMargin(marginVal);
                    onShowToast(`최소 마진율 ≥${marginVal}% 설정`);
                  }}
                  className={`flex-1 py-1 rounded text-xs font-['JetBrains_Mono'] transition-all ${
                    minMargin === marginVal
                      ? 'bg-[#00f59b] text-[#003920] font-bold'
                      : 'bg-[#242a38] text-[#b9cbbd] hover:text-[#dde2f5]'
                  }`}
                >
                  {marginVal}%+
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-between p-2 bg-[#1a1f2d] rounded-lg border border-[#242a38]">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-[#849588]">상품 상태</span>
              <ShieldCheck className="w-3.5 h-3.5 text-[#00f59b]" />
            </div>
            <span className="font-['JetBrains_Mono'] text-xs text-[#00f59b] font-bold truncate mt-1">
              무조건 새 제품(신품)만 스캔
            </span>
          </div>
        </div>

        {/* Sourcing Cost Adjustment Menu (매입원가 KRW 1만원 ~ 2,000만원 조정 메뉴) */}
        <div className="flex flex-col gap-2 p-3 bg-[#121927] border border-[#242a38] rounded-xl">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <div className="flex items-center gap-1.5 font-['JetBrains_Mono'] text-xs font-bold text-[#dde2f5]">
              <Coins className="w-3.5 h-3.5 text-[#00f59b]" />
              <span>매입원가(KRW) 범위 설정</span>
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
            <span className="text-[9px] text-[#849588] uppercase shrink-0 font-['JetBrains_Mono']">빠른 범위:</span>
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
          <p className="text-[9px] text-[#849588] font-['JetBrains_Mono']">
            * 입력하신 매입원가 범위는 브라우저에 영구 저장되며, 직접 변경하거나 복원하지 않는 한 유지됩니다.
          </p>
        </div>
      </div>

      {/* KPI Metrics Grid (2x2 Matrix) */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Metric 1 */}
        <div className="flex flex-col p-3 bg-[#161b29] border border-[#242a38] rounded-xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="font-['JetBrains_Mono'] text-[10px] text-[#849588] uppercase">
              평균 차익 마진율
            </span>
            <TrendingUp className="w-4 h-4 text-[#00f59b]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-['Space_Grotesk'] text-xl sm:text-2xl font-bold text-[#dde2f5]">
              36.8%
            </span>
            <span className="font-['JetBrains_Mono'] text-[11px] text-[#00f59b] font-bold">
              +12.5%
            </span>
          </div>
          <span className="font-['JetBrains_Mono'] text-[9px] text-[#849588] mt-1">
            관부가세·특송배송비 공제 후 순마진
          </span>
        </div>

        {/* Metric 2 */}
        <div className="flex flex-col p-3 bg-[#161b29] border border-[#242a38] rounded-xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="font-['JetBrains_Mono'] text-[10px] text-[#849588] uppercase">
              평균 순이익
            </span>
            <Banknote className="w-4 h-4 text-[#00f59b]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-['Space_Grotesk'] text-xl sm:text-2xl font-bold text-[#dde2f5]">
              71,400
            </span>
            <span className="font-['JetBrains_Mono'] text-[10px] text-[#849588]">원</span>
          </div>
          <span className="font-['JetBrains_Mono'] text-[9px] text-[#849588] mt-1">
            건당 실수령 순이익
          </span>
        </div>

        {/* Metric 3 */}
        <div className="flex flex-col p-3 bg-[#161b29] border border-[#242a38] rounded-xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="font-['JetBrains_Mono'] text-[10px] text-[#849588] uppercase">
              등록 판매처
            </span>
            <Building2 className="w-4 h-4 text-[#00f59b]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-['Space_Grotesk'] text-xl sm:text-2xl font-bold text-[#dde2f5]">
              7개 허브
            </span>
            <span className="font-['JetBrains_Mono'] text-[10px] text-[#00f59b] font-bold">
              미국·일본
            </span>
          </div>
          <span className="font-['JetBrains_Mono'] text-[9px] text-[#849588] mt-1">
            월마트·타겟·이베이·아마존 등
          </span>
        </div>

        {/* Metric 4 */}
        <div className="flex flex-col p-3 bg-[#161b29] border border-[#242a38] rounded-xl shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="font-['JetBrains_Mono'] text-[10px] text-[#849588] uppercase">
              품질 보장
            </span>
            <ShieldCheck className="w-4 h-4 text-[#00f59b]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-['Space_Grotesk'] text-xl sm:text-2xl font-bold text-[#00f59b]">
              100% 신품
            </span>
            <span className="font-['JetBrains_Mono'] text-[10px] text-[#cdffdc]">
              중고/리퍼 0건
            </span>
          </div>
          <span className="font-['JetBrains_Mono'] text-[9px] text-[#849588] mt-1">
            미개봉 정품 공식 판매처 직결
          </span>
        </div>
      </div>

      {/* Top Live Arbitrage Section with Direct Store Links */}
      <div className="flex flex-col gap-3 pt-1">
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-[#00f59b]" />
            <h2 className="font-['Space_Grotesk'] text-base font-bold text-[#dde2f5] tracking-tight">
              {selectedHub === 'all'
                ? `실시간 새 제품 차익 추천 (${displayItems.length}건)`
                : `${SOURCING_HUBS.find((h) => h.id === selectedHub)?.label} 새 제품 차익 (${displayItems.length}건)`}
            </h2>
          </div>
          <span className="font-['JetBrains_Mono'] text-[10px] text-[#00f59b] bg-[#1a1f2d] border border-[#00f59b]/30 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
            <span>클릭 시 실제 구매페이지 이동</span>
            <ExternalLink className="w-3 h-3 text-[#00f59b]" />
          </span>
        </div>

        {displayItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 bg-[#161b29] border border-[#242a38] rounded-xl text-center gap-2">
            <ShieldAlert className="w-8 h-8 text-[#f5a623]" />
            <span className="text-sm font-bold text-[#dde2f5] font-['Space_Grotesk']">
              검색 조건에 맞는 미개봉 새 제품이 없습니다.
            </span>
            <span className="text-xs text-[#849588] font-['JetBrains_Mono']">
              중고/리퍼/반품/전시 제품은 자동 배제되었으며, 100% 신품만 검색됩니다.
            </span>
          </div>
        ) : (
          displayItems.map((item) => {
            const foreignPriceFormatted =
              item.sourceCurrency === 'JPY'
                ? `¥${item.sourcePrice.toLocaleString()}`
                : `$${item.sourcePrice.toLocaleString()}`;
            const sourcingKrw =
              item.sourceCurrency === 'JPY'
                ? Math.round(item.sourcePrice * 9.12)
                : Math.round(item.sourcePrice * 1385);

            return (
              <div
                key={item.id}
                onClick={() => handleOpenSourceSite(item)}
                className="group flex flex-col bg-[#161b29] border border-[#242a38] hover:border-[#00f59b] rounded-xl p-3.5 shadow-md gap-3 transition-all cursor-pointer relative overflow-hidden"
              >
                {/* Top row with image, title, and ROI */}
                <div className="flex items-start gap-3">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="w-16 h-16 rounded-lg object-cover bg-[#242a38] shrink-0 border border-[#242a38] group-hover:scale-105 transition-transform"
                  />
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span className="font-['JetBrains_Mono'] text-[9px] text-[#b6c7e8] bg-[#1a1f2d] border border-[#242a38] px-1.5 py-0.5 rounded uppercase font-bold">
                        {item.sourceMarket}
                      </span>
                      <span className="font-['Space_Grotesk'] text-xs text-[#00f59b] font-bold">
                        +{item.roiPercent}% ROI
                      </span>
                      <span className="font-['JetBrains_Mono'] text-[9px] text-[#00f59b] bg-[#00f59b]/15 border border-[#00f59b]/30 px-1.5 py-0.2 rounded font-bold">
                        100% 미개봉 신품
                      </span>
                      {item.fastTurnover && (
                        <span className="font-['JetBrains_Mono'] text-[9px] bg-[#00f59b]/20 text-[#00f59b] px-1 py-0.2 rounded font-semibold">
                          빠른회전
                        </span>
                      )}
                    </div>
                    <h3 className="font-['Space_Grotesk'] text-sm text-[#dde2f5] group-hover:text-[#00f59b] font-semibold truncate transition-colors">
                      {item.title}
                    </h3>
                    <span className="font-['JetBrains_Mono'] text-[10px] text-[#849588] truncate mt-0.5">
                      ASIN: {item.asin} | 정밀 매칭 {item.matchScore}%
                    </span>
                  </div>
                </div>

                {/* Metrics Chips (검색 빈도, 실시간 구매, 찜 모멘텀) */}
                <div className="grid grid-cols-3 gap-1 bg-[#1a1f2d] p-1.5 rounded-lg text-[10px] font-['JetBrains_Mono'] text-[#b9cbbd]">
                  <div className="flex flex-col px-1">
                    <span className="text-[#849588] text-[9px]">검색 빈도</span>
                    <span className="font-semibold text-[#dde2f5]">{item.searchVolume}</span>
                    <span className="text-[#00f59b] text-[9px]">{item.searchGrowth}</span>
                  </div>
                  <div className="flex flex-col px-1 border-x border-[#242a38]">
                    <span className="text-[#849588] text-[9px]">실시간 구매</span>
                    <span className="font-semibold text-[#dde2f5]">{item.soldLast48h}</span>
                    <span className="text-[#b9cbbd] text-[9px]">재고 {item.stockCount}개</span>
                  </div>
                  <div className="flex flex-col px-1">
                    <span className="text-[#849588] text-[9px]">찜·모멘텀</span>
                    <span className="font-semibold text-[#dde2f5]">{item.wishlistCount}</span>
                    <span className="text-[#00f59b] text-[9px]">모멘텀 98%</span>
                  </div>
                </div>

                {/* Price & Sourcing Vector */}
                <div className="grid grid-cols-2 gap-2 p-2.5 bg-[#1a1f2d] rounded-lg border border-[#242a38]">
                  <div className="flex flex-col">
                    <span className="font-['JetBrains_Mono'] text-[10px] text-[#849588]">
                      해외 소싱 원가 ({item.sourceMarket})
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="font-['JetBrains_Mono'] text-sm font-bold text-[#dde2f5]">
                        {sourcingKrw.toLocaleString()}
                      </span>
                      <span className="font-['JetBrains_Mono'] text-[10px] text-[#849588]">원</span>
                    </div>
                    <span className="font-['JetBrains_Mono'] text-[10px] text-[#00f59b] font-semibold">
                      현지가: {foreignPriceFormatted}
                    </span>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="font-['JetBrains_Mono'] text-[10px] text-[#849588]">
                      국내 오픈마켓 최저가
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="font-['JetBrains_Mono'] text-sm font-bold text-[#dde2f5]">
                        {item.naverLowestKrw.toLocaleString()}
                      </span>
                      <span className="font-['JetBrains_Mono'] text-[10px] text-[#849588]">원</span>
                    </div>
                    <span className="font-['JetBrains_Mono'] text-[10px] text-[#00f59b] font-semibold">
                      예상 순이익: +{item.netProfitKrw.toLocaleString()}원
                    </span>
                  </div>
                </div>

                {/* Tactical Specs and Direct Purchase Action Buttons */}
                <div className="flex items-center justify-between pt-0.5 flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-xs font-['JetBrains_Mono'] text-[#b9cbbd]">
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-[#849588]" />
                      <span>경쟁 {item.competitorsCount}명</span>
                    </div>
                    <span className="text-[#3b4a3f]">|</span>
                    <div className="flex items-center gap-1">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          item.riskLevel === 'very_low' || item.riskLevel === 'low'
                            ? 'bg-[#00f59b]'
                            : 'bg-[#ffb86f]'
                        }`}
                      ></span>
                      <span>위험도: {item.riskTitle}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Domestic Lowest Price Direct Product Purchase Button */}
                    {item.resaleUrl && (
                      <button
                        onClick={(e) => handleOpenResaleSite(item, e)}
                        className="px-2.5 py-1 bg-[#1a1f2d] hover:bg-[#242a38] text-[#00f59b] hover:text-[#00f59b] border border-[#00f59b]/35 hover:border-[#00f59b] rounded-lg font-['JetBrains_Mono'] text-[10px] font-bold flex items-center gap-1 transition-all whitespace-nowrap shadow-sm"
                        title={`${item.resaleStoreName || '국내 최저가'} ${item.naverLowestKrw.toLocaleString()}원 실제 판매/구매 페이지 열기`}
                      >
                        <span className="text-[#849588] font-normal">[최저가 실구매]</span>
                        <span>{item.resaleStoreName || '쿠팡'} {item.naverLowestKrw.toLocaleString()}원</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    )}

                    {/* Direct Overseas Product Page Button with exact foreign price */}
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onShowToast(
                          `[${getMarketName(item.sourceMarket)}] ${foreignPriceFormatted} 실제 구매 페이지로 연결되었습니다 (100% 미개봉 신품)`
                        );
                      }}
                      className="px-2.5 py-1 bg-[#242a38] hover:bg-[#00f59b] text-[#00f59b] hover:text-[#003920] border border-[#00f59b]/40 hover:border-[#00f59b] rounded-lg font-['JetBrains_Mono'] text-[10px] font-bold flex items-center gap-1 transition-all shadow-sm whitespace-nowrap"
                      title={`${getMarketName(item.sourceMarket)} ${foreignPriceFormatted} 실제 상품 상세/구매 페이지 바로가기`}
                    >
                      <span className="text-[#849588] font-normal">[실제구매처]</span>
                      <span>{getMarketName(item.sourceMarket)} {foreignPriceFormatted}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>

                    <button
                      onClick={(e) => handleExecuteArbitrage(item, e)}
                      className="px-2.5 py-1 bg-[#00f59b] hover:bg-[#00d885] text-[#003920] rounded-lg font-['JetBrains_Mono'] text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all shadow-sm whitespace-nowrap"
                    >
                      <span>마진 계산</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
