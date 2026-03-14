# Modulo 07 - CID

## Objetivo

Transformar documentos, audios e videos em ativos processaveis por meio de ingestao, fragmentacao, transcricao, resumo e consolidacao.

## Papel dentro do SagB

### Fato observado

- `CIDView.tsx` tem abas `upload`, `library`, `processing` e `intelligence`.
- Existe migration dedicada com tabelas para assets, files, jobs, chunks, outputs, tags, links e batches.

### Inferencia

- O CID ja e um modulo V1 real, com escopo de pipeline documental, e nao apenas uma tela de upload.

## Arquivos principais

- `components/CIDView.tsx`
- `supabase/migrations/20260312000101_cid_center.sql`
- `services/gemini.ts`
- `netlify/functions/ai.mjs`
- `docs/Estrutura_SagB/CID_Centro_de_Inteligencia_Documental`

## Dependencias

- `cid_assets`
- `cid_asset_files`
- `cid_processing_jobs`
- `cid_chunks`
- `cid_outputs`
- `cid_tags`
- `cid_asset_tags`
- `cid_links`
- `cid_batches`
- `cid_batch_items`
- bucket `cid-assets`
- transcricao e resumo via IA

## Fluxos principais

1. Upload e classificacao do material
2. Criacao do asset e do arquivo
3. Criacao de job de processamento
4. Extracao ou transcricao
5. Fragmentacao em chunks
6. Geracao opcional de resumos e consolidacao
7. Consulta por biblioteca, processamento e inteligencia

## Dados usados

- Metadados de arquivo
- Texto extraido
- Chunks textuais
- Outputs por tipo
- Tags e vinculos

## Status atual

- V1 forte e funcional.

## O que ja esta pronto

- Estrutura de dados dedicada
- Upload com metadados
- Jobs e progresso
- Chunks e outputs
- Resumo curto, longo e consolidacao
- Busca operacional basica na aba inteligencia

## O que ainda falta

- Busca semantica mais robusta
- Engine de retrieval melhor do que leitura recente
- Orquestracao de fila mais sofisticada
- Integracao viva com agentes e RAG global

## Riscos e lacunas

- A inteligencia atual e pragmaticamente limitada para estabilidade
- Sem vetor semantico, o valor depende de boa classificacao e boa navegacao

## Modulos tocados

- Plataforma Base
- AI Proxy
- Potencial futuro com Fluxo, Agentes e Memoria Continua

## Arquivos de apoio recomendados

- `docs/WHISPER_LOCAL_TRANSCRICAO.md`
- `tests/configuration.test.mjs`
