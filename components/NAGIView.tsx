import React, { useDeferredValue, useMemo, useState } from 'react';
import { TabId } from '../types';
import { BackIcon, SearchIcon } from './Icon';

type InitiativeStatus = 'Ideia' | 'Estruturação' | 'Em teste' | 'Ativo' | 'Pausado' | 'Produto futuro';
type InitiativeCategory =
  | 'Memória operacional'
  | 'Inteligência documental'
  | 'Reuniões e contexto'
  | 'Treinamento e capital intelectual'
  | 'Vídeo e contexto'
  | 'Criatividade e inteligência pessoal'
  | 'Aplicação comercial'
  | 'Análise multimodal'
  | 'Organização estratégica'
  | 'Gestão de portfólio';
type InitiativePriority = 'Alta' | 'Média' | 'Baixa';
type OperationalState = 'active' | 'inactive' | 'testing' | 'paused';

type NagiInitiative = {
  id: string;
  title: string;
  shortDescription: string;
  heroDescription: string;
  status: InitiativeStatus;
  category: InitiativeCategory;
  priority: InitiativePriority;
  operationalState: OperationalState;
  value: string;
  currentStage: string;
  overview: string[];
  structure: {
    inputs: string[];
    processing: string[];
    outputs: string[];
    integrations: string[];
  };
  completed: string[];
  nextSteps: string[];
  documentsAndDecisions: string[];
  routeTab?: TabId;
  featured?: boolean;
};

interface NAGIViewProps {
  onBack?: () => void;
  onOpenTab?: (tab: TabId) => void;
}

const STATUS_OPTIONS: InitiativeStatus[] = ['Ideia', 'Estruturação', 'Em teste', 'Ativo', 'Pausado', 'Produto futuro'];
const CATEGORY_OPTIONS: InitiativeCategory[] = [
  'Memória operacional',
  'Inteligência documental',
  'Reuniões e contexto',
  'Treinamento e capital intelectual',
  'Vídeo e contexto',
  'Criatividade e inteligência pessoal',
  'Aplicação comercial',
  'Análise multimodal',
  'Organização estratégica',
  'Gestão de portfólio'
];
const PRIORITY_OPTIONS: InitiativePriority[] = ['Alta', 'Média', 'Baixa'];

