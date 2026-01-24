
import React, { useState } from 'react';
import { BusinessUnit, TabId, Agent } from '../types';
import { Avatar } from './Avatar';

interface HubViewProps {
  businessUnits: BusinessUnit[];
  activeBU: BusinessUnit;
  onSelectBU: (bu: BusinessUnit) => void;
  onNavigate: (tab: TabId) => void;
  onSelectAgent?: (agent: Agent) => void;
  agents?: Agent[];
}

const HubView: React.FC<HubViewProps> = ({ businessUnits, activeBU, onSelectBU, onNavigate, onSelectAgent, agents = [] }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isGlobalExpanded, setIsGlobalExpanded] = useState(false);

  // --- FILTROS DE HIERARQUIA ---
  const masterBU = businessUnits.find(bu => bu.id === 'grupob');
  const bUnits = businessUnits.filter(bu => bu.type === 'CORE' && bu.id !== 'grupob');
  const ventures = businessUnits.filter(bu => bu.type === 'VENTURY');
  const methodologies = businessUnits.filter(bu => bu.type === 'METHODOLOGY');
  
  // --- FILTRO DE INCUBADORA / CUSTOM (CORREÇÃO DE VISIBILIDADE) ---
  // Captura qualquer unidade que não esteja nas categorias acima (Ex: "Pégas")
  const otherUnits = businessUnits.filter(bu => 
      bu.id !== 'grupob' && 
      bu.type !== 'CORE' && 
      bu.type !== 'VENTURY' && 
      bu.type !== 'METHODOLOGY'
  );

  // Filtros de Pessoas Chave para o Conselho
  const councilMembers = agents.filter(a => ['ca006gpb', 'ca007gpb'].includes(a.id)); 
  
  // Mock da Auditoria
  const auditMembers = [
    { id: 'mock1', name: 'Dr. Chen', officialRole: 'Compliance Officer' },
    { id: 'mock2', name: 'Maya', officialRole: 'Auditora Fiscal' },
    { id: 'mock3', name: 'Silva', officialRole: 'Segurança' },
  ];

  // Componente Visual para Pessoas
  const PersonNode: React.FC<{ name: string; role: string; type: 'COUNCIL' | 'AUDIT'; avatarUrl?: string }> = ({ name, role, type, avatarUrl }) => (
    <div className="flex flex-col items-center group cursor-default min-w-[80px]">
        <div className={`
           p-0.5 rounded-2xl bg-white border shadow-sm transition-transform hover:-translate-y-1 duration-300
           ${type === 'COUNCIL' ? 'border-gray-200' : 'border-gray-100 opacity-90'}
        `}>
           <Avatar name={name} url={avatarUrl} className="w-8 h-8 md:w-10 md:h-10 rounded-xl" />
        </div>
        <div className="mt-1 text-center">
            <span className="block text-[8px] font-bold text-gray-800 uppercase tracking-tight leading-tight whitespace-nowrap">{name}</span>
            <span className="block text-[6px] font-bold text-gray-400 uppercase tracking-wider">{role}</span>
        </div>
    </div>
  );

  // Componente de Unidade Expansível (CORRIGIDO: POSICIONAMENTO ABSOLUTO)
  const ExpandableIcon: React.FC<{ bu: BusinessUnit, size?: 'large' | 'medium' | 'small' }> = ({ bu, size = 'medium' }) => {
    const isExpanded = isGlobalExpanded || expandedId === bu.id;
    const buAgents = agents.filter(a => a.buId === bu.id).sort((a,b) => (a.tier === 'ESTRATÉGICO' ? -1 : 1));

    const toggleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isGlobalExpanded) return;
        setExpandedId(prev => prev === bu.id ? null : bu.id);
    };

    const sizeConfig = {
      large: { box: 'w-16 h-16 md:w-20 md:h-20 rounded-[1.2rem]', text: 'text-xs md:text-sm' },
      medium: { box: 'w-10 h-10 md:w-14 md:h-14 rounded-[0.8rem]', text: 'text-[8px] md:text-[9px]' },
      small: { box: 'w-8 h-8 md:w-10 md:h-10 rounded-[0.6rem]', text: 'text-[7px] md:text-[8px]' }
    }[size];

    return (
      <div className={`relative flex flex-col items-center group ${isExpanded ? 'z-50' : 'z-0'}`}>
         {/* Ícone Visível */}
         <div onClick={toggleExpand} className={`cursor-pointer relative flex flex-col items-center transition-transform duration-300 ease-out ${!isExpanded ? 'hover:-translate-y-1' : ''}`}>
             <div className={`flex items-center justify-center transition-all duration-300 bg-white ${sizeConfig.box} ${isExpanded ? 'scale-105 border-bitrix-nav' : 'border-gray-100'} shadow-md group-hover:shadow-lg border`}>
                {bu.logo ? (
                    <img src={bu.logo} alt={bu.name} className={`object-cover w-full h-full ${sizeConfig.box}`} />
                ) : (
                    <div className="font-black text-white w-full h-full flex items-center justify-center text-xs" style={{ backgroundColor: bu.themeColor, borderRadius: 'inherit' }}>
                        {bu.name.substring(0,2).toUpperCase()}
                    </div>
                )}
             </div>
             <h3 className={`text-center font-black text-gray-800 uppercase tracking-tight mt-1 transition-colors duration-300 ${sizeConfig.text} max-w-[80px] truncate`}>
                {bu.name}
             </h3>
         </div>

         {/* Dropdown Flutuante (Absolute para não empurrar o layout) */}
         <div className={`
            absolute top-full mt-2 left-1/2 -translate-x-1/2 
            w-56 bg-white/95 backdrop-blur rounded-xl border border-gray-200 shadow-xl 
            transition-all duration-200 ease-out origin-top
            ${isExpanded ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible pointer-events-none'}
         `}>
             <div className="flex flex-col gap-1 w-full p-1" onClick={(e) => { e.stopPropagation(); }}>
                
                {/* BOTÃO ACESSAR ECOSSISTEMA */}
                <button 
                    onClick={(e) => { e.stopPropagation(); onSelectBU(bu); }}
                    className="w-full py-2.5 mb-1 bg-bitrix-nav text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-bitrix-accent transition-colors shadow-sm flex items-center justify-center gap-2 group/btn"
                >
                    <span>Acessar Ecossistema</span>
                    <svg className="w-3 h-3 text-white/70 group-hover/btn:text-white group-hover/btn:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                </button>

                {buAgents.length === 0 ? (
                    <p className="text-[8px] font-bold text-gray-300 italic uppercase text-center py-2">Sem Agentes</p>
                ) : (
                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar flex flex-col gap-1">
                        {buAgents.map(agent => (
                            <div key={agent.id} onClick={(e) => { e.stopPropagation(); if (onSelectAgent) onSelectAgent(agent); }} className="bg-white p-1.5 rounded-lg border border-gray-100 shadow-sm hover:border-gray-300 hover:shadow-md transition-all flex items-center gap-2 w-full cursor-pointer group/card">
                                <Avatar name={agent.name} url={agent.avatarUrl} className="w-6 h-6 rounded-md shadow-sm" />
                                <div className="text-left min-w-0 flex-1">
                                    <p className="text-[10px] font-bold text-gray-800 leading-tight truncate group-hover/card:text-bitrix-nav">{agent.name}</p>
                                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider truncate">{agent.officialRole}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
         </div>
      </div>
    );
  };

  return (
    <div className="flex-1 h-full bg-[#F8FAFC] overflow-y-auto custom-scrollbar animate-msg font-sans">
      <div className="w-full max-w-[1920px] mx-auto px-4 md:px-8 py-6 md:py-8 flex flex-col items-center">
        
        {/* HEADER */}
        <div className="w-full flex items-end justify-between mb-12 border-b border-gray-100 pb-4 max-w-6xl">
            <div className="text-left">
                <h1 className="text-2xl font-black text-gray-900 tracking-tighter uppercase mb-1">Ecossistema</h1>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.4em]">Organograma Oficial</p>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
                <button onClick={() => onNavigate('fabrica-ca')} className="px-3 py-2 bg-gray-900 text-white rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-md flex items-center gap-2">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                    <span className="hidden md:inline">RH</span>
                </button>
                <button onClick={() => setIsGlobalExpanded(!isGlobalExpanded)} className="px-3 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl text-[8px] font-black uppercase tracking-widest hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm flex items-center gap-2">
                    {isGlobalExpanded ? "Recolher" : "Expandir"}
                </button>
            </div>
        </div>

        {/* --- ÁRVORE HIERÁRQUICA --- */}
        <div className="relative flex flex-col items-center w-full max-w-7xl">
            
            {/* NÍVEL 1: HOLDING (GRUPOB) */}
            {masterBU && (
                <div className="relative z-30 flex flex-col items-center mb-8">
                    <ExpandableIcon bu={masterBU} size="large" />
                    <div className="w-px h-12 bg-gray-200"></div>
                </div>
            )}

            {/* NÍVEL 1.5: ESTRUTURA HORIZONTAL (Metodologias | Conselho | Auditoria) */}
            <div className="w-full grid grid-cols-2 gap-8 md:gap-16 mb-12 relative z-20">
                
                {/* Linhas de Conexão */}
                <div className="absolute top-0 left-[15%] right-[15%] h-px bg-gray-200 -z-10"></div>
                <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gray-200 -z-10"></div>

                {/* ESQUERDA: METODOLOGIAS (Horizontal) */}
                <div className="flex flex-col items-end pr-8 border-r border-gray-100/50">
                    <div className="bg-white px-3 py-1 mb-4 border border-gray-100 rounded-full shadow-sm z-10 relative -top-3">
                         <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest">Metodologias</span>
                    </div>
                    {/* FLEX ROW FORÇADO */}
                    <div className="flex flex-row flex-wrap justify-end gap-3 w-full">
                        {methodologies.map(bu => (
                            <ExpandableIcon key={bu.id} bu={bu} size="small" />
                        ))}
                    </div>
                </div>

                {/* DIREITA: CONSELHO & AUDITORIA */}
                <div className="flex flex-col items-start pl-8">
                     {/* Grupo Conselho */}
                    <div className="flex flex-col items-start mb-8 w-full">
                        <div className="bg-white px-3 py-1 mb-4 border border-gray-100 rounded-full shadow-sm z-10 relative -top-3">
                            <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest">Conselho</span>
                        </div>
                        <div className="flex gap-4">
                            {councilMembers.length > 0 ? (
                                councilMembers.map(agent => (
                                    <PersonNode key={agent.id} name={agent.name} role="Conselheiro" type="COUNCIL" avatarUrl={agent.avatarUrl} />
                                ))
                            ) : (
                                <span className="text-[8px] text-red-300 font-bold uppercase">Conselho Offline</span>
                            )}
                        </div>
                    </div>

                    {/* Grupo Auditoria */}
                    <div className="flex flex-col items-start w-full">
                         <div className="bg-white px-3 py-1 mb-4 border border-gray-100 rounded-full shadow-sm z-10">
                            <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest">Auditoria (IA)</span>
                        </div>
                        <div className="flex gap-4 opacity-80">
                            {auditMembers.map(auditor => (
                                <PersonNode key={auditor.id} name={auditor.name} role={auditor.officialRole} type="AUDIT" />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* NÍVEL 2: CORE BUSINESS */}
            <div className="relative w-full flex flex-col items-center mb-16 z-10">
                <div className="bg-white px-4 py-1 mb-6 border border-gray-100 rounded-full shadow-sm z-10">
                     <span className="text-[8px] font-black text-gray-800 uppercase tracking-widest">Core Business</span>
                </div>
                
                <div className="flex flex-wrap md:flex-nowrap justify-center items-center gap-2 max-w-full">
                    {bUnits.map(bu => (
                        <ExpandableIcon key={bu.id} bu={bu} size="medium" />
                    ))}
                </div>

                <div className="w-px h-12 bg-gray-200 mt-6"></div>
            </div>

            {/* NÍVEL 3: VENTURES */}
            <div className="relative w-full flex flex-col items-center pb-8 z-0">
                <div className="bg-white px-4 py-1 mb-6 border border-gray-100 rounded-full shadow-sm z-10">
                     <span className="text-[7px] font-black text-gray-400 uppercase tracking-widest">Ventures</span>
                </div>
                
                <div className="flex flex-wrap justify-center gap-2 md:gap-3 max-w-5xl">
                    {ventures.map(bu => (
                        <ExpandableIcon key={bu.id} bu={bu} size="small" />
                    ))}
                </div>
            </div>

            {/* NÍVEL 4: INCUBADORA / CUSTOM (VISIBILIDADE PARA PÉGAS E OUTROS) */}
            {otherUnits.length > 0 && (
                <div className="relative w-full flex flex-col items-center pb-20 z-0 mt-8 border-t border-dashed border-gray-200 pt-8">
                    <div className="bg-blue-50 px-4 py-1 mb-6 border border-blue-100 rounded-full shadow-sm z-10">
                        <span className="text-[7px] font-black text-blue-500 uppercase tracking-widest">Incubadora / Custom</span>
                    </div>
                    
                    <div className="flex flex-wrap justify-center gap-2 md:gap-3 max-w-5xl animate-msg">
                        {otherUnits.map(bu => (
                            <ExpandableIcon key={bu.id} bu={bu} size="small" />
                        ))}
                    </div>
                </div>
            )}

        </div>
      </div>
    </div>
  );
};

export default HubView;
