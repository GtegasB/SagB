import {
  Agent,
  AgentArtifact,
  AgentMission,
  AgentMissionStep,
  ModelProvider
} from '../types';

export type PocArtifactType = 'requirements_brief' | 'product_scope' | 'technical_architecture';

export type PocStageBlueprint = {
  stepIndex: number;
  stepName: string;
  agentKey: string;
  defaultAgentId: string;
  defaultAgentName: string;
  defaultAgentRole: string;
  artifactType: PocArtifactType;
  requiredFields: string[];
  schemaExample: Record<string, any>;
  matcher: RegExp;
  fallbackPrompt: string;
};

export type ResolvedPocAgent = {
  agentId: string;
  agentName: string;
  agentRole: string;
  preferredModel: ModelProvider;
  fullPrompt: string;
  source: 'registered_agent' | 'poc_template';
};

type AssembleContextParams = {
  mission: AgentMission;
  step: AgentMissionStep;
  blueprint: PocStageBlueprint;
  steps: AgentMissionStep[];
  artifacts: AgentArtifact[];
  agents: Agent[];
};

const normalize = (value: string) => String(value || '').trim().toLowerCase();

const stringifyArtifact = (artifact?: AgentArtifact | null) => {
  if (!artifact) return 'Nenhum artifact anterior.';
  const json = artifact.contentJson && typeof artifact.contentJson === 'object'
    ? JSON.stringify(artifact.contentJson, null, 2)
    : '{}';
  return `Artifact anterior (${artifact.artifactType}, versao ${artifact.version}):\n${json}`;
};

export const POC_MISSION_STAGE_BLUEPRINTS: PocStageBlueprint[] = [
  {
    stepIndex: 1,
    stepName: 'Descoberta e Requisitos',
    agentKey: 'discovery',
    defaultAgentId: 'poc-discovery-template',
    defaultAgentName: 'Analista de Descoberta e Requisitos',
    defaultAgentRole: 'Organiza a ideia bruta, delimita problema, objetivos, restricoes e perguntas abertas.',
    artifactType: 'requirements_brief',
    requiredFields: [
      'problem_statement',
      'target_user',
      'business_goal',
      'functional_requirements',
      'constraints',
      'assumptions',
      'open_questions'
    ],
    schemaExample: {
      problem_statement: 'Resumo objetivo do problema.',
      target_user: 'Quem sera atendido.',
      business_goal: 'Resultado de negocio esperado.',
      functional_requirements: ['Requisito 1', 'Requisito 2'],
      constraints: ['Restricao 1'],
      assumptions: ['Assuncao 1'],
      open_questions: ['Pergunta 1']
    },
    matcher: /(descoberta|requisitos|analista)/i,
    fallbackPrompt: [
      'Voce e o Analista de Descoberta e Requisitos da POC do SagB.',
      'Sua funcao e transformar uma ideia bruta em um requirements_brief claro, estruturado e util para handoff.',
      'Nao invente funcionalidades desnecessarias. Organize o essencial com objetividade executiva.'
    ].join('\n')
  },
  {
    stepIndex: 2,
    stepName: 'Escopo e MVP',
    agentKey: 'product',
    defaultAgentId: 'poc-product-template',
    defaultAgentName: 'Estrategista de Produto',
    defaultAgentRole: 'Transforma requisitos em visao de produto, escopo de MVP, nao-escopo e metricas de sucesso.',
    artifactType: 'product_scope',
    requiredFields: [
      'product_vision',
      'mvp_scope',
      'non_goals',
      'success_metrics',
      'delivery_slices',
      'main_risks'
    ],
    schemaExample: {
      product_vision: 'Visao de produto em uma frase.',
      mvp_scope: ['Entrega 1', 'Entrega 2'],
      non_goals: ['Nao incluir item X agora'],
      success_metrics: ['Metrica 1'],
      delivery_slices: ['Slice 1'],
      main_risks: ['Risco 1']
    },
    matcher: /(produto|mvp|estrategista)/i,
    fallbackPrompt: [
      'Voce e o Estrategista de Produto da POC do SagB.',
      'Sua funcao e transformar o requirements_brief recebido em um product_scope objetivo, focado em MVP.',
      'Priorize clareza, foco e recorte. Evite inflar o escopo.'
    ].join('\n')
  },
  {
    stepIndex: 3,
    stepName: 'Arquitetura Tecnica Inicial',
    agentKey: 'architecture',
    defaultAgentId: 'poc-architecture-template',
    defaultAgentName: 'Arquiteto Tecnico',
    defaultAgentRole: 'Traduz escopo de produto em arquitetura tecnica inicial, entidades e fases de implementacao.',
    artifactType: 'technical_architecture',
    requiredFields: [
      'architecture_summary',
      'recommended_stack',
      'core_services',
      'data_entities',
      'initial_capabilities',
      'implementation_phases',
      'technical_risks'
    ],
    schemaExample: {
      architecture_summary: 'Resumo tecnico da solucao.',
      recommended_stack: ['Frontend', 'Backend', 'Banco'],
      core_services: ['Servico 1'],
      data_entities: ['Entidade 1'],
      initial_capabilities: ['Capacidade 1'],
      implementation_phases: ['Fase 1'],
      technical_risks: ['Risco tecnico 1']
    },
    matcher: /(arquitet|tecnico|software)/i,
    fallbackPrompt: [
      'Voce e o Arquiteto Tecnico da POC do SagB.',
      'Sua funcao e transformar o escopo do produto em uma arquitetura tecnica inicial.',
      'Seja pragmatico, modular e orientado a implementacao incremental.'
    ].join('\n')
  }
];