const INITIATIVES: NagiInitiative[] = [
  {
    id: 'continuous-memory',
    title: 'Memória Contínua',
    shortDescription: 'Captação contínua de fala ao longo do dia, com blocos curtos, transcrição e organização temporal.',
    heroDescription: 'Captação contínua de fala e transcrição em blocos curtos para inteligência operacional.',
    status: 'Em teste',
    category: 'Memória operacional',
    priority: 'Alta',
    operationalState: 'active',
    value: 'Transforma fala espontânea em memória operacional estruturada dentro do SagB.',
    currentStage: 'Primeiro módulo real do NAGI, já funcional e validando a espinha dorsal da linha de captação e memória.',
    overview: [
      'Memória Contínua é a prova concreta de que o SagB pode captar a realidade do dia e convertê-la em inteligência utilizável.',
      'Ela grava continuamente, fragmenta em blocos curtos, transcreve, organiza por sessão e por tempo, e prepara o terreno para classificação, resumos e extrações.',
      'O projeto já nasce integrado à visão maior do NAGI, servindo como base para agentes, Fluxo de Inteligência e CID.'
    ],
    structure: {
      inputs: ['Áudio contínuo de microfone', 'Contexto da sessão, venture, projeto e sensibilidade'],
      processing: ['Chunking de 3 a 5 minutos', 'Persistência em storage', 'Transcrição por bloco', 'Timeline operacional com retry'],
      outputs: ['Áudio original por chunk', 'Transcrição estruturada', 'Jobs rastreáveis', 'Extrações iniciais e labels'],
      integrations: ['CID', 'Fluxo de Inteligência', 'Agentes', 'Radar de Inteligência']
    },
    completed: ['Captação contínua V1', 'Chunking temporal', 'Transcrição por bloco', 'Timeline do dia', 'Reprocessamento por chunk'],
    nextSteps: ['Classificação automática mais robusta', 'Resumos por sessão/manhã/tarde/dia', 'Extrações validadas por contexto', 'Leitura futura por agentes'],
    documentsAndDecisions: ['Módulo oficial do SAGB já implantado', 'Storage fora do banco', 'RLS e pipeline preparados para escalar'],
    routeTab: 'continuous-memory',
    featured: true
  },
  {
    id: 'cid',
    title: 'CID',
    shortDescription: 'Centro de Inteligência Documental para armazenar, transcrever, resumir e organizar documentos, áudios e vídeos.',
    heroDescription: 'Centro de inteligência documental para ingestão, transcrição e consolidação de materiais estratégicos.',
    status: 'Em teste',
    category: 'Inteligência documental',
    priority: 'Alta',
    operationalState: 'active',
    value: 'Concentra ativos documentais e multimídia em uma camada consultável, resumível e reutilizável pelo ecossistema.',
    currentStage: 'Estrutura avançada já implantada, com espaço para evolução de inteligência e governança documental.',
    overview: [
      'O CID organiza documentos, áudios, vídeos e saídas derivadas como ativo estratégico do SagB.',
      'É a camada que sustenta parte da inteligência documental do NAGI e funciona como repositório operacional para materiais vivos.',
      'No ecossistema, ele abastece consultas, resumos, consolidações e leitura futura por módulos e agentes.'
    ],
    structure: {
      inputs: ['Uploads de documentos, áudio e vídeo', 'Metadados de projeto, área e sensibilidade'],
      processing: ['Armazenamento', 'Fragmentação', 'Transcrição', 'Resumo e consolidação'],
      outputs: ['Assets', 'Chunks', 'Outputs textuais', 'Links e tags documentais'],
      integrations: ['NAGI', 'Fluxo de Inteligência', 'Governança', 'Agentes']
    },
    completed: ['Pipeline de upload', 'Jobs de processamento', 'Outputs e tags', 'Storage privado e RLS'],
    nextSteps: ['Busca semântica', 'Vínculos mais fortes com NAGI', 'Leitura contextual por módulo', 'Consolidação comercial futura'],
    documentsAndDecisions: ['CID permanece módulo próprio do SagB', 'NAGI o organiza como peça da linha de inteligência', 'Integração com memória e reuniões é prioritária'],
    routeTab: 'cid'
  },
  {
    id: 'meeting-transcription',
    title: 'Transcrição de Reuniões',
    shortDescription: 'Captação, transcrição e organização de reuniões para histórico, resumos, decisões e acompanhamento.',
    heroDescription: 'Linha de reuniões para transformar conversas em histórico, decisões, resumos e follow-ups.',
    status: 'Estruturação',
    category: 'Reuniões e contexto',
    priority: 'Alta',
    operationalState: 'inactive',
    value: 'Reduz perda de contexto em reuniões e transforma alinhamento verbal em memória e execução.',
    currentStage: 'Frente definida conceitualmente e pronta para ser acoplada sobre a base já aberta pela Memória Contínua.',
    overview: [
      'A proposta é registrar reuniões com trilha confiável, separar por sessão, gerar resumos e destacar decisões e próximos passos.',
      'A linha conversa diretamente com Memória Contínua, mas com uma experiência específica para reuniões e acompanhamento.',
      'No futuro, deve gerar artefatos prontos para backlogs, Fluxo de Inteligência e histórico de decisão.'
    ],
    structure: {
      inputs: ['Áudio de reuniões', 'Agenda, participantes e contexto'],
      processing: ['Captação', 'Transcrição', 'Detecção de decisões e follow-ups', 'Organização por reunião'],
      outputs: ['Resumo executivo', 'Histórico completo', 'Decisões e ações', 'Material para acompanhamento'],
      integrations: ['Memória Contínua', 'Fluxo de Inteligência', 'Banco de Iniciativas']
    },
    completed: ['Escopo definido dentro do NAGI', 'Dependências centrais já mapeadas'],
    nextSteps: ['Criar experiência dedicada', 'Definir modelo de reunião', 'Extrair decisões com mais precisão'],
    documentsAndDecisions: ['Usará base de áudio e transcrição já consolidada no SagB']
  },
  {
    id: 'training-recordings',
    title: 'Gravações de Treinamento',
    shortDescription: 'Gravação, transcrição e estruturação de treinamentos, mentorias e conteúdos em vídeo e áudio.',
    heroDescription: 'Transforma treinamento e mentoria em capital intelectual estruturado e reaproveitável.',
    status: 'Estruturação',
    category: 'Treinamento e capital intelectual',
    priority: 'Média',
    operationalState: 'inactive',
    value: 'Converte conteúdo de ensino em ativo vivo, reutilizável e organizado dentro do ecossistema.',
    currentStage: 'Frente em desenho, com potencial claro para virar acervo e produto interno.',
    overview: [
      'A linha de treinamentos pega gravações e mentorias e as transforma em material estruturado, pesquisável e reaplicável.',
      'Ela pode abastecer AcadB, agentes, CID e áreas comerciais com conteúdo pronto para reaproveitamento.',
      'No NAGI, entra como braço de capital intelectual e preservação de conhecimento aplicado.'
    ],
    structure: {
      inputs: ['Vídeos de treinamento', 'Áudios de mentoria', 'Materiais complementares'],
      processing: ['Segmentação por capítulos', 'Transcrição', 'Resumo', 'Catalogação temática'],
      outputs: ['Biblioteca de treinamento', 'Resumos', 'Trechos reutilizáveis', 'Insights e checkpoints'],
      integrations: ['CID', 'AcadB', 'Agentes', 'Portfólio Estratégico']
    },
    completed: ['Frente posicionada dentro do NAGI', 'Arquitetura relacionada já existente em CID/Memória'],
    nextSteps: ['Definir experiência de ingestão', 'Estruturar metadados de treinamento', 'Criar leitura por módulo/tema'],
    documentsAndDecisions: ['Prioridade intermediária, mas com alto valor de capital intelectual']
  },
  {
    id: 'creative-capsule',
    title: 'Cápsula de Criatividade',
    shortDescription: 'Espaço de fala livre para registrar ideias, reflexões e raciocínios, transformando criatividade em estrutura.',
    heroDescription: 'Canal intencional de fala livre para converter criatividade em memória e inteligência pessoal.',
    status: 'Estruturação',
    category: 'Criatividade e inteligência pessoal',
    priority: 'Média',
    operationalState: 'inactive',
    value: 'Protege ideias soltas e raciocínios valiosos antes que se percam no fluxo do dia.',
    currentStage: 'Conceito pronto para virar uma experiência específica de captura livre dentro da linha NAGI.',
    overview: [
      'A Cápsula de Criatividade atua como espaço de liberdade controlada: gravar, refletir, raciocinar e depois estruturar.',
      'Ela nasce próxima da Memória Contínua, mas com foco em fluxo criativo e não apenas em registro operacional.',
      'Pode virar uma camada pessoal, estratégica e até comercial de geração de ativos criativos.'
    ],
    structure: {
      inputs: ['Fala livre', 'Ideias, reflexões e hipóteses', 'Contexto pessoal ou estratégico'],
      processing: ['Transcrição', 'Agrupamento temático', 'Extração de ideias e caminhos'],
      outputs: ['Ideias estruturadas', 'Rascunhos de decisão', 'Caminhos de produto e conteúdo'],
      integrations: ['Memória Contínua', 'Banco de Iniciativas', 'Portfólio Estratégico']
    },
    completed: ['Conceito priorizado como braço da linha NAGI'],
    nextSteps: ['Criar modo de captura criativa', 'Separar da lógica puramente operacional', 'Conectar com Banco de Iniciativas'],
    documentsAndDecisions: ['Deve nascer simples, mas com forte valor estratégico pessoal']
  },
  {
    id: 'ip-cameras',
    title: 'Câmeras IP com Nuvem Inteligente',
    shortDescription: 'Gravação por câmera com armazenamento em nuvem, segmentação por tempo e evolução para análise inteligente.',
    heroDescription: 'Linha multimídia para capturar vídeo contínuo com retenção, cortes temporais e evolução analítica.',
    status: 'Ideia',
    category: 'Vídeo e contexto',
    priority: 'Média',
    operationalState: 'inactive',
    value: 'Abre um braço visual e contextual do NAGI para operações físicas, treinamentos e monitoramento com inteligência.',
    currentStage: 'Frente ainda conceitual, mas com potencial estrutural e comercial relevante.',
    overview: [
      'A ideia é transformar câmeras IP e nuvem em fonte de contexto, recorte temporal e inteligência operacional.',
      'No início, o foco é gravação e segmentação; depois, análise inteligente sobre eventos e padrões.',
      'Essa frente expande o SagB da fala para o vídeo como camada de realidade observável.'
    ],
    structure: {
      inputs: ['Streams de câmeras IP', 'Metadados de local, tempo e contexto'],
      processing: ['Armazenamento em nuvem', 'Segmentação temporal', 'Indexação de eventos'],
      outputs: ['Clipes organizados', 'Timeline visual', 'Base para análise futura'],
      integrations: ['CID', 'Radar de Inteligência', 'Leitura de Movimento e Presença']
    },
    completed: ['Escopo inicial posicionado no NAGI'],
    nextSteps: ['Definir arquitetura técnica', 'Modelar storage e retenção', 'Avaliar caminho comercial'],
    documentsAndDecisions: ['Vídeo entra como frente de contexto e produto futuro']
  },
  {
    id: 'commercial-intelligence',
    title: 'Inteligência Comercial',
    shortDescription: 'Transcrição e análise de conversas de vendas e atendimento para identificar objeções, oportunidades e padrões.',
    heroDescription: 'Camada comercial para transformar conversas de vendas em padrões, objeções e ganhos de execução.',
    status: 'Ideia',
    category: 'Aplicação comercial',
    priority: 'Alta',
    operationalState: 'inactive',
    value: 'Leva a linha NAGI diretamente para receita, qualidade comercial e produto futuro.',
    currentStage: 'Ideia com forte potencial de aplicação prática e comercialização.',
    overview: [
      'A frente usa transcrição e inteligência operacional para ler atendimentos, vendas e negociações.',
      'O objetivo é identificar objeções, sinais de oportunidade, gaps de discurso e padrões que melhoram performance.',
      'É uma das linhas com maior potencial de produto futuro dentro do ecossistema.'
    ],
    structure: {
      inputs: ['Áudios de vendas e atendimento', 'Contexto comercial e funil'],
      processing: ['Transcrição', 'Leitura de objeções', 'Classificação de oportunidades', 'Agrupamento por padrão'],
      outputs: ['Relatórios de objeções', 'Insights de venda', 'Material para treinamento comercial'],
      integrations: ['Memória Contínua', 'Gravações de Treinamento', 'Portfólio Estratégico']
    },
    completed: ['Posicionamento estratégico definido no NAGI'],
    nextSteps: ['Definir modelo de captura comercial', 'Criar leitura por etapa de funil', 'Testar aplicação piloto'],
    documentsAndDecisions: ['Linha de forte potencial comercial e de produto']
  },
  {
    id: 'movement-presence',
    title: 'Leitura de Movimento e Presença',
    shortDescription: 'Análise visual de gesto, postura, deslocamento e dinâmica corporal em treinamentos, apresentações e gravações.',
    heroDescription: 'Camada multimodal que cruza vídeo, presença e gesto para leitura mais sofisticada de comportamento.',
    status: 'Ideia',
    category: 'Análise multimodal',
    priority: 'Baixa',
    operationalState: 'inactive',
    value: 'Expande o NAGI para leitura corporal e visual, indo além da fala e do documento.',
    currentStage: 'Frente de pesquisa e futuro, ainda em formulação conceitual.',
    overview: [
      'Essa iniciativa nasce como braço multimodal, olhando gesto, deslocamento, presença e dinâmica corporal.',
      'Tem potencial para apresentações, treinamentos, observação de comportamento e análise futura mais sofisticada.',
      'Ainda é uma linha exploratória, mas importante para o mapa de longo prazo.'
    ],
    structure: {
      inputs: ['Vídeos de treinamentos e apresentações', 'Contexto de sessão e gravação'],
      processing: ['Segmentação visual', 'Mapeamento de gesto e presença', 'Leitura de padrões'],
      outputs: ['Sinais comportamentais', 'Recortes multimodais', 'Base para análise futura'],
      integrations: ['Câmeras IP com Nuvem Inteligente', 'Radar de Inteligência', 'Treinamentos']
    },
    completed: ['Frente mapeada dentro do portfólio NAGI'],
    nextSteps: ['Explorar viabilidade técnica', 'Definir casos de uso prioritários', 'Modelar camada multimodal'],
    documentsAndDecisions: ['Tratar como linha futura de pesquisa e expansão']
  },
  {
    id: 'initiative-bank',
    title: 'Banco de Iniciativas',
    shortDescription: 'Área para reunir ideias, projetos e iniciativas ainda brutas, antes de entrarem no portfólio estruturado.',
    heroDescription: 'Zona de incubação estratégica para frentes ainda brutas antes de virarem projeto maduro.',
    status: 'Estruturação',
    category: 'Organização estratégica',
    priority: 'Média',
    operationalState: 'inactive',
    value: 'Evita dispersão, centraliza ideias e dá fluxo para iniciativas que ainda não estão maduras.',
    currentStage: 'Estruturação conceitual já prevista como camada de organização do NAGI.',
    overview: [
      'O Banco de Iniciativas é o reservatório de ideias antes do portfólio formal.',
      'Ele reduz perda de propostas e ajuda a transformar possibilidades em frente rastreável.',
      'No NAGI, funciona como área de acolhimento para linhas ainda não consolidadas.'
    ],
    structure: {
      inputs: ['Ideias novas', 'Projetos brutos', 'Sinais estratégicos'],
      processing: ['Triagem', 'Classificação inicial', 'Agrupamento por linha'],
      outputs: ['Backlog estruturado', 'Frentes incubadas', 'Pontes para portfólio'],
      integrations: ['Cápsula de Criatividade', 'Portfólio Estratégico', 'Governança']
    },
    completed: ['Papel estratégico definido no NAGI'],
    nextSteps: ['Criar tela própria futura', 'Definir critérios de entrada e maturidade', 'Amarrar com governança'],
    documentsAndDecisions: ['Não substituir backlog operacional; atuar como camada estratégica']
  },
  {
    id: 'strategic-portfolio',
    title: 'Portfólio Estratégico',
    shortDescription: 'Camada para organizar, priorizar e acompanhar projetos e linhas de construção mais maduras dentro do SagB.',
    heroDescription: 'Camada de gestão de portfólio para as frentes NAGI e outras linhas maduras do ecossistema.',
    status: 'Estruturação',
    category: 'Gestão de portfólio',
    priority: 'Alta',
    operationalState: 'inactive',
    value: 'Organiza prioridade, maturidade e peso estratégico das frentes dentro do ecossistema.',
    currentStage: 'Planejada como camada organizadora para quando o NAGI ganhar mais massa.',
    overview: [
      'O Portfólio Estratégico não é apenas vitrine: ele ajuda a priorizar o que merece investimento, estrutura e continuidade.',
      'É o braço de gestão madura para quando as iniciativas saem do campo conceitual e entram em linha séria de construção.',
      'No NAGI, ele fecha o ciclo entre ideia, frente, piloto e produto futuro.'
    ],
    structure: {
      inputs: ['Projetos maduros', 'Sinais de prioridade e impacto', 'Dependências estratégicas'],
      processing: ['Priorização', 'Classificação de maturidade', 'Leitura por valor e risco'],
      outputs: ['Mapa de portfólio', 'Priorização executiva', 'Visão de construção'],
      integrations: ['Banco de Iniciativas', 'Governança', 'NAGI', 'StartyB']
    },
    completed: ['Conceito posicionado na linha estrutural do NAGI'],
    nextSteps: ['Definir estrutura de maturidade', 'Criar filtros de prioridade', 'Abrir visão executiva consolidada'],
    documentsAndDecisions: ['Camada de gestão futura, não backlog bruto']
  },
  {
    id: 'radar-connections',
    title: 'Radar de Conexões e Radar Externo',
    shortDescription: 'Sistema para entender o portfólio, detectar relações internas, vigiar sinais externos e converter tudo isso em ação estratégica.',
    heroDescription: 'Espinha dorsal de inteligência de ecossistema para ler o que existe, o que conecta e o que o mundo sinaliza.',
    status: 'Estruturação',
    category: 'Gestão de portfólio',
    priority: 'Alta',
    operationalState: 'active',
    value: 'Transforma o NAGI em cérebro de portfólio, descoberta e expansão, e não apenas em um lugar para listar iniciativas.',
    currentStage: 'Documento canônico consolidado e módulo estratégico já materializado no SagB como base de implantação.',
    overview: [
      'Esta frente une Radar de Conexões, Radar Externo, Central de Distribuição, Mesa de Decisão, Memória Estratégica e Base de Ativos Reutilizáveis.',
      'O objetivo não é apenas mostrar conexões bonitas, mas criar um sistema capaz de detectar sinergias, riscos, subprodutos, spin-offs, sinais de mercado e rotas reais de ação.',
      'Ela posiciona o NAGI como sistema de inteligência estratégica de ecossistema, capaz de organizar o que existe, ler o que emerge e redistribuir oportunidade.'
    ],
    structure: {
      inputs: ['Projetos, ideias, módulos e ativos do ecossistema', 'Sinais externos de mercado, IA, jurisprudência e movimentos setoriais', 'Histórico de decisões, distribuições e aprovações'],
      processing: ['Ontologia do ecossistema', 'Mapeamento semântico de relações', 'Classificação de sinais e scoring estratégico', 'Roteamento para áreas e Mesa de Decisão'],
      outputs: ['Mapa de relações e genealogias', 'Oportunidades priorizadas', 'Distribuições acionáveis', 'Linhas-mãe, metaprojetos e spin-offs candidatos'],
      integrations: ['NAGI', 'Governança', 'CID', 'Fluxo de Inteligência', 'Hub de Ventures', 'Sala Dev']
    },
    completed: ['Leitura total do projeto-base', 'Especificação canônica do Radar de Conexões', 'Blueprint executivo consolidado', 'Tela estruturada dentro do SagB'],
    nextSteps: ['Definir ontologia oficial', 'Modelar entidades e relações', 'Criar Radar de Conexões V1', 'Criar Radar Externo V1', 'Abrir a Central de Distribuição e a Mesa de Decisão'],
    documentsAndDecisions: ['O projeto não deve nascer como feed ou mural de cards', 'A tríade oficial é Dentro / Entre / Fora', 'A base estrutural exige ontologia, scoring e rastreabilidade'],
    routeTab: 'radar-connections',
    featured: true
  }
];

