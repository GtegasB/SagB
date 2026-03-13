export interface RadarMetric {
  label: string;
  value: string;
  note: string;
}

export interface RadarBlock {
  title: string;
  items: string[];
}

export interface RadarCard {
  title: string;
  summary: string;
  items: string[];
}

export const radarMetrics: RadarMetric[] = [
  {
    label: 'Tese Central',
    value: 'Inteligencia de Ecossistema',
    note: 'Entender o que existe, o que conecta e o que o mundo sinaliza'
  },
  {
    label: 'Triade Mestra',
    value: 'Dentro / Entre / Fora',
    note: 'Portifolio, conexoes internas e sinais externos'
  },
  {
    label: 'Ambicao',
    value: 'Sistema Operacional Estrategico',
    note: 'Nao so organizar projetos, mas gerar movimento a partir deles'
  }
];

export const radarReading = [
  'O documento-base mostra que o NAGI precisa deixar de ser apenas um hub de cards e se tornar um nucleo vivo de descoberta, associacao e antecipacao.',
  'A espinha dorsal do projeto e a uniao entre Radar de Conexoes, Radar Externo e uma camada de distribuicao que transforma descoberta em acao.',
  'A tese real e que o ecossistema deve conseguir ler seu proprio portifolio, suas relacoes internas e os sinais do mundo em um mesmo sistema.'
];

export const radarAlreadyDefined: RadarBlock[] = [
  {
    title: 'Frentes ja definidas no documento-base',
    items: [
      'Radar de Conexoes',
      'Radar Externo',
      'Central de Distribuicao de Insights como terceira camada conceitual'
    ]
  },
  {
    title: 'Funcoes ja claras',
    items: [
      'Detectar sinergias, subprodutos, redundancias e linhas-mae',
      'Observar noticias, jurisprudencia, IA, mercado e sinais fracos',
      'Distribuir sinais para marketing, conteudo, produto, juridico e outras frentes'
    ]
  },
  {
    title: 'Relacoes semanticas ja sugeridas',
    items: [
      'deriva de',
      'usa a mesma base',
      'compartilha modulo',
      'alimenta',
      'depende de',
      'pode virar spin-off',
      'e versao comercial de'
    ]
  }
];

export const radarSuggested: RadarBlock[] = [
  {
    title: 'Direcoes fortes ainda pouco aprofundadas',
    items: [
      'Ontologia formal do ecossistema',
      'Separacao entre ideia, projeto, modulo, insight, oportunidade e metaprojeto',
      'Motor de priorizacao e score',
      'Fluxo que converte insight em acao, projeto ou produto',
      'Memoria historica de decisoes e distribuicoes'
    ]
  },
  {
    title: 'Partes implicitas no texto original',
    items: [
      'Governanca operacional da distribuicao',
      'Aprendizado do sistema com o que foi aprovado ou descartado',
      'Produto potencial para fora do ecossistema',
      'Modelo de dados relacional e de grafo'
    ]
  }
];

export const radarExpansions: RadarCard[] = [
  {
    title: 'Camada de Ontologia do Ecossistema',
    summary: 'Faz o sistema parar de tratar tudo como card e passar a trabalhar com tipos reais de entidade.',
    items: [
      'ideia',
      'iniciativa',
      'projeto',
      'modulo',
      'ativo reutilizavel',
      'metaprojeto',
      'insight',
      'oportunidade',
      'ameaca'
    ]
  },
  {
    title: 'Motor de Tese e Oportunidade',
    summary: 'Transforma conexoes e sinais em teses concretas de expansao.',
    items: [
      'formula hipoteses de nova frente',
      'liga sinais externos a bases tecnicas existentes',
      'aponta marcas candidatas',
      'sugere se algo deve nascer como projeto, spin-off ou linha'
    ]
  },
  {
    title: 'Mesa de Decisao do Ecossistema',
    summary: 'Impede que os insights fiquem soltos e cria um caminho real de aprovacao e incubacao.',
    items: [
      'observado',
      'em analise',
      'incubado',
      'aprovado',
      'descartado',
      'convertido em projeto'
    ]
  },
  {
    title: 'Base de Ativos Reutilizaveis',
    summary: 'Separa infraestrutura, pipelines e componentes transversais dos projetos em si.',
    items: [
      'pipelines tecnicos',
      'componentes de captura',
      'componentes de chunking',
      'componentes de classificacao',
      'ativos editoriais',
      'ativos analiticos'
    ]
  }
];

export const radarIncorporated = [
  'O Radar de Conexoes passa a ser motor de modelagem estrutural do ecossistema.',
  'O Radar Externo passa a ser sistema de vigilancia estrategica e nao apenas leitor tematico.',
  'A Central de Distribuicao vira camada operacional de roteamento com destino, prioridade e rastreabilidade.',
  'Mesa de Decisao, Base de Ativos Reutilizaveis e Memoria Estrategica passam a fazer parte do projeto ampliado.'
];

