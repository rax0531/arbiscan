/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { ScannerTab } from './components/ScannerTab';
import { ArbitrageTableTab } from './components/ArbitrageTableTab';
import { MarginCalculatorTab } from './components/MarginCalculatorTab';
import { WatchlistAlertsTab } from './components/WatchlistAlertsTab';
import { Toast } from './components/Toast';
import { INITIAL_PRODUCTS } from './data/mockProducts';
import { ArbitrageProduct, ActiveTab } from './types';
import {
  fetchProductSourceData,
  fetchLatestExchangeRate,
  isSupabaseConfigured,
  testSupabaseConnection,
} from './lib/supabase';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('scanner');
  const [products, setProducts] = useState<ArbitrageProduct[]>(INITIAL_PRODUCTS);
  const [selectedProductId, setSelectedProductId] = useState<string>('prod-turntable');
  
 // Exchange rates
// defaultFx: Supabase/Frankfurter에서 가져온 기본 환율
// manualFx: 사용자가 직접 지정한 환율. null이면 기본 환율 사용
const [defaultUsdKrw, setDefaultUsdKrw] = useState<number>(1361.89);
const [defaultJpyKrw, setDefaultJpyKrw] = useState<number>(8.6509);

const [manualUsdKrw, setManualUsdKrw] = useState<number | null>(null);
const [manualJpyKrw, setManualJpyKrw] = useState<number | null>(null);

const usdKrw = manualUsdKrw ?? defaultUsdKrw;
const jpyKrw = manualJpyKrw ?? defaultJpyKrw;

