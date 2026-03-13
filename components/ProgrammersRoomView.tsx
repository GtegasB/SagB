import React, { useMemo, useState } from 'react';
import { BackIcon, BookIcon, CheckIcon, FileTextIcon, FolderIcon } from './Icon';
import {
  bridgeAgentChecklist,
  bridgeCards,
  bridgeDecisions,
  bridgeDefinitionOfDone,
  bridgeEndpoints,
  bridgeFlows,
  bridgeFormula,
  bridgeMetrics,
  bridgeRisks,
  bridgeSprints,
  masterBriefMarkdown,
  programmersRoomCapabilities,
  type BridgeSectionId
} from '../data/sagbBridgeBlueprint';

interface ProgrammersRoomViewProps {
  onBack?: () => void;
}

const sectionMeta: { id: BridgeSectionId; label: string; eyebrow: string }[] = [
  { id: 'overview', label: 'Visao', eyebrow: 'Produto' },
  { id: 'execution', label: 'Execucao', eyebrow: 'Cards' },
  { id: 'contracts', label: 'Contratos', eyebrow: 'API' },
  { id: 'operations', label: 'Operacao', eyebrow: 'Fluxos' },
  { id: 'quality', label: 'Qualidade', eyebrow: 'Riscos' }
];

const cardTone = [
  'from-[#0f766e] via-[#115e59] to-[#134e4a]',
  'from-[#1d4ed8] via-[#1e40af] to-[#172554]',
  'from-[#b45309] via-[#92400e] to-[#78350f]',
  'from-[#7c2d12] via-[#9a3412] to-[#431407]'
];

const copyToClipboard = async (value: string) => {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    throw new Error('Clipboard indisponivel neste ambiente.');
  }

  await navigator.clipboard.writeText(value);
};

