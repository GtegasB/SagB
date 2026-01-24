
import React, { useState, useRef, useEffect } from 'react';
import { Agent, BusinessUnit, AgentStatus, AgentTier, ModelProvider } from '../types';
import { Avatar } from './Avatar';
import { PaperclipIcon, PlusIcon, SearchIcon, ChevronDownIcon, XIcon, TrashIcon, PencilIcon, CloudUploadIcon, BotIcon, BackIcon } from './Icon';

interface AgentFactoryProps {
  onNavigateToEcosystem: () => void;
  onActivate: (agentData: any) => void;
  onRemove?: (agentId: string) => void; 
  activeBU: BusinessUnit;
  businessUnits: BusinessUnit[];
  agents: Agent[];
  initialAgent?: Agent | null;
  onManageIntelligence?: (agent: Agent) => void;
}

interface DynamicOption {
    id: string;
    label: string;
    colorClass: string;
    isSystem?: boolean;
}

// Definição das colunas móveis
const INITIAL_MOVABLE_COLUMNS = [
    { id: 'photo', label: 'Foto', width: 60, align: 'center' },
    { id: 'role', label: 'Cargo Principal', width: 220, align: 'left' },
    { id: 'docs', label: 'Doc. Vinculados', width: 100, align: 'left' },
    { id: 'company', label: 'Empresa', width: 140, align: 'left' },
    { id: 'division', label: 'Divisão', width: 100, align: 'left' },
    { id: 'type', label: 'Tipo', width: 130, align: 'left' },
    { id: 'model', label: 'Cérebro', width: 100, align: 'left' },
    { id: 'status', label: 'Status', width: 150, align: 'left' },
    { id: 'resp', label: 'Resp.', width: 80, align: 'center' },
    { id: 'dept', label: 'Depto.', width: 120, align: 'left' },
    { id: 'start', label: 'Início', width: 100, align: 'left' },
    { id: 'salary', label: 'Salário', width: 100, align: 'left' },
    { id: 'actions', label: '', width: 140, align: 'center' }
];

