import React, { useState } from 'react';
import { RefreshCw, User, ShieldCheck, Zap, Activity } from 'lucide-react';
import { ActiveTab } from '../types';

interface HeaderProps {
  activeTab: ActiveTab;
  usdKrw: number;
  jpyKrw: number;
  onRefreshFx?: () => void;
  isFxRefreshing?: boolean;
  manualUsdKrw: number | null;
  manualJpyKrw: number | null;
  onApplyManualFx: (usd: number, jpy: number) => void;
  onRestoreDefaultFx: () => void;
}

const TAB_TITLES: Record<ActiveTab, string> = {
  scanner: 'SCANNER',
  table: 'ARBITRAGE TABLE',
  calculator: 'MARGIN CALCULATOR',
  watchlist: 'WATCHLIST ALERTS'
};

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  usdKrw,
  jpyKrw,
  onRefreshFx,
  isFxRefreshing = false,
  manualUsdKrw,
  manualJpyKrw,
  onApplyManualFx,
  onRestoreDefaultFx
}) => {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showFxModal, setShowFxModal] = useState(false);
  const [editUsdKrw, setEditUsdKrw] = useState('');
  const [editJpyKrw, setEditJpyKrw] = useState('');

  const openFxModal = () => {
    setEditUsdKrw(String(usdKrw));
    setEditJpyKrw(String(jpyKrw));
    setShowFxModal(true);
  };

  const handleApplyFx = () => {
    const usd = Number(editUsdKrw);
    const jpy = Number(editJpyKrw);

    if (!Number.isFinite(usd) || usd <= 0) {
      return;
    }

    if (!Number.isFinite(jpy) || jpy <= 0) {
      return;
    }

    onApplyManualFx(usd, jpy);
    setShowFxModal(false);
  };

  const handleRestoreDefaultFx = () => {
    onRestoreDefaultFx();
    setShowFxModal(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 w-full z-50 bg-[#080e1b]/90 backdrop-blur-xl border-b border-[#1a1f2d] shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
      <div className="max-w-7xl mx-auto flex flex-col justify-between px-3 sm:px-4 py-2">
        {/* Top brand & profile row */}
        <div className="flex items-center justify-between gap-2 h-12">
          {/* Logo and App Title */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCYBncyNEiPtrXBNyvCIT5myYManGB-H4b-BU-AHjr1FkSjxzJ2k_CHqWkmy1OUDdC28TF8XvHNXFbRZG6rYRdJ-zcUuSec1HIfgqq-f4gE3PyS39W9ypBAQ5o4v402iQDfTJwgG8lqAluoSJ0ENEoDhcknCsMBE-7xGpwTB-06_Hzik8coMgDTk67NvQIWHUFoUoovzhcUf9JWodw3sMLwmQM2RJw5P4l6w-ixSPTO9-mdgkd7Zt4VTg"
                alt="ArbiScan Logo"
                className="h-8 sm:h-9 w-auto object-contain filter drop-shadow-[0_0_8px_rgba(0,245,155,0.4)]"
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-['Space_Grotesk'] text-lg sm:text-xl font-bold tracking-tight text-[#dde2f5] leading-none">
                  ArbiScan
                </span>
              </div>
              <span className="font-['JetBrains_Mono'] text-[9px] sm:text-[10px] text-[#00f59b] font-bold tracking-wider uppercase mt-1 leading-none">
                {TAB_TITLES[activeTab]}
              </span>
            </div>
          </div>

          {/* Right Status badge and Profile */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#242a38] border border-[#3b4a3f]/50 rounded-full shadow-inner">
              <span className="w-2 h-2 rounded-full bg-[#00f59b] animate-pulse"></span>
              <span className="font-['JetBrains_Mono'] text-[9px] sm:text-[10px] text-[#00f59b] font-bold tracking-widest uppercase">
                SCANNING
              </span>
            </div>

            <button
              onClick={() => setShowProfileModal(!showProfileModal)}
              className="relative min-h-[40px] min-w-[40px] flex items-center justify-center p-0.5 rounded-full ring-2 ring-[#00f59b]/30 hover:ring-[#00f59b] transition-all active:scale-95"
              title="셀러 프로필 및 퀀트 엔진 상태"
            >
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCX4agnFrog7DpQmAvN8e1YWfwl41kTjpKsFErvkCcAh1OUzjcPFtQck5pPwXmi7sK_a_BJOR4_0j01PaR709MoN7VFZWpODdhr4PKvD26Hf1NFwCI5COkHYiqSIm8rq0J4t1-PSo7ypsja2xH7NpUOLd0LLPesz8oD-qbx8JZzJgMsZmCYuVd90IieGz7C-XxItJUyrjy-oh9qE8nWEWoZh6VJin1jExrb4CFlOCPw09Ce9nDHLfq_AA"
                alt="Profile Avatar"
                className="w-8 h-8 rounded-full object-cover"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#00f59b] border-2 border-[#0d1320] rounded-full"></span>
            </button>
          </div>
        </div>

        {/* Live FX Ticker Sub-bar */}
        <div className="flex items-center justify-between px-2 py-1 mt-1 bg-[#161b29] border border-[#1a1f2d] rounded text-[#b9cbbd] font-['JetBrains_Mono'] text-[10px] tracking-wider">
          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto">
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[#849588]">USD/KRW</span>
              <span className="text-[#dde2f5] font-semibold">{usdKrw.toLocaleString()}원</span>
            </div>
            <span className="text-[#3b4a3f]">|</span>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[#849588]">JPY/KRW</span>
              <span className="text-[#dde2f5] font-semibold">{jpyKrw.toLocaleString()}원</span>
            </div>
          </div>

<button
            onClick={openFxModal}
            className="flex items-center gap-1 text-[9px] text-[#849588] hover:text-[#00f59b] transition-colors shrink-0"
          >
            <span className="font-bold">
              {manualUsdKrw !== null || manualJpyKrw !== null
                ? '수동 환율'
                : '환율 수정'}
            </span>
          </button>

          <button
            onClick={onRefreshFx}
            className="flex items-center gap-1 text-[9px] text-[#849588] hover:text-[#00f59b] transition-colors shrink-0 ml-2"
            title="실시간 환율 동기화"
          >
            <RefreshCw className={`w-3 h-3 text-[#00f59b] ${isFxRefreshing ? 'animate-spin' : ''}`} />
            <span className="font-bold">LIVE FX</span>
          </button>
        </div>
      </div>

      {/* FX edit modal */}
      {showFxModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
          onClick={() => setShowFxModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-[#3b4a3f] bg-[#161b29] p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#dde2f5]">
                  환율 수정
                </h3>
                <p className="mt-1 text-[10px] text-[#849588]">
                  수동 환율은 모든 화면에 동일하게 적용됩니다.
                </p>
              </div>

              <button
                onClick={() => setShowFxModal(false)}
                className="text-[#849588] hover:text-[#dde2f5]"
                aria-label="환율 수정 창 닫기"
              >
                ×
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-[#849588]">
                  USD/KRW
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editUsdKrw}
                  onChange={(event) => setEditUsdKrw(event.target.value)}
                  className="w-full rounded-lg border border-[#3b4a3f] bg-[#0d1320] px-3 py-2 text-sm text-[#dde2f5] outline-none focus:border-[#00f59b]"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-[#849588]">
                  JPY/KRW
                </span>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={editJpyKrw}
                  onChange={(event) => setEditJpyKrw(event.target.value)}
                  className="w-full rounded-lg border border-[#3b4a3f] bg-[#0d1320] px-3 py-2 text-sm text-[#dde2f5] outline-none focus:border-[#00f59b]"
                />
              </label>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={handleRestoreDefaultFx}
                className="flex-1 rounded-lg border border-[#3b4a3f] bg-[#242a38] px-3 py-2 text-[11px] font-bold text-[#b9cbbd] transition-colors hover:bg-[#2f3543]"
              >
                기본 환율 사용
              </button>

              <button
                onClick={handleApplyFx}
                className="flex-1 rounded-lg bg-[#00f59b] px-3 py-2 text-[11px] font-bold text-[#07120f] transition-colors hover:bg-[#18ffad]"
              >
                적용하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile quick modal */}
      {showProfileModal && (
        <div className="absolute top-full right-4 mt-2 w-72 bg-[#161b29] border border-[#3b4a3f] rounded-xl shadow-2xl p-4 text-xs font-['JetBrains_Mono'] animate-in fade-in slide-in-from-top-2 duration-150 z-50">
          <div className="flex items-center justify-between pb-2 border-b border-[#242a38]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00f59b]"></div>
              <span className="font-bold text-[#dde2f5]">PRO 퀀트 아비트라지어</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 bg-[#00f59b]/20 text-[#00f59b] rounded font-bold">
              ACTIVE
            </span>
          </div>

          <div className="py-2.5 flex flex-col gap-2 text-[#b9cbbd]">
            <div className="flex justify-between">
              <span>오늘 스캔 패킷</span>
              <span className="text-[#dde2f5] font-bold">2,840 건</span>
            </div>
            <div className="flex justify-between">
              <span>API 레이턴시</span>
              <span className="text-[#00f59b] font-bold">42ms (초고속)</span>
            </div>
            <div className="flex justify-between">
              <span>연동 마켓 계정</span>
              <span className="text-[#dde2f5]">네이버 · 쿠팡 윙</span>
            </div>
            <div className="flex justify-between">
              <span>텔레그램 봇</span>
              <span className="text-[#00f59b]">ON (@ArbiScanBot)</span>
            </div>
          </div>

          <button
            onClick={() => setShowProfileModal(false)}
            className="w-full mt-1 py-1.5 bg-[#242a38] hover:bg-[#2f3543] text-[#dde2f5] text-center rounded font-semibold transition-colors"
          >
            닫기
          </button>
        </div>
      )}
    </header>
  );
};