export const radarStructure: RadarBlock[] = [
  {
    title: 'Modulos principais',
    items: [
      'NAGI Core',
      'Radar de Conexoes',
      'Radar Externo',
      'Central de Distribuicao de Insights',
      'Mesa de Decisao',
      'Base de Ativos Reutilizaveis',
      'Memoria Estrategica',
      'Painel de Metaprojetos'
    ]
  },
  {
    title: 'Camadas',
    items: [
      'estrutural',
      'semantica',
      'estrategica',
      'operacional',
      'historica',
      'emergente'
    ]
  },
  {
    title: 'Entidades centrais',
    items: [
      'ideia',
      'projeto',
      'modulo',
      'ativo reutilizavel',
      'linha estrategica',
      'metaprojeto',
      'insight',
      'sinal externo',
      'oportunidade',
      'ameaca',
      'decisao',
      'distribuicao'
    ]
  }
];

export const radarImplementation: RadarCard[] = [
  {
    title: 'O que implementar primeiro',
    summary: 'Base minima para nao nascer como feed sem estrutura.',
    items: [
      'ontologia minima',
      'novos campos ricos nos projetos',
      'relacoes manuais semanticas',
      'Radar de Conexoes V1',
      'Radar Externo V1',
      'distribuicao manual assistida'
    ]
  },
  {
    title: 'Segunda camada',
    summary: 'A partir da base, o sistema comeca a raciocinar melhor.',
    items: [
      'score de conexao',
      'score de relevancia externa',
      'deteccao de redundancia',
      'subproduto e spin-off',
      'fila de decisao',
      'memoria de decisoes'
    ]
  },
  {
    title: 'Preparar para depois',
    summary: 'Capacidades fortes que nao devem puxar a V1 para o caos.',
    items: [
      'sinais fracos sofisticados',
      'roteamento automatico',
      'simulacao de portifolio',
      'produto externo',
      'monetizacao por vertical'
    ]
  }
];

export const radarArchitecture = [
  'Produto: plataforma de inteligencia de portifolio.',
  'Experiencia: fazer o usuario enxergar o que existe, o que conecta, o que emerge e para onde cada sinal deve ir.',
  'Sistema: arquitetura orientada a grafo, classificacao, pipeline externo e memoria historica.',
  'Fluxo macro: captar -> classificar -> conectar -> priorizar -> distribuir -> decidir -> aprender.',
  'Escalabilidade: depende de ontologia clara, entidades separadas e rastreabilidade.'
];

export const radarProducts = [
  'Plataforma de inteligencia de portifolio para grupos empresariais.',
  'Radar juridico setorial.',
  'Radar de IA e tecnologia.',
  'Motor de distribuicao de insights para operacao e conteudo.',
  'Sistema de genealogia de projetos e detecao de spin-offs.',
  'Observatorio estrategico de mercado e oportunidades.'
];

export const radarRisks: RadarCard[] = [
  {
    title: 'Riscos de arquitetura',
    summary: 'Os mais perigosos sao os que parecem organizacao, mas destroem a inteligencia do sistema.',
    items: [
      'tudo virar card',
      'relacoes virarem apenas tags',
      'mistura de entidades',
      'falta de historico de decisao'
    ]
  },
  {
    title: 'Riscos de produto',
    summary: 'O sistema pode parecer impressionante e ainda assim nao gerar movimento.',
    items: [
      'virar feed sem acao',
      'gerar excesso de insights sem priorizacao',
      'prometer automacao antes da base estar pronta'
    ]
  },
  {
    title: 'Decisoes criticas',
    summary: 'Essas definicoes precisam acontecer cedo para evitar bagunca depois.',
    items: [
      'ontologia oficial',
      'tipos de relacao',
      'criterios de score',
      'criterios de distribuicao',
      'criterios de aprovacao e descarte'
    ]
  }
];

export const radarBlueprintFinal = [
  'O NAGI deixa de ser area de organizacao e passa a ser sistema de inteligencia estrategica de ecossistema.',
  'O Radar de Conexoes modela o que existe, o que conecta e o que pode emergir como linha maior.',
  'O Radar Externo vigia o mundo e converte sinal em combustivel para o ecossistema.',
  'A Central de Distribuicao e a Mesa de Decisao garantem que inteligencia vire movimento e nao apenas leitura.'
];

export const radarChecklist = [
  'Definir ontologia oficial do ecossistema.',
  'Definir entidades e tipos de relacao.',
  'Adicionar campos ricos nos projetos do NAGI.',
  'Criar Radar de Conexoes V1.',
  'Criar Radar Externo V1.',
  'Criar Central de Distribuicao.',
  'Criar fila de decisao.',
  'Criar memoria de sinais e decisoes.',
  'Criar base de ativos reutilizaveis.',
  'Criar painel de metaprojetos.',
  'Definir metricas de uso, conversao e impacto.'
];