const getLatestArtifactForStep = (artifacts: AgentArtifact[], stepId: string) => {
  return [...artifacts]
    .filter((artifact) => artifact.stepId === stepId)
    .sort((a, b) => {
      if (b.version !== a.version) return b.version - a.version;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })[0] || null;
};

export const resolvePocAgentForBlueprint = (
  agents: Agent[],
  blueprint: PocStageBlueprint
): ResolvedPocAgent => {
  const resolvedAgent = agents.find((agent) => {
    const haystack = [
      agent.name,
      agent.officialRole,
      agent.shortDescription,
      agent.area,
      agent.functionName
    ]
      .map((value) => normalize(String(value || '')))
      .join(' ');
    return blueprint.matcher.test(haystack);
  });

  if (!resolvedAgent) {
    return {
      agentId: blueprint.defaultAgentId,
      agentName: blueprint.defaultAgentName,
      agentRole: blueprint.defaultAgentRole,
      preferredModel: 'gemini',
      fullPrompt: blueprint.fallbackPrompt,
      source: 'poc_template'
    };
  }

  return {
    agentId: resolvedAgent.id,
    agentName: resolvedAgent.name,
    agentRole: resolvedAgent.officialRole || blueprint.defaultAgentRole,
    preferredModel: (resolvedAgent.preferredModel || resolvedAgent.modelProvider || 'gemini') as ModelProvider,
    fullPrompt: resolvedAgent.fullPrompt || blueprint.fallbackPrompt,
    source: 'registered_agent'
  };
};

export const assembleMissionStepContext = ({
  mission,
  step,
  blueprint,
  steps,
  artifacts,
  agents
}: AssembleContextParams) => {
  const resolvedAgent = resolvePocAgentForBlueprint(agents, blueprint);
  const previousStep = steps.find((item) => item.stepIndex === step.stepIndex - 1) || null;
  const previousArtifact = previousStep ? getLatestArtifactForStep(artifacts, previousStep.id) : null;
  const objectiveLine = step.stepIndex === 1
    ? `Input inicial da missao:\n${mission.initialInput}`
    : stringifyArtifact(previousArtifact);

  const systemInstruction = [
    resolvedAgent.fullPrompt,
    '',
    `[MISSAO]: ${mission.title}`,
    '[PROTOCOLO DA POC DE ORQUESTRACAO]:',
    `- Esta e a etapa ${step.stepIndex} de 3.`,
    `- Seu output oficial deve ser um JSON valido do tipo ${blueprint.artifactType}.`,
    '- Nao escreva introducao, comentario ou markdown fora do JSON.',
    '- Responda apenas com um objeto JSON.',
    `- Campos obrigatorios: ${blueprint.requiredFields.join(', ')}.`
  ].join('\n');

  const message = [
    `Voce esta executando a etapa "${blueprint.stepName}".`,
    objectiveLine,
    '',
    'Retorne apenas um JSON valido seguindo exatamente esta estrutura base:',
    JSON.stringify(blueprint.schemaExample, null, 2)
  ].join('\n');

  return {
    resolvedAgent,
    systemInstruction,
    message,
    contextSnapshot: {
      missionTitle: mission.title,
      stepIndex: step.stepIndex,
      stepName: blueprint.stepName,
      artifactType: blueprint.artifactType,
      sourceAgent: resolvedAgent.source,
      previousArtifactId: previousArtifact?.id || null,
      previousArtifactType: previousArtifact?.artifactType || null,
      requiredFields: blueprint.requiredFields
    }
  };
};
