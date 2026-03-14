import {
  Agent,
  AgentArtifact,
  AgentHandoff,
  AgentMission,
  AgentMissionStep,
  ModelProvider
} from '../types';
import { callAiProxy } from './aiProxy';
import {
  appendIntelligenceFlowStep,
  finalizeIntelligenceFlow,
  startIntelligenceFlow
} from './intelligenceFlow';
import {
  POC_MISSION_STAGE_BLUEPRINTS,
  assembleMissionStepContext
} from './contextAssembler';
import { createMissionArtifact, updateMissionArtifactStatus } from './artifactService';
import { validateStepOutput } from './stepValidator';
import {
  createMissionHandoff,
  patchMission,
  patchMissionStep
} from './missionService';

type RunMissionOrchestrationParams = {
  mission: AgentMission;
  steps: AgentMissionStep[];
  artifacts: AgentArtifact[];
  handoffs?: AgentHandoff[];
  agents: Agent[];
};

type ReprocessMissionStepParams = {
  mission: AgentMission;
  steps: AgentMissionStep[];
  artifacts: AgentArtifact[];
  handoffs?: AgentHandoff[];
  stepId: string;
  agents: Agent[];
};

const GEMINI_MODEL = 'gemini-2.5-flash';
const OPENAI_MODEL = 'gpt-4o-mini';
const DEEPSEEK_MODEL = 'deepseek-chat';
const CLAUDE_MODEL = 'claude-3-5-haiku-latest';
const QWEN_MODEL = 'qwen-plus';
const LLAMA_MODEL = 'llama3.1:8b';

const cloneMission = (mission: AgentMission): AgentMission => ({
  ...mission,
  createdAt: new Date(mission.createdAt),
  updatedAt: new Date(mission.updatedAt),
  startedAt: mission.startedAt ? new Date(mission.startedAt) : null,
  finishedAt: mission.finishedAt ? new Date(mission.finishedAt) : null,
  payload: mission.payload ? { ...mission.payload } : {}
});

const cloneStep = (step: AgentMissionStep): AgentMissionStep => ({
  ...step,
  createdAt: new Date(step.createdAt),
  updatedAt: new Date(step.updatedAt),
  startedAt: step.startedAt ? new Date(step.startedAt) : null,
  finishedAt: step.finishedAt ? new Date(step.finishedAt) : null,
  contextSnapshot: step.contextSnapshot ? { ...step.contextSnapshot } : null,
  payload: step.payload ? { ...step.payload } : {}
});

const toErrorMessage = (error: any) => String(error?.message || error?.details?.message || error || 'Falha desconhecida.');

const getLatestArtifactForStep = (artifacts: AgentArtifact[], stepId: string) => {
  return [...artifacts]
    .filter((artifact) => artifact.stepId === stepId)
    .sort((a, b) => {
      if (b.version !== a.version) return b.version - a.version;
      return b.createdAt.getTime() - a.createdAt.getTime();
    })[0] || null;
};

const getNextArtifactVersion = (artifacts: AgentArtifact[], stepId: string) => {
  const latest = getLatestArtifactForStep(artifacts, stepId);
  return latest ? latest.version + 1 : 1;
};

