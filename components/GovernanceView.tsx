
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Agent, BusinessUnit, GovernanceCulture, ComplianceRule, VaultItem, KnowledgeNode } from '../types';
import { BackIcon, BookIcon, CloudUploadIcon, CloudDownloadIcon, LockIcon, ScaleIcon, SearchIcon, FolderIcon, PlusIcon, FileTextIcon, TrashIcon, CheckIcon, XIcon } from './Icon';
import { addDocumentToAgent } from '../services/knowledge'; // Importação do serviço

import MethodologyView from './MethodologyView';
import { Avatar } from './Avatar'; // IMPORTAÇÃO DO AVATAR

type VaultItemInput = {
  name: string;
  provider: string;
  env: string;
  itemType: string;
  ownerEmail?: string;
  storagePath?: string;
  secretRef?: string;
  rotatePolicy?: string;
  payload?: Record<string, any>;
};

type KnowledgeNodeInput = {
  title: string;
  nodeType: KnowledgeNode['nodeType'];
  parentId?: string | null;
  contentMd?: string;
  linkUrl?: string;
};

interface GovernanceViewProps {
  onBack: () => void;
  agents: Agent[];
  onUpdateAgent: (agent: Agent) => void;
  businessUnits: BusinessUnit[];
  onAddUnit: (unit: BusinessUnit) => void;
  targetAgentId?: string | null;
  onClearTarget?: () => void;
  cultureEntry: GovernanceCulture | null;
  complianceMarkdown: string;
  onSaveCulture: (payload: { contentMd: string; title?: string; summary?: string }) => Promise<void> | void;
  onSaveCompliance: (markdown: string) => Promise<void> | void;
  vaultItems: VaultItem[];
  onCreateVaultItem: (input: VaultItemInput) => Promise<void> | void;
  onDeleteVaultItem: (id: string) => Promise<void> | void;
  knowledgeNodes: KnowledgeNode[];
  onCreateKnowledgeNode: (input: KnowledgeNodeInput) => Promise<string | void> | void;
  onUpdateKnowledgeNode: (id: string, updates: Partial<KnowledgeNode>) => Promise<void> | void;
  onDeleteKnowledgeNode: (id: string) => Promise<void> | void;
}




type GovernanceViewMode = 'dashboard' | 'constitution' | 'backup' | 'black-vault' | 'compliance' | 'intelligence' | 'context' | 'methodology';

// Interface para Documento Global
interface VaultDocument {
    id: string;
    title: string;
    content: string; // Text content OR Base64 Data URL
    uploadedAt: string;
    type?: 'FILE' | 'METHODOLOGY'; 
    mimeType?: string; // Para distinguir renderização
    payload?: Record<string, any>;
    source?: 'vault' | 'methodology';
}


// MOCK DAS METODOLOGIAS (Para seleção)
const SYSTEM_METHODOLOGIES: VaultDocument[] = [
        { id: 'sys-met-uau', title: 'Metodologia: Jornada U.A.U (Completa)', content: 'Protocolos de Atendimento UAU...', uploadedAt: '', type: 'METHODOLOGY', mimeType: 'text/markdown', source: 'methodology' },
    { id: 'sys-met-mav', title: 'Metodologia: M.A.V (Máquina de Vendas)', content: 'Processos de Vendas MAV...', uploadedAt: '', type: 'METHODOLOGY', mimeType: 'text/markdown', source: 'methodology' },
    { id: 'sys-met-gerac', title: 'Framework: GERAC (Gestão)', content: 'Pilares de Gestão e Cultura...', uploadedAt: '', type: 'METHODOLOGY', mimeType: 'text/markdown', source: 'methodology' },
    { id: 'sys-met-dr', title: 'Método: Decisão & Resultado', content: 'Foco em ROI e Execução...', uploadedAt: '', type: 'METHODOLOGY', mimeType: 'text/markdown', source: 'methodology' },
    { id: 'sys-met-client', title: 'Árvore Clientológica (Estrutura)', content: 'Mapeamento de Clientes...', uploadedAt: '', type: 'METHODOLOGY', mimeType: 'text/markdown', source: 'methodology' }
];


