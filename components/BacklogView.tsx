
import React, { useState } from 'react';
import { Topic, Agent } from '../types';
import { Avatar } from './Avatar';
import { SearchIcon, ChevronDownIcon, TrashIcon, PlusIcon } from './Icon';

interface BacklogViewProps {
  topics: Topic[];
  agents?: Agent[]; // Lista de agentes para selecionar responsável
  onAddTopic: (title: string, priority: 'Alta' | 'Média' | 'Baixa', assignee?: string, dueDate?: string) => void;
  onRemoveTopic: (id: string) => void;
  onUpdateStatus: (id: string, status: Topic['status']) => void;
}

const BacklogView: React.FC<BacklogViewProps> = ({ topics, agents = [], onAddTopic, onRemoveTopic, onUpdateStatus }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // State para Nova Pauta (Inline)
  const [isAdding, setIsAdding] = useState(false);
  const [newTopic, setNewTopic] = useState<{title: string, priority: 'Alta' | 'Média' | 'Baixa', assignee: string, dueDate: string}>({
      title: '',
      priority: 'Média',
      assignee: '',
      dueDate: ''
  });

  const handleSaveTopic = () => {
      if (!newTopic.title.trim()) {
          alert("Título é obrigatório.");
          return;
      }
      onAddTopic(newTopic.title, newTopic.priority, newTopic.assignee, newTopic.dueDate);
      setIsAdding(false);
      setNewTopic({ title: '', priority: 'Média', assignee: '', dueDate: '' });
  };

  const filteredTopics = topics.filter(t => t.title.toLowerCase().includes(searchTerm.toLowerCase()));

  // Colunas: Status | Prioridade | Pauta | Responsável | Prazo | Ações
  const colWidths = {
      status: "w-32",
      priority: "w-28",
      title: "flex-1",
      assignee: "w-48",
      date: "w-32",
      actions: "w-16"
  };

  return (
    <div className="flex-1 h-full bg-white flex flex-col font-nunito overflow-hidden">
        {/* HEADER */}
        <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0 z-20">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center shadow-md">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                </div>
                <div>
                    <h1 className="text-sm font-black text-gray-800 uppercase tracking-tight">Sessão de Pautas</h1>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Controle de Pendências & Tarefas</p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="flex items-center bg-gray-50 border border-transparent hover:border-gray-200 rounded-lg px-2 py-1.5 w-48 transition-all group">
                    <SearchIcon className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
                    <input 
                        type="text" 
                        placeholder="Pesquisar pauta..." 
                        className="bg-transparent text-xs font-medium text-gray-700 outline-none w-full ml-2 placeholder:text-gray-400"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button 
                    onClick={() => setIsAdding(true)}
                    className="bg-gray-900 text-white px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase hover:bg-black transition-all flex items-center gap-1 shadow-md"
                >
                    Nova Pauta <PlusIcon className="w-3 h-3 ml-1 text-gray-400" />
                </button>
            </div>
        </header>

        {/* TABLE HEADER */}
        <div className="flex items-center px-6 h-10 border-b border-gray-100 bg-gray-50/50 text-[9px] font-bold text-gray-400 uppercase tracking-widest shrink-0">
            <div className={`${colWidths.status} px-2`}>Status</div>
            <div className={`${colWidths.priority} px-2`}>Prioridade</div>
            <div className={`${colWidths.title} px-2`}>Pauta / Tarefa</div>
            <div className={`${colWidths.assignee} px-2`}>Responsável</div>
            <div className={`${colWidths.date} px-2`}>Prazo</div>
            <div className={`${colWidths.actions} text-center`}>#</div>
        </div>

        {/* LISTA */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
            {/* INLINE ADD ROW */}
            {isAdding && (
                <div className="flex items-center px-6 py-2 border-b border-blue-100 bg-blue-50/20 animate-msg">
                    <div className={`${colWidths.status} px-2`}>
                        <div className="bg-gray-100 text-gray-400 px-2 py-1 rounded text-[9px] font-black text-center w-24">NOVO</div>
                    </div>
                    <div className={`${colWidths.priority} px-2`}>
                        <select 
                            className="w-full bg-white border border-blue-200 rounded px-2 py-1 text-[10px] outline-none"
                            value={newTopic.priority}
                            onChange={e => setNewTopic({...newTopic, priority: e.target.value as any})}
                        >
                            <option>Baixa</option>
                            <option>Média</option>
                            <option>Alta</option>
                        </select>
                    </div>
                    <div className={`${colWidths.title} px-2`}>
                        <input 
                            autoFocus
                            className="w-full bg-white border border-blue-200 rounded px-2 py-1 text-[11px] font-medium outline-none focus:ring-1 focus:ring-blue-400"
                            placeholder="Descreva a pauta ou tarefa..."
                            value={newTopic.title}
                            onChange={e => setNewTopic({...newTopic, title: e.target.value})}
                        />
                    </div>
                    <div className={`${colWidths.assignee} px-2`}>
                        <select 
                            className="w-full bg-white border border-blue-200 rounded px-2 py-1 text-[10px] outline-none"
                            value={newTopic.assignee}
                            onChange={e => setNewTopic({...newTopic, assignee: e.target.value})}
                        >
                            <option value="">-- Selecione --</option>
                            {agents.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                        </select>
                    </div>
                    <div className={`${colWidths.date} px-2`}>
                        <input 
                            type="date"
                            className="w-full bg-white border border-blue-200 rounded px-2 py-1 text-[10px] outline-none"
                            value={newTopic.dueDate}
                            onChange={e => setNewTopic({...newTopic, dueDate: e.target.value})}
                        />
                    </div>
                    <div className={`${colWidths.actions} flex justify-center gap-1`}>
                        <button onClick={handleSaveTopic} className="text-green-500 hover:text-green-700 font-bold text-xs p-1">OK</button>
                        <button onClick={() => setIsAdding(false)} className="text-red-400 hover:text-red-600 font-bold text-xs p-1">X</button>
                    </div>
                </div>
            )}

            {filteredTopics.length === 0 && !isAdding ? (
                <div className="flex flex-col items-center justify-center h-64 opacity-30">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nenhuma pauta pendente</p>
                </div>
            ) : (
                filteredTopics.sort((a,b) => b.timestamp.getTime() - a.timestamp.getTime()).map(topic => {
                    const agent = agents.find(a => a.name === topic.assignee);
                    
                    return (
                    <div key={topic.id} className="group flex items-center px-6 py-3 border-b border-gray-50 hover:bg-gray-50 transition-all h-14">
                        
                        {/* Status */}
                        <div className={`${colWidths.status} px-2`}>
                            <div className="relative group/status w-24">
                                <select 
                                    value={topic.status}
                                    onChange={(e) => onUpdateStatus(topic.id, e.target.value as any)}
                                    className={`appearance-none w-full pl-2 pr-4 py-1 rounded text-[9px] font-black uppercase tracking-widest outline-none cursor-pointer text-center border transition-all ${
                                        topic.status === 'Resolvido' ? 'bg-green-50 text-green-600 border-green-100' : 
                                        topic.status === 'Em Pauta' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                                        'bg-gray-100 text-gray-500 border-transparent'
                                    }`}
                                >
                                    <option>Pendente</option>
                                    <option>Em Pauta</option>
                                    <option>Resolvido</option>
                                </select>
                            </div>
                        </div>

                        {/* Priority */}
                        <div className={`${colWidths.priority} px-2`}>
                            <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${
                                topic.priority === 'Alta' ? 'bg-red-50 text-red-500' : 
                                topic.priority === 'Média' ? 'bg-orange-50 text-orange-500' : 
                                'bg-blue-50 text-blue-500'
                            }`}>
                                {topic.priority}
                            </span>
                        </div>

                        {/* Title */}
                        <div className={`${colWidths.title} px-2 min-w-0`}>
                            <span className={`text-xs font-bold text-gray-700 truncate block ${topic.status === 'Resolvido' ? 'line-through text-gray-400' : ''}`}>
                                {topic.title}
                            </span>
                        </div>

                        {/* Assignee */}
                        <div className={`${colWidths.assignee} px-2 flex items-center gap-2 overflow-hidden`}>
                            {topic.assignee ? (
                                <>
                                    <Avatar name={topic.assignee} url={agent?.avatarUrl} className="w-6 h-6 rounded-md" />
                                    <span className="text-[10px] font-medium text-gray-600 truncate">{topic.assignee}</span>
                                </>
                            ) : (
                                <span className="text-[10px] text-gray-300 italic">-</span>
                            )}
                        </div>

                        {/* Date */}
                        <div className={`${colWidths.date} px-2`}>
                            <span className="text-[10px] font-mono font-medium text-gray-500">
                                {topic.dueDate ? new Date(topic.dueDate).toLocaleDateString() : topic.timestamp.toLocaleDateString()}
                            </span>
                        </div>

                        {/* Actions */}
                        <div className={`${colWidths.actions} flex justify-center opacity-0 group-hover:opacity-100 transition-opacity`}>
                            <button 
                                onClick={() => onRemoveTopic(topic.id)}
                                className="text-gray-300 hover:text-red-500 transition-colors p-1"
                                title="Excluir Pauta"
                            >
                                <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )})
            )}
        </div>
    </div>
  );
};

export default BacklogView;