const [isFxRefreshing, setIsFxRefreshing] = useState<boolean>(false);

  const [supabaseStatus, setSupabaseStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>(
    isSupabaseConfigured ? 'idle' : 'error'
  );

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  }, []);
  useEffect(() => {
    let cancelled = false;

    async function loadProductsFromSupabase() {
      if (!isSupabaseConfigured) {
        setSupabaseStatus('error');
        return;
      }

      setSupabaseStatus('checking');

      const result = await fetchProductSourceData();
      if (cancelled) return;

      if (result.ok) {
        setSupabaseStatus('connected');

        if (result.data.length > 0) {
          setProducts((currentProducts) => {
            const byId = new Map(currentProducts.map((product) => [product.id, product]));

            return result.data
              .map((row) => {
                const base = byId.get(row.canonical_key);
                if (!base) return null;

                return {
                  ...base,
                  ...row.source_data,
                  id: row.canonical_key,
                  title: row.title,
                  category: row.category ?? base.category,
                } as ArbitrageProduct;
              })
              .filter((product): product is ArbitrageProduct => product !== null);
          });
        }

        showToast(result.message);
      } else {
        setSupabaseStatus('error');
        showToast(result.message);
      }
    }

    loadProductsFromSupabase();

    return () => {
      cancelled = true;
    };
  }, [showToast]);

   useEffect(() => {
    let cancelled = false;

    async function loadExchangeRates() {
      const [usdResult, jpyResult] = await Promise.all([
        fetchLatestExchangeRate('USD', 'KRW'),
        fetchLatestExchangeRate('JPY', 'KRW'),
      ]);

      if (cancelled) return;

      let hasUpdate = false;

      if (usdResult.ok && usdResult.rate !== null) {
        setDefaultUsdKrw(usdResult.rate);
        hasUpdate = true;
      }

      if (jpyResult.ok && jpyResult.rate !== null) {
        setDefaultJpyKrw(jpyResult.rate);
        hasUpdate = true;
      }

      if (hasUpdate) {
        showToast('기본 환율을 업데이트했습니다.');
      } else {
        showToast('기본 환율을 불러오지 못했습니다.');
      }
    }

    loadExchangeRates();

    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const handleToggleWatchlist = useCallback((productId: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, isWatchlisted: !p.isWatchlisted } : p))
    );
  }, []);

  const handleSelectProduct = useCallback((product: ArbitrageProduct) => {
    setSelectedProductId(product.id);
  }, []);

    const handleRefreshFx = useCallback(async () => {
    setIsFxRefreshing(true);

    try {
      const [usdResult, jpyResult] = await Promise.all([
        fetchLatestExchangeRate('USD', 'KRW'),
        fetchLatestExchangeRate('JPY', 'KRW'),
      ]);

      if (usdResult.ok && usdResult.rate !== null) {
        setDefaultUsdKrw(usdResult.rate);
      }

      if (jpyResult.ok && jpyResult.rate !== null) {
        setDefaultJpyKrw(jpyResult.rate);
      }

      if (usdResult.ok || jpyResult.ok) {
        showToast('기본 환율을 새로고침했습니다.');
      } else {
        showToast('환율을 불러오지 못했습니다.');
      }
    } catch (error) {
      console.error('환율 새로고침 실패:', error);
      showToast('환율 새로고침에 실패했습니다.');
    } finally {
      setIsFxRefreshing(false);
    }
  }, [showToast]);

  const handleApplyManualFx = useCallback(
    (usd: number, jpy: number) => {
      setManualUsdKrw(usd);
      setManualJpyKrw(jpy);
      showToast('수동 환율을 적용했습니다.');
    },
    [showToast]
  );

  const handleRestoreDefaultFx = useCallback(() => {
    setManualUsdKrw(null);
    setManualJpyKrw(null);
    showToast('기본 환율로 복원했습니다.');
  }, [showToast]);

  const handleTestSupabase = useCallback(async () => {
    setSupabaseStatus('checking');
    const result = await testSupabaseConnection();
    setSupabaseStatus(result.ok ? 'connected' : 'error');
    showToast(result.message);
  }, [showToast]);

  const selectedProduct =
    products.find((p) => p.id === selectedProductId) || products[0];

  const watchlistCount = products.filter((p) => p.isWatchlisted).length;

  return (
    <div className="min-h-screen bg-[#0d1320] text-[#dde2f5] flex flex-col relative font-['JetBrains_Mono',monospace]">
      {/* Top Fixed Header with Brand & FX Ticker */}
       <Header
        activeTab={activeTab}
        usdKrw={usdKrw}
        jpyKrw={jpyKrw}
        onRefreshFx={handleRefreshFx}
        isFxRefreshing={isFxRefreshing}
        manualUsdKrw={manualUsdKrw}
        manualJpyKrw={manualJpyKrw}
        onApplyManualFx={handleApplyManualFx}
        onRestoreDefaultFx={handleRestoreDefaultFx}
      />

      {/* Main Screen Content */}
      <div className="fixed right-4 top-20 z-40 flex items-center gap-2 rounded-lg border border-white/10 bg-[#111827]/90 px-3 py-2 text-xs shadow-lg backdrop-blur">
        <span className={`h-2 w-2 rounded-full ${supabaseStatus === 'connected' ? 'bg-emerald-400' : supabaseStatus === 'checking' ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'}`} />
        <span className="text-slate-300">DB</span>
        <button onClick={handleTestSupabase} disabled={supabaseStatus === 'checking'} className="text-cyan-300 hover:text-cyan-200 disabled:opacity-50">
          {supabaseStatus === 'connected' ? '연결됨' : supabaseStatus === 'checking' ? '확인 중' : '연결 테스트'}
        </button>
      </div>

      <main className="flex-1 w-full pt-24">
        {activeTab === 'scanner' && (
          <ScannerTab
            products={products}
            onSelectProduct={handleSelectProduct}
            onNavigateTab={setActiveTab}
            onShowToast={showToast}
            usdKrw={usdKrw}
            jpyKrw={jpyKrw}
          />
        )}

        {activeTab === 'table' && (
          <ArbitrageTableTab
            products={products}
            onSelectProduct={handleSelectProduct}
            onNavigateTab={setActiveTab}
            onToggleWatchlist={handleToggleWatchlist}
            onShowToast={showToast}
            usdKrw={usdKrw}
            jpyKrw={jpyKrw}
          />
        )}

        {activeTab === 'calculator' && (
          <MarginCalculatorTab
            selectedProduct={selectedProduct}
            allProducts={products}
            onSelectProduct={handleSelectProduct}
            usdKrw={usdKrw}
            jpyKrw={jpyKrw}
            onToggleWatchlist={handleToggleWatchlist}
            onShowToast={showToast}
          />
        )}

        {activeTab === 'watchlist' && (
          <WatchlistAlertsTab
            products={products}
            onToggleWatchlist={handleToggleWatchlist}
            onSelectProduct={handleSelectProduct}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onShowToast={showToast}
            usdKrw={usdKrw}
            jpyKrw={jpyKrw}
          />
        )}
      </main>

      {/* Bottom Fixed Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        watchlistCount={watchlistCount}
      />

      {/* Global Interactive Toast Notification */}
      <Toast message={toastMessage} />
    </div>
  );
}

