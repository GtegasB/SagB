export type BridgeSectionId =
  | 'overview'
  | 'execution'
  | 'contracts'
  | 'operations'
  | 'quality';

export interface BridgeMetric {
  label: string;
  value: string;
  note: string;
}

export interface BridgeCard {
  title: string;
  objective: string;
  deliverables: string[];
  validation: string[];
}

export interface BridgeEndpoint {
  method: 'GET' | 'POST' | 'PATCH';
  path: string;
  purpose: string;
}

export interface BridgeRisk {
  title: string;
  mitigation: string;
}

export interface BridgeSprint {
  name: string;
  focus: string;
  items: string[];
}

export const bridgeMetrics: BridgeMetric[] = [
  {
    label: 'Entrega Inicial',
    value: 'Abrir no VS Code',
    note: 'Projeto certo, task certa, contexto certo'
  },
  {
    label: 'Ponte Oficial',
    value: 'SagB + Extensao',
    note: 'Nada de embutir o VS Code inteiro no SagB'
  },
  {
    label: 'Rastro Tecnico',
    value: 'Task Runs',
    note: 'Status, bloqueio, resumo e auditoria'
  }
];

export const bridgeFormula = [
  'SagB = sala de comando',
  'VS Code = base operacional',
  'SagB Bridge = ponte oficial',
  'Codex = operador assistido dentro do VS Code'
];

export const bridgeDecisions = [
  'Nao embutir o VS Code completo no SagB na V1.',
  'Usar API HTTP do SagB + extensao oficial do VS Code.',
  'Usar launchToken temporario no deep link.',
  'Resolver projeto local por project binding, nao por localPath fixo vindo da API.',
  'Persistir pendingLaunch antes de qualquer openFolder.',
  'Armazenar token apenas em SecretStorage.',
  'Nao controlar a interface do Codex na V1.'
];

export const programmersRoomCapabilities = [
  'Fila de tarefas tecnicas com filtros por projeto, modulo, etapa e status.',
  'Cartoes de tarefa com historico tecnico, responsavel, prioridade e ultimo run.',
  'Acao Abrir no VS Code, Copiar prompt, Ver detalhes e Ver historico.',
  'Leitura clara de bloqueios, devolutivas e riscos da execucao.'
];

export const bridgeCards: BridgeCard[] = [
  {
    title: 'SagB Bridge | ET-01 | definir arquitetura e contratos da ponte SagB x VS Code',
    objective: 'Fechar a arquitetura, os contratos de API, launch token, binding local e regras de run.',
    deliverables: [
      'Documento canonico aprovado',
      'Contratos de API validados',
      'Launch token e consumo definidos',
      'Modelo de task run e ownership fechado'
    ],
    validation: [
      'Fluxos A ate K compreendidos pelo time',
      'Payloads sem localPath como verdade global',
      'Definition of Done da V1 validada'
    ]
  },
  {
    title: 'SagB Bridge | ET-02 | criar extensao VS Code base',
    objective: 'Subir a extensao com autenticacao, abertura por ID, binding local e base de painel.',
    deliverables: [
      'Bootstrap da extensao',
      'Comandos principais',
      'SecretStorage',
      'Binding local por profileType'
    ],
    validation: [
      'Usuario conecta com token valido',
      'Task abre por ID',
      'Projeto local e resolvido com binding'
    ]
  },
  {
    title: 'SagB Bridge | ET-03 | implementar deep link, pending launch e operacao de runs',
    objective: 'Garantir abertura pelo SagB com deep link, reidratacao e controle correto de runs.',
    deliverables: [
      'URI handler',
      'Consume launch',
      'PendingLaunch',
      'Create or resume run',
      'Atualizacao de status e report final'
    ],
    validation: [
      'Clique em Abrir no VS Code abre a mesma run quando apropriado',
      'Launch expirado gera UX clara',
      'openFolder nao perde o contexto'
    ]
  },
  {
    title: 'SagB Bridge | ET-04 | criar backend minimo e Sala dos Programadores',
    objective: 'Levar a operacao para dentro do SagB com lista de tasks, detalhes, historico e abertura no VS Code.',
    deliverables: [
      'Projects',
      'Tasks',
      'Task launches',
      'Task runs',
      'Historico tecnico'
    ],
    validation: [
      'Sala dos Programadores acessivel no SagB',
      'Historico de runs visivel por task',
      'Abertura no VS Code operando ponta a ponta'
    ]
  }
];

export const bridgeEndpoints: BridgeEndpoint[] = [
  { method: 'POST', path: '/api/dev/auth/validate', purpose: 'Validar token da extensao' },
  { method: 'GET', path: '/api/dev/projects', purpose: 'Listar projetos disponiveis' },
  { method: 'GET', path: '/api/dev/tasks', purpose: 'Listar tasks para a Sala dos Programadores' },
  { method: 'GET', path: '/api/dev/tasks/{taskId}', purpose: 'Detalhar task por ID' },
  { method: 'POST', path: '/api/dev/task-launches', purpose: 'Gerar launchToken e deep link' },
  { method: 'POST', path: '/api/dev/task-launches/consume', purpose: 'Consumir launchToken e recuperar payload real' },
  { method: 'POST', path: '/api/dev/task-runs', purpose: 'Criar ou retomar task run' },
  { method: 'PATCH', path: '/api/dev/task-runs/{runId}/status', purpose: 'Atualizar status ou bloqueio da run' },
  { method: 'POST', path: '/api/dev/task-runs/{runId}/report', purpose: 'Enviar resumo final da run' },
  { method: 'POST', path: '/api/dev/developer-sessions', purpose: 'Registrar sessao do VS Code' }
];

