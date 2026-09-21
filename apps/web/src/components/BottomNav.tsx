import React from 'react';
import { Radar, Table, Sliders, Bell } from 'lucide-react';
import { ActiveTab } from '../types';

interface BottomNavProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  watchlistCount: number;
}

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ReactNode;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  watchlistCount
}) => {
  const items: NavItem[] = [
    {
      id: 'scanner',
      label: '스캐너',
      icon: <Radar className="w-5 h-5" />
    },
    {
      id: 'table',
      label: '차익 분석표',
      icon: <Table className="w-5 h-5" />
    },
    {
      id: 'calculator',
      label: '마진 계산기',
      icon: <Sliders className="w-5 h-5" />
    },
    {
      id: 'watchlist',
      label: '관심/알림',
      icon: (
        <div className="relative">
          <Bell className="w-5 h-5" />
          {watchlistCount > 0 && (
            <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 bg-[#00f59b] text-[#003920] font-bold text-[9px] rounded-full flex items-center justify-center shadow-sm">
              {watchlistCount}
            </span>
          )}
        </div>
      )
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full z-50 bg-[#080e1b]/95 backdrop-blur-xl border-t border-[#1a1f2d] shadow-[0_-4px_20px_rgba(0,0,0,0.6)]">
      <div className="max-w-md mx-auto grid grid-cols-4 items-center h-16 px-1">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`min-h-[48px] min-w-[48px] flex flex-col items-center justify-center gap-1 py-1 rounded-lg transition-all duration-150 relative ${
                isActive
                  ? 'text-[#00f59b] bg-[#242a38]/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                  : 'text-[#b9cbbd] hover:text-[#dde2f5] active:scale-95'
              }`}
            >
              {isActive && (
                <span className="absolute top-1 w-6 h-0.5 bg-[#00f59b] rounded-full shadow-[0_0_8px_#00f59b]"></span>
              )}
              {item.icon}
              <span
                className={`font-['JetBrains_Mono'] text-[10px] tracking-tight ${
                  isActive ? 'font-bold text-[#00f59b]' : 'font-normal'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