const invokeMissionAgent = async ({
  provider,
  systemInstruction,
  message
}: {
  provider: ModelProvider;
  systemInstruction: string;
  message: string;
}): Promise<string> => {
  if (provider === 'deepseek') {
    const response = await callAiProxy<{ text: string }>('deepseek_chat', {
      model: DEEPSEEK_MODEL,
      systemInstruction,
      messages: [{ role: 'user', content: message }],
      temperature: 0.2,
      maxTokens: 1800
    });
    return response.text || '';
  }

  if (provider === 'openai') {
    const response = await callAiProxy<{ text: string }>('openai_chat', {
      model: OPENAI_MODEL,
      systemInstruction,
      messages: [{ role: 'user', content: message }],
      temperature: 0.2,
      maxTokens: 1800
    });
    return response.text || '';
  }

  if (provider === 'claude') {
    const response = await callAiProxy<{ text: string }>('claude_chat', {
      model: CLAUDE_MODEL,
      systemInstruction,
      messages: [{ role: 'user', content: message }],
      temperature: 0.2,
      maxTokens: 1800
    });
    return response.text || '';
  }

  if (provider === 'qwen') {
    const response = await callAiProxy<{ text: string }>('qwen_chat', {
      model: QWEN_MODEL,
      systemInstruction,
      messages: [{ role: 'user', content: message }],
      temperature: 0.2,
      maxTokens: 1800
    });
    return response.text || '';
  }

  if (provider === 'llama_local') {
    const response = await callAiProxy<{ text: string }>('llama_local_chat', {
      model: LLAMA_MODEL,
      systemInstruction,
      messages: [{ role: 'user', content: message }],
      temperature: 0.2,
      maxTokens: 1800
    });
    return response.text || '';
  }

  const response = await callAiProxy<{ text: string }>('gemini_chat', {
    modelId: GEMINI_MODEL,
    systemInstruction,
    message,
    temperature: 0.2
  });
  return response.text || '';
};

const getFlowParticipants = (steps: AgentMissionStep[]) => {
  return Array.from(new Set(steps.map((step) => step.agentName).filter(Boolean)));
};

const ensureMissionFlowId = async (mission: AgentMission, steps: AgentMissionStep[]) => {
  const existingFlowId = mission.payload?.intelligenceFlowId;
  if (existingFlowId) return existingFlowId as string;

  const flowId = await startIntelligenceFlow({
    workspaceId: mission.workspaceId,
    executionRunId: mission.id,
    flowType: 'agent_orchestration',
    sourceKind: 'operation',
    sourceId: mission.id,
    origin: mission.title,
    participants: getFlowParticipants(steps),
    finalAction: 'Missao iniciada',
    status: 'running',
    payload: {
      module: 'agent_missions_poc'
    }
  });

  const nextPayload = {
    ...(mission.payload || {}),
    intelligenceFlowId: flowId
  };
  await patchMission({
    missionId: mission.id,
    patch: { payload: nextPayload }
  });
  mission.payload = nextPayload;
  return flowId;
};

const failMission = async ({
  mission,
  step,
  flowId,
  message
}: {
  mission: AgentMission;
  step: AgentMissionStep;
  flowId: string;
  message: string;
}) => {
  const now = new Date();
  await patchMissionStep({
    stepId: step.id,
    patch: {
      status: 'failed',
      validationStatus: 'failed',
      errorMessage: message,
      finishedAt: now
    }
  });
  await patchMission({
    missionId: mission.id,
    patch: {
      status: 'failed',
      currentStepIndex: step.stepIndex,
      finishedAt: now
    }
  });
  await appendIntelligenceFlowStep({
    flowId,
    workspaceId: mission.workspaceId,
    stepOrder: step.stepIndex * 10 + 3,
    actorType: 'system',
    actorName: 'Mission Runner',
    actionType: 'error',
    status: 'error',
    note: `${step.stepName}: ${message}`,
    payload: {
      missionId: mission.id,
      missionStepId: step.id
    }
  });
  await finalizeIntelligenceFlow({
    flowId,
    flowType: 'agent_orchestration',
    finalAction: `Falha na etapa ${step.stepIndex}`,
    status: 'error',
    participants: getFlowParticipants([step])
  });
};

