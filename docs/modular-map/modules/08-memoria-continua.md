# Modulo 08 - Memoria Continua

## Objetivo

Capturar sessoes de memoria viva, transcrever, classificar, extrair itens e manter uma linha historica organizavel do que foi falado.

## Papel dentro do SagB

### Fato observado

- `ContinuousMemoryView.tsx` trabalha com sessoes, chunks, files, jobs, outputs, labels, extracted items e links.
- `services/continuousMemory.ts` oferece modo remoto e local, com fallback no navegador.

### Inferencia

- Este modulo ja tem espinha dorsal tecnica robusta e esta mais avancado do que um experimento simples de transcricao.

## Arquivos principais

- `components/ContinuousMemoryView.tsx`
- `services/continuousMemory.ts`
- `supabase/migrations/20260313000101_continuous_memory.sql`
- `docs/WHISPER_LOCAL_TRANSCRICAO.md`
- `tools/local_whisper_server.py`

## Dependencias

- `continuous_memory_sessions`
- `continuous_memory_chunks`
- `continuous_memory_files`
- `continuous_memory_jobs`
- `continuous_memory_outputs`
- `continuous_memory_labels`
- `continuous_memory_chunk_labels`
- `continuous_memory_extracted_items`
- `continuous_memory_links`
- bucket `continuous-memory`

## Fluxos principais

1. Iniciar sessao
2. Capturar audio em blocos
3. Persistir ou guardar localmente
4. Transcrever
5. Classificar e extrair sinais
6. Organizar timeline e agrupamentos
7. Reprocessar chunks e encerrar sessao

## Dados usados

- Audio bruto
- Transcript
- Labels
- Itens extraidos
- Saidas de classificacao
- Links para outros modulos

## Status atual

- V1 forte, com fallback local bem pensado.

## O que ja esta pronto

- Sessao continua com start/pause/end
- Modo remoto e local
- Estrutura de labels
- Timeline e organizacao
- Extracoes heuristicas
- Reprocessamento

## O que ainda falta

- Camada de inteligencia mais forte para consolidacao de longo prazo
- Integracao mais profunda com CID e Fluxo
- Melhor relatorio executivo de sessoes

## Riscos e lacunas

- Parte da extracao e classificacao ainda e heuristica
- Em modo local, persistencia depende do browser
- Valor estrategico pode ficar abaixo do potencial sem rotas de distribuicao

## Modulos tocados

- Plataforma Base
- AI Proxy
- Potencial futuro com CID e Fluxo de Inteligencia

## Arquivos de apoio recomendados

- `docs/WHISPER_LOCAL_TRANSCRICAO.md`
- `tools/local_whisper_server.py`
