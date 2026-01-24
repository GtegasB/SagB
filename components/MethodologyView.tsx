
import React, { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, FolderIcon, FileTextIcon, PlusIcon, BackIcon } from './Icon';

// Mock Data Structure
interface KnowledgeNode {
  id: string;
  title: string;
  type: 'folder' | 'file';
  children?: KnowledgeNode[];
  content?: string; // Markdown content for files
}

const INITIAL_DATA: KnowledgeNode[] = [
  {
    id: '1',
    title: 'Arvore Clientológica',
    type: 'folder',
    children: [
      {
        id: '1-1',
        title: 'Arvore 01',
        type: 'folder',
        children: [
            { id: '1-1-1', title: 'Introdução', type: 'file', content: '# Olá Rodrigues\n\nEste é o início da sua **Base de Conhecimento**.\n\nAqui você guardará os processos da Jornada U.A.U e outras metodologias.' }
        ]
      },
      { id: '1-2', title: 'Jornada U.A.U', type: 'file', content: '# Jornada U.A.U\n\n- Ultra\n- Atendimento\n- Único' }
    ]
  },
  {
      id: '2',
      title: 'GERAC - Processos',
      type: 'folder',
      children: []
  }
];

interface MethodologyViewProps {
    onBack?: () => void;
}

const MethodologyView: React.FC<MethodologyViewProps> = ({ onBack }) => {
  const [data, setData] = useState<KnowledgeNode[]>(INITIAL_DATA);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['1', '1-1']));
  const [selectedNodeId, setSelectedNodeId] = useState<string>('1-1-1');

  // Helper recursivo para atualizar conteúdo de um nó
  const updateNodeContent = (nodes: KnowledgeNode[], id: string, newContent: string): KnowledgeNode[] => {
    return nodes.map(node => {
      if (node.id === id) {
        return { ...node, content: newContent };
      }
      if (node.children) {
        return { ...node, children: updateNodeContent(node.children, id, newContent) };
      }
      return node;
    });
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      setData(prevData => updateNodeContent(prevData, selectedNodeId, newContent));
  };

  const handleAddPage = () => {
      const newId = Date.now().toString();
      const newPage: KnowledgeNode = {
          id: newId,
          title: 'Nova Página Sem Título',
          type: 'file',
          content: '# Nova Página\n\nComece a escrever aqui...'
      };
      
      // Adiciona na raiz por enquanto (simples)
      setData(prev => [...prev, newPage]);
      setSelectedNodeId(newId);
  };

  // Recursive Tree Component
  const TreeNode: React.FC<{ node: KnowledgeNode, level?: number }> = ({ node, level = 0 }) => {
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedNodeId === node.id;
    const hasChildren = node.children && node.children.length > 0;

    const handleToggle = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (node.type === 'folder') {
        const newExpanded = new Set(expandedNodes);
        if (isExpanded) newExpanded.delete(node.id);
        else newExpanded.add(node.id);
        setExpandedNodes(newExpanded);
      } else {
        setSelectedNodeId(node.id);
      }
    };

    return (
      <div className="animate-msg">
        <div 
          onClick={handleToggle}
          className={`
            flex items-center gap-2 py-1.5 px-3 rounded-lg cursor-pointer transition-colors select-none
            ${isSelected ? 'bg-bitrix-nav text-white' : 'hover:bg-gray-100 text-gray-600'}
          `}
          style={{ paddingLeft: `${level * 12 + 12}px` }}
        >
          {node.type === 'folder' && (
             <span className="text-gray-400">
               {isExpanded ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
             </span>
          )}
          
          <span className={`shrink-0 ${isSelected ? 'text-white' : 'text-gray-400'}`}>
            {node.type === 'folder' ? <FolderIcon className="w-4 h-4" /> : <FileTextIcon className="w-4 h-4" />}
          </span>
          
          <span className={`text-xs font-medium truncate ${isSelected ? 'text-white' : ''}`}>
            {node.title}
          </span>
        </div>

        {isExpanded && hasChildren && (
          <div className="border-l border-gray-100 ml-[18px]">
            {node.children!.map(child => (
              <TreeNode key={child.id} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const getSelectedContent = () => {
    const findNode = (nodes: KnowledgeNode[]): KnowledgeNode | undefined => {
      for (const node of nodes) {
        if (node.id === selectedNodeId) return node;
        if (node.children) {
          const found = findNode(node.children);
          if (found) return found;
        }
      }
      return undefined;
    };
    return findNode(data)?.content || '';
  };

  const getSelectedTitle = () => {
      const findNode = (nodes: KnowledgeNode[]): KnowledgeNode | undefined => {
        for (const node of nodes) {
          if (node.id === selectedNodeId) return node;
          if (node.children) {
            const found = findNode(node.children);
            if (found) return found;
          }
        }
        return undefined;
      };
      return findNode(data)?.title || 'Sem Título';
  };

  return (
    <div className="flex h-full bg-white font-nunito animate-msg overflow-hidden">
      
      {/* SIDEBAR DA ÁRVORE */}
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
                className="flex items-center gap-1 bg-white border border-gray-200 px-2 py-1 rounded-md shadow-sm hover:bg-gray-50 text-[9px] font-bold text-gray-600 uppercase tracking-wider transition-all"
           >
             <PlusIcon className="w-3 h-3" />
             Página
           </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
           {data.map(node => (
             <TreeNode key={node.id} node={node} />
           ))}
        </div>
      </div>

      {/* ÁREA DE CONTEÚDO */}
      <div className="flex-1 flex flex-col bg-white">
          <header className="h-24 px-10 flex items-end pb-6 border-b border-gray-50">
             <div>
                <h1 className="text-3xl font-black text-bitrix-nav tracking-tighter uppercase mb-1">{getSelectedTitle()}</h1>
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                   <span>Metodologia</span>
                   <span>/</span>
                   <span>Jornada U.A.U</span>
                </div>
             </div>
          </header>
          
          <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
             <div className="max-w-3xl">
                <textarea 
                  className="w-full h-[500px] outline-none resize-none text-gray-600 leading-relaxed bg-transparent font-medium"
                  value={getSelectedContent()}
                  onChange={handleContentChange}
                  placeholder="Comece a escrever aqui..."
                />
             </div>
          </div>
      </div>

    </div>
  );
};

export default MethodologyView;
