import React, { useState } from 'react';
import { BackIcon, BookIcon, CheckIcon, FileTextIcon } from './Icon';
import {
  radarAlreadyDefined,
  radarArchitecture,
  radarBlueprintFinal,
  radarChecklist,
  radarExpansions,
  radarImplementation,
  radarIncorporated,
  radarMetrics,
  radarProducts,
  radarReading,
  radarRisks,
  radarStructure,
  radarSuggested
} from '../data/radarConnectionsBlueprint';

type SectionId = 'reading' | 'defined' | 'expansion' | 'structure' | 'execution' | 'blueprint';

interface RadarConnectionsViewProps {
  onBack?: () => void;
}

const sections: { id: SectionId; label: string; eyebrow: string }[] = [
  { id: 'reading', label: 'Leitura', eyebrow: 'Base' },
  { id: 'defined', label: 'Definicoes', eyebrow: 'Nucleo' },
  { id: 'expansion', label: 'Expansoes', eyebrow: 'Potencia' },
  { id: 'structure', label: 'Estrutura', eyebrow: 'Sistema' },
  { id: 'execution', label: 'Implantacao', eyebrow: 'Execucao' },
  { id: 'blueprint', label: 'Blueprint', eyebrow: 'Fechamento' }
];

const copyToClipboard = async (value: string) => {
  if (typeof navigator === 'undefined' || !navigator.clipboard) throw new Error('Clipboard indisponivel.');
  await navigator.clipboard.writeText(value);
};

