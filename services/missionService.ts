import {
  addDoc,
  collection,
  db,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where
} from './supabase';
import {
  Agent,
  AgentArtifact,
  AgentHandoff,
  AgentMission,
  AgentMissionStep
} from '../types';
import {
  POC_MISSION_STAGE_BLUEPRINTS,
  resolvePocAgentForBlueprint
} from './contextAssembler';
import { resolveWorkspaceId } from '../utils/supabaseChat';

type CreateMissionParams = {
  workspaceId?: string | null;
  title?: string;
  initialInput: string;
  createdBy?: string | null;
  agents: Agent[];
};

type PatchMissionParams = {
  missionId: string;
  patch: Partial<AgentMission>;
};

type PatchMissionStepParams = {
  stepId: string;
  patch: Partial<AgentMissionStep>;
};

type CreateMissionHandoffParams = {
  workspaceId?: string | null;
  missionId: string;
  fromStepId: string;
  toStepId?: string | null;
  fromAgentId?: string | null;
  toAgentId?: string | null;
  artifactId?: string | null;
  status: AgentHandoff['status'];
  note?: string | null;
  payload?: Record<string, any>;
};

export type MissionBundle = {
  mission: AgentMission | null;
  steps: AgentMissionStep[];
  artifacts: AgentArtifact[];
  handoffs: AgentHandoff[];
};

const toDate = (value: any): Date => {
  if (value instanceof Date) return value;
  const parsed = new Date(value || Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const createMissionTitle = (initialInput: string) => {
  const clean = String(initialInput || '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'Missao de Orquestracao';
  const short = clean.length > 72 ? `${clean.slice(0, 72).trim()}...` : clean;
  return `Missao | ${short}`;
};

const runOnce = <T,>(ref: any, mapper: (snapshot: any) => T, fallback: T): Promise<T> => {
  return new Promise((resolve) => {
    let settled = false;
    let unsubscribe = () => undefined;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      resolve(fallback);
    }, 7000);

    unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        unsubscribe();
        resolve(mapper(snapshot));
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        unsubscribe();
        resolve(fallback);
      }
    );
  });
};

export const createMissionWithSteps = async ({
  workspaceId,
  title,
  initialInput,
  createdBy,
  agents
}: CreateMissionParams): Promise<{ mission: AgentMission; steps: AgentMissionStep[] }> => {
  const scopedWorkspaceId = resolveWorkspaceId(workspaceId);
  const now = new Date();
  const missionRef = await addDoc(collection(db, 'agent_missions'), {
    workspaceId: scopedWorkspaceId,
    title: title || createMissionTitle(initialInput),
    initialInput,
    status: 'queued',
    currentStepIndex: 1,
    createdBy: createdBy || null,
    startedAt: null,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
    payload: {
      missionType: 'poc_three_agents',
      stageCount: POC_MISSION_STAGE_BLUEPRINTS.length
    }
  });

  const mission: AgentMission = {
    id: missionRef.id,
    workspaceId: scopedWorkspaceId,
    title: title || createMissionTitle(initialInput),
    initialInput,
    status: 'queued',
    currentStepIndex: 1,
    createdBy: createdBy || null,
    startedAt: null,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
    payload: {
      missionType: 'poc_three_agents',
      stageCount: POC_MISSION_STAGE_BLUEPRINTS.length
    }
  };

  const steps = await Promise.all(
    POC_MISSION_STAGE_BLUEPRINTS.map(async (blueprint) => {
      const resolvedAgent = resolvePocAgentForBlueprint(agents, blueprint);
      const stepNow = new Date();
      const status = blueprint.stepIndex === 1 ? 'ready' : 'pending';
      const stepRef = await addDoc(collection(db, 'agent_mission_steps'), {
        workspaceId: scopedWorkspaceId,
        missionId: mission.id,
        stepIndex: blueprint.stepIndex,
        agentId: resolvedAgent.agentId,
        agentName: resolvedAgent.agentName,
        stepName: blueprint.stepName,
        artifactType: blueprint.artifactType,
        status,
        validationStatus: null,
        retryCount: 0,
        promptSnapshot: null,
        contextSnapshot: null,
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: stepNow,
        updatedAt: stepNow,
        payload: {
          agentRole: resolvedAgent.agentRole,
          agentSource: resolvedAgent.source,
          preferredModel: resolvedAgent.preferredModel
        }
      });

      return {
        id: stepRef.id,
        workspaceId: scopedWorkspaceId,
        missionId: mission.id,
        stepIndex: blueprint.stepIndex,
        agentId: resolvedAgent.agentId,
        agentName: resolvedAgent.agentName,
        stepName: blueprint.stepName,
        artifactType: blueprint.artifactType,
        status,
        validationStatus: null,
        retryCount: 0,
        promptSnapshot: null,
        contextSnapshot: null,
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: stepNow,
        updatedAt: stepNow,
        payload: {
          agentRole: resolvedAgent.agentRole,
          agentSource: resolvedAgent.source,
          preferredModel: resolvedAgent.preferredModel
        }
      } as AgentMissionStep;
    })
  );

  return { mission, steps };
};

export const patchMission = async ({ missionId, patch }: PatchMissionParams) => {
  await updateDoc(doc(db, 'agent_missions', missionId), {
    ...patch,
    updatedAt: new Date()
  });
};

export const patchMissionStep = async ({ stepId, patch }: PatchMissionStepParams) => {
  await updateDoc(doc(db, 'agent_mission_steps', stepId), {
    ...patch,
    updatedAt: new Date()
  });
};

