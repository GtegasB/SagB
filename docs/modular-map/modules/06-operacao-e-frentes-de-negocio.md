# Modulo 06 - Operacao e Frentes de Negocio

## Objetivo

Cobrir as superficies de trabalho diario, pauta, conversas operacionais, war rooms e frentes por unidade ou venture.

## Papel dentro do SagB

### Fato observado

- Este modulo esta distribuido por varias views: `ConversationsView`, `BacklogView`, `ManagementView`, `UnitView`, `AlignmentView`, `VenturesView`, `ThreeForBView`, `StartyBView`, `AudacusView` e os canais `requests`/`redir`.

### Inferencia

- Nao e um unico motor tecnico, mas sim um conjunto real de salas e superficies operacionais que reaproveitam a base do SagB.

## Arquivos principais

- `components/ConversationsView.tsx`
- `components/BacklogView.tsx`
- `components/ManagementView.tsx`
- `components/UnitView.tsx`
- `components/AlignmentView.tsx`
- `components/VenturesView.tsx`
- `components/ThreeForBView.tsx`
- `components/StartyBView.tsx`
- `components/AudacusView.tsx`
- `App.tsx`
- `utils/supabaseChat.ts`

## Dependencias

- `tasks`
- `topics`
- `ventures`
- `chat_sessions`
- `chat_messages`
- `agents`
- provedores de IA

## Fluxos principais

1. Navegar por conversas existentes
2. Criar pautas e atualizar status
3. Operar o `ManagementView` com Klaus e parsing de JSON oculto para gerar task
4. Entrar em salas por unidade com contexto proprio
5. Fazer alinhamento estrategico por BU
6. Operar frentes especificas como 3forB, StartyB e Audacus

## Dados usados

- Tasks
- Topics
- Ventures
- Agents
- Sessions e messages
- Alguns dados estaticos por frente

## Status atual

- Misto: parte forte e parte adaptativa, com algumas frentes ainda semi-mockadas.

## O que ja esta pronto

- Browser de conversas
- Quadro de pautas
- Golden Seal / Management com persistencia
- Sala de unidade
- Sala de alinhamento
- CRUD de ventures
- Frentes especificas funcionando em algum nivel

## O que ainda falta

- Padronizar a experiencia de chat entre as frentes
- Reduzir duplicacao de logica
- Trocar dados mockados por dados reais em algumas views
- Melhor separar superfices genericas de frentes experimentais

## Riscos e lacunas

- `StartyBView` usa projetos ativos estaticos
- `AudacusView` e um gateway fino, nao um modulo funcional profundo
- `ThreeForBView` implementa chat proprio em vez de reaproveitar todo o core

## Modulos tocados

- Plataforma Base
- Core Conversacional
- Agentes
- Ventures
- Qualidade e Fluxo indiretamente

## Arquivos de apoio recomendados

- `utils/supabaseChat.ts`
- `types.ts`