export const runMissionOrchestration = async ({
  mission,
  steps,
  artifacts,
  agents
}: RunMissionOrchestrationParams) => {
  const liveMission = cloneMission(mission);
  const liveSteps = [...steps].map(cloneStep).sort((a, b) => a.stepIndex - b.stepIndex);
  const liveArtifacts = [...artifacts];
  const flowId = await ensureMissionFlowId(liveMission, liveSteps);

  const firstPendingStep = liveSteps.find((step) => step.status !== 'completed');
  if (!firstPendingStep) {
    return;
  }

  const missionStartedAt = liveMission.startedAt || new Date();
  await patchMission({
    missionId: liveMission.id,
    patch: {
      status: 'running',
      startedAt: missionStartedAt,
      currentStepIndex: firstPendingStep.stepIndex
    }
  });

  for (let index = 0; index < liveSteps.length; index += 1) {
    const step = liveSteps[index];
    if (step.status === 'completed') continue;

    const blueprint = POC_MISSION_STAGE_BLUEPRINTS.find((item) => item.stepIndex === step.stepIndex);
    if (!blueprint) {
      await failMission({
        mission: liveMission,
        step,
        flowId,
        message: `Blueprint nao encontrado para a etapa ${step.stepIndex}.`
      });
      return;
    }

    const now = new Date();
    const assembled = assembleMissionStepContext({
      mission: liveMission,
      step,
      blueprint,
      steps: liveSteps,
      artifacts: liveArtifacts,
      agents
    });

    await patchMission({
      missionId: liveMission.id,
      patch: {
        status: 'running',
        currentStepIndex: step.stepIndex
      }
    });
    await patchMissionStep({
      stepId: step.id,
      patch: {
        status: 'running',
        startedAt: now,
        finishedAt: null,
        errorMessage: null,
        promptSnapshot: assembled.systemInstruction,
        contextSnapshot: assembled.contextSnapshot,
        validationStatus: 'running',
        payload: {
          ...(step.payload || {}),
          agentRole: assembled.resolvedAgent.agentRole,
          agentSource: assembled.resolvedAgent.source,
          preferredModel: assembled.resolvedAgent.preferredModel
        }
      }
    });

    await appendIntelligenceFlowStep({
      flowId,
      workspaceId: liveMission.workspaceId,
      stepOrder: step.stepIndex * 10 + 1,
      actorType: 'agent',
      actorId: assembled.resolvedAgent.agentId,
      actorName: assembled.resolvedAgent.agentName,
      actionType: 'analysis',
      status: 'running',
      modelUsed: assembled.resolvedAgent.preferredModel,
      note: `Executando ${step.stepName}`,
      payload: {
        missionId: liveMission.id,
        missionStepId: step.id,
        artifactType: step.artifactType
      }
    });

    try {
      const rawText = await invokeMissionAgent({
        provider: assembled.resolvedAgent.preferredModel,
        systemInstruction: assembled.systemInstruction,
        message: assembled.message
      });

      const validation = validateStepOutput(blueprint, rawText);

      if (!validation.ok) {
        const rejectedArtifact = await createMissionArtifact({
          workspaceId: liveMission.workspaceId,
          missionId: liveMission.id,
          stepId: step.id,
          artifactType: step.artifactType,
          status: 'rejected',
          version: getNextArtifactVersion(liveArtifacts, step.id),
          contentJson: validation.normalizedJson,
          contentText: validation.contentText || rawText,
          createdByAgentId: assembled.resolvedAgent.agentId,
          payload: {
            issues: validation.issues,
            rawResponse: rawText
          }
        });
        liveArtifacts.push(rejectedArtifact);
        await failMission({
          mission: liveMission,
          step,
          flowId,
          message: validation.issues.join(' ')
        });
        return;
      }

      const artifact = await createMissionArtifact({
        workspaceId: liveMission.workspaceId,
        missionId: liveMission.id,
        stepId: step.id,
        artifactType: step.artifactType,
        status: 'created',
        version: getNextArtifactVersion(liveArtifacts, step.id),
        contentJson: validation.normalizedJson,
        contentText: validation.contentText,
        createdByAgentId: assembled.resolvedAgent.agentId,
        payload: {
          source: 'mission_runner',
          agentName: assembled.resolvedAgent.agentName
        }
      });
      liveArtifacts.push({ ...artifact, status: 'validated' });
      await updateMissionArtifactStatus({
        artifactId: artifact.id,
        status: 'validated',
        payload: {
          source: 'mission_runner',
          validation: 'passed'
        }
      });

      const finishedAt = new Date();
      await patchMissionStep({
        stepId: step.id,
        patch: {
          status: 'completed',
          validationStatus: 'validated',
          errorMessage: null,
          finishedAt,
          payload: {
            ...(step.payload || {}),
            outputArtifactId: artifact.id,
            artifactVersion: artifact.version,
            lastRawResponse: rawText
          }
        }
      });

      await appendIntelligenceFlowStep({
        flowId,
        workspaceId: liveMission.workspaceId,
        stepOrder: step.stepIndex * 10 + 2,
        actorType: 'agent',
        actorId: assembled.resolvedAgent.agentId,
        actorName: assembled.resolvedAgent.agentName,
        actionType: 'synthesis',
        status: 'ok',
        modelUsed: assembled.resolvedAgent.preferredModel,
        note: `${step.artifactType} validado`,
        payload: {
          missionId: liveMission.id,
          missionStepId: step.id,
          artifactId: artifact.id,
          artifactType: step.artifactType
        }
      });

      const nextStep = liveSteps[index + 1];
      if (nextStep) {
        await createMissionHandoff({
          workspaceId: liveMission.workspaceId,
          missionId: liveMission.id,
          fromStepId: step.id,
          toStepId: nextStep.id,
          fromAgentId: assembled.resolvedAgent.agentId,
          toAgentId: nextStep.agentId || null,
          artifactId: artifact.id,
          status: 'accepted',
          note: `${step.artifactType} entregue para ${nextStep.stepName}.`,
          payload: {
            fromStepIndex: step.stepIndex,
            toStepIndex: nextStep.stepIndex
          }
        });

        await patchMissionStep({
          stepId: nextStep.id,
          patch: {
            status: 'ready',
            errorMessage: null
          }
        });

        await appendIntelligenceFlowStep({
          flowId,
          workspaceId: liveMission.workspaceId,
          stepOrder: step.stepIndex * 10 + 4,
          actorType: 'system',
          actorName: 'Mission Runner',
          actionType: 'handoff',
          status: 'ok',
          note: `${step.stepName} -> ${nextStep.stepName}`,
          payload: {
            missionId: liveMission.id,
            fromStepId: step.id,
            toStepId: nextStep.id,
            artifactId: artifact.id
          }
        });

        nextStep.status = 'ready';
      }
    } catch (error: any) {
      await failMission({
        mission: liveMission,
        step,
        flowId,
        message: toErrorMessage(error)
      });
      return;
    }
  }

  const finishedAt = new Date();
  await patchMission({
    missionId: liveMission.id,
    patch: {
      status: 'completed',
      currentStepIndex: liveSteps.length,
      finishedAt
    }
  });
  await finalizeIntelligenceFlow({
    flowId,
    flowType: 'agent_orchestration',
    finalAction: 'Missao concluida',
    status: 'ok',
    participants: getFlowParticipants(liveSteps)
  });
};

