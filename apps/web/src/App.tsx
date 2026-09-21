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
import { fetchProductSourceData, isSupabaseConfigured, testSupabaseConnection } from './lib/supabase';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('scanner');
  const [products, setProducts] = useState<ArbitrageProduct[]>(INITIAL_PRODUCTS);
  const [selectedProductId, setSelectedProductId] = useState<string>('prod-turntable');
  
  // Real-time exchange rates
  const [usdKrw, setUsdKrw] = useState<number>(1385);
  const [jpyKrw, setJpyKrw] = useState<number>(912);
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
      if (!isSupabaseConfigured) return;

      const result = await fetchProductSourceData();
      if (cancelled) return;

      if (result.ok && result.data.length > 0) {
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
        setSupabaseStatus('connected');
        showToast(`DB 상품 ${result.data.length}개를 불러왔습니다.`);
      } else if (!result.ok) {
        showToast(result.message);
      }
    }

    loadProductsFromSupabase();

    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  }, []);

  const handleToggleWatchlist = useCallback((productId: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, isWatchlisted: !p.isWatchlisted } : p))
    );
  }, []);

  const handleSelectProduct = useCallback((product: ArbitrageProduct) => {
    setSelectedProductId(product.id);
  }, []);

  const handleRefreshFx = useCallback(() => {
    setIsFxRefreshing(true);
    showToast('외환 마켓 실시간 환율 틱 스트림 동기화 중...');
    setTimeout(() => {
      // Simulate slight micro-ticks
      const deltaUsd = (Math.random() - 0.5) * 4;
      const deltaJpy = (Math.random() - 0.5) * 2;
      setUsdKrw((prev) => Math.round(prev + deltaUsd));
      setJpyKrw((prev) => Math.round(prev + deltaJpy));
      setIsFxRefreshing(false);
      showToast('실시간 환율 패킷 갱신 완료: USD 1,385원 / JPY 912원');
    }, 600);
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

