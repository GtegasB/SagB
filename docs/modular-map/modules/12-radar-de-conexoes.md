# Modulo 12 - Radar de Conexoes

## Objetivo

Mapear conexoes, sinais, sinergias e oportunidades do ecossistema, com forte orientacao estrategica.

## Papel dentro do SagB

### Fato observado

- `RadarConnectionsView.tsx` consome um blueprint estatico de `data/radarConnectionsBlueprint.ts`.
- Existe documento canonico em `docs/Estrutura_SagB/Radar_de_Conexoes`.
- Existe migration `20260313000102_nagi_radar_core.sql` com schema de ecossistema, relacoes, sinais e distribuicao.

### Inferencia

- O Radar de Conexoes esta estrategicamente muito bem desenhado, mas ainda nao virou motor operacional alimentado por dados vivos.

## Arquivos principais

- `components/RadarConnectionsView.tsx`
- `data/radarConnectionsBlueprint.ts`
- `docs/Estrutura_SagB/Radar_de_Conexoes`
- `supabase/migrations/20260313000102_nagi_radar_core.sql`

## Dependencias

- Blueprint estatico
- Futuras tabelas `nagi_ecosystem_entities`, `nagi_entity_relations`, `nagi_external_signals`, `nagi_insight_distributions`, `nagi_ecosystem_decisions`

## Fluxos principais

1. Abrir o Radar
2. Ler narrativa, camadas e blueprint
3. Identificar tese e modulos alvo

## Dados usados

- Dados estaticos do blueprint
- Documento canonico
- Schema pronto, ainda nao conectado

## Status atual

- Documentado e scaffoldado, nao operacionalizado por dados reais.

## O que ja esta pronto

- Documento canonico forte
- Tela documental coerente
- Base SQL para evolucao

## O que ainda falta

- CRUD e ingestao de entidades e relacoes
- Motor de score e distribuicao
- UI de operacao real

## Riscos e lacunas

- Distancia grande entre ambicao e implementacao
- Pode parecer modulo pronto quando ainda e majoritariamente blueprint

## Modulos tocados

- NAGI
- Futuro CID
- Futuro Fluxo de Inteligencia
- Futuras decisoes de ecossistema

## Arquivos de apoio recomendados

- `components/NAGIView.tsx`
- `supabase/migrations/20260313000102_nagi_radar_core.sql`