const ProgrammersRoomView: React.FC<ProgrammersRoomViewProps> = ({ onBack }) => {
  const [activeSection, setActiveSection] = useState<BridgeSectionId>('overview');
  const [feedback, setFeedback] = useState<string>('');

  const cardsSummary = useMemo(() => bridgeCards.map((card) => {
    return [
      card.title,
      `Objetivo: ${card.objective}`,
      'Entregaveis:',
      ...card.deliverables.map((item) => `- ${item}`),
      'Validacao:',
      ...card.validation.map((item) => `- ${item}`)
    ].join('\n');
  }).join('\n\n'), []);

  const handleCopy = async (payload: string, label: string) => {
    try {
      await copyToClipboard(payload);
      setFeedback(`${label} copiado para a area de transferencia.`);
      window.setTimeout(() => setFeedback(''), 2400);
    } catch (error: any) {
      setFeedback(String(error?.message || 'Falha ao copiar o conteudo.'));
      window.setTimeout(() => setFeedback(''), 2800);
    }
  };

  return (
    <div className="flex-1 h-full bg-[#f5f7fb] overflow-y-auto">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <section className="relative overflow-hidden rounded-[28px] bg-slate-950 text-white shadow-[0_30px_80px_rgba(15,23,42,0.35)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.22),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.18),_transparent_26%)]" />
          <div className="relative px-8 py-8 md:px-10 md:py-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.3em] text-cyan-200/85">
                  {onBack && (
                    <button
                      onClick={onBack}
                      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] text-white/80 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
                    >
                      <BackIcon className="h-3.5 w-3.5" />
                      Voltar
                    </button>
                  )}
                  <span>Modulo Canonico</span>
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">
                  Sala dos Programadores
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 md:text-base">
                  O documento do SagB Bridge agora virou uma central de execucao dentro do proprio SagB.
                  Esta tela concentra visao de produto, arquitetura, contratos, operacao, riscos e cards
                  de entrega para que qualquer agente consiga iniciar o projeto sem depender de contexto extra.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => handleCopy(masterBriefMarkdown, 'Briefing mestre')}
                    className="inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-950 transition hover:bg-cyan-300"
                  >
                    <BookIcon className="h-4 w-4" />
                    Copiar Briefing Mestre
                  </button>
                  <button
                    onClick={() => handleCopy(cardsSummary, 'Cards de execucao')}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:border-white/30 hover:bg-white/10"
                  >
                    <FileTextIcon className="h-4 w-4" />
                    Copiar Cards
                  </button>
                </div>
                {feedback && (
                  <p className="mt-4 text-xs font-bold text-cyan-200">{feedback}</p>
                )}
              </div>

              <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-xl">
                {bridgeMetrics.map((metric) => (
                  <div key={metric.label} className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">{metric.label}</p>
                    <p className="mt-3 text-lg font-black tracking-tight">{metric.value}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-300">{metric.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
            <p className="px-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Mapa do Projeto</p>
            <div className="mt-4 space-y-2">
              {sectionMeta.map((section) => {
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                      isActive
                        ? 'bg-slate-950 text-white shadow-lg'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className={`block text-[10px] font-black uppercase tracking-[0.24em] ${isActive ? 'text-cyan-200' : 'text-slate-400'}`}>
                      {section.eyebrow}
                    </span>
                    <span className="mt-1 block text-sm font-bold tracking-tight">
                      {section.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 rounded-2xl bg-gradient-to-br from-cyan-50 via-white to-blue-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Formula Oficial</p>
              <div className="mt-3 space-y-2">
                {bridgeFormula.map((item) => (
                  <div key={item} className="rounded-xl border border-white bg-white/80 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            {activeSection === 'overview' && (
              <>
                <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Visao de Produto</p>
                      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                        O SagB organiza, o VS Code executa e o Bridge conecta
                      </h2>
                    </div>
                    <div className="rounded-2xl bg-slate-950 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">
                      Projeto Canonico
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-3xl bg-slate-950 p-5 text-white">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">Decisoes Imutaveis</p>
                      <div className="mt-4 space-y-3">
                        {bridgeDecisions.map((item) => (
                          <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-100">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Sala dos Programadores</p>
                      <div className="mt-4 space-y-3">
                        {programmersRoomCapabilities.map((item) => (
                          <div key={item} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 shadow-sm">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}

            {activeSection === 'execution' && (
              <>
                <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Cards de Execucao</p>
                  <div className="mt-5 grid gap-4 xl:grid-cols-2">
                    {bridgeCards.map((card, index) => (
                      <article
                        key={card.title}
                        className={`overflow-hidden rounded-[24px] bg-gradient-to-br ${cardTone[index % cardTone.length]} text-white shadow-[0_18px_50px_rgba(15,23,42,0.18)]`}
                      >
                        <div className="p-6">
                          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/70">
                            Card oficial
                          </p>
                          <h3 className="mt-3 text-lg font-black tracking-tight">{card.title}</h3>
                          <p className="mt-3 text-sm leading-6 text-white/88">{card.objective}</p>

                          <div className="mt-5 grid gap-4 lg:grid-cols-2">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">Entregaveis</p>
                              <ul className="mt-3 space-y-2 text-sm text-white/88">
                                {card.deliverables.map((item) => (
                                  <li key={item} className="rounded-xl bg-white/8 px-3 py-2">{item}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">Como validar</p>
                              <ul className="mt-3 space-y-2 text-sm text-white/88">
                                {card.validation.map((item) => (
                                  <li key={item} className="rounded-xl bg-white/8 px-3 py-2">{item}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Roadmap de Sprints</p>
                  <div className="mt-5 grid gap-4 xl:grid-cols-4">
                    {bridgeSprints.map((sprint) => (
                      <div key={sprint.name} className="rounded-[22px] border border-slate-200 bg-slate-50 p-5">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{sprint.name}</p>
                        <h3 className="mt-2 text-lg font-black tracking-tight text-slate-900">{sprint.focus}</h3>
                        <ul className="mt-4 space-y-2">
                          {sprint.items.map((item) => (
                            <li key={item} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {activeSection === 'contracts' && (
              <>
                <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Contratos de API</p>
                      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                        Back-end minimo para tornar a ponte operavel
                      </h2>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">URI oficial</p>
                      <p className="mt-2 text-xs font-bold text-slate-700">vscode://grupob.sagb-bridge/open?launchToken=...</p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {bridgeEndpoints.map((endpoint) => (
                      <div key={`${endpoint.method}-${endpoint.path}`} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex min-w-[72px] justify-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${
                            endpoint.method === 'GET'
                              ? 'bg-emerald-100 text-emerald-700'
                              : endpoint.method === 'PATCH'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                          }`}>
                            {endpoint.method}
                          </span>
                          <div>
                            <p className="text-sm font-black tracking-tight text-slate-900">{endpoint.path}</p>
                            <p className="text-xs text-slate-500">{endpoint.purpose}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Estados</p>
                    <div className="mt-4 space-y-3">
                        <div className="rounded-2xl bg-slate-950 px-4 py-4 text-sm text-white">
                          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">Task</p>
                          <p className="mt-2 font-bold">{'backlog -> todo -> in_progress -> blocked -> done'}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Task Run</p>
                          <p className="mt-2 font-bold">{'in_progress -> blocked -> done'}</p>
                        </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Estrutura da Extensao</p>
                    <div className="mt-4 grid gap-3">
                      {[
                        'commands -> interface de acoes do usuario',
                        'services -> API, estado local, run, session e Git',
                        'uri -> parse do deep link e delegacao',
                        'panels -> webview segura da task',
                        'state -> globalState, workspaceState e secretStorage'
                      ].map((item) => (
                        <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            )}

            {activeSection === 'operations' && (
              <>
                <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Fluxos Oficiais</p>
                  <div className="mt-5 grid gap-4 xl:grid-cols-3">
                    {bridgeFlows.map((flow) => (
                      <div key={flow.title} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{flow.title}</p>
                        <ol className="mt-4 space-y-3">
                          {flow.steps.map((step, index) => (
                            <li key={step} className="flex gap-3 rounded-2xl bg-white px-3 py-3 shadow-sm">
                              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[10px] font-black text-white">
                                {index + 1}
                              </span>
                              <span className="text-sm leading-6 text-slate-700">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Cenarios de ambiente</p>
                    <div className="mt-4 grid gap-3">
                      {[
                        'Windows desktop local e o suporte oficial da V1.',
                        'WSL, Dev Container e Remote SSH precisam existir no desenho por profileType.',
                        'Monorepo deve usar relativeTargetPath para apontar o subdiretorio funcional.',
                        'Projeto ausente deve pedir binding manual na V1, nao clonar automaticamente.'
                      ].map((item) => (
                        <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Checklist para outro agente</p>
                    <div className="mt-4 space-y-3">
                      {bridgeAgentChecklist.map((item) => (
                        <div key={item} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          <span className="text-sm leading-6 text-slate-700">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            )}

            {activeSection === 'quality' && (
              <>
                <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Riscos e mitigacoes</p>
                    <div className="mt-5 space-y-3">
                      {bridgeRisks.map((risk) => (
                        <div key={risk.title} className="rounded-[22px] border border-slate-200 bg-slate-50 p-5">
                          <div className="flex items-center gap-3">
                            <FolderIcon className="h-5 w-5 text-slate-500" />
                            <h3 className="text-sm font-black tracking-tight text-slate-900">{risk.title}</h3>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-700">{risk.mitigation}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200">Definition of Done</p>
                    <div className="mt-5 space-y-3">
                      {bridgeDefinitionOfDone.map((item) => (
                        <div key={item} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                          <span className="text-sm leading-6 text-slate-100">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ProgrammersRoomView;
