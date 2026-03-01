
import React, { useState } from 'react';
import { Venture, Agent } from '../types';
import { Avatar } from './Avatar';
import { SearchIcon, PlusIcon, TrashIcon, CloudUploadIcon, XIcon } from './Icon';
import { db, collection, addDoc, deleteDoc, doc, Timestamp } from '../services/supabase';

interface VenturesViewProps {
    ventures: Venture[];
    agents: Agent[];
    onAddVenture: (v: Venture) => void;
    onRemoveVenture: (id: string) => void;
}

const VenturesView: React.FC<VenturesViewProps> = ({ ventures, agents, onAddVenture, onRemoveVenture }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [newVenture, setNewVenture] = useState<Partial<Venture>>({
        name: '',
        status: 'DESENVOLVIMENTO',
        type: 'Marca',
        statusLab: 'Pendente',
        niche: '',
        segment: '',
        sphere: '',
        url: ''
    });

    const [logoPreview, setLogoPreview] = useState<string | null>(null);

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 300000) {
                alert("Logo muito pesado! Por favor, use uma imagem de até 300KB.");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setLogoPreview(base64);
                setNewVenture(prev => ({ ...prev, logo: base64 }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (!newVenture.name || !newVenture.logo) {
            alert("Nome e Logo são obrigatórios para registrar uma Venture.");
            return;
        }

        try {
            const ventureData = {
                ...newVenture,
                timestamp: Timestamp.fromDate(new Date())
            } as any;

            const docRef = await addDoc(collection(db, "ventures"), ventureData);
            onAddVenture({ ...ventureData, id: docRef.id, timestamp: new Date() });

            setIsAdding(false);
            setNewVenture({ name: '', status: 'DESENVOLVIMENTO', type: 'Marca', statusLab: 'Pendente', url: '' });
            setLogoPreview(null);
        } catch (e) {
            console.error("Error saving venture:", e);
            alert("Erro ao salvar Venture no banco de dados.");
        }
    };

    const filteredVentures = ventures.filter(v => v.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const colWidths = {
        logo: "w-20",
        name: "flex-1",
        status: "w-32",
        type: "w-24",
        statusLab: "w-32",
        niche: "w-32",
        segment: "w-32",
        sphere: "w-28",
        url: "w-10",
        actions: "w-12"
    };

    return (
        <div className="flex-1 h-full bg-white flex flex-col font-nunito overflow-hidden">
            {/* HEADER */}
            <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-6 shrink-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-gray-800 uppercase tracking-tight">Hub de Ventures</h1>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Painel de Controle de Marcas & Projetos</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-gray-50 border border-transparent hover:border-gray-200 rounded-lg px-2 py-1.5 w-48 transition-all group">
                        <SearchIcon className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
                        <input
                            type="text"
                            placeholder="Buscar marca..."
                            className="bg-transparent text-xs font-medium text-gray-700 outline-none w-full ml-2 placeholder:text-gray-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => setIsAdding(true)}
                        className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase hover:bg-indigo-700 transition-all flex items-center gap-1 shadow-md"
                    >
                        Nova Venture <PlusIcon className="w-3 h-3 ml-1 text-white/50" />
                    </button>
                </div>
            </header>

            {/* TABLE HEADER */}
            <div className="flex items-center px-6 h-10 border-b border-gray-100 bg-gray-50/50 text-[9px] font-bold text-gray-400 uppercase tracking-widest shrink-0">
                <div className={`${colWidths.logo} px-2`}>Logo</div>
                <div className={`${colWidths.name} px-2`}>Nome da Marca</div>
                <div className={`${colWidths.status} px-2`}>Status</div>
                <div className={`${colWidths.type} px-2`}>Iniciativa</div>
                <div className={`${colWidths.statusLab} px-2`}>Status Lab</div>
                <div className={`${colWidths.niche} px-2`}>Nicho</div>
                <div className={`${colWidths.segment} px-2`}>Segmento</div>
                <div className={`${colWidths.sphere} px-2`}>Esfera</div>
                <div className={`${colWidths.actions} text-center`}>#</div>
            </div>

            {/* LISTA */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
                {/* INLINE ADD ROW */}
                {isAdding && (
                    <div className="flex items-center px-6 py-4 border-b border-indigo-100 bg-indigo-50/20 animate-msg gap-2">
                        <div className={`${colWidths.logo} px-2`}>
                            <label className="w-10 h-10 border-2 border-dashed border-indigo-200 rounded-lg flex items-center justify-center cursor-pointer hover:bg-white transition-all overflow-hidden bg-white shadow-sm group">
                                {logoPreview ? (
                                    <img src={logoPreview} className="w-full h-full object-contain" alt="Logo preview" />
                                ) : (
                                    <CloudUploadIcon className="w-4 h-4 text-indigo-300 group-hover:text-indigo-500" />
                                )}
                                <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                            </label>
                        </div>
                        <div className={`${colWidths.name} px-2`}>
                            <input
                                autoFocus
                                className="w-full bg-white border border-indigo-200 rounded px-2 py-1.5 text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-400 shadow-sm"
                                placeholder="Nome da Venture..."
                                value={newVenture.name}
                                onChange={e => setNewVenture({ ...newVenture, name: e.target.value })}
                            />
                        </div>
                        <div className={`${colWidths.status} px-2`}>
                            <select
                                className="w-full bg-white border border-indigo-200 rounded px-2 py-1 text-[10px] font-black outline-none"
                                value={newVenture.status}
                                onChange={e => setNewVenture({ ...newVenture, status: e.target.value as any })}
                            >
                                <option>IDEIA</option>
                                <option>DESENVOLVIMENTO</option>
                                <option>APROVADO</option>
                            </select>
                        </div>
                        <div className={`${colWidths.type} px-2`}>
                            <select
                                className="w-full bg-white border border-indigo-200 rounded px-2 py-1 text-[10px] outline-none"
                                value={newVenture.type}
                                onChange={e => setNewVenture({ ...newVenture, type: e.target.value as any })}
                            >
                                <option>Marca</option>
                                <option>Projeto</option>
                            </select>
                        </div>
                        <div className={`${colWidths.statusLab} px-2`}>
                            <select
                                className="w-full bg-white border border-indigo-200 rounded px-2 py-1 text-[10px] outline-none"
                                value={newVenture.statusLab}
                                onChange={e => setNewVenture({ ...newVenture, statusLab: e.target.value as any })}
                            >
                                <option>Pendente</option>
                                <option>Validado</option>
                                <option>Próximo Teste</option>
                            </select>
                        </div>
                        <div className={`${colWidths.niche} px-2`}>
                            <input
                                className="w-full bg-white border border-indigo-200 rounded px-2 py-1 text-[10px] outline-none"
                                placeholder="Pública..."
                                value={newVenture.niche}
                                onChange={e => setNewVenture({ ...newVenture, niche: e.target.value })}
                            />
                        </div>
                        <div className={`${colWidths.segment} px-2`}>
                            <input
                                className="w-full bg-white border border-indigo-200 rounded px-2 py-1 text-[10px] outline-none"
                                placeholder="Segmento..."
                                value={newVenture.segment}
                                onChange={e => setNewVenture({ ...newVenture, segment: e.target.value })}
                            />
                        </div>
                        <div className={`${colWidths.sphere} px-2`}>
                            <input
                                className="w-full bg-white border border-indigo-200 rounded px-2 py-1 text-[10px] outline-none"
                                placeholder="Esfera..."
                                value={newVenture.sphere}
                                onChange={e => setNewVenture({ ...newVenture, sphere: e.target.value })}
                            />
                        </div>
                        <div className={`${colWidths.url} px-2`}>
                            <input
                                className="w-full bg-white border border-indigo-200 rounded px-2 py-1 text-[10px] outline-none"
                                placeholder="https://..."
                                value={newVenture.url}
                                onChange={e => setNewVenture({ ...newVenture, url: e.target.value })}
                            />
                        </div>
                        <div className={`${colWidths.actions} flex justify-center gap-2`}>
                            <button onClick={handleSave} className="bg-green-500 text-white px-3 py-1 rounded text-[10px] font-black hover:bg-green-600 shadow-sm">SALVAR</button>
                            <button onClick={() => setIsAdding(false)} className="bg-gray-100 text-gray-500 px-3 py-1 rounded text-[10px] font-black hover:bg-gray-200 shadow-sm">X</button>
                        </div>
                    </div>
                )}

                {filteredVentures.length === 0 && !isAdding ? (
                    <div className="flex flex-col items-center justify-center h-64 opacity-30">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center px-10">
                            Nenhuma Venture registrada.<br />Use o botão + para começar a organizar seu ecossistema.
                        </p>
                    </div>
                ) : (
                    filteredVentures.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).map(venture => {
                        return (
                            <div key={venture.id} className="group flex items-center px-6 py-4 border-b border-gray-50 hover:bg-indigo-50/10 transition-all h-16 animate-msg">

                                {/* Logo */}
                                <div className={`${colWidths.logo} px-2`}>
                                    <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center p-1.5 overflow-hidden shadow-sm">
                                        <img src={venture.logo} alt={venture.name} className="w-full h-full object-contain" />
                                    </div>
                                </div>

                                {/* Name */}
                                <div className={`${colWidths.name} px-2 min-w-0`}>
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-xs font-black text-gray-800 tracking-tight uppercase">{venture.name}</span>
                                        <span className="text-[8px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded font-black uppercase tracking-widest border border-indigo-100">
                                            {agents.filter(a => a.ventureId === venture.id).length} Agentes
                                        </span>
                                    </div>
                                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest truncate">{venture.segment || 'Segmento não definido'}</p>
                                </div>

                                {/* Status */}
                                <div className={`${colWidths.status} px-2`}>
                                    <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest text-center block ${venture.status === 'APROVADO' ? 'bg-green-100 text-green-700' :
                                        venture.status === 'DESENVOLVIMENTO' ? 'bg-amber-100 text-amber-700' :
                                            'bg-gray-100 text-gray-500'
                                        }`}>
                                        {venture.status}
                                    </span>
                                </div>

                                {/* Iniciativa */}
                                <div className={`${colWidths.type} px-2`}>
                                    <span className="text-[9px] font-black bg-purple-100 text-purple-700 px-2 py-1 rounded uppercase tracking-tighter block text-center">
                                        {venture.type}
                                    </span>
                                </div>

                                {/* Status Lab */}
                                <div className={`${colWidths.statusLab} px-2`}>
                                    <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest text-center block border ${venture.statusLab === 'Validado' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                        venture.statusLab === 'Próximo Teste' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                                            'bg-gray-50 text-gray-400 border-gray-100'
                                        }`}>
                                        {venture.statusLab}
                                    </span>
                                </div>

                                {/* Nicho */}
                                <div className={`${colWidths.niche} px-2 text-[10px] font-bold text-gray-600 truncate`}>
                                    {venture.niche || '--'}
                                </div>

                                {/* Segmento */}
                                <div className={`${colWidths.segment} px-2 text-[10px] font-bold text-gray-600 truncate`}>
                                    {venture.segment || '--'}
                                </div>

                                {/* Esfera */}
                                <div className={`${colWidths.sphere} px-2 text-[10px] font-black text-gray-400 uppercase tracking-widest truncate`}>
                                    {venture.sphere || '--'}
                                </div>

                                {/* Link Externo */}
                                <div className={`${colWidths.url} px-2 flex justify-center`}>
                                    {venture.url ? (
                                        <a
                                            href={venture.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-7 h-7 bg-white border border-gray-100 rounded-lg flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm"
                                            title="Acessar Sistema Externo"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                        </a>
                                    ) : (
                                        <div className="w-7 h-7 flex items-center justify-center opacity-10">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className={`${colWidths.actions} flex justify-center opacity-0 group-hover:opacity-100 transition-opacity`}>
                                    <button
                                        onClick={() => onRemoveVenture(venture.id)}
                                        className="text-gray-300 hover:text-red-500 transition-colors p-2"
                                        title="Remover Venture"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    );
};

export default VenturesView;