const AgentFactory: React.FC<AgentFactoryProps> = ({ 
  onNavigateToEcosystem, 
  onActivate,
  onRemove,
  activeBU, 
  businessUnits, 
  agents,
  onManageIntelligence
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'group'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [grouping, setGrouping] = useState<'none' | 'company'>('none'); 
  
  // --- STATE COLUNAS ---
  const [columnOrder, setColumnOrder] = useState(INITIAL_MOVABLE_COLUMNS.map(c => c.id));
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

  // --- ESTADOS PARA CRIAÇÃO INLINE ---
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newAgent, setNewAgent] = useState<Partial<Agent>>({
      name: '',
      officialRole: '',
      company: activeBU.name,
      buId: activeBU.id,
      status: 'ACTIVE',
      tier: 'OPERACIONAL',
      division: '',
      salary: '',
      collaboratorType: 'AGENTE_IA',
      avatarUrl: '',
      modelProvider: 'gemini'
  });

  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [statusOptions, setStatusOptions] = useState<DynamicOption[]>([
      { id: 'ACTIVE', label: 'ATIVOS', colorClass: 'bg-green-500 text-white hover:bg-green-600', isSystem: true },
      { id: 'STAGING', label: 'HOMOLOGAÇÃO', colorClass: 'bg-purple-500 text-white hover:bg-purple-600', isSystem: true },
      { id: 'MAINTENANCE', label: 'EM DESENV...', colorClass: 'bg-gray-100 text-gray-500 hover:bg-gray-200', isSystem: true },
      { id: 'PLANNED', label: 'PLANEJADO', colorClass: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200', isSystem: true },
      { id: 'BLOCKED', label: 'BLOQUEADO', colorClass: 'bg-red-100 text-red-600 hover:bg-red-200', isSystem: false }
  ]);

  const [typeOptions, setTypeOptions] = useState<DynamicOption[]>([
      { id: 'HUMANO', label: 'HUMANO', colorClass: 'bg-[#8b5cf6] text-white', isSystem: true },
      { id: 'AGENTE_IA', label: 'AGENTE IA', colorClass: 'bg-[#f43f5e] text-white', isSystem: true },
      { id: 'TERCEIRO', label: 'TERCEIRO', colorClass: 'bg-orange-500 text-white', isSystem: false }
  ]);

  // --- RESIZABLE COLUMNS STATE ---
  const [colWidths, setColWidths] = useState({
      expand: 40,
      name: 380,
      ...INITIAL_MOVABLE_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.width }), {})
  });

  const resizingRef = useRef<{ colId: string, startX: number, startWidth: number } | null>(null);

  const startResize = (e: React.MouseEvent, colId: string) => {
      e.preventDefault();
      e.stopPropagation();
      resizingRef.current = {
          colId,
          startX: e.clientX,
          startWidth: colWidths[colId as keyof typeof colWidths]
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none'; 
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const { colId, startX, startWidth } = resizingRef.current;
      const diff = e.clientX - startX;
      const newWidth = Math.max(40, startWidth + diff); 
      
      setColWidths(prev => ({
          ...prev,
          [colId]: newWidth
      }));
  };

  const handleMouseUp = () => {
      resizingRef.current = null;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
  };

  // --- DRAG AND DROP HANDLERS ---
  const handleDragStart = (e: React.DragEvent, colId: string) => {
      setDraggedColumn(colId);
      e.dataTransfer.effectAllowed = 'move';
      // Pequeno hack para a imagem fantasma não ser gigante
      const img = new Image();
      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      e.dataTransfer.setDragImage(img, 0, 0);
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
      e.preventDefault();
      if (!draggedColumn || draggedColumn === colId) return;

      const newOrder = [...columnOrder];
      const draggedIdx = newOrder.indexOf(draggedColumn);
      const targetIdx = newOrder.indexOf(colId);

      if (draggedIdx !== -1 && targetIdx !== -1) {
          newOrder.splice(draggedIdx, 1);
          newOrder.splice(targetIdx, 0, draggedColumn);
          setColumnOrder(newOrder);
      }
  };

  const handleDragEnd = () => {
      setDraggedColumn(null);
  };

  const Resizer = ({ colId }: { colId: string }) => (
      <div 
          className="absolute top-0 right-0 bottom-0 w-4 cursor-col-resize flex justify-center group z-20 translate-x-2"
          onMouseDown={(e) => startResize(e, colId)}
          onClick={(e) => e.stopPropagation()}
      >
          <div className="w-[2px] h-full bg-transparent group-hover:bg-purple-400 transition-colors"></div>
      </div>
  );

  // --- LOGICA DE CRIAÇÃO/EDIÇÃO ---
  
  const handleEditAgent = (agent: Agent) => {
      setNewAgent({ ...agent });
      setEditingId(agent.id);
      setIsAdding(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setNewAgent(prev => ({ ...prev, avatarUrl: reader.result as string }));
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSaveNewAgent = () => {
      if (!newAgent.name || !newAgent.officialRole) {
          alert("Nome e Cargo são obrigatórios.");
          return;
      }

      if (!newAgent.avatarUrl) {
          alert("PROTOCOLO DE SEGURANÇA: É obrigatório adicionar uma foto de identidade para o agente.");
          return;
      }

      const selectedBU = businessUnits.find(b => b.id === newAgent.buId);
      
      const agentId = editingId || Date.now().toString();
      const universalId = editingId 
          ? agents.find(a => a.id === editingId)?.universalId 
          : `ca${Math.floor(Math.random()*10000)}new`;

      const payload = {
          ...newAgent,
          company: selectedBU ? selectedBU.name : 'GrupoB',
          version: '1.0',
          fullPrompt: editingId ? (newAgent.fullPrompt || '') : '', 
          sector: newAgent.division || 'Geral',
          id: agentId,
          universalId: universalId
      };

      onActivate(payload);
      setIsAdding(false);
      setEditingId(null);
      setNewAgent({ 
          name: '', officialRole: '', company: activeBU.name, buId: activeBU.id,
          status: 'ACTIVE', tier: 'OPERACIONAL', division: '', salary: '',
          collaboratorType: 'AGENTE_IA', avatarUrl: '', modelProvider: 'gemini'
      });
  };

  const handleCancel = () => {
      setIsAdding(false);
      setEditingId(null);
      setNewAgent({ 
          name: '', officialRole: '', company: activeBU.name, buId: activeBU.id,
          status: 'ACTIVE', tier: 'OPERACIONAL', division: '', salary: '',
          collaboratorType: 'AGENTE_IA', avatarUrl: '', modelProvider: 'gemini'
      });
  }

  const handleStatusChange = (agent: Agent, value: string) => {
      if (value === '__NEW__') {
          const newLabel = prompt("Nome do Novo Status (ex: FÉRIAS):");
          if (newLabel) {
              const newId = newLabel.toUpperCase().replace(/\s+/g, '_');
              setStatusOptions(prev => [...prev, { id: newId, label: newLabel.toUpperCase(), colorClass: 'bg-blue-500 text-white', isSystem: false }]);
              const updatedAgent = { ...agent, status: newId as AgentStatus }; 
              onActivate(updatedAgent);
          }
      } else {
          const updatedAgent = { ...agent, status: value as AgentStatus };
          onActivate(updatedAgent);
      }
  };

  const handleTypeChange = (agent: Agent, value: string) => {
      console.log(`Tipo alterado para ${value} para ${agent.name}`);
  };

  const getStatusOption = (statusId: string) => {
      return statusOptions.find(s => s.id === statusId) || 
             { id: statusId, label: statusId, colorClass: 'bg-gray-100 text-gray-500' };
  };

  const getRenderGroups = () => {
      const filteredList = agents.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()));

      if (grouping === 'none') {
          return {
              'ALL': { id: 'all', name: 'Todos os Colaboradores', color: '#111827', agents: filteredList }
          };
      }

      return filteredList.reduce((acc, agent) => {
        const bu = businessUnits.find(b => b.id === agent.buId);
        const buKey = bu ? bu.name : (agent.company || 'Outros'); 
        const themeColor = bu ? bu.themeColor : '#6B7280'; 
        const buId = bu ? bu.id : 'custom_unit';

        if (!acc[buKey]) {
          acc[buKey] = { id: buId, name: buKey, color: themeColor, agents: [] };
        }
        acc[buKey].agents.push(agent);
        return acc;
      }, {} as Record<string, { id: string, name: string, color: string, agents: Agent[] }>);
  };

  const groups = getRenderGroups();
  const sortedGroupKeys = Object.keys(groups).sort();

  const renderTypeSelect = (agent: Agent) => {
    const isHuman = agent.collaboratorType === 'HUMANO' || agent.officialRole.toLowerCase().includes('humano');
    const currentTypeId = agent.collaboratorType || (isHuman ? 'HUMANO' : 'AGENTE_IA');
    const currentOption = typeOptions.find(t => t.id === currentTypeId) || typeOptions[1];

    return (
        <div className="relative group/type w-full h-6">
            <select 
                value={currentTypeId}
                onChange={(e) => handleTypeChange(agent, e.target.value)}
                className={`appearance-none w-full h-full pl-2 pr-4 rounded-[4px] text-[9px] font-bold uppercase shadow-sm whitespace-nowrap outline-none cursor-pointer text-center ${currentOption.colorClass}`}
            >
                {typeOptions.map(opt => (
                    <option key={opt.id} value={opt.id} className="bg-white text-gray-800">{opt.label}</option>
                ))}
            </select>
        </div>
    );
  };

  // --- RENDER DYNAMIC CELL ---
  const renderCellContent = (colId: string, agent: Agent | null, isInputRow: boolean = false, badgeName: string = '', badgeColor: string = '') => {
      // Helper para renderizar célula de tabela
      const wrapCell = (content: React.ReactNode, align: string = 'left') => (
          <td className={`px-4 align-middle overflow-hidden ${align === 'center' ? 'text-center' : 'text-left'}`}>
              {content}
          </td>
      );

      if (isInputRow) {
          // RENDERIZAÇÃO DA LINHA DE CRIAÇÃO (INPUTS)
          switch (colId) {
              case 'photo':
                  return (
                      <td className="px-2 align-middle text-center">
                          <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                          <div onClick={() => avatarInputRef.current?.click()} className={`w-8 h-8 rounded-full mx-auto flex items-center justify-center text-[8px] font-bold border cursor-pointer hover:scale-110 transition-all relative overflow-hidden ${!newAgent.avatarUrl ? 'bg-red-100 border-red-300 text-red-500 animate-pulse' : 'bg-gray-200 border-gray-300'}`} title="FOTO OBRIGATÓRIA">
                              {newAgent.avatarUrl ? <img src={newAgent.avatarUrl} className="w-full h-full object-cover" /> : <CloudUploadIcon className="w-4 h-4" />}
                          </div>
                      </td>
                  );
              case 'role': return wrapCell(<input className="w-full bg-white border border-blue-200 rounded px-2 py-1 text-[10px] outline-none focus:ring-1 focus:ring-blue-400" placeholder="Cargo" value={newAgent.officialRole} onChange={e => setNewAgent({...newAgent, officialRole: e.target.value})} />);
              case 'docs': return wrapCell(<span className="text-[10px] text-gray-300">-</span>, 'center');
              case 'company': 
                  return wrapCell(
                      <select className="w-full bg-white border border-blue-200 rounded px-2 py-1 text-[10px] outline-none" value={newAgent.buId} onChange={e => setNewAgent({...newAgent, buId: e.target.value})}>
                          {businessUnits.map(bu => <option key={bu.id} value={bu.id}>{bu.name}</option>)}
                      </select>
                  );
              case 'division': return wrapCell(<input className="w-full bg-white border border-blue-200 rounded px-2 py-1 text-[10px] outline-none focus:ring-1 focus:ring-blue-400" placeholder="Divisão" value={newAgent.division || ''} onChange={e => setNewAgent({...newAgent, division: e.target.value})} />);
              case 'type':
                  return wrapCell(
                      <select className="w-full bg-white border border-blue-200 rounded px-2 py-1 text-[10px] outline-none" value={newAgent.collaboratorType} onChange={e => setNewAgent({...newAgent, collaboratorType: e.target.value})}>
                          {typeOptions.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                  );
              case 'model':
                  return wrapCell(
                      <select className="w-full bg-white border border-blue-200 rounded px-2 py-1 text-[10px] outline-none font-bold" value={newAgent.modelProvider || 'gemini'} onChange={e => setNewAgent({...newAgent, modelProvider: e.target.value as ModelProvider})}>
                          <option value="gemini">⚡ Gemini 2.0 (Google)</option>
                          <option value="deepseek">🧠 DeepSeek V3 (Reasoning)</option>
                      </select>
                  );
              case 'status':
                  return wrapCell(
                      <select className="w-full bg-white border border-blue-200 rounded px-2 py-1 text-[10px] outline-none" value={newAgent.status} onChange={e => setNewAgent({...newAgent, status: e.target.value as AgentStatus})}>
                          {statusOptions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                  );
              case 'resp': return wrapCell(<span className="text-[10px] text-gray-300">-</span>, 'center');
              case 'dept': return wrapCell(<span className="text-[10px] text-gray-300">-</span>, 'center');
              case 'start': return wrapCell(<input type="date" className="w-full bg-white border border-blue-200 rounded px-2 py-1 text-[10px] outline-none" value={newAgent.startDate || ''} onChange={e => setNewAgent({...newAgent, startDate: e.target.value})} />);
              case 'salary': return wrapCell(<input className="w-full bg-white border border-blue-200 rounded px-2 py-1 text-[10px] outline-none focus:ring-1 focus:ring-blue-400" placeholder="R$ 0,00" value={newAgent.salary || ''} onChange={e => setNewAgent({...newAgent, salary: e.target.value})} />);
              case 'actions':
                  return wrapCell(
                      <div className="flex items-center justify-center gap-2">
                          <button onClick={handleSaveNewAgent} className="w-6 h-6 bg-green-500 hover:bg-green-600 text-white rounded flex items-center justify-center shadow-sm transition-all" title="Salvar"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><path d="M5 13l4 4L19 7" /></svg></button>
                          <button onClick={handleCancel} className="w-6 h-6 bg-red-100 hover:bg-red-200 text-red-500 rounded flex items-center justify-center shadow-sm transition-all" title="Cancelar"><XIcon className="w-3 h-3" /></button>
                      </div>, 'center'
                  );
              default: return <td />;
          }
      } else if (agent) {
          // RENDERIZAÇÃO DE LINHA NORMAL
          const isMaintenance = agent.status === 'MAINTENANCE';
          const currentStatusOpt = getStatusOption(agent.status);

          switch (colId) {
              case 'photo':
                  return (
                      <td className="px-2 flex justify-center items-center h-8 overflow-hidden">
                          <div className={`transition-all ${agent.status === 'PLANNED' ? 'opacity-50 grayscale' : ''}`}>
                              <Avatar name={agent.name} url={agent.avatarUrl} className="w-6 h-6 rounded-md" />
                          </div>
                      </td>
                  );
              case 'role': return wrapCell(<div className={`text-[10px] whitespace-nowrap overflow-hidden text-ellipsis max-w-full cursor-text ${isMaintenance ? 'text-gray-400' : 'text-gray-600'}`} title={agent.officialRole}>{agent.officialRole}</div>);
              case 'docs': return wrapCell(<span className="text-[10px] text-gray-300 font-bold">{agent.docCount || '—'}</span>);
              case 'company':
                  return wrapCell(
                      <div className="h-6 w-full flex items-center justify-center rounded-[4px] text-white text-[9px] font-bold uppercase shadow-sm cursor-pointer hover:opacity-90 mx-auto" style={{ backgroundColor: grouping === 'company' ? '#d1d5db' : badgeColor }}>
                          {badgeName}
                      </div>
                  );
              case 'division': return wrapCell(<span className="text-[10px] text-gray-500 font-bold block text-center truncate">{agent.division || agent.sector || '—'}</span>);
              case 'type': return wrapCell(renderTypeSelect(agent));
              case 'model':
                  return wrapCell(
                      agent.modelProvider === 'deepseek' ? (
                          <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase border border-blue-100 flex items-center justify-center gap-1">🧠 DeepSeek</span>
                      ) : (
                          <span className="text-[8px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full uppercase border border-gray-100 flex items-center justify-center gap-1">⚡ Gemini</span>
                      ), 'center'
                  );
              case 'status':
                  return wrapCell(
                      <div className="relative group/status w-full h-6">
                          <select value={agent.status} onChange={(e) => handleStatusChange(agent, e.target.value)} className={`appearance-none w-full h-full pl-2 pr-6 rounded-[4px] text-[9px] font-black uppercase tracking-widest outline-none cursor-pointer transition-all truncate flex items-center ${currentStatusOpt.colorClass}`}>
                              {statusOptions.map(opt => <option key={opt.id} value={opt.id} className="bg-white text-gray-800 font-bold">{opt.label}</option>)}
                              <option disabled>──────────</option>
                              <option value="__NEW__" className="bg-gray-50 text-gray-400 text-[10px]">+ Novo</option>
                          </select>
                          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-current opacity-70"><ChevronDownIcon className="w-2.5 h-2.5" /></div>
                      </div>
                  );
              case 'resp':
                  return wrapCell(
                      <div className="w-5 h-5 rounded-full bg-gray-100 border border-white flex items-center justify-center text-[10px] text-gray-400 shadow-sm cursor-pointer hover:bg-gray-200 mx-auto">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                      </div>, 'center'
                  );
              case 'dept': return wrapCell(<div className="border border-gray-100 rounded px-2 py-0.5 bg-gray-50 text-[9px] text-gray-400 text-center whitespace-nowrap">{agent.tier === 'ESTRATÉGICO' ? 'Diretoria' : '—'}</div>);
              case 'start': return wrapCell(<div className="flex items-center gap-1 text-[10px] text-gray-400">{agent.startDate ? agent.startDate : '—'}</div>);
              case 'salary': return wrapCell(<div className="text-[10px] text-gray-600 overflow-hidden font-mono">{agent.salary || '—'}</div>);
              case 'actions':
                  return wrapCell(
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEditAgent(agent)} className="text-gray-300 hover:text-blue-500 transition-colors w-6 h-6 flex items-center justify-center bg-gray-50 rounded-lg hover:bg-blue-50" title="Editar"><PencilIcon className="w-3.5 h-3.5" /></button>
                          {onManageIntelligence && <button onClick={() => onManageIntelligence(agent)} className="text-gray-300 hover:text-purple-600 transition-colors w-6 h-6 flex items-center justify-center bg-gray-50 rounded-lg hover:bg-purple-50" title="Cérebro"><BotIcon className="w-3.5 h-3.5" /></button>}
                          {onRemove && <button onClick={() => { if (window.confirm(`Excluir ${agent.name}?`)) onRemove(agent.id); }} className="text-gray-300 hover:text-red-500 transition-colors w-6 h-6 flex items-center justify-center bg-gray-50 rounded-lg hover:bg-red-50" title="Excluir"><TrashIcon className="w-3.5 h-3.5" /></button>}
                      </div>, 'center'
                  );
              default: return <td />;
          }
      }
      return <td />;
  };

  return (
    <div className="flex-1 h-full bg-[#F9FAFB] flex flex-col font-nunito overflow-hidden">
        {/* Header */}
        <div className="h-20 bg-white border-b border-gray-100 flex justify-between items-center px-8 shrink-0">
            <div className="flex items-center gap-4">
                <button onClick={onNavigateToEcosystem} className="hover:bg-gray-100 p-2 rounded-lg text-gray-400 transition-colors">
                    <BackIcon className="w-6 h-6" />
                </button>
                <div>
                    <h1 className="text-2xl font-black text-bitrix-nav uppercase tracking-tighter">R.H.</h1>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Gestão de Colaboradores & I.A.</p>
                </div>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 w-64 focus-within:border-blue-300 transition-all">
                    <SearchIcon className="w-4 h-4 text-gray-400" />
                    <input 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Buscar profissional..."
                        className="bg-transparent border-none outline-none text-xs font-bold text-gray-600 ml-2 w-full placeholder:text-gray-300"
                    />
                </div>
                
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setGrouping('none')} className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${grouping === 'none' ? 'bg-white text-bitrix-nav shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Lista</button>
                    <button onClick={() => setGrouping('company')} className={`px-3 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${grouping === 'company' ? 'bg-white text-bitrix-nav shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Agrupar</button>
                </div>

                <button onClick={() => { setIsAdding(true); setEditingId(null); }} className="px-5 py-2.5 bg-bitrix-nav text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg flex items-center gap-2">
                    <PlusIcon className="w-3 h-3" />
                    Novo Colaborador
                </button>
            </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-auto pb-40 bg-white relative">
            <table className="w-full border-collapse table-fixed min-w-[1400px]">
                <colgroup>
                    <col style={{ width: colWidths.expand }} />
                    <col style={{ width: colWidths.name }} />
                    {columnOrder.map(colId => (
                        <col key={colId} style={{ width: colWidths[colId as keyof typeof colWidths] || 100 }} />
                    ))}
                </colgroup>
                
                <thead>
                    <tr className="border-b border-gray-100 bg-white sticky top-0 z-40 shadow-sm h-10">
                        {/* FIXADO: Coluna Expand */}
                        <th className="text-center px-2 bg-white relative group border-b border-gray-100" style={{ position: 'sticky', left: 0, zIndex: 40 }}>
                             <Resizer colId="expand" /> 
                        </th>
                        {/* FIXADO: Coluna Nome */}
                        <th className="text-left px-4 text-[9px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap bg-white relative group border-b border-gray-100 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]" style={{ position: 'sticky', left: colWidths.expand, zIndex: 40 }}> 
                            Nome <Resizer colId="name" /> 
                        </th>
                        
                        {/* COLUNAS MÓVEIS (DRAGGABLE) */}
                        {columnOrder.map(colId => {
                            const colDef = INITIAL_MOVABLE_COLUMNS.find(c => c.id === colId);
                            if (!colDef) return null;
                            return (
                                <th 
                                    key={colId}
                                    className={`
                                        ${colDef.align === 'center' ? 'text-center' : 'text-left'} px-4 
                                        text-[9px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap 
                                        bg-white relative group cursor-grab active:cursor-grabbing hover:bg-gray-50 transition-colors
                                        ${draggedColumn === colId ? 'opacity-30 bg-gray-100' : ''}
                                    `}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, colId)}
                                    onDragOver={(e) => handleDragOver(e, colId)}
                                    onDragEnd={handleDragEnd}
                                >
                                    {colDef.label} 
                                    <Resizer colId={colId} />
                                </th>
                            );
                        })}
                    </tr>
                </thead>

                {isAdding && (
                    <tbody>
                        <tr className="bg-blue-50/30 border-b border-blue-100 transition-all h-10 animate-msg shadow-inner group">
                            {/* FIXADO: Coluna Expand */}
                            <td className="px-2 text-center align-middle bg-white group-hover:bg-blue-50/30" style={{ position: 'sticky', left: 0, zIndex: 30 }}>
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mx-auto animate-pulse"></div>
                            </td>
                            {/* FIXADO: Coluna Nome */}
                            <td className="px-4 align-middle bg-white group-hover:bg-blue-50/30 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] border-r border-gray-100" style={{ position: 'sticky', left: colWidths.expand, zIndex: 30 }}>
                                <input 
                                    autoFocus
                                    className="w-full bg-white border border-blue-200 rounded px-2 py-1 text-[10px] outline-none focus:ring-1 focus:ring-blue-400"
                                    placeholder="Nome do Agente"
                                    value={newAgent.name}
                                    onChange={e => setNewAgent({...newAgent, name: e.target.value})}
                                />
                            </td>
                            
                            {/* Células Dinâmicas de Criação */}
                            {columnOrder.map(colId => (
                                <React.Fragment key={colId}>
                                    {renderCellContent(colId, null, true)}
                                </React.Fragment>
                            ))}
                        </tr>
                    </tbody>
                )}

                {sortedGroupKeys.map(groupKey => {
                    const group = groups[groupKey];
                    if (group.agents.length === 0) return null;

                    return (
                        <tbody key={group.name}>
                            {grouping === 'company' && (
                                <tr className="bg-white group/header sticky top-9 z-10">
                                    <td colSpan={15} className="pt-6 pb-2 px-4 bg-gray-50/50 border-b border-gray-100">
                                        <div className="flex items-center gap-3">
                                            <div className={`px-4 py-1 rounded-[4px] text-white text-[11px] font-black uppercase shadow-sm tracking-wider flex items-center gap-2 cursor-pointer hover:brightness-110 transition-all`} style={{ backgroundColor: group.color }}>
                                                {group.name}
                                                <span className="bg-black/20 px-1.5 py-0.5 rounded text-[9px] min-w-[20px] text-center">{group.agents.length}</span>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {group.agents.map(agent => {
                                const agentBu = businessUnits.find(b => b.id === agent.buId);
                                const badgeColor = agentBu ? agentBu.themeColor : '#6B7280';
                                const badgeName = agentBu ? agentBu.name : (agent.company || 'Outros');
                                const isActive = agent.status === 'ACTIVE';
                                const isPlanned = agent.status === 'PLANNED';
                                
                                let nameColorClass = isPlanned ? 'text-yellow-600' : 'text-gray-700';

                                return (
                                    <tr 
                                        key={agent.id} 
                                        className="group border-b border-gray-100 transition-all bg-white h-8 hover:bg-gray-50"
                                    >
                                        {/* FIXADO: Coluna Expand */}
                                        <td className="px-2 text-center align-middle overflow-hidden bg-white group-hover:bg-gray-50 transition-colors" style={{ position: 'sticky', left: 0, zIndex: 30 }}>
                                            <div className="w-0 group-hover:w-full transition-all overflow-hidden flex justify-center">
                                                <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                                            </div>
                                        </td>
                                        
                                        {/* FIXADO: Coluna Nome */}
                                        <td className="px-4 align-middle border-r border-transparent group-hover:border-gray-100 overflow-hidden bg-white group-hover:bg-gray-50 transition-colors shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]" style={{ position: 'sticky', left: colWidths.expand, zIndex: 30 }}>
                                            <div className="flex items-center gap-3 w-full">
                                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                                <span className={`text-[11px] font-medium whitespace-nowrap overflow-hidden text-ellipsis block max-w-full ${nameColorClass}`} title={agent.name}>
                                                    {agent.name}
                                                </span>
                                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0">
                                                    <span className="text-[9px] text-gray-400 bg-gray-100 px-1 rounded flex items-center gap-1">📞 1</span>
                                                    <span className="text-gray-300 hover:text-gray-500 cursor-pointer"><PaperclipIcon className="w-3 h-3"/></span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Células Dinâmicas */}
                                        {columnOrder.map(colId => (
                                            <React.Fragment key={colId}>
                                                {renderCellContent(colId, agent, false, badgeName, badgeColor)}
                                            </React.Fragment>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    );
                })}
            </table>
        </div>
    </div>
  );
};

export default AgentFactory;