const statusTone: Record<InitiativeStatus, string> = {
  'Ideia': 'bg-slate-100 text-slate-700 border-slate-200',
  'Estruturação': 'bg-blue-50 text-blue-700 border-blue-200',
  'Em teste': 'bg-amber-50 text-amber-700 border-amber-200',
  'Ativo': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Pausado': 'bg-gray-100 text-gray-600 border-gray-200',
  'Produto futuro': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200'
};

const priorityTone: Record<InitiativePriority, string> = {
  'Alta': 'text-rose-600',
  'Média': 'text-amber-600',
  'Baixa': 'text-slate-500'
};

const operationalMeta: Record<OperationalState, { label: string; dot: string; card: string; on: boolean }> = {
  active: { label: 'Ativo', dot: 'bg-emerald-500', card: '', on: true },
  inactive: { label: 'Inativo', dot: 'bg-rose-500', card: 'opacity-80 saturate-[0.85]', on: false },
  testing: { label: 'Em teste', dot: 'bg-amber-400', card: '', on: true },
  paused: { label: 'Pausado', dot: 'bg-slate-400', card: 'opacity-90', on: false }
};

const TogglePill: React.FC<{ state: OperationalState }> = ({ state }) => {
  const meta = operationalMeta[state];
  return (
    <div className={`relative inline-flex items-center w-[72px] h-9 rounded-full px-2 transition-colors ${meta.on ? 'bg-emerald-500' : state === 'inactive' ? 'bg-slate-700' : 'bg-slate-400'}`}>
      <span className={`absolute inset-y-1 w-7 h-7 rounded-full bg-white shadow-sm transition-transform ${meta.on ? 'translate-x-[34px]' : 'translate-x-0'}`} />
      <span className={`relative z-10 text-[10px] font-black uppercase tracking-[0.24em] text-white ${meta.on ? 'ml-auto mr-1' : 'ml-1'}`}>
        {meta.on ? 'ON' : 'OFF'}
      </span>
    </div>
  );
};