export const reprocessMissionStep = async ({
  mission,
  steps,
  artifacts,
  stepId,
  agents
}: ReprocessMissionStepParams) => {
  const targetStep = steps.find((step) => step.id === stepId);
  if (!targetStep) {
    throw new Error('Etapa nao encontrada para reprocessamento.');
  }

  const orderedSteps = [...steps].sort((a, b) => a.stepIndex - b.stepIndex);
  const affectedSteps = orderedSteps.filter((step) => step.stepIndex >= targetStep.stepIndex);

  for (const step of affectedSteps) {
    await patchMissionStep({
      stepId: step.id,
      patch: {
        status: step.id === targetStep.id ? 'ready' : 'pending',
        validationStatus: null,
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
        retryCount: (step.retryCount || 0) + (step.id === targetStep.id ? 1 : 0)
      }
    });
  }

  await patchMission({
    missionId: mission.id,
    patch: {
      status: 'queued',
      currentStepIndex: targetStep.stepIndex,
      finishedAt: null
    }
  });

  const refreshedSteps = orderedSteps.map((step) => {
    if (step.stepIndex < targetStep.stepIndex) return step;
    return {
      ...step,
      status: step.id === targetStep.id ? 'ready' : 'pending',
      validationStatus: null,
      errorMessage: null,
      startedAt: null,
      finishedAt: null,
      retryCount: (step.retryCount || 0) + (step.id === targetStep.id ? 1 : 0)
    };
  });

  await runMissionOrchestration({
    mission: {
      ...mission,
      status: 'queued',
      currentStepIndex: targetStep.stepIndex,
      finishedAt: null
    },
    steps: refreshedSteps,
    artifacts,
    agents
  });
};
