import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Agent, AgentStatus, AgentTier, BusinessUnit, ModelProvider, Venture } from '../types';
import { Avatar } from './Avatar';
import { BackIcon, BotIcon, CloudUploadIcon, PencilIcon, PlusIcon, SearchIcon, TrashIcon, XIcon } from './Icon';
import { auth, db } from '../services/supabase';
import { addDoc, collection, deleteDoc, doc, Timestamp, updateDoc } from '../services/supabase';

interface AgentFactoryProps {
    onNavigateToEcosystem: () => void;
    onActivate: (agentData: any) => void;
    onRemove?: (agentId: string) => void;
    activeBU: BusinessUnit;
    activeWorkspaceId?: string | null;
    businessUnits: BusinessUnit[];
    ventures: Venture[];
    agents: Agent[];
    initialAgent?: Agent | null;
    onManageIntelligence?: (agent: Agent) => void;
}

type EntityType = 'HUMANO' | 'AGENTE' | 'HIBRIDO';
type RoleType = 'LIDERANCA' | 'CONSULTORIA' | 'AUDITORIA' | 'EXECUCAO' | 'MENTORIA' | 'APOIO';
type StructuralStatus = 'ESTRUTURAL' | 'EM_CONFIGURACAO' | 'HOMOLOGACAO' | 'ATIVO' | 'ARQUIVADO';
type OperationalActivation = 'ATIVO_NASCIMENTO' | 'PREVISTO_GATILHO' | 'RESERVADO_FUTURO' | 'COMPARTILHADO';
type DnaStatus = 'SEM_DNA' | 'DNA_BASE' | 'DNA_PARCIAL' | 'DNA_COMPLETO' | 'REVISAR';
type OperationalClass = 'ECONOMICA' | 'BALANCEADA' | 'PREMIUM' | 'CRITICA';

interface FormCustomField {
    key: string;
    value: string;
}

interface AgentFormState {
    name: string;
    entityType: EntityType;
    shortDescription: string;
    avatarUrl: string;
    origin: string;
    ventureId: string;
    unitName: string;
    area: string;
    functionName: string;
    baseRoleUniversal: string;
    level: AgentTier;
    roleType: RoleType;
    structuralStatus: StructuralStatus;
    operationalActivation: OperationalActivation;
    dnaStatus: DnaStatus;
    operationalClass: OperationalClass;
    allowedStacks: ModelProvider[];
    preferredModel: ModelProvider | '';
    aiMentor: string;
    humanOwner: string;
    documentCount: string;
    startDate: string;
    salary: string;
    customFields: FormCustomField[];
}

const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000000';

const ENTITY_TYPE_OPTIONS: Array<{ value: EntityType; label: string }> = [
    { value: 'HUMANO', label: 'Humano' },
    { value: 'AGENTE', label: 'Agente' },
    { value: 'HIBRIDO', label: 'Hibrido' }
];

const LEVEL_OPTIONS: Array<{ value: AgentTier; label: string }> = [
    { value: 'ESTRATÉGICO', label: 'Estrategico' },
    { value: 'TÁTICO', label: 'Tatico' },
    { value: 'OPERACIONAL', label: 'Operacional' }
];

const ROLE_TYPE_OPTIONS: Array<{ value: RoleType; label: string }> = [
    { value: 'LIDERANCA', label: 'Lideranca' },
    { value: 'CONSULTORIA', label: 'Consultoria' },
    { value: 'AUDITORIA', label: 'Auditoria' },
    { value: 'EXECUCAO', label: 'Execucao' },
    { value: 'MENTORIA', label: 'Mentoria' },
    { value: 'APOIO', label: 'Apoio' }
];

const STRUCTURAL_STATUS_OPTIONS: Array<{ value: StructuralStatus; label: string }> = [
    { value: 'ESTRUTURAL', label: 'Estrutural' },
    { value: 'EM_CONFIGURACAO', label: 'Em configuracao' },
    { value: 'HOMOLOGACAO', label: 'Homologacao' },
    { value: 'ATIVO', label: 'Ativo' },
    { value: 'ARQUIVADO', label: 'Arquivado' }
];

const OPERATIONAL_ACTIVATION_OPTIONS: Array<{ value: OperationalActivation; label: string }> = [
    { value: 'ATIVO_NASCIMENTO', label: 'Ativo no nascimento' },
    { value: 'PREVISTO_GATILHO', label: 'Previsto por gatilho' },
    { value: 'RESERVADO_FUTURO', label: 'Reservado para futuro' },
    { value: 'COMPARTILHADO', label: 'Compartilhado' }
];

const DNA_STATUS_OPTIONS: Array<{ value: DnaStatus; label: string }> = [
    { value: 'SEM_DNA', label: 'Sem DNA' },
    { value: 'DNA_BASE', label: 'DNA base' },
    { value: 'DNA_PARCIAL', label: 'DNA parcial' },
    { value: 'DNA_COMPLETO', label: 'DNA completo' },
    { value: 'REVISAR', label: 'Revisar' }
];

const OPERATIONAL_CLASS_OPTIONS: Array<{ value: OperationalClass; label: string }> = [
    { value: 'ECONOMICA', label: 'Economica' },
    { value: 'BALANCEADA', label: 'Balanceada' },
    { value: 'PREMIUM', label: 'Premium' },
    { value: 'CRITICA', label: 'Critica' }
];

