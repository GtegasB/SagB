import { PocStageBlueprint } from './contextAssembler';

type ValidationResult = {
  ok: boolean;
  normalizedJson: Record<string, any> | null;
  contentText: string;
  issues: string[];
};

const tryParseJson = (value: string): Record<string, any> | null => {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const extractJsonCandidate = (rawText: string): string => {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return '';

  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/```\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) return fencedMatch[1].trim();

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
  }

  return trimmed;
};

const normalizeFieldValue = (key: string, value: any) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (key.endsWith('s') || key.includes('scope') || key.includes('metrics') || key.includes('risks') || key.includes('phases') || key.includes('requirements') || key.includes('capabilities') || key.includes('entities')) {
      return trimmed ? [trimmed] : [];
    }
    return trimmed;
  }

  if (value === null || value === undefined) {
    return key.endsWith('s') ? [] : '';
  }

  return value;
};

const buildContentText = (json: Record<string, any>) => {
  return Object.entries(json)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        const items = value.map((item) => `- ${String(item)}`).join('\n');
        return `${key}:\n${items}`;
      }
      return `${key}: ${String(value || '')}`;
    })
    .join('\n\n')
    .trim();
};

export const validateStepOutput = (
  blueprint: PocStageBlueprint,
  rawText: string
): ValidationResult => {
  const candidate = extractJsonCandidate(rawText);
  const parsed = tryParseJson(candidate);

  if (!parsed) {
    return {
      ok: false,
      normalizedJson: null,
      contentText: String(rawText || '').trim(),
      issues: ['Resposta do agente nao retornou JSON valido.']
    };
  }

  const normalizedJson: Record<string, any> = { ...parsed };
  const issues: string[] = [];

  blueprint.requiredFields.forEach((field) => {
    const normalizedValue = normalizeFieldValue(field, normalizedJson[field]);
    normalizedJson[field] = normalizedValue;

    if (Array.isArray(normalizedValue) && normalizedValue.length === 0) {
      issues.push(`Campo obrigatorio vazio: ${field}.`);
      return;
    }

    if (!Array.isArray(normalizedValue) && !String(normalizedValue || '').trim()) {
      issues.push(`Campo obrigatorio vazio: ${field}.`);
    }
  });

  return {
    ok: issues.length === 0,
    normalizedJson,
    contentText: buildContentText(normalizedJson),
    issues
  };
};