export const bridgeFlows = [
  {
    title: 'Fluxo principal',
    steps: [
      'Usuario abre a task no SagB.',
      'SagB gera launchToken e dispara a URI da extensao.',
      'A extensao consome o token, resolve o binding local e persiste pendingLaunch.',
      'O workspace abre, a extensao reidrata, cria ou retoma a run e mostra o painel.'
    ]
  },
  {
    title: 'Retomada e resiliencia',
    steps: [
      'Se a mesma task for aberta pelo mesmo usuario, a run ativa deve ser retomada por padrao.',
      'Se o usuario clicar duas vezes, a extensao nao deve multiplicar runs sem criterio.',
      'Se o launchToken expirar, a UX precisa orientar a gerar um novo link.'
    ]
  },
  {
    title: 'Ambiente real',
    steps: [
      'Monorepo deve usar relativeTargetPath.',
      'Projeto ausente deve pedir binding manual na V1.',
      'Repositorio sujo ou branch divergente deve gerar aviso, nao automacao destrutiva.'
    ]
  }
];

export const bridgeRisks: BridgeRisk[] = [
  {
    title: 'Perda de estado apos openFolder',
    mitigation: 'Persistir pendingLaunch antes da troca de workspace e retomar no activate seguinte.'
  },
  {
    title: 'Path fixo por maquina',
    mitigation: 'Usar projectSlug + binding local por profileType.'
  },
  {
    title: 'Token exposto',
    mitigation: 'SecretStorage para token e launchToken temporario sem segredo persistente.'
  },
  {
    title: 'Duplicidade de run',
    mitigation: 'Retomar a run ativa do mesmo usuario por padrao.'
  },
  {
    title: 'Branch errada ou repositorio sujo',
    mitigation: 'Exibir contexto Git no painel e exigir confirmacao para acoes mais fortes.'
  }
];

export const bridgeDefinitionOfDone = [
  'A extensao autentica com o SagB.',
  'O SagB abre task no VS Code por deep link.',
  'A extensao abre task por ID.',
  'O projeto local e resolvido por binding.',
  'openFolder nao quebra o fluxo.',
  'A run e criada ou retomada corretamente.',
  'Os arquivos iniciais abrem.',
  'O painel exibe informacoes basicas da task.',
  'O prompt-base pode ser copiado.',
  'Status e report final podem ser enviados.',
  'Launch expirado e projeto nao mapeado possuem UX clara.'
];

export const bridgeSprints: BridgeSprint[] = [
  {
    name: 'Sprint 1',
    focus: 'Base da extensao e contratos minimos',
    items: [
      'Contratos de API',
      'Autenticacao',
      'Abertura por ID',
      'Binding local',
      'Estrutura base da extensao'
    ]
  },
  {
    name: 'Sprint 2',
    focus: 'Abertura pelo SagB',
    items: [
      'Launch token',
      'Deep link',
      'PendingLaunch',
      'Reidratacao',
      'Task run'
    ]
  },
  {
    name: 'Sprint 3',
    focus: 'Operacao no VS Code',
    items: [
      'Painel da task',
      'Copy prompt',
      'Update status',
      'Report final',
      'Avisos de Git'
    ]
  },
  {
    name: 'Sprint 4',
    focus: 'Sala dos Programadores no SagB',
    items: [
      'Lista de tasks',
      'Detalhes da task',
      'Abrir no VS Code',
      'Historico tecnico'
    ]
  }
];

export const bridgeAgentChecklist = [
  'Implementar backend SagB conforme os contratos canonicos.',
  'Implementar bootstrap da extensao grupob.sagb-bridge.',
  'Salvar token apenas em SecretStorage.',
  'Nao usar taskId puro como desenho final da URI.',
  'Nao depender de variaveis em memoria apos openFolder.',
  'Implementar pendingLaunch, task runs e painel da task.',
  'Fechar o ciclo Sala dos Programadores -> VS Code -> devolutiva.'
];

export const masterBriefMarkdown = `# SagB Bridge

## Formula operacional
- SagB = sala de comando
- VS Code = base operacional
- SagB Bridge = ponte oficial
- Codex = operador assistido dentro do VS Code

## Resultado esperado da V1
- abrir task no VS Code
- resolver o projeto local
- abrir arquivos iniciais
- copiar prompt-base
- criar ou retomar task run
- sincronizar status
- enviar resumo final

## Decisoes imutaveis
- nao embutir o VS Code completo no SagB
- usar launchToken temporario no deep link
- usar binding local por projectSlug
- persistir pendingLaunch antes de openFolder
- guardar token apenas em SecretStorage
- nao controlar visualmente o Codex na V1

## Definicao de pronto
- clique em Abrir no VS Code abre projeto, task e contexto corretos
- run e criada ou retomada sem duplicidade indevida
- status e report final voltam para o SagB
- erros principais possuem UX clara`;
