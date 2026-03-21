import { Agent } from '../types';

type GovernanceContext = {
  constitution?: string;
  context?: string;
  compliance?: string;
};

const clean = (value?: string | null) => String(value || '').trim();

export const resolveAgentBasePrompt = (agent?: Partial<Agent> | null): string => {
  if (!agent) return '';
  return clean(agent.effectivePrompt) || clean(agent.dnaIndividualPrompt) || clean(agent.fullPrompt);
};

export const composeEffectivePrompt = (
  basePrompt: string,
  governance?: GovernanceContext
): string => {
  const sections = [clean(basePrompt)];
  const constitution = clean(governance?.constitution);
  const compliance = clean(governance?.compliance);
  const context = clean(governance?.context);

  if (constitution) sections.push(`[CONSTITUICAO GLOBAL]\n${constitution}`);
  if (compliance) sections.push(`[COMPLIANCE GLOBAL]\n${compliance}`);
  if (context) sections.push(`[CONTEXTO GLOBAL]\n${context}`);

  return sections.filter(Boolean).join('\n\n').trim();
};

export const resolveAgentInstruction = (
  agent?: Partial<Agent> | null,
  governance?: GovernanceContext
): string => {
  const base = resolveAgentBasePrompt(agent);
  if (!base) return composeEffectivePrompt('', governance);
  if (clean(agent?.effectivePrompt)) return clean(agent?.effectivePrompt);
  return composeEffectivePrompt(base, governance);
};
