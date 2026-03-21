# Documentacao Oficial do SagB

Este diretorio e a **fonte de verdade documental** do SagB.

## Estrutura oficial

- `modular-map/` -> mapa funcional do sistema por modulos (arquitetura, escopo e fluxos).
- `Estrutura_SagB/` -> especificacoes canonicas de iniciativas estrategicas (CID, Radar, SagB Bridge).
- `standards/` -> padroes globais reutilizaveis para novos sistemas do GrupoB.
- `legacy/` -> material historico descontinuado (evitar uso para implementacao nova).

## Ordem de leitura recomendada

1. `modular-map/README.md`
2. `modular-map/blueprint-final.md`
3. `modular-map/HISTORICO_MODULOS.md`
4. `standards/README.md`

## Regra para novos projetos do GrupoB

Todo novo sistema deve copiar esta base documental minima:

1. mapa modular
2. historico por modulo
3. padroes globais (design + stack + infraestrutura)
