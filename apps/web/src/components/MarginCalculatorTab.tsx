import React, { useState, useMemo, useEffect } from 'react';
import {
  Sliders,
  RotateCcw,
  ShieldCheck,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Info,
  CheckCircle,
  AlertTriangle,
  ChevronDown
} from 'lucide-react';
import { LOGISTICS_TIERS, PLATFORM_FEES } from '../data/mockProducts';
import { ArbitrageProduct } from '../types';

interface MarginCalculatorTabProps {
  selectedProduct: ArbitrageProduct;
  allProducts: ArbitrageProduct[];
  onSelectProduct: (product: ArbitrageProduct) => void;
  usdKrw: number;
  jpyKrw: number;
  onToggleWatchlist: (productId: string) => void;
  onShowToast: (msg: string) => void;
}

export const MarginCalculatorTab: React.FC<MarginCalculatorTabProps> = ({
  selectedProduct,
  allProducts,
  onSelectProduct,
  usdKrw,
  jpyKrw,
  onToggleWatchlist,
  onShowToast
}) => {
  // Configurable parameters
  const [foreignCost, setForeignCost] = useState<number>(selectedProduct.sourcePrice);
  const [sellingPriceKrw, setSellingPriceKrw] = useState<number>(selectedProduct.targetSellingKrw);
  const [shippingCost, setShippingCost] = useState<number>(14500);
  const [platformFeeRate, setPlatformFeeRate] = useState<number>(0.058); // 5.8% default
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  useEffect(() => {
    setForeignCost(selectedProduct.sourcePrice);
    setSellingPriceKrw(selectedProduct.targetSellingKrw);
  }, [selectedProduct.id, selectedProduct.sourcePrice, selectedProduct.targetSellingKrw]);

  const fxRate = selectedProduct.sourceCurrency === 'JPY' ? jpyKrw / 100 : usdKrw;

  // Real-time calculations
  const {
    sourcingKrw,
    usdEquivalent,
    isExempt,
    customsDuty,
    platformFee,
    domesticCourier,
    totalExpense,
    netProfit,
    marginRatio,
    costShareRatio
  } = useMemo(() => {
    const sourcing = Math.round(foreignCost * fxRate);
    const usdEq = sourcing / usdKrw;
    const exempt = usdEq <= (selectedProduct.sourceMarket === 'US-AMZN' ? 200 : 150);
    const customs = exempt ? 0 : Math.round(sourcing * 0.188); // 8% tariff + 10% VAT
    const fee = Math.round(sellingPriceKrw * platformFeeRate);
    const domestic = 3500;
    const totalExp = sourcing + shippingCost + customs + fee + domestic;
    const profit = sellingPriceKrw - totalExp;
    const margin = sellingPriceKrw > 0 ? (profit / sellingPriceKrw) * 100 : 0;
    const costShare = sellingPriceKrw > 0 ? (totalExp / sellingPriceKrw) * 100 : 0;

    return {
      sourcingKrw: sourcing,
      usdEquivalent: usdEq,
      isExempt: exempt,
      customsDuty: customs,
      platformFee: fee,
      domesticCourier: domestic,
      totalExpense: totalExp,
      netProfit: profit,
      marginRatio: margin,
      costShareRatio: costShare
    };
  }, [foreignCost, fxRate, usdKrw, selectedProduct.sourceMarket, sellingPriceKrw, platformFeeRate, shippingCost]);

  const handleResetDefaults = () => {
    setForeignCost(selectedProduct.sourcePrice);
    setSellingPriceKrw(selectedProduct.targetSellingKrw);
    setShippingCost(14500);
    setPlatformFeeRate(0.058);
    onShowToast('모든 마진 시뮬레이션 변수가 기본값으로 초기화되었습니다.');
  };

  const handleProductChange = (prod: ArbitrageProduct) => {
    onSelectProduct(prod);
    setForeignCost(prod.sourcePrice);
    setSellingPriceKrw(prod.targetSellingKrw);
    setIsDropdownOpen(false);
    onShowToast(`'${prod.title}' 상품 분석 로드 완료`);
  };

  const isProfitable = netProfit > 0;
  const competitiveDelta = (
    ((sellingPriceKrw - selectedProduct.naverLowestKrw) / selectedProduct.naverLowestKrw) * 100
  ).toFixed(1);

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-3 sm:px-4 py-3 gap-4 pb-28">
      {/* Product Switcher Bar */}
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-full flex items-center justify-between p-2.5 bg-[#161b29] border border-[#242a38] rounded-xl text-left hover:border-[#00f59b]/50 transition-colors"
        >
          <div className="flex items-center gap-2 truncate">
            <span className="text-[10px] bg-[#00f59b]/15 text-[#00f59b] font-bold px-1.5 py-0.5 rounded font-['JetBrains_Mono'] shrink-0">
              분석 대상
            </span>
            <span className="font-['Space_Grotesk'] text-sm font-semibold text-[#dde2f5] truncate">
              {selectedProduct.title}
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-[#849588] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {isDropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#161b29] border border-[#3b4a3f] rounded-xl shadow-2xl z-30 max-h-64 overflow-y-auto divide-y divide-[#242a38]">
            {allProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => handleProductChange(p)}
                className={`w-full p-2.5 flex items-center gap-3 text-left hover:bg-[#1a1f2d] transition-colors ${
                  p.id === selectedProduct.id ? 'bg-[#242a38]' : ''
                }`}
              >
                <img
                  src={p.imageUrl}
                  alt={p.title}
                  className="w-10 h-10 rounded object-cover bg-[#242a38] shrink-0"
                />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-['Space_Grotesk'] text-xs font-bold text-[#dde2f5] truncate">
                    {p.title}
                  </span>
                  <div className="flex items-center gap-2 text-[10px] text-[#849588] font-['JetBrains_Mono']">
                    <span>{p.sourceMarket}</span>
                    <span>·</span>
                    <span className="text-[#00f59b]">+{p.roiPercent}% ROI</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Header Card: Selected Item Vector */}
      <div className="bg-[#161b29] border border-[#242a38] p-3.5 rounded-xl flex flex-col gap-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 bg-[#394a65] text-[#b6c7e8] font-['JetBrains_Mono'] text-[10px] font-bold uppercase tracking-wider rounded">
              {selectedProduct.sourceMarket} &gt; KR-MULTI
            </span>
            <span className="px-2 py-0.5 bg-[#00f59b]/15 text-[#00f59b] font-['JetBrains_Mono'] text-[10px] font-bold rounded">
              ASIN: {selectedProduct.asin}
            </span>
            <span className="px-2 py-0.5 bg-[#00f59b]/15 text-[#00f59b] font-['JetBrains_Mono'] text-[10px] font-bold rounded border border-[#00f59b]/30">
              미개봉 신품
            </span>
          </div>
          <span className="flex items-center gap-1 font-['JetBrains_Mono'] text-[10px] text-[#00f59b] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00f59b] animate-ping"></span>
            LIVE SIMULATOR
          </span>
        </div>

        <div className="flex gap-3 items-center">
          <a
            href={selectedProduct.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="새 탭에서 판매사이트 열기"
            className="group relative w-20 h-20 bg-[#242a38] rounded-lg shrink-0 flex items-center justify-center overflow-hidden border border-[#242a38] hover:border-[#00f59b] transition-colors"
          >
            <img
              src={selectedProduct.imageUrl}
              alt={selectedProduct.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
            <span className="absolute bottom-0 right-0 bg-[#080e1b]/90 text-[#b9cbbd] font-['JetBrains_Mono'] text-[9px] px-1.5 py-0.5 rounded-tl font-semibold">
              {selectedProduct.weightKg}KG
            </span>
            <span className="absolute top-1 left-1 bg-[#00f59b] text-[#003920] p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="w-3 h-3" />
            </span>
          </a>

          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="font-['JetBrains_Mono'] text-[10px] text-[#849588]">
                {selectedProduct.category} · {selectedProduct.sourceMarket}
              </span>
              <a
                href={selectedProduct.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-[#00f59b] hover:underline font-['JetBrains_Mono'] flex items-center gap-0.5"
              >
                <span>판매처 방문</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <a
              href={selectedProduct.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-['Space_Grotesk'] text-base font-bold text-[#dde2f5] hover:text-[#00f59b] truncate leading-tight mt-0.5 transition-colors"
            >
              {selectedProduct.title}
            </a>
            <p className="font-['JetBrains_Mono'] text-xs text-[#b9cbbd] truncate mt-0.5">
              {selectedProduct.riskDescription}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <a
                href={selectedProduct.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  onShowToast(
                    `[${selectedProduct.sourceMarket}] ${selectedProduct.sourceCurrency === 'JPY' ? '¥' : '$'}${selectedProduct.sourcePrice.toLocaleString()} 실제 구매 페이지로 연결되었습니다 (100% 미개봉 신품)`
                  );
                }}
                className="px-2.5 py-1 bg-[#242a38] hover:bg-[#00f59b] text-[#00f59b] hover:text-[#003920] border border-[#00f59b]/40 rounded-lg font-['JetBrains_Mono'] text-[10px] font-bold flex items-center gap-1 transition-all shadow-sm"
                title={`${selectedProduct.sourceMarket} 실제 상품 상세/구매 페이지 열기`}
              >
                <span>
                  실제구매처 {selectedProduct.sourceCurrency === 'JPY' ? '¥' : '$'}
                  {selectedProduct.sourcePrice.toLocaleString()}
                </span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>

              {selectedProduct.resaleUrl && (
                <a
                  href={selectedProduct.resaleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    onShowToast(
                      `[국내 최저가] ${selectedProduct.naverLowestKrw.toLocaleString()}원 실시간 판매처 비교 페이지로 연결되었습니다`
                    );
                  }}
                  className="px-2.5 py-1 bg-[#1a1f2d] hover:bg-[#242a38] text-[#b6c7e8] hover:text-[#00f59b] border border-[#242a38] rounded-lg font-['JetBrains_Mono'] text-[10px] flex items-center gap-1 transition-colors"
                  title="국내 실시간 최저가 판매처 비교 페이지 바로가기"
                >
                  <span>국내 최저가 {selectedProduct.naverLowestKrw.toLocaleString()}원</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}

              <span className="font-['JetBrains_Mono'] text-[10px] text-[#849588] px-1.5 py-0.5 rounded font-semibold">
                환율: 100엔={jpyKrw}원 · $1={usdKrw}원
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-Time Profit Telemetry HUD */}
      <div className="bg-[#080e1b] border border-[#242a38] p-4 rounded-xl flex flex-col gap-1.5 shadow-lg relative overflow-hidden">
        <div className="flex items-center justify-between font-['JetBrains_Mono'] text-[10px] text-[#849588] uppercase tracking-wider font-semibold">
          <span>NET ARBITRAGE YIELD</span>
          <span>CALCULATED REALTIME</span>
        </div>

        <div className="flex items-baseline justify-between mt-1">
          <div className="flex items-baseline gap-1.5">
            <span
              className={`font-['Space_Grotesk'] text-3xl sm:text-4xl font-bold tracking-tight ${
                isProfitable ? 'text-[#00f59b]' : 'text-[#ffb4ab]'
              }`}
            >
              {netProfit.toLocaleString()}
            </span>
            <span className="font-['JetBrains_Mono'] text-xs text-[#cdffdc] font-bold">KRW</span>
          </div>

          <div className="flex flex-col items-end">
            <span
              className={`px-2.5 py-0.5 font-['JetBrains_Mono'] text-xs font-bold rounded ${
                isProfitable
                  ? 'bg-[#00f59b]/20 text-[#00f59b]'
                  : 'bg-[#ffb4ab]/20 text-[#ffb4ab]'
              }`}
            >
              {isProfitable ? '+' : ''}
              {marginRatio.toFixed(1)}% ROI
            </span>
            <span className="font-['JetBrains_Mono'] text-[10px] text-[#849588] mt-0.5">
              순마진율 {marginRatio.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Dynamic Profit vs Cost progress bar */}
        <div className="w-full bg-[#242a38] h-2 rounded-full mt-2 overflow-hidden flex shadow-inner">
          <div
            className="bg-[#00f59b] h-full transition-all duration-200"
            style={{ width: `${Math.max(0, Math.min(100, marginRatio))}%` }}
          ></div>
          <div
            className="bg-[#394a65] h-full transition-all duration-200"
            style={{ width: `${Math.max(0, Math.min(100, costShareRatio))}%` }}
          ></div>
        </div>

        <div className="flex justify-between font-['JetBrains_Mono'] text-[10px] text-[#b9cbbd] mt-1">
          <span>
            원가/부대비용 점유율 <b className="text-[#dde2f5]">{Math.min(100, Math.max(0, costShareRatio)).toFixed(1)}%</b>
          </span>
          <span>
            순수익 점유율 <b className="text-[#00f59b]">{Math.min(100, Math.max(0, marginRatio)).toFixed(1)}%</b>
          </span>
        </div>
      </div>

      {/* Interactive Parameter Adjuster */}
      <div className="bg-[#161b29] border border-[#242a38] p-3.5 rounded-xl flex flex-col gap-3.5 shadow-sm">
        <div className="flex items-center justify-between pb-1 border-b border-[#242a38]">
          <span className="font-['Space_Grotesk'] text-sm font-bold text-[#dde2f5] flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-[#00f59b]" />
            마진 시뮬레이션 변수 제어
          </span>
          <button
            onClick={handleResetDefaults}
            className="font-['JetBrains_Mono'] text-[10px] text-[#849588] hover:text-[#00f59b] transition-colors uppercase flex items-center gap-1 font-bold"
          >
            <RotateCcw className="w-3 h-3" />
            초기화
          </button>
        </div>

        {/* Parameter 1: Foreign Cost */}
        <div className="flex flex-col gap-1.5 bg-[#1a1f2d] p-3 rounded-lg border border-[#242a38]">
          <div className="flex justify-between items-baseline font-['JetBrains_Mono'] text-[11px]">
            <span className="text-[#b9cbbd]">
              해외 현지가 ({selectedProduct.sourceCurrency === 'JPY' ? 'JPY 아마존' : 'USD 아마존'})
            </span>
            <div className="flex items-center gap-1 text-[#dde2f5]">
              <span className="text-[#00f59b] font-bold text-sm">
                {selectedProduct.sourceCurrency === 'JPY' ? '¥' : '$'}
                {foreignCost.toLocaleString()}
              </span>
              <span className="text-[#849588] text-[10px]">
                ({sourcingKrw.toLocaleString()}원)
              </span>
            </div>
          </div>
          <input
            type="range"
            min={selectedProduct.sourceCurrency === 'JPY' ? 2000 : 20}
            max={selectedProduct.sourceCurrency === 'JPY' ? 40000 : 350}
            step={selectedProduct.sourceCurrency === 'JPY' ? 100 : 1}
            value={foreignCost}
            onChange={(e) => setForeignCost(Number(e.target.value))}
            className="w-full h-1.5 bg-[#2f3543] rounded-lg appearance-none cursor-pointer accent-[#00f59b]"
          />
          <div className="flex justify-between font-['JetBrains_Mono'] text-[9px] text-[#849588]">
            <span>{selectedProduct.sourceCurrency === 'JPY' ? '¥2,000' : '$20'}</span>
            <span>기준환율 {selectedProduct.sourceCurrency === 'JPY' ? `${jpyKrw}원` : `${usdKrw}원`}</span>
            <span>{selectedProduct.sourceCurrency === 'JPY' ? '¥40,000' : '$350'}</span>
          </div>
        </div>

        {/* Parameter 2: KR Target Selling Price */}
        <div className="flex flex-col gap-1.5 bg-[#1a1f2d] p-3 rounded-lg border border-[#242a38]">
          <div className="flex justify-between items-baseline font-['JetBrains_Mono'] text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="text-[#b9cbbd]">국내 판매 희망가</span>
              <span className="px-1.5 py-0.5 bg-[#242a38] text-[#849588] text-[9px] rounded font-semibold">
                네이버 최저 {selectedProduct.naverLowestKrw.toLocaleString()}원
              </span>
            </div>
            <span className="text-[#00f59b] font-bold text-sm font-['JetBrains_Mono']">
              {sellingPriceKrw.toLocaleString()}원
            </span>
          </div>
          <input
            type="range"
            min={Math.round(selectedProduct.targetSellingKrw * 0.7)}
            max={Math.round(selectedProduct.targetSellingKrw * 1.5)}
            step={1000}
            value={sellingPriceKrw}
            onChange={(e) => setSellingPriceKrw(Number(e.target.value))}
            className="w-full h-1.5 bg-[#2f3543] rounded-lg appearance-none cursor-pointer accent-[#00f59b]"
          />
          <div className="flex justify-between font-['JetBrains_Mono'] text-[9px] text-[#849588]">
            <span>{Math.round(selectedProduct.targetSellingKrw * 0.7).toLocaleString()}원</span>
            <span className={Number(competitiveDelta) <= 0 ? 'text-[#00f59b] font-bold' : 'text-[#ffb4ab]'}>
              경쟁가 대비 {competitiveDelta}% {Number(competitiveDelta) <= 0 ? '(가격 우위)' : '(고가)'}
            </span>
            <span>{Math.round(selectedProduct.targetSellingKrw * 1.5).toLocaleString()}원</span>
          </div>
        </div>

        {/* Parameter 3: Forwarding Agent / Logistics */}
        <div className="flex flex-col gap-1.5 bg-[#1a1f2d] p-3 rounded-lg border border-[#242a38]">
          <div className="flex justify-between items-center font-['JetBrains_Mono'] text-[11px]">
            <div className="flex items-center gap-1">
              <span className="text-[#b9cbbd]">배송대행지 요금</span>
              <span className="text-[#849588] text-[9px]">
                (도쿄/인천 항공특송 {selectedProduct.weightKg}kg)
              </span>
            </div>
            <span className="text-[#dde2f5] font-semibold">{shippingCost.toLocaleString()}원</span>
          </div>
          <div className="grid grid-cols-3 gap-2 font-['JetBrains_Mono'] text-xs">
            {LOGISTICS_TIERS.map((tier) => {
              const isSelected = shippingCost === tier.costKrw;
              return (
                <button
                  key={tier.id}
                  onClick={() => setShippingCost(tier.costKrw)}
                  className={`py-1.5 px-2 rounded-lg text-center transition-all ${
                    isSelected
                      ? 'bg-[#00f59b] text-[#003920] font-bold shadow-sm'
                      : 'bg-[#242a38] text-[#b9cbbd] hover:bg-[#2f3543]'
                  }`}
                >
                  <div className="text-[11px]">{tier.name}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Parameter 4: Platform Commission Selector */}
        <div className="flex flex-col gap-1.5 bg-[#1a1f2d] p-3 rounded-lg border border-[#242a38]">
          <div className="flex justify-between items-center font-['JetBrains_Mono'] text-[11px]">
            <span className="text-[#b9cbbd]">오픈마켓 수수료 정책</span>
            <span className="text-[#00f59b] font-bold">
              {platformFeeRate === 0.058 ? '스마트스토어 (5.8%)' : '쿠팡 윙 (10.8%)'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 font-['JetBrains_Mono'] text-xs">
            {PLATFORM_FEES.map((fee) => {
              const isSelected = platformFeeRate === fee.rate;
              return (
                <button
                  key={fee.id}
                  onClick={() => setPlatformFeeRate(fee.rate)}
                  className={`py-2 px-3 rounded-lg flex flex-col items-center gap-0.5 transition-all ${
                    isSelected
                      ? 'bg-[#00f59b] text-[#003920] font-bold shadow-sm'
                      : 'bg-[#242a38] text-[#b9cbbd] hover:bg-[#2f3543]'
                  }`}
                >
                  <span className="font-semibold">{fee.name}</span>
                  <span className="text-[9px] opacity-80">{fee.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Parameter 5: Customs Exemption Status Notice */}
        <div className="flex items-center justify-between p-3 bg-[#242a38] rounded-lg font-['JetBrains_Mono'] text-xs border border-[#3b4a3f]">
          <div className="flex items-center gap-2.5">
            <CheckCircle className={`w-4 h-4 ${isExempt ? 'text-[#00f59b]' : 'text-[#ffb4ab]'}`} />
            <div className="flex flex-col">
              <span className="text-[#dde2f5] font-semibold text-[11px]">
                {isExempt ? '간이통관 관·부가세 면제' : '관·부가세 발생 대상 (한도 초과)'}
              </span>
              <span className="text-[#849588] text-[9px]">
                {isExempt
                  ? `현재 결제 환산가 약 $${usdEquivalent.toFixed(1)} ≤ 면세 한도 $150`
                  : `현재 결제 환산가 약 $${usdEquivalent.toFixed(1)} > $150 (간이세율 약 18.8% 부과)`}
              </span>
            </div>
          </div>
          <span
            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
              isExempt
                ? 'bg-[#00f59b]/20 text-[#00f59b]'
                : 'bg-[#ffb4ab]/20 text-[#ffb4ab]'
            }`}
          >
            {isExempt ? '면세 (0원)' : `-${customsDuty.toLocaleString()}원`}
          </span>
        </div>
      </div>

      {/* Real-Time Waterfall Financial Breakdown Matrix */}
      <div className="bg-[#161b29] border border-[#242a38] p-3.5 rounded-xl flex flex-col gap-2.5 shadow-sm">
        <div className="flex items-center justify-between pb-1 border-b border-[#242a38]">
          <span className="font-['Space_Grotesk'] text-sm font-bold text-[#dde2f5] flex items-center gap-1.5">
            <span className="w-1.5 h-3 bg-[#00f59b] rounded-sm"></span>
            손익 산출 워터폴 (Waterfall)
          </span>
          <span className="font-['JetBrains_Mono'] text-[10px] text-[#849588]">
            단위: 원(KRW)
          </span>
        </div>

        <div className="flex flex-col gap-1.5 font-['JetBrains_Mono'] text-xs">
          {/* Revenue */}
          <div className="flex items-center justify-between py-1.5 px-2 bg-[#242a38] rounded text-[#dde2f5] font-semibold">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[#00f59b] rounded-full"></span>
              <span>예상 총 매출액</span>
            </div>
            <span className="font-bold text-[#dde2f5]">+{sellingPriceKrw.toLocaleString()}원</span>
          </div>

          {/* Sourcing Cost */}
          <div className="flex items-center justify-between py-1 px-2 text-[#b9cbbd]">
            <div className="flex items-center gap-2 pl-3">
              <span className="text-[#ffb4ab] font-bold">−</span>
              <span>
                해외 상품 매입원가 ({selectedProduct.sourceCurrency === 'JPY' ? 'JPY' : 'USD'}{' '}
                {foreignCost.toLocaleString()})
              </span>
            </div>
            <span className="text-[#ffb4ab]">-{sourcingKrw.toLocaleString()}원</span>
          </div>

          {/* Logistics Cost */}
          <div className="flex items-center justify-between py-1 px-2 text-[#b9cbbd]">
            <div className="flex items-center gap-2 pl-3">
              <span className="text-[#ffb4ab] font-bold">−</span>
              <span>국제 항공 배송비 (배대지 {selectedProduct.weightKg}kg)</span>
            </div>
            <span className="text-[#ffb4ab]">-{shippingCost.toLocaleString()}원</span>
          </div>

          {/* Customs */}
          <div className="flex items-center justify-between py-1 px-2 text-[#b9cbbd]">
            <div className="flex items-center gap-2 pl-3">
              <span className="text-[#849588] font-bold">−</span>
              <span>수입 관·부가세 {isExempt ? '(관세 0% + 부가세 0%)' : '(간이세율 18.8%)'}</span>
            </div>
            <span className={isExempt ? 'text-[#849588]' : 'text-[#ffb4ab]'}>
              {isExempt ? '0원 (면세)' : `-${customsDuty.toLocaleString()}원`}
            </span>
          </div>

          {/* Platform fee */}
          <div className="flex items-center justify-between py-1 px-2 text-[#b9cbbd]">
            <div className="flex items-center gap-2 pl-3">
              <span className="text-[#ffb4ab] font-bold">−</span>
              <span>
                마켓 판매 수수료 ({platformFeeRate === 0.058 ? '스마트스토어 5.8%' : '쿠팡 10.8%'})
              </span>
            </div>
            <span className="text-[#ffb4ab]">-{platformFee.toLocaleString()}원</span>
          </div>

          {/* Domestic delivery */}
          <div className="flex items-center justify-between py-1 px-2 text-[#b9cbbd]">
            <div className="flex items-center gap-2 pl-3">
              <span className="text-[#ffb4ab] font-bold">−</span>
              <span>국내 택배 및 연계 배송료</span>
            </div>
            <span className="text-[#ffb4ab]">-{domesticCourier.toLocaleString()}원</span>
          </div>

          {/* Final Profit */}
          <div className="flex items-center justify-between py-2.5 px-3 bg-[#080e1b] border border-[#00f59b]/30 rounded-lg mt-1 text-[#00f59b]">
            <div className="flex items-center gap-2 font-bold">
              <span className="text-base">=</span>
              <span className="font-['Space_Grotesk'] text-sm sm:text-base">
                최종 건당 정산 순수익
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span
                className={`font-['Space_Grotesk'] text-lg sm:text-xl font-bold ${
                  isProfitable ? 'text-[#00f59b]' : 'text-[#ffb4ab]'
                }`}
              >
                {netProfit.toLocaleString()}원
              </span>
              <span
                className={`font-['JetBrains_Mono'] text-[10px] font-bold ${
                  isProfitable ? 'text-[#cdffdc]' : 'text-[#ffb4ab]'
                }`}
              >
                순마진율 {marginRatio.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Risk & Feasibility Assessment Card */}
      <div className="bg-[#161b29] border border-[#242a38] p-3.5 rounded-xl flex flex-col gap-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-['Space_Grotesk'] text-sm font-bold text-[#dde2f5] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#00f59b]" />
            소싱 리스크 &amp; 규제 검토 보고서
          </span>
          <span className="px-2 py-0.5 bg-[#00f59b]/15 text-[#00f59b] font-['JetBrains_Mono'] text-[10px] font-bold rounded">
            통과 적합 (SAFE)
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 font-['JetBrains_Mono'] text-xs">
          {/* Risk 1 */}
          <div className="bg-[#1a1f2d] border border-[#242a38] p-2.5 rounded-lg flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[#849588] text-[10px]">반품 / 파손 위험도</span>
              <span className="px-1.5 py-0.2 bg-[#ffce9f] text-[#895000] font-bold text-[9px] rounded">
                {selectedProduct.riskTitle}
              </span>
            </div>
            <p className="text-[#b9cbbd] text-[10px] leading-tight mt-0.5">
              {selectedProduct.riskDescription}
            </p>
          </div>

          {/* Risk 2 */}
          <div className="bg-[#1a1f2d] border border-[#242a38] p-2.5 rounded-lg flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[#849588] text-[10px]">KC 인증 적합성</span>
              <span className="px-1.5 py-0.2 bg-[#00f59b]/20 text-[#00f59b] font-bold text-[9px] rounded">
                {selectedProduct.kcStatus}
              </span>
            </div>
            <p className="text-[#b9cbbd] text-[10px] leading-tight mt-0.5">
              {selectedProduct.kcDescription}
            </p>
          </div>

          {/* Metric 3 */}
          <div className="bg-[#1a1f2d] border border-[#242a38] p-2.5 rounded-lg flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[#849588] text-[10px]">월 추정 시장 수요</span>
              <span className="text-[#00f59b] font-bold text-[11px]">
                {selectedProduct.monthlyDemand}
              </span>
            </div>
            <p className="text-[#b9cbbd] text-[10px] leading-tight mt-0.5">
              {selectedProduct.demandDescription}
            </p>
          </div>

          {/* Metric 4 */}
          <div className="bg-[#1a1f2d] border border-[#242a38] p-2.5 rounded-lg flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[#849588] text-[10px]">동일 셀러 경쟁도</span>
              <span className="text-[#00f59b] font-bold text-[11px]">
                셀러 {selectedProduct.competitorsCount}인 (낮음)
              </span>
            </div>
            <p className="text-[#b9cbbd] text-[10px] leading-tight mt-0.5">
              {selectedProduct.sellerCompDesc}
            </p>
          </div>
        </div>
      </div>

      {/* Action Execution Bar */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => {
              onToggleWatchlist(selectedProduct.id);
              onShowToast(
                selectedProduct.isWatchlisted
                  ? `'${selectedProduct.title}' 관심 상품 등록이 해제되었습니다.`
                  : `'${selectedProduct.title}' 관심 상품으로 등록되었습니다.`
              );
            }}
            className={`min-h-[44px] px-3 py-2 rounded-xl font-['JetBrains_Mono'] text-xs uppercase flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow ${
              selectedProduct.isWatchlisted
                ? 'bg-[#00f59b] text-[#003920] font-bold'
                : 'bg-[#242a38] hover:bg-[#2f3543] text-[#dde2f5]'
            }`}
          >
            {selectedProduct.isWatchlisted ? (
              <>
                <BookmarkCheck className="w-4 h-4" />
                <span>관심 등록 완료</span>
              </>
            ) : (
              <>
                <Bookmark className="w-4 h-4" />
                <span>관심 상품 등록</span>
              </>
            )}
          </button>

          {selectedProduct.resaleUrl && (
            <a
              href={selectedProduct.resaleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-3 py-2 bg-[#1a1f2d] hover:bg-[#242a38] text-[#dde2f5] border border-[#242a38] font-['JetBrains_Mono'] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <span>네이버 국내시세 비교</span>
              <ExternalLink className="w-3.5 h-3.5 text-[#849588]" />
            </a>
          )}

          <a
            href={selectedProduct.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] px-3 py-2 bg-[#00f59b] hover:bg-[#53ffab] text-[#003920] font-['JetBrains_Mono'] text-xs uppercase font-bold rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-[0_4px_12px_rgba(0,245,155,0.2)]"
          >
            <span>공식 판매처 구매 페이지 열기 ↗</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        <div className="p-2 bg-[#080e1b] rounded-lg text-center border border-[#1a1f2d]">
          <p className="font-['JetBrains_Mono'] text-[10px] text-[#849588]">
            • 환율 변동 및 카드사 해외결제 수수료(1.2%)에 따라 실제 정산금액에 ±1.5% 오차가 발생할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
};