const STACK_OPTIONS: Array<{ value: ModelProvider; label: string }> = [
    { value: 'llama_local', label: 'Llama' },
    { value: 'gemini', label: 'Gemini' },
    { value: 'deepseek', label: 'Deepseek' },
    { value: 'openai', label: 'Openai' },
    { value: 'claude', label: 'Claude' },
    { value: 'qwen', label: 'Qwen' }
];

const STRUCTURAL_TO_AGENT_STATUS: Record<StructuralStatus, AgentStatus> = {
    ESTRUTURAL: 'PLANNED',
    EM_CONFIGURACAO: 'PLANNED',
    HOMOLOGACAO: 'STAGING',
    ATIVO: 'ACTIVE',
    ARQUIVADO: 'BLOCKED'
};

const normalizeText = (value: string) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

const toDisplayOption = (value: any) => {
    const raw = String(value ?? '').trim();
    if (!raw || raw === '-') return '-';
    const normalized = raw.replace(/[_-]+/g, ' ').trim().toLowerCase();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const toCustomFieldObject = (fields: FormCustomField[]) => {
    const out: Record<string, string> = {};
    fields.forEach((field) => {
        const key = field.key.trim();
        if (!key) return;
        out[key] = field.value.trim();
    });
    return out;
};

const fromCustomFieldObject = (record?: Record<string, string>) => {
    if (!record || typeof record !== 'object') return [] as FormCustomField[];
    return Object.entries(record).map(([key, value]) => ({ key, value: String(value ?? '') }));
};

const parseCsvLine = (line: string) => {
    const out: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (char === '"') {
            const next = line[i + 1];
            if (inQuotes && next === '"') {
                current += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === ',' && !inQuotes) {
            out.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    out.push(current);
    return out.map((value) => value.trim());
};

const parseCsvRecords = (content: string) => {
    const lines = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length < 2) return [] as Array<Record<string, string>>;

    const headers = parseCsvLine(lines[0]).map((header) => normalizeText(header));

    return lines.slice(1).map((line) => {
        const values = parseCsvLine(line);
        return headers.reduce<Record<string, string>>((acc, header, index) => {
            acc[header] = values[index] ?? '';
            return acc;
        }, {});
    });
};

const readByAliases = (row: Record<string, string>, aliases: string[]) => {
    const normalizedAliases = aliases.map((alias) => normalizeText(alias));
    for (const alias of normalizedAliases) {
        const value = row[alias];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return String(value).trim();
        }
    }
    return '';
};

const mapEntityToCollaboratorType = (entityType: EntityType) => {
    if (entityType === 'HUMANO') return 'HUMANO';
    if (entityType === 'HIBRIDO') return 'HIBRIDO';
    return 'AGENTE_IA';
};

const normalizeModelValue = (value: string): ModelProvider | '' => {
    const normalized = normalizeText(value);
    if (!normalized) return '';
    if (normalized.includes('llama')) return 'llama_local';
    if (normalized.includes('gemini')) return 'gemini';
    if (normalized.includes('deepseek') || normalized.includes('deep')) return 'deepseek';
    if (normalized.includes('openai') || normalized.includes('gpt')) return 'openai';
    if (normalized.includes('claude')) return 'claude';
    if (normalized.includes('qwen') || normalized.includes('quinn')) return 'qwen';
    return '';
};

const createEmptyForm = (activeBU: BusinessUnit, ventures: Venture[]): AgentFormState => ({
    name: '',
    entityType: 'AGENTE',
    shortDescription: '',
    avatarUrl: '',
    origin: 'Cadastro manual',
    ventureId: ventures[0]?.id || '',
    unitName: activeBU.name,
    area: '',
    functionName: '',
    baseRoleUniversal: '',
    level: 'TÁTICO',
    roleType: 'EXECUCAO',
    structuralStatus: 'EM_CONFIGURACAO',
    operationalActivation: 'ATIVO_NASCIMENTO',
    dnaStatus: 'SEM_DNA',
    operationalClass: 'BALANCEADA',
    allowedStacks: ['deepseek'],
    preferredModel: 'deepseek',
    aiMentor: '',
    humanOwner: '',
    documentCount: '0',
    startDate: '',
    salary: '',
    customFields: []
});

const agentToForm = (agent: Agent, activeBU: BusinessUnit, ventures: Venture[]): AgentFormState => {
    const fallback = createEmptyForm(activeBU, ventures);
    const preferredModel = (agent.preferredModel || agent.modelProvider || '') as ModelProvider | '';

    return {
        ...fallback,
        name: agent.name || '',
        entityType: (agent.entityType || (agent.collaboratorType === 'HUMANO' ? 'HUMANO' : 'AGENTE')) as EntityType,
        shortDescription: agent.shortDescription || '',
        avatarUrl: agent.avatarUrl || '',
        origin: agent.origin || 'Cadastro manual',
        ventureId: agent.ventureId || fallback.ventureId,
        unitName: agent.unitName || agent.division || activeBU.name,
        area: agent.area || agent.sector || '',
        functionName: agent.functionName || agent.officialRole || '',
        baseRoleUniversal: agent.baseRoleUniversal || agent.officialRole || '',
        level: (agent.tier || 'TÁTICO') as AgentTier,
        roleType: (agent.roleType || 'EXECUCAO') as RoleType,
        structuralStatus: (agent.structuralStatus || (agent.status === 'ACTIVE' ? 'ATIVO' : agent.status === 'STAGING' ? 'HOMOLOGACAO' : agent.status === 'BLOCKED' ? 'ARQUIVADO' : 'EM_CONFIGURACAO')) as StructuralStatus,
        operationalActivation: (agent.operationalActivation || 'ATIVO_NASCIMENTO') as OperationalActivation,
        dnaStatus: (agent.dnaStatus || 'SEM_DNA') as DnaStatus,
        operationalClass: (agent.operationalClass || 'BALANCEADA') as OperationalClass,
        allowedStacks: Array.isArray(agent.allowedStacks) && agent.allowedStacks.length > 0
            ? agent.allowedStacks
            : preferredModel ? [preferredModel] : fallback.allowedStacks,
        preferredModel,
        aiMentor: agent.aiMentor || '',
        humanOwner: agent.humanOwner || '',
        documentCount: String(agent.docCount ?? 0),
        startDate: agent.startDate || '',
        salary: agent.salary || '',
        customFields: fromCustomFieldObject(agent.customFields)
    };
};

const AgentFactory: React.FC<AgentFactoryProps> = ({
    onNavigateToEcosystem,
    onActivate,
    onRemove,
    activeBU,
    activeWorkspaceId,
    businessUnits,
    ventures,
    agents,
    initialAgent,
    onManageIntelligence
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [form, setForm] = useState<AgentFormState>(() => createEmptyForm(activeBU, ventures));
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [batchOrigin, setBatchOrigin] = useState('Importacao StartyB');
    const [batchVentureId, setBatchVentureId] = useState('');
    const [importFeedback, setImportFeedback] = useState('');

    const avatarInputRef = useRef<HTMLInputElement>(null);
    const batchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!batchVentureId && ventures.length > 0) {
            setBatchVentureId(ventures[0].id);
        }
    }, [batchVentureId, ventures]);

    useEffect(() => {
        if (!initialAgent) return;
        setEditingAgentId(initialAgent.id);
        setForm(agentToForm(initialAgent, activeBU, ventures));
        setIsFormOpen(true);
    }, [initialAgent, activeBU, ventures]);

    const filteredAgents = useMemo(() => {
        const term = normalizeText(searchTerm);
        const list = [...agents].sort((a, b) => a.name.localeCompare(b.name));
        if (!term) return list;

        return list.filter((agent) => {
            const ventureName = ventures.find((venture) => venture.id === agent.ventureId)?.name || '';
            const haystack = [
                agent.name,
                agent.functionName,
                agent.officialRole,
                agent.area,
                agent.unitName,
                ventureName,
                agent.origin
            ]
                .map((value) => normalizeText(String(value || '')))
                .join(' ');

            return haystack.includes(term);
        });
    }, [agents, searchTerm, ventures]);

    const mentorCandidates = useMemo(
        () => agents.filter((agent) => agent.id !== editingAgentId),
        [agents, editingAgentId]
    );

    const currentEditingAgent = useMemo(
        () => agents.find((agent) => agent.id === editingAgentId),
        [agents, editingAgentId]
    );

    const handleOpenNew = () => {
        setEditingAgentId(null);
        setForm(createEmptyForm(activeBU, ventures));
        setIsFormOpen(true);
    };

    const handleOpenEdit = (agent: Agent) => {
        setEditingAgentId(agent.id);
        setForm(agentToForm(agent, activeBU, ventures));
        setIsFormOpen(true);
    };

    const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > 1024 * 1024) {
            window.alert('Avatar acima de 1MB. Use um arquivo menor.');
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setForm((prev) => ({ ...prev, avatarUrl: String(reader.result || '') }));
        };
        reader.readAsDataURL(file);
    };

    const setFormField = <K extends keyof AgentFormState>(key: K, value: AgentFormState[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const toggleStack = (stack: ModelProvider) => {
        setForm((prev) => {
            const hasStack = prev.allowedStacks.includes(stack);
            const allowedStacks = hasStack
                ? prev.allowedStacks.filter((item) => item !== stack)
                : [...prev.allowedStacks, stack];
            let preferredModel = prev.preferredModel;
            if (preferredModel && !allowedStacks.includes(preferredModel)) {
                preferredModel = allowedStacks[0] || '';
            }
            return { ...prev, allowedStacks, preferredModel };
        });
    };

    const upsertCustomField = (index: number, patch: Partial<FormCustomField>) => {
        setForm((prev) => ({
            ...prev,
            customFields: prev.customFields.map((field, fieldIndex) => (
                fieldIndex === index ? { ...field, ...patch } : field
            ))
        }));
    };

    const removeCustomField = (index: number) => {
        setForm((prev) => ({
            ...prev,
            customFields: prev.customFields.filter((_, fieldIndex) => fieldIndex !== index)
        }));
    };

    const addCustomField = () => {
        setForm((prev) => ({
            ...prev,
            customFields: [...prev.customFields, { key: '', value: '' }]
        }));
    };

    const buildAgentPayload = (draft: AgentFormState, originOverride?: string) => {
        const selectedVenture = ventures.find((venture) => venture.id === draft.ventureId);
        const selectedBu = businessUnits.find((unit) => unit.id === activeBU.id);
        const userId = (auth as any)?.currentUser?.id;
        const normalizedStacks = draft.allowedStacks.length > 0 ? draft.allowedStacks : ['deepseek'];
        const preferredModel = (draft.preferredModel || normalizedStacks[0] || 'deepseek') as ModelProvider;
        const structuralStatus = draft.structuralStatus;
        const status = STRUCTURAL_TO_AGENT_STATUS[structuralStatus] || 'STAGING';

        return {
            name: draft.name.trim(),
            entityType: draft.entityType,
            shortDescription: draft.shortDescription.trim(),
            origin: (originOverride || draft.origin || 'Cadastro manual').trim(),
            ventureId: selectedVenture?.id,
            company: selectedVenture?.name || selectedBu?.name || activeBU.name,
            buId: activeBU.id,
            unitName: draft.unitName.trim(),
            area: draft.area.trim(),
            functionName: draft.functionName.trim(),
            baseRoleUniversal: (draft.baseRoleUniversal || draft.functionName).trim(),
            officialRole: (draft.functionName || draft.baseRoleUniversal).trim(),
            tier: draft.level,
            roleType: draft.roleType,
            structuralStatus,
            operationalActivation: draft.operationalActivation,
            dnaStatus: draft.dnaStatus,
            operationalClass: draft.operationalClass,
            allowedStacks: normalizedStacks,
            preferredModel,
            modelProvider: preferredModel,
            aiMentor: draft.aiMentor || undefined,
            humanOwner: draft.humanOwner || undefined,
            division: draft.unitName.trim() || undefined,
            sector: draft.area.trim() || undefined,
            collaboratorType: mapEntityToCollaboratorType(draft.entityType),
            docCount: Number(draft.documentCount || 0),
            startDate: draft.startDate || undefined,
            salary: draft.salary || undefined,
            avatarUrl: draft.avatarUrl || undefined,
            customFields: toCustomFieldObject(draft.customFields),
            status,
            active: status === 'ACTIVE' || status === 'STAGING',
            workspaceId: activeWorkspaceId || DEFAULT_WORKSPACE_ID,
            updatedAt: Timestamp.now(),
            updatedBy: userId || undefined
        };
    };

    const persistAgent = async (draft: AgentFormState, originOverride?: string) => {
        const payload = buildAgentPayload(draft, originOverride);

        if (!payload.name) throw new Error('Nome e obrigatorio.');
        if (!payload.ventureId) throw new Error('Venture e obrigatoria.');
        if (!payload.functionName && !payload.baseRoleUniversal) throw new Error('Funcao e obrigatoria.');

        if (editingAgentId && isUuid(editingAgentId)) {
            await updateDoc(doc(db, 'agents', editingAgentId), payload);
            const hydrated = {
                ...(currentEditingAgent || {}),
                ...payload,
                id: editingAgentId,
                universalId: currentEditingAgent?.universalId || editingAgentId
            };
            onActivate(hydrated);
            return hydrated as Agent;
        }

        const userId = (auth as any)?.currentUser?.id;
        const createPayload = {
            ...payload,
            createdAt: Timestamp.now(),
            createdBy: userId || undefined
        };

        const docRef = await addDoc(collection(db, 'agents'), createPayload);
        await updateDoc(docRef, {
            id: docRef.id,
            universalId: docRef.id,
            updatedAt: Timestamp.now(),
            updatedBy: userId || undefined
        });

        const hydrated = { ...payload, id: docRef.id, universalId: docRef.id };
        onActivate(hydrated);
        return hydrated as Agent;
    };

    const handleSave = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            await persistAgent(form);
            setIsFormOpen(false);
            setEditingAgentId(null);
            setForm(createEmptyForm(activeBU, ventures));
            window.alert('Cadastro salvo com sucesso.');
        } catch (error: any) {
            console.error('Erro ao salvar cadastro estrutural:', error);
            window.alert(error?.message || 'Falha ao salvar cadastro estrutural.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (agent: Agent) => {
        if (!onRemove) return;
        const confirmed = window.confirm(`Excluir ${agent.name} do cadastro estrutural?`);
        if (!confirmed) return;
        try {
            if (isUuid(agent.id)) {
                await deleteDoc(doc(db, 'agents', agent.id));
            }
            onRemove(agent.id);
        } catch (error: any) {
            console.error('Erro ao excluir agente:', error);
            window.alert(error?.message || 'Falha ao excluir cadastro.');
        }
    };

    const resolveVentureId = (raw: string) => {
        const value = raw.trim();
        if (!value) return '';
        const byId = ventures.find((venture) => venture.id === value);
        if (byId) return byId.id;
        const byName = ventures.find((venture) => normalizeText(venture.name) === normalizeText(value));
        if (byName) return byName.id;
        return '';
    };

    const mapImportRowToForm = (row: Record<string, string>): AgentFormState => {
        const draft = createEmptyForm(activeBU, ventures);
        const typeRaw = readByAliases(row, ['tipo', 'type', 'entity_type']);
        const normalizedType = normalizeText(typeRaw);
        let entityType: EntityType = 'AGENTE';
        if (normalizedType.includes('human')) entityType = 'HUMANO';
        if (normalizedType.includes('hibr') || normalizedType.includes('hybrid')) entityType = 'HIBRIDO';

        const levelRaw = normalizeText(readByAliases(row, ['nivel', 'level', 'tier']));
        const level = levelRaw.includes('estrateg')
            ? 'ESTRATÉGICO'
            : levelRaw.includes('opera')
                ? 'OPERACIONAL'
                : 'TÁTICO';

        const structuralRaw = normalizeText(readByAliases(row, ['status estrutural', 'structural_status', 'structuralstatus']));
        const structuralStatus: StructuralStatus = structuralRaw.includes('ativo')
            ? 'ATIVO'
            : structuralRaw.includes('homo')
                ? 'HOMOLOGACAO'
                : structuralRaw.includes('arquiv')
                    ? 'ARQUIVADO'
                    : structuralRaw.includes('estrutural')
                        ? 'ESTRUTURAL'
                        : 'EM_CONFIGURACAO';

        const dnaRaw = normalizeText(readByAliases(row, ['status dna', 'dna_status', 'dnastatus']));
        const dnaStatus: DnaStatus = dnaRaw.includes('completo')
            ? 'DNA_COMPLETO'
            : dnaRaw.includes('parcial')
                ? 'DNA_PARCIAL'
                : dnaRaw.includes('base')
                    ? 'DNA_BASE'
                    : dnaRaw.includes('revis')
                        ? 'REVISAR'
                        : 'SEM_DNA';

        const stackRaw = readByAliases(row, ['stack permitida', 'allowed_stacks', 'stack']);
        const parsedStacks = stackRaw
            .split(/[;,|]/)
            .map((part) => normalizeModelValue(part))
            .filter((value): value is ModelProvider => Boolean(value));

        const preferredModel = normalizeModelValue(readByAliases(row, ['modelo preferencial', 'preferred_model', 'model']));
        const ventureRaw = readByAliases(row, ['venture', 'venture_id', 'marca']);
        const roleRaw = normalizeText(readByAliases(row, ['papel', 'role_type'])) || 'execucao';
        const activationRaw = normalizeText(readByAliases(row, ['ativacao operacional', 'operational_activation']));
        const classRaw = normalizeText(readByAliases(row, ['classe operacional', 'operational_class']));

        return {
            ...draft,
            name: readByAliases(row, ['nome', 'name']),
            entityType,
            shortDescription: readByAliases(row, ['descricao', 'descricao curta', 'short_description', 'description']),
            origin: readByAliases(row, ['origem', 'origin']) || batchOrigin,
            ventureId: resolveVentureId(ventureRaw) || batchVentureId,
            unitName: readByAliases(row, ['unidade', 'unit', 'unit_name']) || activeBU.name,
            area: readByAliases(row, ['area']),
            functionName: readByAliases(row, ['funcao', 'function', 'function_name']),
            baseRoleUniversal: readByAliases(row, ['cargo-base universal', 'base_role_universal', 'base role', 'cargo base']),
            level,
            roleType: roleRaw.includes('lider')
                ? 'LIDERANCA'
                : roleRaw.includes('consult')
                    ? 'CONSULTORIA'
                    : roleRaw.includes('audit')
                        ? 'AUDITORIA'
                        : roleRaw.includes('mentor')
                            ? 'MENTORIA'
                            : roleRaw.includes('apoio')
                                ? 'APOIO'
                                : 'EXECUCAO',
            structuralStatus,
            operationalActivation: activationRaw.includes('gatilho')
                ? 'PREVISTO_GATILHO'
                : activationRaw.includes('reserv')
                    ? 'RESERVADO_FUTURO'
                    : activationRaw.includes('compart')
                        ? 'COMPARTILHADO'
                        : 'ATIVO_NASCIMENTO',
            dnaStatus,
            operationalClass: classRaw.includes('econom')
                ? 'ECONOMICA'
                : classRaw.includes('premium')
                    ? 'PREMIUM'
                    : classRaw.includes('crit')
                        ? 'CRITICA'
                        : 'BALANCEADA',
            allowedStacks: parsedStacks.length > 0 ? parsedStacks : draft.allowedStacks,
            preferredModel: preferredModel || (parsedStacks[0] || draft.preferredModel),
            aiMentor: readByAliases(row, ['mentor ia', 'ai_mentor']),
            humanOwner: readByAliases(row, ['responsavel humano', 'human_owner']),
            documentCount: readByAliases(row, ['documentos vinculados', 'doc_count']) || '0',
            startDate: readByAliases(row, ['inicio', 'start_date']),
            salary: readByAliases(row, ['salario', 'salary']),
            customFields: []
        };
    };

    const handleBatchFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setIsImporting(true);
        setImportFeedback('Processando lote...');
        try {
            const content = await file.text();
            let rows: Array<Record<string, string>> = [];
            if (file.name.toLowerCase().endsWith('.json')) {
                const parsed = JSON.parse(content);
                if (!Array.isArray(parsed)) throw new Error('JSON de importacao precisa ser um array de objetos.');
                rows = parsed.map((item) => {
                    const row: Record<string, string> = {};
                    Object.entries(item || {}).forEach(([key, value]) => {
                        row[normalizeText(key)] = String(value ?? '');
                    });
                    return row;
                });
            } else {
                rows = parseCsvRecords(content);
            }
            if (rows.length === 0) throw new Error('Arquivo sem registros validos para importar.');

            let successCount = 0;
            let failCount = 0;
            for (const row of rows) {
                try {
                    const draft = mapImportRowToForm(row);
                    if (!draft.name) {
                        failCount += 1;
                        continue;
                    }
                    const originLabel = `${batchOrigin} (Lote ${new Date().toISOString()})`;
                    await persistAgent(draft, originLabel);
                    successCount += 1;
                } catch (error) {
                    console.warn('Falha ao importar linha:', error);
                    failCount += 1;
                }
            }
            setImportFeedback(`Lote finalizado: ${successCount} importado(s), ${failCount} com falha.`);
        } catch (error: any) {
            console.error('Erro na importacao em lote:', error);
            setImportFeedback(`Falha na importacao: ${error?.message || 'erro desconhecido'}`);
        } finally {
            setIsImporting(false);
        }
    };

    const renderBadge = (label: string, tone: 'default' | 'green' | 'yellow' | 'purple' | 'gray' = 'default') => {
        const toneClass = {
            default: 'bg-slate-100 text-slate-700 border-slate-200',
            green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            yellow: 'bg-amber-100 text-amber-700 border-amber-200',
            purple: 'bg-violet-100 text-violet-700 border-violet-200',
            gray: 'bg-gray-100 text-gray-600 border-gray-200'
        }[tone];
        return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${toneClass}`}>{label}</span>;
    };

    return (
        <div className="flex h-full flex-col overflow-hidden bg-[#F9FAFB] font-nunito">
            <header className="flex h-20 shrink-0 items-center justify-between border-b border-gray-100 bg-white px-8">
                <div className="flex items-center gap-4">
                    <button onClick={onNavigateToEcosystem} className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100">
                        <BackIcon className="h-6 w-6" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight text-bitrix-nav">Quadro de Elite</h1>
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-400">Cadastro estrutural de humanos e agentes</p>
                    </div>
                </div>
                <button onClick={handleOpenNew} className="inline-flex items-center gap-2 rounded-xl bg-bitrix-nav px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg transition hover:bg-black">
                    <PlusIcon className="h-3.5 w-3.5" />
                    Novo cadastro
                </button>
            </header>

            <div className={`grid flex-1 gap-0 overflow-hidden ${isFormOpen ? 'grid-cols-[1fr_440px]' : 'grid-cols-1'}`}>
                <section className="flex min-w-0 flex-col overflow-hidden border-r border-gray-100 bg-white">
                    <div className="flex flex-wrap items-end gap-3 border-b border-gray-100 px-6 py-4">
                        <label className="relative min-w-[280px] flex-1">
                            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar por nome, area, funcao, origem..." className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-xs font-semibold text-gray-700 outline-none transition focus:border-indigo-300" />
                        </label>
                        <div className="grid min-w-[240px] gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">Venture do lote</span>
                            <select value={batchVentureId} onChange={(event) => setBatchVentureId(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-indigo-300">
                                <option value="">Selecionar...</option>
                                {ventures.map((venture) => <option key={venture.id} value={venture.id}>{venture.name}</option>)}
                            </select>
                        </div>
                        <div className="grid min-w-[220px] gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">Origem do lote</span>
                            <input value={batchOrigin} onChange={(event) => setBatchOrigin(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-indigo-300" />
                        </div>
                        <input ref={batchInputRef} type="file" accept=".csv,.json" className="hidden" onChange={handleBatchFile} />
                        <button onClick={() => batchInputRef.current?.click()} disabled={isImporting} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50">
                            <CloudUploadIcon className="h-4 w-4" />
                            {isImporting ? 'Importando...' : 'Importar lote'}
                        </button>
                    </div>
                    {importFeedback && <div className="border-b border-gray-100 bg-gray-50 px-6 py-2 text-[11px] font-semibold text-gray-600">{importFeedback}</div>}

                    <div className="flex-1 overflow-auto">
                        <table className="min-w-[1700px] table-fixed border-collapse">
                            <thead className="sticky top-0 z-10 bg-white shadow-sm">
                                <tr className="border-b border-gray-100 text-left text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">
                                    <th className="px-3 py-3">Nome</th><th className="px-3 py-3">Tipo</th><th className="px-3 py-3">Venture</th><th className="px-3 py-3">Unidade</th><th className="px-3 py-3">Area</th><th className="px-3 py-3">Funcao</th><th className="px-3 py-3">Cargo-base</th><th className="px-3 py-3">Nivel</th><th className="px-3 py-3">Papel</th><th className="px-3 py-3">Status estrutural</th><th className="px-3 py-3">Ativacao</th><th className="px-3 py-3">DNA</th><th className="px-3 py-3">Classe</th><th className="px-3 py-3">Stack permitida</th><th className="px-3 py-3">Modelo preferencial</th><th className="px-3 py-3">Responsavel humano</th><th className="px-3 py-3">Documentos</th><th className="px-3 py-3">Origem</th><th className="px-3 py-3">Ultima atualizacao</th><th className="px-3 py-3 text-center">Acoes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAgents.map((agent) => {
                                    const ventureName = ventures.find((venture) => venture.id === agent.ventureId)?.name || agent.company || '-';
                                    const stackText = Array.isArray(agent.allowedStacks) && agent.allowedStacks.length > 0
                                        ? agent.allowedStacks.map((stack) => toDisplayOption(stack)).join(', ')
                                        : toDisplayOption(agent.modelProvider || '-');
                                    const updatedAt = (agent as any).updatedAt || (agent as any).updated_at || (agent as any).createdAt;
                                    const updatedAtText = updatedAt ? new Date(updatedAt).toLocaleString('pt-BR') : '-';
                                    const structuralStatus = agent.structuralStatus || (agent.status === 'ACTIVE' ? 'ATIVO' : agent.status === 'STAGING' ? 'HOMOLOGACAO' : 'EM_CONFIGURACAO');
                                    const dnaStatus = agent.dnaStatus || 'SEM_DNA';
                                    return (
                                        <tr key={agent.id} className="border-b border-gray-100 text-[12px] text-gray-700 hover:bg-gray-50">
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-3">
                                                    <Avatar name={agent.name} url={agent.avatarUrl} className="h-9 w-9" />
                                                    <div className="min-w-0">
                                                        <p className="truncate text-[12px] font-bold text-gray-800">{agent.name}</p>
                                                        <p className="truncate text-[10px] font-semibold text-gray-400">{agent.shortDescription || agent.officialRole || '-'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2">{toDisplayOption(agent.entityType || (agent.collaboratorType === 'HUMANO' ? 'HUMANO' : 'AGENTE'))}</td>
                                            <td className="px-3 py-2">{ventureName}</td>
                                            <td className="px-3 py-2">{agent.unitName || agent.division || '-'}</td>
                                            <td className="px-3 py-2">{agent.area || agent.sector || '-'}</td>
                                            <td className="px-3 py-2">{agent.functionName || agent.officialRole || '-'}</td>
                                            <td className="px-3 py-2">{agent.baseRoleUniversal || agent.officialRole || '-'}</td>
                                            <td className="px-3 py-2">{toDisplayOption(agent.tier || '-')}</td>
                                            <td className="px-3 py-2">{toDisplayOption(agent.roleType || '-')}</td>
                                            <td className="px-3 py-2">{renderBadge(toDisplayOption(structuralStatus), structuralStatus === 'ATIVO' ? 'green' : structuralStatus === 'HOMOLOGACAO' ? 'purple' : 'gray')}</td>
                                            <td className="px-3 py-2">{toDisplayOption(agent.operationalActivation || '-')}</td>
                                            <td className="px-3 py-2">{renderBadge(toDisplayOption(dnaStatus), dnaStatus === 'DNA_COMPLETO' ? 'green' : dnaStatus === 'DNA_PARCIAL' ? 'yellow' : 'gray')}</td>
                                            <td className="px-3 py-2">{toDisplayOption(agent.operationalClass || '-')}</td>
                                            <td className="px-3 py-2">{stackText}</td>
                                            <td className="px-3 py-2">{toDisplayOption(agent.preferredModel || agent.modelProvider || '-')}</td>
                                            <td className="px-3 py-2">{agent.humanOwner || '-'}</td>
                                            <td className="px-3 py-2">{Number(agent.docCount || 0)}</td>
                                            <td className="px-3 py-2">{agent.origin || '-'}</td>
                                            <td className="px-3 py-2 text-[11px]">{updatedAtText}</td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button onClick={() => handleOpenEdit(agent)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition hover:bg-blue-50 hover:text-blue-600" title="Editar"><PencilIcon className="h-3.5 w-3.5" /></button>
                                                    {onManageIntelligence && <button onClick={() => onManageIntelligence(agent)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition hover:bg-purple-50 hover:text-purple-600" title="Status DNA"><BotIcon className="h-3.5 w-3.5" /></button>}
                                                    {onRemove && <button onClick={() => handleDelete(agent)} className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition hover:bg-red-50 hover:text-red-600" title="Excluir"><TrashIcon className="h-3.5 w-3.5" /></button>}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredAgents.length === 0 && <tr><td colSpan={20} className="px-6 py-10 text-center text-sm font-semibold text-gray-400">Nenhum cadastro encontrado para o filtro atual.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </section>

                {isFormOpen && (
                    <aside className="flex h-full flex-col overflow-hidden bg-[#FCFCFE]">
                        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
                            <div>
                                <h2 className="text-lg font-black uppercase tracking-tight text-bitrix-nav">{editingAgentId ? 'Editar cadastro' : 'Novo cadastro'}</h2>
                                <p className="mt-1 text-[11px] font-semibold text-gray-500">Quadro estrutural sem exposicao de DNA, cultura ou compliance.</p>
                            </div>
                            <button onClick={() => setIsFormOpen(false)} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"><XIcon className="h-5 w-5" /></button>
                        </div>
                        <div className="flex-1 space-y-6 overflow-auto px-6 py-5">
                            <section className="space-y-3">
                                <h3 className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">Identidade</h3>
                                <div className="grid grid-cols-1 gap-3">
                                    <label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Nome *</span><input value={form.name} onChange={(e) => setFormField('name', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-indigo-300" /></label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Tipo *</span><select value={form.entityType} onChange={(e) => setFormField('entityType', e.target.value as EntityType)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-indigo-300">{ENTITY_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                                        <label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Origem</span><input value={form.origin} onChange={(e) => setFormField('origin', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-indigo-300" /></label>
                                    </div>
                                    <label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Descricao curta</span><textarea value={form.shortDescription} onChange={(e) => setFormField('shortDescription', e.target.value)} rows={2} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-indigo-300" /></label>
                                    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
                                        <Avatar name={form.name || 'Novo Cadastro'} url={form.avatarUrl} className="h-12 w-12" />
                                        <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-gray-700">Avatar / Foto</p><p className="truncate text-[10px] font-semibold text-gray-400">Imagem publica para visualizacao de lista</p></div>
                                        <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                                        <button onClick={() => avatarInputRef.current?.click()} className="rounded-lg border border-gray-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-gray-600 transition hover:bg-gray-50">Selecionar</button>
                                    </div>
                                </div>
                            </section>
                            <section className="space-y-3"><h3 className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">Estrutura organizacional</h3><div className="grid grid-cols-1 gap-3"><label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Venture *</span><select value={form.ventureId} onChange={(e) => setFormField('ventureId', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-indigo-300"><option value="">Selecionar...</option>{ventures.map((venture) => <option key={venture.id} value={venture.id}>{venture.name}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Unidade</span><input value={form.unitName} onChange={(e) => setFormField('unitName', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-indigo-300" /></label><label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Area</span><input value={form.area} onChange={(e) => setFormField('area', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-indigo-300" /></label></div><div className="grid grid-cols-2 gap-3"><label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Funcao *</span><input value={form.functionName} onChange={(e) => setFormField('functionName', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-indigo-300" /></label><label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Cargo-base universal</span><input value={form.baseRoleUniversal} onChange={(e) => setFormField('baseRoleUniversal', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-indigo-300" /></label></div><div className="grid grid-cols-2 gap-3"><label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Nivel</span><select value={form.level} onChange={(e) => setFormField('level', e.target.value as AgentTier)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-indigo-300">{LEVEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Papel</span><select value={form.roleType} onChange={(e) => setFormField('roleType', e.target.value as RoleType)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-indigo-300">{ROLE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div></div></section>
                            <section className="space-y-3"><h3 className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">Status</h3><div className="grid grid-cols-1 gap-3"><label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Status estrutural</span><select value={form.structuralStatus} onChange={(e) => setFormField('structuralStatus', e.target.value as StructuralStatus)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-indigo-300">{STRUCTURAL_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Ativacao operacional</span><select value={form.operationalActivation} onChange={(e) => setFormField('operationalActivation', e.target.value as OperationalActivation)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-indigo-300">{OPERATIONAL_ACTIVATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Status DNA (somente status)</span><select value={form.dnaStatus} onChange={(e) => setFormField('dnaStatus', e.target.value as DnaStatus)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-indigo-300">{DNA_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div></section>
                            <section className="space-y-3"><h3 className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">Operacao</h3><div className="grid grid-cols-1 gap-3"><label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Classe operacional</span><select value={form.operationalClass} onChange={(e) => setFormField('operationalClass', e.target.value as OperationalClass)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-indigo-300">{OPERATIONAL_CLASS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><div className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Stack permitida (multiplos)</span><div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 bg-white p-2">{STACK_OPTIONS.map((option) => (<label key={option.value} className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"><input type="checkbox" checked={form.allowedStacks.includes(option.value)} onChange={() => toggleStack(option.value)} className="h-3.5 w-3.5" />{option.label}</label>))}</div></div><label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Modelo preferencial</span><select value={form.preferredModel} onChange={(e) => setFormField('preferredModel', e.target.value as ModelProvider | '')} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-indigo-300"><option value="">Selecionar...</option>{STACK_OPTIONS.filter((option) => form.allowedStacks.includes(option.value)).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div></section>
                            <section className="space-y-3"><h3 className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">Vinculos e documentos</h3><div className="grid grid-cols-1 gap-3"><label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Mentor IA</span><select value={form.aiMentor} onChange={(e) => setFormField('aiMentor', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-indigo-300"><option value="">Selecionar...</option>{mentorCandidates.map((candidate) => <option key={candidate.id} value={candidate.name}>{candidate.name}</option>)}</select></label><label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Responsavel humano</span><select value={form.humanOwner} onChange={(e) => setFormField('humanOwner', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-indigo-300"><option value="">Selecionar...</option>{mentorCandidates.map((candidate) => <option key={candidate.id} value={candidate.name}>{candidate.name}</option>)}</select></label><div className="grid grid-cols-3 gap-3"><label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Documentos vinculados</span><input type="number" min="0" value={form.documentCount} onChange={(e) => setFormField('documentCount', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-indigo-300" /></label><label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Inicio</span><input type="date" value={form.startDate} onChange={(e) => setFormField('startDate', e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-indigo-300" /></label><label className="space-y-1"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">Salario</span><input value={form.salary} onChange={(e) => setFormField('salary', e.target.value)} placeholder="R$ 0,00" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-indigo-300" /></label></div></div></section>
                            <section className="space-y-3"><div className="flex items-center justify-between"><h3 className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">Campos customizados</h3><button onClick={addCustomField} className="rounded-lg border border-gray-200 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-gray-600 hover:bg-gray-50">+ Campo</button></div><div className="space-y-2">{form.customFields.length === 0 && <p className="rounded-lg border border-dashed border-gray-200 px-3 py-3 text-[11px] font-semibold text-gray-400">Nenhum campo customizado adicionado.</p>}{form.customFields.map((field, index) => (<div key={`${index}-${field.key}`} className="grid grid-cols-[1fr_1fr_auto] gap-2"><input value={field.key} onChange={(e) => upsertCustomField(index, { key: e.target.value })} placeholder="Chave" className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-indigo-300" /><input value={field.value} onChange={(e) => upsertCustomField(index, { value: e.target.value })} placeholder="Valor" className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-indigo-300" /><button onClick={() => removeCustomField(index)} className="rounded-lg border border-red-100 px-2 text-red-500 hover:bg-red-50"><XIcon className="h-4 w-4" /></button></div>))}</div></section>
                        </div>
                        <div className="flex shrink-0 items-center justify-between border-t border-gray-100 bg-white px-6 py-4">
                            <p className="text-[10px] font-semibold text-gray-400">{editingAgentId ? 'Edicao de cadastro estrutural.' : 'Cadastro novo para escalar o ecossistema.'}</p>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setIsFormOpen(false)} className="rounded-xl border border-gray-200 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-gray-600 hover:bg-gray-50">Cancelar</button>
                                <button onClick={handleSave} disabled={isSaving} className="rounded-xl bg-bitrix-nav px-5 py-2 text-[10px] font-black uppercase tracking-wider text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? 'Salvando...' : 'Salvar cadastro'}</button>
                            </div>
                        </div>
                    </aside>
                )}
            </div>
        </div>
    );
};

export default AgentFactory;
