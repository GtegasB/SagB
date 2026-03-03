
import React, { useMemo, useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronRightIcon, FolderIcon, FileTextIcon, PlusIcon, BackIcon } from './Icon';
import { KnowledgeNode } from '../types';

interface MethodologyViewProps {
  onBack?: () => void;
  nodes: KnowledgeNode[];
  onCreateNode: (input: { title: string; nodeType: KnowledgeNode['nodeType']; parentId?: string | null; contentMd?: string }) => Promise<string | void>;
  onUpdateNode: (id: string, updates: Partial<KnowledgeNode>) => Promise<void> | void;
  onDeleteNode: (id: string) => Promise<void> | void;
}

type TreeNode = KnowledgeNode & { children: TreeNode[] };

const buildTree = (nodes: KnowledgeNode[]): TreeNode[] => {
  const map = new Map<string, TreeNode>();
  nodes.forEach(node => {
    map.set(node.id, { ...node, children: [] });
  });

  const roots: TreeNode[] = [];
  map.forEach(node => {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortRecursive = (items: TreeNode[]) => {
    items.sort((a, b) => {
      const orderDiff = (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return a.title.localeCompare(b.title);
    });
    items.forEach(child => sortRecursive(child.children));
  };

  sortRecursive(roots);
  return roots;
};

const MethodologyView: React.FC<MethodologyViewProps> = ({
  onBack,
  nodes,
  onCreateNode,
  onUpdateNode,
  onDeleteNode
}) => {
  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  useEffect(() => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      nodes.filter(n => n.nodeType === 'folder').forEach(folder => {
        if (!next.has(folder.id)) next.add(folder.id);
      });
      return next;
    });
  }, [nodes]);

  const selectedNode = useMemo(() => {
    if (selectedNodeId && nodes.some(n => n.id === selectedNodeId)) {
      return nodes.find(n => n.id === selectedNodeId) ?? null;
    }
    const firstDoc = nodes.find(n => n.nodeType === 'doc');
    return firstDoc ?? nodes[0] ?? null;
  }, [nodes, selectedNodeId]);

  useEffect(() => {
    if (!selectedNode) {
      setSelectedNodeId(null);
      setDraftContent('');
      return;
    }
    setSelectedNodeId(selectedNode.id);
    setDraftContent(selectedNode.contentMd || '');
  }, [selectedNode?.id, selectedNode?.contentMd]);

  const handleToggleNode = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
      return next;
    });
  };

  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    const target = nodes.find(n => n.id === nodeId);
    setDraftContent(target?.contentMd || '');
  };

  const handleSave = async () => {
    if (!selectedNode || selectedNode.nodeType !== 'doc') return;
    setIsSaving(true);
    try {
      await onUpdateNode(selectedNode.id, { contentMd: draftContent });
    } catch (error) {
      console.error('Erro ao salvar página da metodologia:', error);
      alert('Falha ao salvar a página. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const resolveParentId = () => {
    if (!selectedNode) return null;
    if (selectedNode.nodeType === 'folder') return selectedNode.id;
    return selectedNode.parentId ?? null;
  };

  const handleAddPage = async () => {
    setIsCreating(true);
    try {
      const newId = await onCreateNode({
        title: 'Nova Página',
        nodeType: 'doc',
        parentId: resolveParentId(),
        contentMd: '# Nova Página\n\nComece a escrever aqui...'
      });
      if (typeof newId === 'string') {
        setSelectedNodeId(newId);
        setDraftContent('# Nova Página\n\nComece a escrever aqui...');
      }
    } catch (error) {
      console.error('Erro ao criar nova página:', error);
      alert('Falha ao criar página. Verifique seu acesso ao workspace.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleArchive = async () => {
    if (!selectedNode) return;
    if (!window.confirm('Arquivar esta página? Ela ficará oculta, mas poderá ser restaurada futuramente.')) return;
    setIsArchiving(true);
    try {
      await onDeleteNode(selectedNode.id);
      setSelectedNodeId(null);
      setDraftContent('');
    } catch (error) {
      console.error('Erro ao arquivar página:', error);
      alert('Falha ao arquivar a página.');
    } finally {
      setIsArchiving(false);
    }
  };

  const TreeNodeComponent: React.FC<{ node: TreeNode; level?: number }> = ({ node, level = 0 }) => {
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedNodeId === node.id;
    const hasChildren = node.children.length > 0;

    const handleClick = (event: React.MouseEvent) => {
      event.stopPropagation();
      if (node.nodeType === 'folder') {
        handleToggleNode(node.id);
      } else {
        handleSelectNode(node.id);
      }
    };

    return (
      <div className="animate-msg">
        <div
          onClick={handleClick}
          className={`
            flex items-center gap-2 py-1.5 px-3 rounded-lg cursor-pointer transition-colors select-none
            ${isSelected ? 'bg-bitrix-nav text-white' : 'hover:bg-gray-100 text-gray-600'}
          `}
          style={{ paddingLeft: `${level * 12 + 12}px` }}
        >
          {node.nodeType === 'folder' && (
            <span className="text-gray-400">
              {isExpanded ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
            </span>
          )}

          <span className={`shrink-0 ${isSelected ? 'text-white' : 'text-gray-400'}`}>
            {node.nodeType === 'folder' ? <FolderIcon className="w-4 h-4" /> : <FileTextIcon className="w-4 h-4" />}
          </span>

          <span className={`text-xs font-medium truncate ${isSelected ? 'text-white' : ''}`}>
            {node.title}
          </span>
        </div>

        {isExpanded && hasChildren && (
          <div className="border-l border-gray-100 ml-[18px]">
            {node.children.map(child => (
              <TreeNodeComponent key={child.id} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const isDoc = selectedNode?.nodeType === 'doc';

  return (
    <div className="flex h-full bg-white font-nunito animate-msg overflow-hidden">
      <div className="w-72 bg-gray-50 border-r border-gray-100 flex flex-col shrink-0">
        <header className="h-16 flex items-center justify-between px-5 border-b border-gray-100 bg-white/50">
          {onBack && (
            <button onClick={onBack} className="p-1 hover:bg-gray-200 rounded text-gray-400 mr-2">
              <BackIcon className="w-4 h-4" />
            </button>
          )}
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex-1">Base de Conhecimento</span>
          <button
            onClick={handleAddPage}
            disabled={isCreating}
            className={`
              flex items-center gap-1 bg-white border border-gray-200 px-2 py-1 rounded-md shadow-sm
              text-[9px] font-bold uppercase tracking-wider transition-all
              ${isCreating ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50 text-gray-600'}
            `}
          >
            <PlusIcon className="w-3 h-3" />
            {isCreating ? 'Criando...' : 'Página'}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {tree.length === 0 ? (
            <div className="text-center text-xs text-gray-400 mt-10">
              Nenhuma metodologia cadastrada ainda.
            </div>
          ) : (
            tree.map(node => <TreeNodeComponent key={node.id} node={node} />)
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white">
        <header className="h-24 px-10 flex items-end pb-6 border-b border-gray-50">
          <div>
            <h1 className="text-3xl font-black text-bitrix-nav tracking-tighter uppercase mb-1">
              {selectedNode ? selectedNode.title : 'Selecione uma página'}
            </h1>
            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <span>Metodologia</span>
              <span>/</span>
              <span>{selectedNode?.nodeType === 'folder' ? 'Pasta' : 'Documento'}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          {selectedNode && isDoc ? (
            <div className="max-w-3xl space-y-6">
              <textarea
                className="w-full h-[500px] outline-none resize-none text-gray-600 leading-relaxed bg-transparent font-medium"
                value={draftContent}
                onChange={e => setDraftContent(e.target.value)}
                placeholder="Comece a escrever aqui..."
              />
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={handleArchive}
                  disabled={isArchiving}
                  className={`
                    px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                    ${isArchiving ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}
                  `}
                >
                  {isArchiving ? 'Arquivando...' : 'Arquivar'}
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className={`
                    px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all
                    ${isSaving ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-bitrix-nav text-white hover:bg-bitrix-accent'}
                  `}
                >
                  {isSaving ? 'Salvando...' : 'Salvar Página'}
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl text-sm text-gray-500">
              <p>Selecione uma página para editar o conteúdo ou crie uma nova página na lateral.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MethodologyView;

