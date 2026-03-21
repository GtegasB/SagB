# Modulo 07 - CID

## Objetivo

Transformar documentos, audios e videos em ativos processaveis por meio de ingestao, fragmentacao, transcricao, resumo e consolidacao.

## Arquitetura

O pipeline do CID foi refatorado para uma arquitetura mais robusta e escalável, centrada no back-end.

1.  **Upload via Cliente**: O front-end (`CIDView.tsx`) é responsável por capturar os metadados do arquivo e fazer o upload diretamente para o Supabase Storage.
2.  **Iniciação do Job**: Após o upload, o cliente cria os registros iniciais nas tabelas `cid_assets`, `cid_asset_files` e `cid_processing_jobs`, com o status "queued".
3.  **Processamento Assíncrono no Back-end**: O cliente então invoca uma Netlify Function (`cid-processor.mjs`) dedicada, passando o ID do asset. Esta função assume todo o processamento pesado de forma assíncrona.
4.  **Pipeline do Back-end**: A função `cid-processor.mjs` executa o pipeline:
    *   Download do arquivo do storage.
    *   Transcrição (para áudio/vídeo) via API da Gemini.
    *   Extração de texto (atualmente para arquivos de texto plano).
    *   Fragmentação do conteúdo em `chunks`.
    *   Geração de resumos via API da Gemini.
    *   Atualização contínua do status e progresso no banco de dados.
5.  **Busca via Back-end**: A busca da aba "Inteligência" agora é servida por uma função dedicada (`cid-search.mjs`) que realiza uma consulta full-text search diretamente no banco de dados, abrangendo todos os documentos.

Esta abordagem remove a fragilidade do processamento no lado do cliente, permitindo que a operação continue mesmo que o usuário feche o navegador, e melhora drasticamente a performance e a abrangência da busca.

## Arquivos principais

-   `components/CIDView.tsx`
-   `netlify/functions/cid-processor.mjs` (Novo)
-   `netlify/functions/cid-search.mjs` (Novo)
-   `supabase/migrations/20260312000101_cid_center.sql`

## Fluxos principais

1.  **Upload**: Usuário seleciona o arquivo e metadados no `CIDView`.
2.  **Iniciação**: O front-end envia o arquivo para o storage e cria os registros no banco de dados, disparando a função de back-end `cid-processor`.
3.  **Processamento no Back-end**: A Netlify Function executa o pipeline de extração, transcrição e resumo, atualizando o status do job em tempo real. O front-end é apenas um observador deste processo.
4.  **Consulta**: A aba "Inteligência" utiliza a função `cid-search` para buscar em todos os assets, chunks e outputs do CID.

## Status atual

-   V2 com arquitetura de back-end.

## O que ja esta pronto

-   Estrutura de dados dedicada e robusta.
-   Upload desacoplado com trigger para processamento em background.
-   Jobs assíncronos e status rastreável em tempo real.
-   Fragmentação, transcrição e resumos executados no back-end.
-   **Busca por texto completo (Full-Text Search)** em toda a base de dados na aba "Inteligência".

## O que ainda falta

-   **Extração de texto de arquivos complexos**: A extração de texto atualmente funciona bem para arquivos `.txt`. A implementação para `.pdf`, `.docx`, etc., precisa ser adicionada no back-end (`cid-processor.mjs`).
-   **Busca semântica (Vector Search)**: A busca atual é por texto, não por significado.
-   **Orquestração de fila mais sofisticada**: Uma fila dedicada (ex: RabbitMQ ou Supabase MQ) para gerenciar os jobs de processamento.
-   **Integração com Agentes e RAG**: Conectar os documentos processados do CID ao contexto dos agentes para consultas (RAG).

## Riscos e lacunas

-   **Limitação de processamento da Netlify**: Arquivos muito grandes (ex: >100MB) podem exceder os limites de tempo ou memória da função do Netlify. Uma arquitetura com runners dedicados (ex: VMs) seria o próximo passo para escala industrial.
-   **Extração de texto de PDFs/DOCs**: Sem uma biblioteca robusta para extração de texto de arquivos binários no back-end, o valor do CID para esses formatos é limitado à sua transcrição ou aos metadados.
