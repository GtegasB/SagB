
import React, { useState } from 'react';
import { TabId, BusinessUnit } from '../types';

interface SidebarProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  agentCount: number;
  activeBU: BusinessUnit;
  version?: string;
  onReset?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  agentCount,
  activeBU,
  version = "1.8.1", // ALINHADO COM METADATA.JSON
  onReset
}) => {
  const DEFAULT_LOGO = "https://static.wixstatic.com/media/64c3dc_866011d493924761b15d6162e82c4948~mv2.png";

  const menuItems: { id: TabId; label: string; icon: string }[] = [
    {
      id: 'home',
      label: 'Início',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
    },
    {
      id: 'ecosystem',
      label: 'Ecossistema',
      icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
    },
    {
      id: 'conversations',
      label: 'Conversas',
      icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z'
    },
    {
      id: 'team',
      label: 'Equipe Global',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
    },
    {
      id: 'management',
      label: 'Gestão de Ideias',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01'
    },
    {
      id: 'vault',
      label: 'Sessão de Pautas',
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00 2 2zm10-10V7a4 4 0 00-8 0v4h8z'
    },
    {
      id: 'fabrica-ca',
      label: 'R.H.',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
    },
    {
      id: 'governance',
      label: 'Governança',
      icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'
    },
  ];

  return (
    // ALTERAÇÃO AQUI: hidden md:flex (Esconde no celular, exibe no desktop)
    <aside className="hidden md:flex w-[260px] bg-white flex-col h-full border-r border-gray-100 shrink-0 z-30 font-sans py-6 px-3">

      {/* BRANDING */}
      <button
        onClick={onReset}
        className="flex flex-col items-center justify-center mb-8 w-full hover:opacity-80 transition-opacity group px-2"
        title="Voltar ao Hub"
      >
        {activeBU.logo ? (
          <img src={activeBU.logo} alt={activeBU.name} className="h-9 w-auto object-contain transition-transform group-hover:scale-105" />
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center bg-gray-50 rounded-lg">
              <img src={DEFAULT_LOGO} alt="GrupoB Logo" className="w-5 h-5 object-contain opacity-80" />
            </div>
            <span className="text-sm font-bold text-gray-800 tracking-tight">
              {activeBU.name}
            </span>
          </div>
        )}
      </button>

      {/* MENU NAVIGATION - PURE CLEAN */}
      <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`
                group flex items-center w-full px-3 py-2.5 rounded-lg transition-all duration-200
                ${isActive ? 'bg-gray-50 text-gray-900' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}
              `}
            >
              {/* ÍCONE (Phosphor Style SVG Path) */}
              <svg
                className={`w-5 h-5 mr-3 shrink-0 transition-colors duration-200 stroke-[1.5] ${isActive ? 'text-gray-900' : 'text-gray-400 group-hover:text-gray-600'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
              </svg>

              {/* LABEL */}
              <span className={`text-sm tracking-tight ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>

              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-gray-900"></span>
              )}
            </button>
          );
        })}
      </nav>

      {/* FOOTER - ANTIGRAVITY STATUS */}
      <div className="mt-4 pt-4 border-t border-gray-100 px-1">
        <div className="mt-3 flex flex-col items-center">
          <span className="text-[9px] font-medium text-gray-300">v{version} • Gerac Start </span>
          <div className="flex items-center gap-1.5 mt-1 opacity-60">
            <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">Antigravity On</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
