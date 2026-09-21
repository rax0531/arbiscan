import React, { useState, useMemo } from 'react';
import {
  Bell,
  Sliders,
  ShieldAlert,
  Download,
  Send,
  Bookmark,
  BookmarkCheck,
  ArrowRight,
  Filter,
  CheckCircle2,
  Activity,
  AlertOctagon,
  ExternalLink
} from 'lucide-react';
import { ArbitrageProduct, FilterPreset } from '../types';

interface WatchlistAlertsTabProps {
  products: ArbitrageProduct[];
  onToggleWatchlist: (productId: string) => void;
  onSelectProduct: (product: ArbitrageProduct) => void;
  onNavigateTab: (tab: 'calculator' | 'table') => void;
  onShowToast: (msg: string) => void;
  usdKrw: number;
  jpyKrw: number;
}

export const WatchlistAlertsTab: React.FC<WatchlistAlertsTabProps> = ({
  products,
  onToggleWatchlist,
  onSelectProduct,
  onNavigateTab,
  onShowToast,
  usdKrw,
  jpyKrw
}) => {
  const [filterPreset, setFilterPreset] = useState<FilterPreset>('all');
  const [fxAlertEnabled, setFxAlertEnabled] = useState<boolean>(true);
  const [stockAlertEnabled, setStockAlertEnabled] = useState<boolean>(true);

  const getMarketName = (market: string) => {
    switch (market) {
      case 'US-WALMART':
        return '월마트';
      case 'US-TARGET':
        return '타겟';
      case 'US-EBAY':
        return '이베이';
      case 'US-AMZN':
        return '미국 아마존';
      case 'JP-AMZN':
        return '일본 아마존';
      case 'RAKUTEN':
        return '라쿠텐';
      case 'JP-YAHOO':
        return '야후 쇼핑';
      default:
        return market;
    }
  };

  // Filter only items that are watchlisted (or if none, fallback to top candidate items with tag)
  const watchlistedItems = useMemo(() => {
    const list = products.filter((p) => p.isWatchlisted);
    return list.length > 0 ? list : products.slice(0, 4);
  }, [products]);

  const filteredItems = useMemo(() => {
    return watchlistedItems.filter((item) => {
      const capital =
        item.sourceCurrency === 'JPY'
          ? Math.round(item.sourcePrice * (jpyKrw / 100))
          : Math.round(item.sourcePrice * usdKrw);

      if (filterPreset === 'margin40') return item.roiPercent >= 40;
      if (filterPreset === 'capital10') return capital <= 100000;
      if (filterPreset === 'comp3') return item.competitorsCount <= 3;
      return true;
    });
  }, [watchlistedItems, filterPreset, jpyKrw, usdKrw]);

  const handleExportCsv = () => {
    const headers = 'ASIN,상품명,소싱국가,소싱원가,국내판매가,예상순마진,초기투자금\n';
    const rows = filteredItems
      .map((p) => {
        const capital =
          p.sourceCurrency === 'JPY'
            ? Math.round(p.sourcePrice * (jpyKrw / 100))
            : Math.round(p.sourcePrice * usdKrw);
        return `"${p.asin}","${p.title.replace(/"/g, '""')}","${p.sourceMarket}",${p.sourcePrice},${p.targetSellingKrw},"${p.roiPercent}%",${capital}`;
      })
      .join('\n');

    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ArbiScan_관심품목_알림_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast(`관심 품목 ${filteredItems.length}건의 차익 데이터 CSV 추출 완료`);
  };

  const handleTestTelegram = () => {
    onShowToast('텔레그램 봇(@ArbiScanBot)으로 실시간 테스트 알림 패킷을 전송했습니다.');
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto px-3 sm:px-4 py-3 gap-4 pb-28">
      {/* Alert Radar / Telemetry Banner */}
      <section className="flex flex-col bg-[#161b29] border border-[#242a38] rounded-xl p-3.5 sm:p-4 gap-3 shadow-md relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-[#00f59b]/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00f59b] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00f59b]"></span>
            </span>
            <span className="font-['Space_Grotesk'] text-base font-bold text-[#dde2f5]">
              실시간 알림 파이프라인
            </span>
          </div>
          <span className="font-['JetBrains_Mono'] text-[10px] bg-[#242a38] text-[#00f59b] px-2 py-0.5 rounded-full font-bold border border-[#00f59b]/30">
            {watchlistedItems.length}개 타깃 추적중
          </span>
        </div>

        {/* Active Trigger Criteria */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <div className="flex flex-col bg-[#1a1f2d] border border-[#242a38] p-2 rounded-lg gap-0.5">
            <div className="flex items-center gap-1 text-[#b9cbbd]">
              <Bell className="w-3.5 h-3.5 text-[#00f59b]" />
              <span className="font-['JetBrains_Mono'] text-[10px]">스프레드 트리거</span>
            </div>
            <div className="font-['JetBrains_Mono'] text-xs text-[#dde2f5] font-semibold mt-0.5">
              차익 <span className="text-[#00f59b] font-bold">≥ 30.0%</span> 즉시 푸시
            </div>
          </div>

          <div className="flex flex-col bg-[#1a1f2d] border border-[#242a38] p-2 rounded-lg gap-0.5">
            <div className="flex items-center gap-1 text-[#b9cbbd]">
              <Filter className="w-3.5 h-3.5 text-[#b6c7e8]" />
              <span className="font-['JetBrains_Mono'] text-[10px]">타깃 밸류에이션</span>
            </div>
            <div className="font-['JetBrains_Mono'] text-xs text-[#dde2f5] font-semibold mt-0.5">
              20,000원 ~ 400,000원
            </div>
          </div>
        </div>

        {/* Micro Stream Stat Bar */}
        <div className="flex items-center justify-between bg-[#080e1b]/80 px-2.5 py-1.5 rounded-lg text-[#b9cbbd] font-['JetBrains_Mono'] text-[10px] border border-[#1a1f2d]">
          <span className="flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-[#00e38f]" />
            마지막 패킷 감지: 4초 전 (동기화 완료)
          </span>
          <span className="text-[#00f59b] font-bold">TG_BOT: CONNECTED</span>
        </div>
      </section>

      {/* Filter Selector Matrix */}
      <section className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="font-['JetBrains_Mono'] text-[10px] text-[#849588] uppercase tracking-wider font-bold">
            소싱 매트릭스 필터
          </span>
          <span className="font-['JetBrains_Mono'] text-[10px] text-[#b9cbbd]">
            정렬: 순마진율 순
          </span>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'all' as FilterPreset, label: `전체 (${watchlistedItems.length})` },
            {
              id: 'margin40' as FilterPreset,
              label: `마진 40%+ (${watchlistedItems.filter((i) => i.roiPercent >= 40).length})`
            },
            {
              id: 'capital10' as FilterPreset,
              label: `초기자본 10만↓ (${
                watchlistedItems.filter((i) => {
                  const cap =
                    i.sourceCurrency === 'JPY'
                      ? Math.round(i.sourcePrice * (jpyKrw / 100))
                      : Math.round(i.sourcePrice * usdKrw);
                  return cap <= 100000;
                }).length
              })`
            },
            {
              id: 'comp3' as FilterPreset,
              label: `경쟁 3인이하 (${watchlistedItems.filter((i) => i.competitorsCount <= 3).length})`
            }
          ].map((pill) => {
            const isSelected = filterPreset === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => {
                  setFilterPreset(pill.id);
                  onShowToast(`필터가 적용되었습니다: ${pill.label}`);
                }}
                className={`min-h-[34px] px-3 py-1 rounded-full font-['JetBrains_Mono'] text-[11px] shrink-0 transition-all ${
                  isSelected
                    ? 'bg-[#00f59b] text-[#003920] font-bold shadow-sm'
                    : 'bg-[#161b29] text-[#b9cbbd] border border-[#242a38] hover:bg-[#242a38]'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Watchlist Cards Section */}
      <section className="flex flex-col gap-3">
        {filteredItems.map((item) => {
          const sourcingKrw =
            item.sourceCurrency === 'JPY'
              ? Math.round(item.sourcePrice * (jpyKrw / 100))
              : Math.round(item.sourcePrice * usdKrw);
          const spreadKrw = item.targetSellingKrw - sourcingKrw;
          const initialCapital = sourcingKrw + 4000; // includes minimal domestic/buffer

          return (
            <article
              key={item.id}
              className="flex flex-col bg-[#161b29] border border-[#242a38] rounded-xl p-3.5 sm:p-4 gap-3 shadow-md hover:border-[#00f59b]/40 transition-all active:scale-[0.99]"
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3 min-w-0 flex-1">
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="판매처 바로가기"
                    className="relative group shrink-0"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-14 h-14 rounded-lg object-cover bg-[#242a38] border border-[#242a38] group-hover:scale-105 transition-transform"
                    />
                    <span className="absolute -bottom-1 -right-1 p-0.5 bg-[#080e1b] rounded text-[#00f59b] border border-[#242a38]">
                      <ExternalLink className="w-2.5 h-2.5" />
                    </span>
                  </a>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-['JetBrains_Mono'] text-[9px] bg-[#242a38] text-[#b6c7e8] px-1.5 py-0.5 rounded uppercase font-bold">
                        {item.sourceMarket} &gt; {item.sourceMarket.includes('JP') ? 'KR-OPEN' : 'NAVER'}
                      </span>
                      <span className="font-['JetBrains_Mono'] text-[9px] bg-[#00f59b]/15 text-[#00f59b] px-1.5 py-0.5 rounded font-bold">
                        {item.fastTurnover ? '가격차 확대 +5.2%' : '차익 안정 유지'}
                      </span>
                      <span className="font-['JetBrains_Mono'] text-[9px] text-[#00f59b] bg-[#00f59b]/15 border border-[#00f59b]/30 px-1 py-0.5 rounded font-bold">
                        미개봉 신품
                      </span>
                    </div>
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-['Space_Grotesk'] text-sm font-bold text-[#dde2f5] hover:text-[#00f59b] truncate pt-0.5 transition-colors flex items-center gap-1"
                    >
                      <span className="truncate">{item.title}</span>
                      <ExternalLink className="w-3 h-3 text-[#849588] shrink-0" />
                    </a>
                    <span className="font-['JetBrains_Mono'] text-[10px] text-[#849588] truncate">
                      ASIN: {item.asin} · 재고 {item.stockCount}개 보유
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onToggleWatchlist(item.id);
                    onShowToast(`'${item.title}' 관심 상품 해제`);
                  }}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#00f59b] rounded-full hover:bg-[#242a38] transition-colors"
                  title="즐겨찾기 토글"
                >
                  <BookmarkCheck className="w-5 h-5 text-[#00f59b] fill-[#00f59b]" />
                </button>
              </div>

              {/* Price Arbitrage Flow Breakdown */}
              <div className="flex items-center justify-between bg-[#1a1f2d] border border-[#242a38] rounded-lg p-2.5">
                <div className="flex flex-col">
                  <span className="font-['JetBrains_Mono'] text-[10px] text-[#849588]">
                    소싱원가 ({item.sourceCurrency === 'JPY' ? '일본' : '미국'})
                  </span>
                  <span className="font-['JetBrains_Mono'] text-xs sm:text-sm text-[#dde2f5] font-bold">
                    {item.sourceCurrency === 'JPY' ? '¥' : '$'}
                    {item.sourcePrice.toLocaleString()}
                  </span>
                  <span className="font-['JetBrains_Mono'] text-[10px] text-[#849588]">
                    (약 {sourcingKrw.toLocaleString()}원)
                  </span>
                </div>

                <div className="flex items-center px-2 text-[#00f59b]">
                  <ArrowRight className="w-5 h-5" />
                </div>

                <div className="flex flex-col items-end">
                  <span className="font-['JetBrains_Mono'] text-[10px] text-[#849588]">
                    국내 판매가 ({item.sourceMarket.includes('US') ? '네이버' : '쿠팡'})
                  </span>
                  <span className="font-['JetBrains_Mono'] text-xs sm:text-sm text-[#dde2f5] font-bold">
                    {item.targetSellingKrw.toLocaleString()}원
                  </span>
                  <span className="font-['JetBrains_Mono'] text-[10px] text-[#00f59b] font-semibold">
                    스프레드 +{spreadKrw.toLocaleString()}원
                  </span>
                </div>
              </div>

              {/* Financial Metrics Grid */}
              <div className="grid grid-cols-3 gap-1.5 bg-[#080e1b]/80 border border-[#242a38] p-2 rounded-lg text-center font-['JetBrains_Mono']">
                <div className="flex flex-col items-center justify-center p-1">
                  <span className="text-[9px] text-[#849588]">예상 순마진</span>
                  <span className="text-sm font-bold text-[#00f59b]">+{item.roiPercent}%</span>
                </div>
                <div className="flex flex-col items-center justify-center p-1 bg-[#242a38]/40 rounded border border-[#3b4a3f]/30">
                  <span className="text-[9px] text-[#849588]">소싱 초기자본</span>
                  <span className="text-xs font-bold text-[#dde2f5]">
                    {initialCapital.toLocaleString()}원
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center p-1">
                  <span className="text-[9px] text-[#849588]">역마진 리스크</span>
                  <span className="text-xs font-semibold text-[#cdffdc]">{item.riskTitle}</span>
                </div>
              </div>

              {/* Action Buttons with explicit prices */}
              <div className="flex items-center justify-between pt-0.5 flex-wrap gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {item.resaleUrl && (
                    <a
                      href={item.resaleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[#b6c7e8] hover:text-[#00f59b] font-['JetBrains_Mono'] px-2.5 py-1 bg-[#1a1f2d] hover:bg-[#242a38] border border-[#242a38] rounded-lg flex items-center gap-1 transition-colors"
                      title="국내 실시간 최저가 판매 페이지 바로가기"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>국내 최저가 {item.naverLowestKrw.toLocaleString()}원</span>
                    </a>
                  )}

                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[#00f59b] hover:text-[#003920] hover:bg-[#00f59b] font-['JetBrains_Mono'] font-bold px-2.5 py-1 bg-[#242a38] border border-[#00f59b]/40 rounded-lg flex items-center gap-1 transition-all shadow-sm"
                    title="실제 상품 구매 페이지 열기"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>
                      {getMarketName(item.sourceMarket)}{' '}
                      {item.sourceCurrency === 'JPY' ? '¥' : '$'}
                      {item.sourcePrice.toLocaleString()} 구매
                    </span>
                  </a>
                </div>

                <button
                  onClick={() => {
                    onSelectProduct(item);
                    onNavigateTab('calculator');
                  }}
                  className="text-xs text-[#00f59b] hover:text-[#cdffdc] font-['JetBrains_Mono'] font-bold flex items-center gap-1 active:translate-x-0.5 transition-transform"
                >
                  <span>정밀 마진 시뮬레이션</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {/* Automation & Trigger Safeguards */}
      <section className="flex flex-col bg-[#161b29] border border-[#242a38] rounded-xl p-3.5 sm:p-4 gap-3.5 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-[#00f59b]" />
            <span className="font-['Space_Grotesk'] text-sm font-bold text-[#dde2f5]">
              알림 및 자동화 방어선
            </span>
          </div>
          <span className="font-['JetBrains_Mono'] text-[10px] text-[#00e38f] bg-[#1a1f2d] border border-[#00e38f]/30 px-2 py-0.5 rounded font-bold">
            AUTO PROTECT
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {/* Toggle 1: FX Volatility */}
          <div className="flex items-center justify-between bg-[#1a1f2d] border border-[#242a38] p-3 rounded-lg">
            <div className="flex flex-col pr-2">
              <span className="font-['JetBrains_Mono'] text-xs text-[#dde2f5] font-semibold">
                환율 급등락 안전 알림
              </span>
              <span className="font-['JetBrains_Mono'] text-[10px] text-[#849588]">
                USD·JPY 환율 ±1.5% 변동 시 소싱 중단 경고
              </span>
            </div>
            <button
              onClick={() => {
                const next = !fxAlertEnabled;
                setFxAlertEnabled(next);
                onShowToast(`환율 급등락 방어 알림이 ${next ? '활성화' : '비활성화'}되었습니다.`);
              }}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                fxAlertEnabled ? 'bg-[#00f59b]' : 'bg-[#2f3543]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-[#080e1b] transition-transform ${
                  fxAlertEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              ></span>
            </button>
          </div>

          {/* Toggle 2: Out of stock / Price hikes */}
          <div className="flex items-center justify-between bg-[#1a1f2d] border border-[#242a38] p-3 rounded-lg">
            <div className="flex flex-col pr-2">
              <span className="font-['JetBrains_Mono'] text-xs text-[#dde2f5] font-semibold">
                품절 및 해외 가격인상 즉시 감지
              </span>
              <span className="font-['JetBrains_Mono'] text-[10px] text-[#849588]">
                아마존 셀러 품절 또는 소싱가 급등 시 알림
              </span>
            </div>
            <button
              onClick={() => {
                const next = !stockAlertEnabled;
                setStockAlertEnabled(next);
                onShowToast(`가격인상/품절 감지 알림이 ${next ? '활성화' : '비활성화'}되었습니다.`);
              }}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
                stockAlertEnabled ? 'bg-[#00f59b]' : 'bg-[#2f3543]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-[#080e1b] transition-transform ${
                  stockAlertEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              ></span>
            </button>
          </div>
        </div>

        {/* Quick Export / Integration Actions */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            onClick={handleExportCsv}
            className="min-h-[44px] flex items-center justify-center gap-1.5 bg-[#242a38] hover:bg-[#2f3543] text-[#dde2f5] font-['JetBrains_Mono'] text-xs font-bold px-3 py-2 rounded-xl transition-all active:scale-95 shadow-sm"
          >
            <Download className="w-4 h-4 text-[#00f59b]" />
            <span>엑셀(CSV) 추출</span>
          </button>

          <button
            onClick={handleTestTelegram}
            className="min-h-[44px] flex items-center justify-center gap-1.5 bg-[#00f59b] hover:bg-[#53ffab] text-[#003920] font-['JetBrains_Mono'] text-xs font-bold px-3 py-2 rounded-xl transition-all active:scale-95 shadow-sm"
          >
            <Send className="w-4 h-4" />
            <span>텔레그램 테스트</span>
          </button>
        </div>
      </section>
    </div>
  );
};
