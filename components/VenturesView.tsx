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

const lc = (v: any) => String(v ?? '').toLowerCase();
const includesCI = (hay: any, needle: any) => lc(hay).includes(lc(needle));
const ventureName = (v: any) => String(v?.name ?? v?.brandName ?? v?.brand_name ?? v?.brand ?? '');

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
        url: '',
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
            const ventureDoc = {
                ...newVenture,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            };

            const ref = await addDoc(collection(db, "ventures"), ventureDoc);

            const ventureToAdd = { ...ventureDoc, id: ref.id } as Venture;
            onAddVenture(ventureToAdd);

            setNewVenture({
                name: '',
                status: 'DESENVOLVIMENTO',
                type: 'Marca',
                statusLab: 'Pendente',
                niche: '',
                segment: '',
                sphere: '',
                url: '',
            });
            setLogoPreview(null);
            setIsAdding(false);
        } catch (error) {
            console.error(error);
            alert("Erro ao salvar Venture no banco de dados.");
        }
    };

    const filteredVentures = ventures.filter(v => includesCI(ventureName(v), searchTerm));

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
                        <h1 className="text-sm font-black tracking-tight text-gray-900">HUB DE VENTURES</h1>
                        <p className="text-[10px] font-semibold tracking-[0.3em] text-gray-400 uppercase">Painel de Controle de Marcas & Projetos</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative w-72">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <SearchIcon className="w-4 h-4" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar marca..."
                            className="w-full h-10 pl-10 pr-3 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={() => setIsAdding(true)}
                        className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs tracking-wide flex items-center gap-2 shadow-lg"
                    >
                        <PlusIcon className="w-4 h-4" />
                        NOVA VENTURE
                    </button>
                </div>
            </header>

            {/* MODAL */}
            {isAdding && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
                    <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <div>
                                <h2 className="text-sm font-black tracking-tight text-gray-900">Cadastrar Venture</h2>
                                <p className="text-[10px] font-semibold tracking-[0.3em] text-gray-400 uppercase">Marca, projeto ou unidade do ecossistema</p>
                            </div>
                            <button onClick={() => setIsAdding(false)} className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                                <XIcon className="w-4 h-4 text-gray-700" />
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="grid grid-cols-12 gap-4">
                                <div className="col-span-2">
                                    <div className="w-full aspect-square rounded-2xl border border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
                                        {logoPreview ? (
                                            <img src={logoPreview} className="w-full h-full object-cover" />
                                        ) : (
                                            <CloudUploadIcon className="w-7 h-7 text-gray-400" />
                                        )}
                                    </div>
                                    <label className="mt-2 block text-[10px] font-bold text-gray-600">
                                        Logo
                                    </label>
                                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="mt-1 w-full text-[10px]" />
                                </div>

                                <div className="col-span-10">
                                    <div className="grid grid-cols-12 gap-3">
                                        <div className="col-span-6">
                                            <label className="block text-[10px] font-black tracking-[0.2em] text-gray-500 uppercase">Nome da Marca</label>
                                            <input
                                                type="text"
                                                placeholder="Nome da Venture..."
                                                value={newVenture.name}
                                                onChange={e => setNewVenture({ ...newVenture, name: e.target.value })}
                                                className="mt-1 w-full h-10 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-black tracking-[0.2em] text-gray-500 uppercase">Status</label>
                                            <select
                                                value={newVenture.status}
                                                onChange={e => setNewVenture({ ...newVenture, status: e.target.value })}
                                                className="mt-1 w-full h-10 rounded-xl border border-gray-200 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                                            >
                                                <option>DESENVOLVIMENTO</option>
                                                <option>ATIVA</option>
                                                <option>PAUSADA</option>
                                                <option>ENCERRADA</option>
                                            </select>
                                        </div>

                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-black tracking-[0.2em] text-gray-500 uppercase">Iniciativa</label>
                                            <select
                                                value={newVenture.type}
                                                onChange={e => setNewVenture({ ...newVenture, type: e.target.value })}
                                                className="mt-1 w-full h-10 rounded-xl border border-gray-200 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                                            >
                                                <option>Marca</option>
                                                <option>Produto</option>
                                                <option>Projeto</option>
                                                <option>Unidade</option>
                                            </select>
                                        </div>

                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-black tracking-[0.2em] text-gray-500 uppercase">Status Lab</label>
                                            <select
                                                value={newVenture.statusLab}
                                                onChange={e => setNewVenture({ ...newVenture, statusLab: e.target.value })}
                                                className="mt-1 w-full h-10 rounded-xl border border-gray-200 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                                            >
                                                <option>Pendente</option>
                                                <option>Em Progresso</option>
                                                <option>Validada</option>
                                            </select>
                                        </div>

                                        <div className="col-span-3">
                                            <label className="block text-[10px] font-black tracking-[0.2em] text-gray-500 uppercase">Nicho</label>
                                            <input
                                                type="text"
                                                value={newVenture.niche}
                                                onChange={e => setNewVenture({ ...newVenture, niche: e.target.value })}
                                                className="mt-1 w-full h-10 rounded-xl border border-gray-200 px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                                            />
                                        </div>

                                        <div className="col-span-3">
                                            <label className="block text-[10px] font-black tracking-[0.2em] text-gray-500 uppercase">Segmento</label>
                                            <input
                                                type="text"
                                                value={newVenture.segment}
                                                onChange={e => setNewVenture({ ...newVenture, segment: e.target.value })}
                                                className="mt-1 w-full h-10 rounded-xl border border-gray-200 px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                                            />
                                        </div>

                                        <div className="col-span-3">
                                            <label className="block text-[10px] font-black tracking-[0.2em] text-gray-500 uppercase">Esfera</label>
                                            <input
                                                type="text"
                                                value={newVenture.sphere}
                                                onChange={e => setNewVenture({ ...newVenture, sphere: e.target.value })}
                                                className="mt-1 w-full h-10 rounded-xl border border-gray-200 px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                                            />
                                        </div>

                                        <div className="col-span-3">
                                            <label className="block text-[10px] font-black tracking-[0.2em] text-gray-500 uppercase">URL</label>
                                            <input
                                                type="text"
                                                value={newVenture.url}
                                                onChange={e => setNewVenture({ ...newVenture, url: e.target.value })}
                                                className="mt-1 w-full h-10 rounded-xl border border-gray-200 px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 flex items-center justify-end gap-3">
                                <button
                                    onClick={() => setIsAdding(false)}
                                    className="h-10 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="h-10 px-5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-extrabold text-xs"
                                >
                                    Salvar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TABLE */}
            <main className="flex-1 overflow-auto">
                <div className="min-w-[1100px]">
                    <div className="px-6 py-4">
                        <div className="grid grid-cols-12 text-[10px] font-black tracking-[0.25em] text-gray-400 uppercase border-b border-gray-200 pb-3">
                            <div className={`${colWidths.logo} col-span-1`}>Logo</div>
                            <div className={`${colWidths.name} col-span-2`}>Nome da Marca</div>
                            <div className={`${colWidths.status} col-span-1`}>Status</div>
                            <div className={`${colWidths.type} col-span-1`}>Iniciativa</div>
                            <div className={`${colWidths.statusLab} col-span-1`}>Status Lab</div>
                            <div className={`${colWidths.niche} col-span-1`}>Nicho</div>
                            <div className={`${colWidths.segment} col-span-1`}>Segmento</div>
                            <div className={`${colWidths.sphere} col-span-1`}>Esfera</div>
                            <div className={`${colWidths.url} col-span-1`}></div>
                            <div className={`${colWidths.actions} col-span-1 text-right`}></div>
                        </div>
                    </div>

                    <div className="px-6 pb-6">
                        {filteredVentures.length === 0 ? (
                            <div className="text-center py-20 text-gray-400">
                                <p className="text-xs font-black tracking-[0.35em] uppercase">Nenhuma venture registrada.</p>
                                <p className="mt-2 text-[10px] tracking-[0.25em] uppercase">Use o botão + para começar a organizar seu ecossistema.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredVentures.map(venture => (
                                    <div key={venture.id} className="grid grid-cols-12 items-center bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm hover:shadow-md transition">
                                        <div className="col-span-1">
                                            <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden shadow-sm">
                                                {venture.logo ? (
                                                    <img src={venture.logo} alt={ventureName(venture) || 'Venture'} className="w-full h-full object-contain" />
                                                ) : (
                                                    <span className="text-[10px] font-black text-gray-400">N/A</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="col-span-2 flex flex-col">
                                            <span className="text-xs font-black text-gray-800 tracking-tight uppercase">{ventureName(venture) || 'Sem nome'}</span>
                                            <span className="text-[8px] bg-indigo-50 text-indigo-500 px-2 py-1 rounded-full w-fit mt-1 font-black tracking-[0.25em] uppercase">
                                                {venture.type ?? 'Marca'}
                                            </span>
                                        </div>

                                        <div className="col-span-1">
                                            <span className="text-[10px] font-extrabold text-gray-700">{venture.status}</span>
                                        </div>

                                        <div className="col-span-1">
                                            <span className="text-[10px] font-extrabold text-gray-700">{venture.type}</span>
                                        </div>

                                        <div className="col-span-1">
                                            <span className="text-[10px] font-extrabold text-gray-700">{venture.statusLab}</span>
                                        </div>

                                        <div className="col-span-1">
                                            <span className="text-[10px] font-extrabold text-gray-700">{venture.niche}</span>
                                        </div>

                                        <div className="col-span-1">
                                            <span className="text-[10px] font-extrabold text-gray-700">{venture.segment}</span>
                                        </div>

                                        <div className="col-span-1">
                                            <span className="text-[10px] font-extrabold text-gray-700">{venture.sphere}</span>
                                        </div>

                                        <div className="col-span-1 flex justify-center">
                                            {venture.url ? (
                                                <a href={venture.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800 text-xs font-black">
                                                    ↗
                                                </a>
                                            ) : null}
                                        </div>

                                        <div className="col-span-1 flex justify-end">
                                            <button
                                                onClick={async () => {
                                                    if (confirm("Deseja remover esta Venture?")) {
                                                        try {
                                                            await deleteDoc(doc(db, "ventures", venture.id));
                                                            onRemoveVenture(venture.id);
                                                        } catch (error) {
                                                            console.error(error);
                                                            alert("Erro ao remover Venture.");
                                                        }
                                                    }
                                                }}
                                                className="w-9 h-9 rounded-xl bg-red-50 hover:bg-red-100 flex items-center justify-center"
                                                title="Remover"
                                            >
                                                <TrashIcon className="w-4 h-4 text-red-500" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default VenturesView;