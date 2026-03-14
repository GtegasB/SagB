import { addDoc, collection, db, doc, updateDoc } from './supabase';
import { AgentArtifact, AgentArtifactStatus } from '../types';
import { resolveWorkspaceId } from '../utils/supabaseChat';

type CreateMissionArtifactParams = {
  workspaceId?: string | null;
  missionId: string;
  stepId: string;
  artifactType: string;
  status: AgentArtifactStatus;
  version: number;
  contentJson?: Record<string, any> | null;
  contentText?: string | null;
  createdByAgentId?: string | null;
  payload?: Record<string, any>;
};

type UpdateMissionArtifactStatusParams = {
  artifactId: string;
  status: AgentArtifactStatus;
  payload?: Record<string, any>;
};

const toDate = (value: any) => {
  if (value instanceof Date) return value;
  const parsed = new Date(value || Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export const createMissionArtifact = async ({
  workspaceId,
  missionId,
  stepId,
  artifactType,
  status,
  version,
  contentJson,
  contentText,
  createdByAgentId,
  payload
}: CreateMissionArtifactParams): Promise<AgentArtifact> => {
  const now = new Date();
  const created = await addDoc(collection(db, 'agent_artifacts'), {
    workspaceId: resolveWorkspaceId(workspaceId),
    missionId,
    stepId,
    artifactType,
    status,
    version,
    contentJson: contentJson || null,
    contentText: contentText || null,
    createdByAgentId: createdByAgentId || null,
    createdAt: now,
    payload: payload || {}
  });

  return {
    id: created.id,
    workspaceId: resolveWorkspaceId(workspaceId),
    missionId,
    stepId,
    artifactType,
    status,
    version,
    contentJson: contentJson || null,
    contentText: contentText || null,
    createdByAgentId: createdByAgentId || null,
    createdAt: toDate(now),
    payload: payload || {}
  };
};

export const updateMissionArtifactStatus = async ({
  artifactId,
  status,
  payload
}: UpdateMissionArtifactStatusParams) => {
  await updateDoc(doc(db, 'agent_artifacts', artifactId), {
    status,
    ...(payload ? { payload } : {})
  });
};
