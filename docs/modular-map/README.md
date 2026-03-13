# SagB Modular Map

Mineracao estrutural do projeto SagB feita a partir do codigo, docs, migrations e testes existentes em `2026-03-13`.

## Regra de leitura

- `Fato observado`: algo visto diretamente no codigo, SQL, testes, config ou docs do repo.
- `Inferencia`: conclusao arquitetural minha a partir do que o repo implementa hoje.

## Modulos ativos ou claramente scaffoldados

1. Plataforma Base, Auth e Workspace
2. Home, Dashboard e Hub do Ecossistema
3. Nucleo Conversacional Multiagente
4. Governanca, Black Vault e Metodologia
5. Cadastro e DNA de Agentes
6. Operacao e Frentes de Negocio
7. CID
8. Memoria Continua
9. Fluxo de Inteligencia
10. Sensor de Qualidade
11. NAGI
12. Radar de Conexoes
13. SagB Bridge / Sala dos Programadores

## Arquivos gerados

- `blueprint-final.md`: visao consolidada do sistema no formato operacional pedido.
- `chat-prompts.md`: prompts prontos para abrir chats independentes por modulo.
- `modules/*.md`: ficha tecnica profunda de cada modulo.

## Observacoes de higiene arquitetural

- Componentes e arquivos legados existem no repo, mas nao foram tratados como modulos vivos quando nao estao conectados ao `App.tsx` ou aos fluxos atuais.
- Exemplos de material legado ou auxiliar: `services/supabase_antigo.ts`, `docs/legacy/App_Antigo.tsx`, `components/CircuitB.tsx`, `tmpclaude-*`, `tmp_test_file.txt`, `sagb (10).zip`.
- Tests inspecionados: `tests/configuration.test.mjs`.