const InfoList: React.FC<{ title: string; items: string[] }> = ({ title, items }) => (
  <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
    <h3 className="text-xl font-black tracking-tight text-slate-950 mb-4">{title}</h3>
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item} className="flex items-start gap-3 text-sm leading-7 text-slate-600">
          <span className="mt-2 w-2 h-2 rounded-full bg-cyan-500 shrink-0" />
          <span>{item}</span>
        </div>
      ))}
    </div>
  </section>
);

const NAGIView: React.FC<NAGIViewProps> = ({ onBack, onOpenTab }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InitiativeStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | InitiativeCategory>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | InitiativePriority>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  const initiatives = INITIATIVES;
  const selected = initiatives.find((initiative) => initiative.id === selectedId) || null;

  const filtered = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase();
    return initiatives.filter((initiative) => {
      if (statusFilter !== 'all' && initiative.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && initiative.category !== categoryFilter) return false;
      if (priorityFilter !== 'all' && initiative.priority !== priorityFilter) return false;
      if (!term) return true;
      return [
        initiative.title,
        initiative.shortDescription,
        initiative.category,
        initiative.status,
        initiative.heroDescription
      ].join(' ').toLowerCase().includes(term);
    });
  }, [initiatives, deferredSearch, statusFilter, categoryFilter, priorityFilter]);

  const statusCounts = useMemo(() => {
    const counts = new Map<InitiativeStatus, number>();
    initiatives.forEach((initiative) => counts.set(initiative.status, (counts.get(initiative.status) || 0) + 1));
    return counts;
  }, [initiatives]);

  const operationalCounts = useMemo(() => {
    const active = initiatives.filter((initiative) => operationalMeta[initiative.operationalState].on).length;
    return { active, inactive: initiatives.length - active };
  }, [initiatives]);

  if (selected) {
    const stateMeta = operationalMeta[selected.operationalState];
    return (
      <div className="flex-1 h-full overflow-y-auto custom-scrollbar bg-[radial-gradient(circle_at_top_left,_rgba(8,145,178,0.16),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(251,191,36,0.14),_transparent_26%),linear-gradient(180deg,_#f8fafc_0%,_#eef4ff_100%)]">
        <div className="max-w-[1500px] mx-auto px-6 md:px-10 py-8 space-y-8">
          <header className="rounded-[34px] bg-slate-950 text-white shadow-[0_32px_90px_rgba(15,23,42,0.22)] overflow-hidden">
            <div className="px-8 md:px-10 py-8">
              <button onClick={() => setSelectedId(null)} className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] font-black text-cyan-300 mb-5">
                <BackIcon className="w-4 h-4" /> Voltar ao hub
              </button>
              <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6">
                <div className="max-w-4xl">
                  <span className="text-[10px] uppercase tracking-[0.4em] font-black text-cyan-300 block mb-3">NAGI / Iniciativa</span>
                  <h1 className="text-4xl md:text-5xl font-black tracking-[-0.04em]">{selected.title}</h1>
                  <p className="text-slate-300 text-lg leading-8 mt-4">{selected.heroDescription}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-[300px]">
                  <div className={`rounded-[24px] border px-4 py-4 ${statusTone[selected.status]}`}>
                    <span className="text-[10px] uppercase tracking-[0.28em] font-black opacity-70 block mb-1">Status</span>
                    <strong className="text-base font-black">{selected.status}</strong>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                    <span className="text-[10px] uppercase tracking-[0.28em] font-black text-slate-400 block mb-1">Categoria</span>
                    <strong className="text-base font-black">{selected.category}</strong>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                    <span className="text-[10px] uppercase tracking-[0.28em] font-black text-slate-400 block mb-1">Prioridade</span>
                    <strong className={`text-base font-black ${selected.priority === 'Alta' ? 'text-rose-300' : selected.priority === 'Média' ? 'text-amber-300' : 'text-slate-200'}`}>{selected.priority}</strong>
                  </div>
                  <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                    <span className="text-[10px] uppercase tracking-[0.28em] font-black text-slate-400 block mb-1">Vínculo</span>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${stateMeta.dot}`} />
                        <strong className="text-base font-black">{stateMeta.label}</strong>
                      </div>
                      <TogglePill state={selected.operationalState} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
              <span className="text-[10px] uppercase tracking-[0.35em] font-black text-slate-400 block mb-3">Visão Geral</span>
              <h2 className="text-2xl font-black tracking-tight text-slate-950 mb-4">O que é, para que serve e valor atual</h2>
              <div className="space-y-4 text-sm leading-7 text-slate-600">
                {selected.overview.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                <div className="rounded-[22px] border border-cyan-100 bg-cyan-50 px-4 py-4">
                  <div className="text-[10px] uppercase tracking-[0.24em] font-black text-cyan-700 mb-2">Valor do projeto</div>
                  <p className="text-sm leading-7 text-cyan-900">{selected.value}</p>
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="text-[10px] uppercase tracking-[0.24em] font-black text-slate-500 mb-2">Estágio atual</div>
                  <p className="text-sm leading-7 text-slate-700">{selected.currentStage}</p>
                </div>
              </div>
            </section>

            <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
              <span className="text-[10px] uppercase tracking-[0.35em] font-black text-slate-400 block mb-3">Estrutura</span>
              <h2 className="text-2xl font-black tracking-tight text-slate-950 mb-4">Entradas, processamento, saídas e integrações</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { title: 'Entradas', items: selected.structure.inputs },
                  { title: 'Processamento', items: selected.structure.processing },
                  { title: 'Saídas', items: selected.structure.outputs },
                  { title: 'Integrações', items: selected.structure.integrations }
                ].map((block) => (
                  <div key={block.title} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <div className="text-[10px] uppercase tracking-[0.24em] font-black text-slate-500 mb-3">{block.title}</div>
                    <div className="space-y-2">
                      {block.items.map((item) => (
                        <div key={item} className="text-sm leading-6 text-slate-700">{item}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <InfoList title="O que já foi feito" items={selected.completed} />
            <InfoList title="Próximos passos" items={selected.nextSteps} />
            <InfoList title="Documentos e decisões" items={selected.documentsAndDecisions} />
          </section>

          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase tracking-[0.35em] font-black text-slate-400 block mb-3">Conexão com SagB</span>
                <h2 className="text-2xl font-black tracking-tight text-slate-950">Vínculo do projeto com o ecossistema</h2>
                <p className="text-sm leading-7 text-slate-600 mt-3">
                  Esta iniciativa existe dentro do NAGI como frente estratégica do ecossistema e pode se desdobrar em módulo real do SagB conforme sua maturidade operacional.
                </p>
              </div>
              {selected.routeTab && onOpenTab && (
                <button
                  onClick={() => onOpenTab(selected.routeTab!)}
                  className="px-5 py-3 rounded-2xl bg-slate-950 text-white font-black tracking-tight hover:bg-slate-800 transition-colors"
                >
                  Abrir módulo real no SagB
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full overflow-y-auto custom-scrollbar bg-[radial-gradient(circle_at_top_left,_rgba(8,145,178,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(34,197,94,0.12),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef4ff_100%)]">
      <div className="max-w-[1500px] mx-auto px-6 md:px-10 py-8 space-y-8">
        <header className="rounded-[34px] border border-white/70 bg-slate-950 text-white shadow-[0_32px_90px_rgba(15,23,42,0.22)] overflow-hidden">
          <div className="px-8 md:px-10 py-8">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
              <div className="max-w-4xl">
                {onBack && (
                  <button onClick={onBack} className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.28em] font-black text-cyan-300 mb-5">
                    <BackIcon className="w-4 h-4" /> Voltar ao ecossistema
                  </button>
                )}
                <span className="text-[10px] uppercase tracking-[0.4em] font-black text-cyan-300 block mb-3">Hub Estrutural</span>
                <h1 className="text-4xl md:text-5xl font-black tracking-[-0.04em]">NAGI</h1>
                <p className="text-slate-300 text-lg leading-8 mt-4">
                  Plataforma-mãe de captação, memória, transcrição e inteligência operacional.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-[320px]">
                <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                  <span className="text-[10px] uppercase tracking-[0.28em] font-black text-slate-400 block mb-1">Frentes</span>
                  <strong className="text-3xl font-black tracking-tight">{initiatives.length}</strong>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                  <span className="text-[10px] uppercase tracking-[0.28em] font-black text-slate-400 block mb-1">Ligadas</span>
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-3xl font-black tracking-tight">{operationalCounts.active}</strong>
                    <TogglePill state="active" />
                  </div>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4">
                  <span className="text-[10px] uppercase tracking-[0.28em] font-black text-slate-400 block mb-1">Desligadas</span>
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-3xl font-black tracking-tight">{operationalCounts.inactive}</strong>
                    <TogglePill state="inactive" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-[30px] border border-white/80 bg-white/85 backdrop-blur-xl p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div className="flex flex-wrap gap-3">
              <label className="relative">
                <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar iniciativa, categoria ou descrição..."
                  className="pl-10 pr-3 py-3 rounded-2xl border border-slate-200 bg-white text-sm min-w-[260px]"
                />
              </label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | InitiativeStatus)} className="px-3 py-3 rounded-2xl border border-slate-200 bg-white text-sm">
                <option value="all">Todos os status</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status} ({statusCounts.get(status) || 0})</option>
                ))}
              </select>
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as 'all' | InitiativeCategory)} className="px-3 py-3 rounded-2xl border border-slate-200 bg-white text-sm">
                <option value="all">Todas as categorias</option>
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as 'all' | InitiativePriority)} className="px-3 py-3 rounded-2xl border border-slate-200 bg-white text-sm">
                <option value="all">Todas as prioridades</option>
                {PRIORITY_OPTIONS.map((priority) => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>
            </div>

            <button className="px-5 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 text-sm font-black tracking-tight cursor-default">
              Adicionar iniciativa depois
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
          {filtered.map((initiative) => {
            const stateMeta = operationalMeta[initiative.operationalState];
            return (
              <button
                key={initiative.id}
                onClick={() => setSelectedId(initiative.id)}
                className={`group min-h-[228px] rounded-[28px] border p-4 text-left bg-white shadow-[0_18px_44px_rgba(15,23,42,0.06)] hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)] transition-all ${initiative.featured ? 'border-cyan-300 ring-1 ring-cyan-200' : 'border-slate-200'} ${stateMeta.card}`}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.22em] font-black ${statusTone[initiative.status]}`}>
                    <span className={`w-2 h-2 rounded-full ${stateMeta.dot}`} />
                    {initiative.status}
                  </div>
                  <TogglePill state={initiative.operationalState} />
                </div>

                <div className="mb-4">
                  <h3 className="text-[20px] leading-6 font-black tracking-tight text-slate-950 mb-2">{initiative.title}</h3>
                  <p className="text-sm leading-6 text-slate-600">{initiative.shortDescription}</p>
                </div>

                <div className="mt-auto space-y-3">
                  <div className="text-[10px] uppercase tracking-[0.24em] font-black text-slate-400">{initiative.category}</div>
                  <div className="flex items-center justify-between gap-3">
                    <span className={`text-xs font-black uppercase tracking-[0.18em] ${priorityTone[initiative.priority]}`}>Prioridade {initiative.priority}</span>
                    {initiative.featured && <span className="text-[10px] uppercase tracking-[0.24em] font-black text-cyan-700">Primeiro módulo real</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </section>
      </div>
    </div>
  );
};

export default NAGIView;