export const createMissionHandoff = async ({
  workspaceId,
  missionId,
  fromStepId,
  toStepId,
  fromAgentId,
  toAgentId,
  artifactId,
  status,
  note,
  payload
}: CreateMissionHandoffParams): Promise<AgentHandoff> => {
  const createdAt = new Date();
  const ref = await addDoc(collection(db, 'agent_handoffs'), {
    workspaceId: resolveWorkspaceId(workspaceId),
    missionId,
    fromStepId,
    toStepId: toStepId || null,
    fromAgentId: fromAgentId || null,
    toAgentId: toAgentId || null,
    artifactId: artifactId || null,
    status,
    note: note || null,
    createdAt,
    acceptedAt: status === 'accepted' ? createdAt : null,
    payload: payload || {}
  });

  return {
    id: ref.id,
    workspaceId: resolveWorkspaceId(workspaceId),
    missionId,
    fromStepId,
    toStepId: toStepId || null,
    fromAgentId: fromAgentId || null,
    toAgentId: toAgentId || null,
    artifactId: artifactId || null,
    status,
    note: note || null,
    createdAt,
    acceptedAt: status === 'accepted' ? createdAt : null,
    payload: payload || {}
  };
};

export const loadMissionBundle = async ({
  workspaceId,
  missionId
}: {
  workspaceId?: string | null;
  missionId: string;
}): Promise<MissionBundle> => {
  const scopedWorkspaceId = resolveWorkspaceId(workspaceId);
  const missionQuery = query(
    collection(db, 'agent_missions'),
    where('workspaceId', '==', scopedWorkspaceId),
    where('id', '==', missionId),
    orderBy('createdAt', 'desc')
  );
  const stepsQuery = query(
    collection(db, 'agent_mission_steps'),
    where('workspaceId', '==', scopedWorkspaceId),
    where('missionId', '==', missionId),
    orderBy('stepIndex', 'asc')
  );
  const artifactsQuery = query(
    collection(db, 'agent_artifacts'),
    where('workspaceId', '==', scopedWorkspaceId),
    where('missionId', '==', missionId),
    orderBy('createdAt', 'asc')
  );
  const handoffsQuery = query(
    collection(db, 'agent_handoffs'),
    where('workspaceId', '==', scopedWorkspaceId),
    where('missionId', '==', missionId),
    orderBy('createdAt', 'asc')
  );

  const [mission, steps, artifacts, handoffs] = await Promise.all([
    runOnce(
      missionQuery,
      (snapshot) => {
        const row = snapshot.docs[0];
        if (!row) return null;
        const data = row.data() as any;
        return {
          id: String(data.id || row.id),
          workspaceId: String(data.workspaceId || scopedWorkspaceId),
          title: String(data.title || 'Missao'),
          initialInput: String(data.initialInput || ''),
          status: data.status || 'queued',
          currentStepIndex: Number(data.currentStepIndex || 1),
          createdBy: data.createdBy || null,
          startedAt: data.startedAt ? toDate(data.startedAt) : null,
          finishedAt: data.finishedAt ? toDate(data.finishedAt) : null,
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
          payload: data.payload || {}
        } as AgentMission;
      },
      null
    ),
    runOnce(
      stepsQuery,
      (snapshot) => snapshot.docs.map((row: any) => {
        const data = row.data() as any;
        return {
          id: String(data.id || row.id),
          workspaceId: String(data.workspaceId || scopedWorkspaceId),
          missionId: String(data.missionId || missionId),
          stepIndex: Number(data.stepIndex || 0),
          agentId: data.agentId || null,
          agentName: String(data.agentName || 'Agente'),
          stepName: String(data.stepName || 'Etapa'),
          artifactType: String(data.artifactType || 'artifact'),
          status: data.status || 'pending',
          validationStatus: data.validationStatus || null,
          retryCount: Number(data.retryCount || 0),
          promptSnapshot: data.promptSnapshot || null,
          contextSnapshot: data.contextSnapshot || null,
          errorMessage: data.errorMessage || null,
          startedAt: data.startedAt ? toDate(data.startedAt) : null,
          finishedAt: data.finishedAt ? toDate(data.finishedAt) : null,
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
          payload: data.payload || {}
        } as AgentMissionStep;
      }),
      []
    ),
    runOnce(
      artifactsQuery,
      (snapshot) => snapshot.docs.map((row: any) => {
        const data = row.data() as any;
        return {
          id: String(data.id || row.id),
          workspaceId: String(data.workspaceId || scopedWorkspaceId),
          missionId: String(data.missionId || missionId),
          stepId: String(data.stepId || ''),
          artifactType: String(data.artifactType || 'artifact'),
          status: data.status || 'created',
          version: Number(data.version || 1),
          contentJson: data.contentJson || null,
          contentText: data.contentText || null,
          createdByAgentId: data.createdByAgentId || null,
          createdAt: toDate(data.createdAt),
          payload: data.payload || {}
        } as AgentArtifact;
      }),
      []
    ),
    runOnce(
      handoffsQuery,
      (snapshot) => snapshot.docs.map((row: any) => {
        const data = row.data() as any;
        return {
          id: String(data.id || row.id),
          workspaceId: String(data.workspaceId || scopedWorkspaceId),
          missionId: String(data.missionId || missionId),
          fromStepId: String(data.fromStepId || ''),
          toStepId: data.toStepId || null,
          fromAgentId: data.fromAgentId || null,
          toAgentId: data.toAgentId || null,
          artifactId: data.artifactId || null,
          status: data.status || 'created',
          note: data.note || null,
          createdAt: toDate(data.createdAt),
          acceptedAt: data.acceptedAt ? toDate(data.acceptedAt) : null,
          payload: data.payload || {}
        } as AgentHandoff;
      }),
      []
    )
  ]);

  return { mission, steps, artifacts, handoffs };
};