const GovernanceView: React.FC<GovernanceViewProps> = ({ 
  onBack, 
  agents, 
  onUpdateAgent, 
  businessUnits, 
  onAddUnit,
    targetAgentId,
  onClearTarget,
  cultureEntry,
  complianceMarkdown,
  onSaveCulture,
  onSaveCompliance,
  vaultItems,
  onCreateVaultItem,
  onDeleteVaultItem,
  knowledgeNodes,
  onCreateKnowledgeNode,
  onUpdateKnowledgeNode,
  onDeleteKnowledgeNode
}) => {


  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [currentView, setCurrentView] = useState<GovernanceViewMode>('dashboard');

  // Editor States
    const [cultureDraft, setCultureDraft] = useState('');
  const [complianceDraft, setComplianceDraft] = useState(''); 
  const [isSavingCulture, setIsSavingCulture] = useState(false);
  const [isSavingCompliance, setIsSavingCompliance] = useState(false);

  // Vault State
  const [vaultSearchTerm, setVaultSearchTerm] = useState(''); 
  const [previewDoc, setPreviewDoc] = useState<VaultDocument | null>(null); // Visualizador
  const [isUploadingVault, setIsUploadingVault] = useState(false);

    const vaultDocuments = useMemo<VaultDocument[]>(() => {
    return vaultItems.map(item => {
      const payload = (item.payload || {}) as Record<string, any>;
      const uploadedAt = item.updatedAt instanceof Date ? item.updatedAt.toISOString() : '';
      const previewContent = typeof payload.previewData === 'string' ? payload.previewData : '';
      return {
        id: item.id,
        title: item.name,
        content: previewContent || 'Conteúdo protegido. Consulte o Cofre Black.',
        uploadedAt,
        type: 'FILE',
        mimeType: payload.mimeType || item.itemType,
        payload,
        source: 'vault'
      } as VaultDocument;
    });
  }, [vaultItems]);


  const availableKnowledgeDocs = useMemo(() => {
    return [...vaultDocuments, ...SYSTEM_METHODOLOGIES];
  }, [vaultDocuments]);

  // Intelligence Editor State

  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [activeAgentTab, setActiveAgentTab] = useState<'dna' | 'knowledge'>('dna');
  const [tempPrompt, setTempPrompt] = useState('');
  
  // Search State for Knowledge Selection
  const [knowledgeSearchTerm, setKnowledgeSearchTerm] = useState('');
  
  // Ref para Upload em Massa
  const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
    if (!isUnlocked) return;
    setCultureDraft(cultureEntry?.contentMd || '');
  }, [isUnlocked, cultureEntry]);

  useEffect(() => {
    if (!isUnlocked) return;
    setComplianceDraft(complianceMarkdown || "");
  }, [isUnlocked, complianceMarkdown]);


  // AUTO-NAVIGATE TO AGENT EDITOR ON UNLOCK (Deep Link Logic)
  useEffect(() => {
      if (isUnlocked && targetAgentId) {
          const target = agents.find(a => a.id === targetAgentId);
          if (target) {
              setEditingAgent(target);
              setTempPrompt(target.fullPrompt || '');
              setActiveAgentTab('dna');
              setKnowledgeSearchTerm('');
              setCurrentView('intelligence');
              
              // Limpa o target para não reabrir se sair e voltar
              if (onClearTarget) onClearTarget();
          }
      }
  }, [isUnlocked, targetAgentId, agents, onClearTarget]);

  

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '8933') {
        setIsUnlocked(true);
        setErrorMsg('');
    } else {
        setErrorMsg('ACESSO NEGADO');
    }
  };

    const handleSaveConstitution = async () => {
      setIsSavingCulture(true);
      try {
          await onSaveCulture({ contentMd: cultureDraft });
          alert('Cultura Global atualizada.');
      } catch (error) {
          console.error('Erro ao salvar cultura global:', error);
          alert('Falha ao salvar Cultura Global.');
      } finally {
          setIsSavingCulture(false);
      }
  };

  const handleSaveCompliance = async () => {
      setIsSavingCompliance(true);
      try {
          await onSaveCompliance(complianceDraft);
          alert('Diretrizes & Compliance atualizadas.');
      } catch (error) {
          console.error('Erro ao salvar compliance:', error);
          alert('Falha ao salvar Diretrizes & Compliance.');
      } finally {
          setIsSavingCompliance(false);
      }
  };


  const handleSaveAgent = () => {
      if (editingAgent) {
          const updatedAgent = { ...editingAgent, fullPrompt: tempPrompt };
          onUpdateAgent(updatedAgent);
          alert(`DNA de ${editingAgent.name} atualizado.`);
          setEditingAgent(null); 
      }
  };

  // --- VAULT OPERATIONS ---
    const handleVaultUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      const readFile = (file: File): Promise<{ content: string; mimeType: string; isText: boolean }> => {
          return new Promise((resolve, reject) => {
              const isText = file.type.startsWith('text/') ||
                file.name.endsWith('.md') ||
                file.name.endsWith('.json') ||
                file.name.endsWith('.csv') ||
                file.name.endsWith('.js') ||
                file.name.endsWith('.ts') ||
                file.type === 'application/pdf';

              const reader = new FileReader();

              reader.onload = (e) => {
                  resolve({
                      content: e.target?.result as string,
                      mimeType: file.type || (isText ? 'text/plain' : 'application/octet-stream'),
                      isText
                  });
              };

              reader.onerror = (e) => reject(e);

              if (isText) {
                  reader.readAsText(file);
              } else {
                  reader.readAsDataURL(file);
              }
          });
      };

      setIsUploadingVault(true);
      let processedCount = 0;

      try {
          for (let i = 0; i < files.length; i++) {
              const file = files[i];
              try {
                  const { content, mimeType, isText } = await readFile(file);
                  const payload: Record<string, any> = { mimeType };
                  // Apenas anexamos preview inline para arquivos de texto menores
                  if (isText && content.length <= 500_000) {
                      payload.previewData = content;
                  }

                  await onCreateVaultItem({
                      name: file.name,
                      provider: mimeType ? mimeType.split('/')[0] : 'documento',
                      env: 'internal',
                      itemType: mimeType || 'document',
                      payload
                  });
                  processedCount++;
              } catch (err) {
                  console.error(`Erro ao processar arquivo ${file.name}`, err);
              }
          }

          if (processedCount > 0) {
              alert(`${processedCount} arquivo(s) enviados para o Cofre Black.`);
          }
      } catch (error) {
          console.error("Erro no upload do cofre:", error);
          alert("Erro crítico no processamento do Cofre Black.");
      } finally {
          setIsUploadingVault(false);
          event.target.value = '';
      }
  };


    const handleDeleteFromVault = async (docId: string) => {
      if (!window.confirm("ATENÇÃO: Isso removerá este documento do Cofre e de TODOS os agentes que o utilizam. Confirmar?")) return;
      try {
          await onDeleteVaultItem(docId);
          if (previewDoc?.id === docId) setPreviewDoc(null);
      } catch (error) {
          console.error('Erro ao remover item do Cofre Black:', error);
          alert('Falha ao remover item do Cofre Black.');
      }
  };


  // --- AGENT PERMISSIONS ---
  const toggleAgentDocument = (doc: VaultDocument) => {
      if (!editingAgent) return;

      const currentDocs = editingAgent.globalDocuments || [];
      const exists = currentDocs.some(d => d.title === doc.title); 

      let updatedDocs;
      if (exists) {
          updatedDocs = currentDocs.filter(d => d.title !== doc.title);
      } else {
          updatedDocs = [...currentDocs, { 
              id: doc.id, 
              title: doc.title, 
              content: doc.content, 
              tags: doc.title.toLowerCase().split(' ') 
          }];
      }

      const updatedAgent = { ...editingAgent, globalDocuments: updatedDocs, docCount: updatedDocs.length };
      onUpdateAgent(updatedAgent);
      setEditingAgent(updatedAgent);
  };

  // --- BACKUP SYSTEM ---
  const handleExportData = () => {
      const STORAGE_KEYS = [
          'grupob_activated_agents_v11', 
          'grupob_chat_history_v4',
          'grupob_black_vault_docs_v1', 
          'grupob_global_constitution_v1',
          'grupob_global_compliance_v1'
      ];

      const backupData: Record<string, any> = {
          timestamp: new Date().toISOString(),
          version: '2.0.0',
          data: {}
      };

      STORAGE_KEYS.forEach(key => {
          const item = localStorage.getItem(key);
          if (item) {
              try {
                  backupData.data[key] = JSON.parse(item);
              } catch (e) {
                  backupData.data[key] = item;
              }
          }
      });

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `grupob_full_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const openAgentEditor = (agent: Agent) => {
      setEditingAgent(agent);
      setTempPrompt(agent.fullPrompt || '');
      setActiveAgentTab('dna');
      setKnowledgeSearchTerm(''); 
  };

  // --- RENDERERS ---

  const renderFilePreview = () => {
      if (!previewDoc) return null;

            const payload = previewDoc.payload || {};
      const mime = previewDoc.mimeType || payload.mimeType || '';
      const previewContent = typeof payload.previewData === 'string' ? payload.previewData : previewDoc.content;
      
      const renderContent = () => {
          if (!previewContent) {
              return (
                  <div className="bg-white p-10 rounded-2xl shadow-lg flex flex-col items-center gap-3 max-w-xl">
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                          <FileTextIcon className="w-5 h-5" />
                      </div>
                      <h3 className="font-bold text-gray-700">Nenhum preview disponível</h3>
                      <p className="text-xs text-gray-500 text-center">O documento está registrado no Cofre, mas não possui visualização inline. Consulte o armazenamento seguro para acessar o conteúdo completo.</p>
                  </div>
              );
          }

          if (mime.startsWith('image/')) {
              return <img src={previewContent} alt={previewDoc.title} className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-lg" />;
          }
          if (mime.startsWith('video/')) {
              return <video controls src={previewContent} className="max-w-full max-h-[80vh] rounded-lg shadow-lg" />;
          }
          if (mime.startsWith('audio/')) {
              return (
                  <div className="bg-white p-10 rounded-2xl shadow-lg flex flex-col items-center gap-4">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                      </div>
                      <h3 className="font-bold text-gray-800">{previewDoc.title}</h3>
                      <audio controls src={previewContent} className="w-80" />
                  </div>
              );
          }
          if (mime === 'application/pdf') {
              return (
                  <iframe src={previewContent} className="w-full h-[80vh] rounded-lg border border-gray-200" title={previewDoc.title}></iframe>
              );
          }
          // Default: Text View
          return (
              <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-4xl h-[80vh] flex flex-col">
                  <h3 className="text-lg font-black text-bitrix-nav uppercase tracking-tight mb-4 border-b pb-4">{previewDoc.title}</h3>
                  <pre className="flex-1 overflow-auto custom-scrollbar text-xs font-mono text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {previewContent}
                  </pre>
              </div>
          );
      };


      return (
          <div className="fixed inset-0 z-[100] bg-bitrix-nav/90 backdrop-blur-sm flex items-center justify-center p-6 animate-msg" onClick={() => setPreviewDoc(null)}>
              <div className="relative w-full max-w-6xl flex flex-col items-center" onClick={e => e.stopPropagation()}>
                  <button 
                      onClick={() => setPreviewDoc(null)}
                      className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors"
                  >
                      <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-widest">Fechar</span>
                          <div className="w-8 h-8 rounded-full border border-white/30 flex items-center justify-center"><XIcon className="w-4 h-4" /></div>
                      </div>
                  </button>
                  {renderContent()}
              </div>
          </div>
      );
  };

  const renderLockScreen = () => (
    <div className="flex-1 flex flex-col items-center justify-center animate-msg p-6">
      <div className="max-w-md w-full bg-white p-10 rounded-[2.5rem] shadow-xl border border-gray-100 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-bitrix-nav"></div>
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-gray-300">
             <LockIcon className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-black text-bitrix-nav uppercase tracking-tight mb-2">Credencial Master</h3>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-8">Acesso Restrito à Diretoria</p>
          
          <form onSubmit={handleUnlock}>
            <input 
                type="password" 
                autoFocus 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="" 
                autoComplete="new-password"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-center text-xl font-black tracking-[0.5em] outline-none focus:border-bitrix-nav transition-all mb-4 text-gray-800" 
            />
            {errorMsg && <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-4 animate-pulse">{errorMsg}</p>}
            <button type="submit" className="w-full py-4 bg-bitrix-nav text-white rounded-xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-bitrix-accent transition-all shadow-lg hover:shadow-xl">
                Acessar Painel
            </button>
          </form>
          
          <button onClick={onBack} className="mt-6 text-[9px] font-bold text-gray-300 uppercase tracking-widest hover:text-gray-500 transition-colors">
              Voltar ao Ecossistema
          </button>
      </div>
    </div>
  );

  const renderDashboard = () => (
      <div className="p-10 max-w-7xl mx-auto animate-msg">
          <header className="mb-12">
              <h1 className="text-3xl font-black text-bitrix-nav tracking-tighter uppercase mb-2">Painel de Governança</h1>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.4em]">Gestão Centralizada de Ativos e Regras</p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* CARD 1: CULTURA */}
              <button onClick={() => setCurrentView('constitution')} className="group bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-bitrix-nav/20 transition-all text-left relative overflow-hidden">
                  <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-bitrix-nav group-hover:text-white transition-colors mb-6">
                      <BookIcon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black text-gray-800 uppercase mb-2 group-hover:text-bitrix-nav">Cultura Atual</h3>
                  <p className="text-xs font-medium text-gray-400 leading-relaxed">Defina a identidade, tom de voz e visão estratégica global.</p>
              </button>

              {/* CARD 2: BACKUP */}
              <button onClick={handleExportData} className="group bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-bitrix-nav/20 transition-all text-left relative overflow-hidden">
                  <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-bitrix-nav group-hover:text-white transition-colors mb-6">
                      <CloudDownloadIcon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black text-gray-800 uppercase mb-2 group-hover:text-bitrix-nav">Backup do Sistema</h3>
                  <p className="text-xs font-medium text-gray-400 leading-relaxed">Baixe uma cópia completa de todos os agentes, documentos e conversas.</p>
              </button>

              {/* CARD 3: COFRE BLACK */}
              <button onClick={() => setCurrentView('black-vault')} className="group bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-bitrix-nav/20 transition-all text-left relative overflow-hidden">
                  <div className="absolute top-6 right-6 flex items-center gap-2">
                      <span className="text-[8px] font-black text-green-500 uppercase tracking-widest">Secure</span>
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                  <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-bitrix-nav group-hover:text-white transition-colors mb-6">
                      <LockIcon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black text-gray-800 uppercase mb-2 group-hover:text-bitrix-nav">Cofre Black</h3>
                  <p className="text-xs font-medium text-gray-400 leading-relaxed">Repositório Central de Documentos. Ingestão em massa de TXT/PDF.</p>
              </button>

              {/* CARD 4: COMPLIANCE */}
              <button onClick={() => setCurrentView('compliance')} className="group bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-bitrix-nav/20 transition-all text-left relative overflow-hidden col-span-1 md:col-span-2">
                  <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-bitrix-nav group-hover:text-white transition-colors mb-6">
                      <ScaleIcon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black text-gray-800 uppercase mb-2 group-hover:text-bitrix-nav">Diretrizes & Compliance</h3>
                  <p className="text-xs font-medium text-gray-400 leading-relaxed">Protocolos de segurança e regras de bloqueio aplicadas a todos os agentes.</p>
              </button>

               {/* CARD 5: METODOLOGIAS */}
               <button onClick={() => setCurrentView('methodology')} className="group bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-bitrix-nav/20 transition-all text-left relative overflow-hidden">
                  <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-bitrix-nav group-hover:text-white transition-colors mb-6">
                      <FolderIcon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black text-gray-800 uppercase mb-2 group-hover:text-bitrix-nav">Metodologias Gerais</h3>
                  <p className="text-xs font-medium text-gray-400 leading-relaxed">Árvore de processos gerais da empresa.</p>
              </button>

               {/* CARD 6: INTELLIGENCE */}
               <button onClick={() => setCurrentView('intelligence')} className="group bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-bitrix-nav/20 transition-all text-left relative overflow-hidden">
                  <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-bitrix-nav group-hover:text-white transition-colors mb-6">
                      <SearchIcon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-black text-gray-800 uppercase mb-2 group-hover:text-bitrix-nav">Núcleo de Inteligência</h3>
                  <p className="text-xs font-medium text-gray-400 leading-relaxed">Gestão de DNA e Permissões de Acesso (RAG) dos Agentes.</p>
              </button>
          </div>
      </div>
  );

  // Editor Genérico
    const renderEditor = (
      title: string,
      value: string,
      setValue: (v: string) => void,
      onSave: () => void,
      placeholder: string,
      options: { isSaving?: boolean } = {}
  ) => (
      <div className="flex-1 flex flex-col p-8 animate-msg h-full overflow-hidden">
          <div className="max-w-5xl mx-auto w-full flex flex-col h-full">
            <header className="mb-6 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => setCurrentView('dashboard')} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
                        <BackIcon className="w-6 h-6" />
                    </button>
                    <div>
                        <h2 className="text-xl font-black text-bitrix-nav uppercase tracking-tighter">{title}</h2>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Edição Global</p>
                    </div>
                </div>
                <button
                  onClick={onSave}
                  disabled={options.isSaving}
                  className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all ${options.isSaving ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-500 text-white hover:bg-green-600'}`}
                >
                    {options.isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
            </header>
            
            <div className="flex-1 bg-white rounded-[2rem] border border-gray-100 shadow-sm p-1 overflow-hidden">
                <textarea 
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    className="w-full h-full p-8 bg-white resize-none outline-none font-mono text-xs leading-relaxed text-gray-800 custom-scrollbar"
                    spellCheck={false}
                    placeholder={placeholder}
                />
            </div>
          </div>
      </div>
  );


  // Cofre Black (Gerenciador de Documentos) - LIST VIEW UPDATE
  const renderBlackVault = () => {
            const filteredVaultDocs = vaultDocuments.filter(d => 
          d.title.toLowerCase().includes(vaultSearchTerm.toLowerCase())
      );


      return (
      <div className="flex-1 flex flex-col p-8 animate-msg h-full overflow-hidden relative">
          {renderFilePreview()}
          
          <div className="max-w-6xl mx-auto w-full flex flex-col h-full">
              <header className="mb-8 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-4">
                      <button onClick={() => setCurrentView('dashboard')} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
                          <BackIcon className="w-6 h-6" />
                      </button>
                      <div>
                          <h2 className="text-xl font-black text-bitrix-nav uppercase tracking-tighter">Cofre Black</h2>
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Repositório Central de Documentos</p>
                      </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                      <div className="bg-white px-4 py-3 rounded-xl shadow-sm border border-gray-200 flex items-center gap-2 w-64">
                          <SearchIcon className="w-4 h-4 text-gray-400" />
                          <input 
                              value={vaultSearchTerm}
                              onChange={e => setVaultSearchTerm(e.target.value)}
                              className="bg-transparent outline-none text-xs font-medium w-full"
                              placeholder="Pesquisar arquivos..."
                          />
                      </div>

                      {/* INPUT AGORA ACEITA TUDO (*) */}
                      <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          multiple 
                          accept="*" 
                          onChange={handleVaultUpload}
                      />
                                            <button 
                          onClick={() => !isUploadingVault && fileInputRef.current?.click()}
                          disabled={isUploadingVault}
                          className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 transition-all ${isUploadingVault ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-bitrix-nav text-white hover:bg-bitrix-accent'}`}
                      >
                          {isUploadingVault ? (
                            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          ) : (
                            <CloudUploadIcon className="w-4 h-4" />
                          )}
                          {isUploadingVault ? 'Processando...' : 'Ingestão em Massa'}
                      </button>

                  </div>
              </header>

              <div className="flex-1 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{filteredVaultDocs.length} Arquivos Seguros</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-2">
                                {vaultDocuments.length === 0 && (

                          <div className="flex flex-col items-center justify-center opacity-30 py-20">
                              <LockIcon className="w-16 h-16 mb-4" />
                              <p className="font-bold text-sm">O Cofre está vazio.</p>
                          </div>
                      )}
                      
                      {filteredVaultDocs.map(doc => (
                          <div 
                            key={doc.id} 
                            onClick={() => setPreviewDoc(doc)} // ABRE PREVIEW AO CLICAR
                            className="flex items-center h-14 px-4 bg-white border border-gray-100 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all gap-4 group cursor-pointer"
                          >
                              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                                  <FileTextIcon className="w-4 h-4" />
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                  <h4 className="text-xs font-bold text-gray-800 truncate group-hover:text-bitrix-nav">{doc.title}</h4>
                              </div>

                              <span className="text-[9px] text-gray-400 font-mono hidden md:block">
                                  {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : '—'}
                              </span>

                                                            {doc.source !== 'methodology' && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDeleteFromVault(doc.id); }} 
                                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                              )}

                          </div>
                      ))}
                  </div>
              </div>
          </div>
      </div>
      );
  };

  const renderAgentManager = () => {
    // Modo de Edição
    if (editingAgent) {
                // COMBINA DOCUMENTOS DO COFRE E METODOLOGIAS DO SISTEMA
        const allAvailableDocs: VaultDocument[] = availableKnowledgeDocs;
        const filteredDocs = allAvailableDocs.filter(d => 
 
            d.title.toLowerCase().includes(knowledgeSearchTerm.toLowerCase())
        );

        return (
            <div className="flex-1 flex flex-col p-8 animate-msg h-full overflow-hidden relative">
                {renderFilePreview()}
                
                <div className="max-w-6xl mx-auto w-full flex flex-col h-full bg-white rounded-[3rem] shadow-xl overflow-hidden border border-gray-100">
                    
                    {/* Header */}
                    <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setEditingAgent(null)} className="p-2 hover:bg-gray-200 rounded-lg text-gray-400">
                                <BackIcon className="w-6 h-6" />
                            </button>
                            <div>
                                <h2 className="text-xl font-black text-bitrix-nav uppercase tracking-tighter">Editando: {editingAgent.name}</h2>
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Gestão de Inteligência</p>
                            </div>
                        </div>
                        <div className="flex bg-gray-200 p-1 rounded-xl">
                            <button 
                                onClick={() => setActiveAgentTab('dna')}
                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeAgentTab === 'dna' ? 'bg-white text-bitrix-nav shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                DNA (Prompt)
                            </button>
                            <button 
                                onClick={() => setActiveAgentTab('knowledge')}
                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeAgentTab === 'knowledge' ? 'bg-white text-bitrix-nav shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Permissões (Cofre)
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden relative">
                        {activeAgentTab === 'dna' && (
                            <div className="flex flex-col h-full">
                                <textarea 
                                    value={tempPrompt}
                                    onChange={e => setTempPrompt(e.target.value)}
                                    // FORCE WHITE BACKGROUND AND DARK GRAY TEXT HERE
                                    className="flex-1 p-8 resize-none outline-none font-mono text-xs leading-relaxed text-gray-800 bg-white custom-scrollbar"
                                    spellCheck={false}
                                    placeholder="Defina o prompt do sistema aqui..."
                                />
                                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                                    <button onClick={handleSaveAgent} className="px-6 py-3 bg-green-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-600 shadow-lg">
                                        Salvar Prompt
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeAgentTab === 'knowledge' && (
                            <div className="flex h-full p-8 bg-gray-50/20">
                                <div className="w-full h-full flex flex-col">
                                    <div className="mb-6 flex justify-between items-end">
                                        <div>
                                            <h3 className="text-lg font-black text-bitrix-nav uppercase tracking-tight">Vínculo de Conhecimento</h3>
                                            <p className="text-xs text-gray-500">Selecione quais documentos (Cofre) ou Metodologias este agente pode acessar.</p>
                                        </div>
                                        <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200 flex items-center gap-2 w-64">
                                            <SearchIcon className="w-4 h-4 text-gray-400" />
                                            <input 
                                                value={knowledgeSearchTerm}
                                                onChange={e => setKnowledgeSearchTerm(e.target.value)}
                                                className="bg-transparent outline-none text-xs font-medium w-full"
                                                placeholder="Pesquisar..."
                                            />
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 pb-20">
                                        {filteredDocs.length === 0 && (
                                            <div className="text-center py-10 opacity-50">
                                                <p className="text-sm font-bold">Nenhum documento encontrado.</p>
                                            </div>
                                        )}
                                        {filteredDocs.map(doc => {
                                            const hasAccess = editingAgent.globalDocuments?.some(d => d.title === doc.title);
                                            const isMethodology = doc.type === 'METHODOLOGY';
                                            
                                            return (
                                                <div 
                                                    key={doc.id} 
                                                    className={`
                                                        flex items-center h-12 px-4 rounded-xl border transition-all gap-4 group
                                                        ${hasAccess ? 'bg-green-50 border-green-200 shadow-sm' : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-sm'}
                                                    `}
                                                >
                                                    {/* Checkbox "Bolinha" - Area de Clique para Seleção */}
                                                    <div 
                                                        onClick={() => toggleAgentDocument(doc)}
                                                        className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all cursor-pointer ${hasAccess ? 'bg-green-500 border-green-500 text-white' : 'bg-gray-50 border-gray-300 text-transparent hover:border-green-400'}`}
                                                    >
                                                        <CheckIcon className="w-3 h-3" />
                                                    </div>
                                                    
                                                    {/* Ícone de Tipo */}
                                                    <div 
                                                        onClick={() => setPreviewDoc(doc)}
                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:opacity-80 ${isMethodology ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}
                                                    >
                                                        {isMethodology ? <FolderIcon className="w-4 h-4" /> : <FileTextIcon className="w-4 h-4" />}
                                                    </div>

                                                    {/* Título (Linha Única) - Clica para PREVIEW */}
                                                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setPreviewDoc(doc)}>
                                                        <h4 className={`text-xs font-bold truncate ${hasAccess ? 'text-green-800' : 'text-gray-700'} hover:underline`}>{doc.title}</h4>
                                                    </div>

                                                    {/* Badge de Tipo */}
                                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${isMethodology ? 'bg-purple-50 text-purple-500' : 'bg-gray-100 text-gray-400'}`}>
                                                        {isMethodology ? 'Metodologia' : 'Arquivo'}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // List View (Seleção de Agente)
    const editableAgents = agents.filter(a => a.status === 'ACTIVE' || a.status === 'STAGING');

    return (
        <div className="flex-1 flex flex-col p-8 animate-msg h-full overflow-hidden">
            <div className="max-w-5xl mx-auto w-full flex flex-col h-full">
                <header className="mb-8 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setCurrentView('dashboard')} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
                            <BackIcon className="w-6 h-6" />
                        </button>
                        <div>
                            <h2 className="text-xl font-black text-bitrix-nav uppercase tracking-tighter">Núcleo de Inteligência</h2>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Selecione um agente para gerenciar DNA e Conhecimento</p>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto custom-scrollbar pb-20">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {editableAgents.map(agent => (
                            <button 
                                key={agent.id}
                                onClick={() => openAgentEditor(agent)}
                                className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-lg hover:border-bitrix-nav/20 transition-all text-left flex items-center gap-4 group"
                            >
                                {/* AVATAR SUBSTITUINDO CAIXA DE LETRAS */}
                                <Avatar name={agent.name} url={agent.avatarUrl} className={`w-12 h-12 rounded-xl shadow-sm ${agent.status === 'STAGING' ? 'grayscale opacity-70' : ''}`} />
                                
                                <div>
                                    <h3 className="text-sm font-bold text-gray-800 group-hover:text-bitrix-nav transition-colors">{agent.name}</h3>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">{agent.officialRole}</p>
                                    {agent.status === 'STAGING' && <span className="text-[8px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold uppercase mt-1 inline-block">Homologação</span>}
                                    {agent.docCount && agent.docCount > 0 && <span className="ml-2 text-[8px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold uppercase mt-1 inline-block">{agent.docCount} Acessos</span>}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
  };

  if (!isUnlocked) return renderLockScreen();

  switch(currentView) {
      case 'dashboard': return (
        <div className="flex-1 h-full bg-[#F9FAFB] flex flex-col font-nunito overflow-y-auto custom-scrollbar relative">
             <button onClick={onBack} className="absolute top-8 right-8 text-gray-400 hover:text-bitrix-nav text-[9px] font-black uppercase tracking-widest">Voltar</button>
             {renderDashboard()}
        </div>
      );
            case 'constitution': return renderEditor('Cultura Atual', cultureDraft, setCultureDraft, handleSaveConstitution, "Defina a Cultura...", { isSaving: isSavingCulture });
      case 'compliance': return renderEditor('Diretrizes & Compliance', complianceDraft, setComplianceDraft, handleSaveCompliance, "Defina os Protocolos de Bloqueio...", { isSaving: isSavingCompliance });

      case 'black-vault': return renderBlackVault();
      case 'intelligence': return renderAgentManager(); 
            case 'methodology': return (
        <MethodologyView
          onBack={() => setCurrentView('dashboard')}
          nodes={knowledgeNodes}
          onCreateNode={onCreateKnowledgeNode}
          onUpdateNode={onUpdateKnowledgeNode}
          onDeleteNode={onDeleteKnowledgeNode}
        />
      );

      case 'backup': return renderDashboard(); // Fallback, triggered by button directly
      default: return renderDashboard();
  }
};

export default GovernanceView;