const RadarConnectionsView: React.FC<RadarConnectionsViewProps> = ({ onBack }) => {
  const [activeSection, setActiveSection] = useState<SectionId>('reading');
  const [feedback, setFeedback] = useState('');

  const handleCopy = async (label: string, content: string[]) => {
    try {
      await copyToClipboard(content.join('\n'));
      setFeedback(`${label} copiado.`);
      window.setTimeout(() => setFeedback(''), 2200);
    } catch (error: any) {
      setFeedback(String(error?.message || 'Falha ao copiar.'));
      window.setTimeout(() => setFeedback(''), 2600);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.12),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(34,197,94,0.10),_transparent_24%),linear-gradient(180deg,_#f8fafc_0%,_#eef4ff_100%)]">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <section className="relative overflow-hidden rounded-[30px] bg-slate-950 text-white shadow-[0_30px_90px_rgba(15,23,42,0.3)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.20),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.18),_transparent_26%)]" />
          <div className="relative px-8 py-8 md:px-10 md:py-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                {onBack && (
                  <button
                    onClick={onBack}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200 transition hover:border-white/25 hover:bg-white/10"
                  >
                    <BackIcon className="h-3.5 w-3.5" />
                    Voltar
                  </button>
                )}
                <p className="mt-4 text-[10px] font-black uppercase tracking-[0.32em] text-cyan-200">NAGI / Radar Estrategico</p>
                <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">Radar de Conexoes</h1>
                <p className="mt-4 text-sm leading-7 text-slate-200 md:text-base">
                  Esta tela materializa a tese completa do Radar de Conexoes e do Radar Externo dentro do SagB.
                  Aqui o projeto deixa de ser intuicao e passa a existir como arquitetura de ecossistema,
                  modulo de produto e trilha de implantacao real.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => handleCopy('Blueprint executivo', radarBlueprintFinal)}
                    className="inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-950 transition hover:bg-cyan-300"
                  >
                    <BookIcon className="h-4 w-4" />
                    Copiar Blueprint
                  </button>
                  <button
                    onClick={() => handleCopy('Checklist de implantacao', radarChecklist)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white transition hover:border-white/25 hover:bg-white/10"
                  >
                    <FileTextIcon className="h-4 w-4" />
                    Copiar Checklist
                  </button>
                </div>
                {feedback && <p className="mt-4 text-xs font-bold text-cyan-200">{feedback}</p>}
              </div>

              <div className="grid w-full gap-3 sm:grid-cols-3 lg:max-w-xl">
                {radarMetrics.map((metric) => (
                  <div key={metric.label} className="rounded-3xl border border-white/10 bg-white/5 p-4">
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
            <p className="px-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Mapa do Radar</p>
            <div className="mt-4 space-y-2">
              {sections.map((section) => {
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full rounded-2xl px-4 py-3 text-left transition ${
                      isActive ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className={`block text-[10px] font-black uppercase tracking-[0.24em] ${isActive ? 'text-cyan-200' : 'text-slate-400'}`}>
                      {section.eyebrow}
                    </span>
                    <span className="mt-1 block text-sm font-bold tracking-tight">{section.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="space-y-6">
            {activeSection === 'reading' && (
              <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Leitura total</p>
                <div className="mt-5 space-y-4">
                  {radarReading.map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activeSection === 'defined' && (
              <section className="grid gap-4 xl:grid-cols-3">
                {radarAlreadyDefined.concat(radarSuggested).map((block) => (
                  <article key={block.title} className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Bloco</p>
                    <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">{block.title}</h2>
                    <div className="mt-4 space-y-3">
                      {block.items.map((item) => (
                        <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          {item}
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </section>
            )}

            {activeSection === 'expansion' && (
              <>
                <section className="grid gap-4 xl:grid-cols-2">
                  {radarExpansions.map((card) => (
                    <article key={card.title} className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Nova camada</p>
                      <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">{card.title}</h2>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{card.summary}</p>
                      <div className="mt-4 space-y-3">
                        {card.items.map((item) => (
                          <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                            {item}
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </section>

                <section className="rounded-[24px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200">Projeto ampliado</p>
                  <div className="mt-5 grid gap-3">
                    {radarIncorporated.map((item) => (
                      <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-100">
                        {item}
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {activeSection === 'structure' && (
              <>
                <section className="grid gap-4 xl:grid-cols-3">
                  {radarStructure.map((block) => (
                    <article key={block.title} className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Estrutura</p>
                      <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">{block.title}</h2>
                      <div className="mt-4 space-y-3">
                        {block.items.map((item) => (
                          <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                            {item}
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </section>

                <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Arquitetura de produto e sistema</p>
                  <div className="mt-5 grid gap-3">
                    {radarArchitecture.map((item) => (
                      <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        {item}
                      </div>
                    ))}
                  </div>
                </section>
              </>
            )}

            {activeSection === 'execution' && (
              <>
                <section className="grid gap-4 xl:grid-cols-3">
                  {radarImplementation.map((card) => (
                    <article key={card.title} className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Implantacao</p>
                      <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">{card.title}</h2>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{card.summary}</p>
                      <div className="mt-4 space-y-3">
                        {card.items.map((item) => (
                          <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                            {item}
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </section>

                <section className="grid gap-4 xl:grid-cols-2">
                  <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Spin-offs e linhas derivadas</p>
                    <div className="mt-5 space-y-3">
                      {radarProducts.map((item) => (
                        <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                          {item}
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="rounded-[24px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200">Checklist pratico</p>
                    <div className="mt-5 space-y-3">
                      {radarChecklist.map((item) => (
                        <div key={item} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                          <span className="text-sm leading-6 text-slate-100">{item}</span>
                        </div>
                      ))}
                    </div>
                  </article>
                </section>
              </>
            )}

            {activeSection === 'blueprint' && (
              <>
                <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                  <article className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Riscos e cuidados</p>
                    <div className="mt-5 space-y-4">
                      {radarRisks.map((card) => (
                        <div key={card.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <h3 className="text-sm font-black tracking-tight text-slate-900">{card.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{card.summary}</p>
                          <div className="mt-3 space-y-2">
                            {card.items.map((item) => (
                              <div key={item} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="rounded-[24px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200">Blueprint executivo final</p>
                    <div className="mt-5 space-y-3">
                      {radarBlueprintFinal.map((item) => (
                        <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-slate-100">
                          {item}
                        </div>
                      ))}
                    </div>
                  </article>
                </section>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default RadarConnectionsView;
