
# GRUPOB ECOSYSTEM - DEV LOG

## 1. Visão Geral do Sistema
**Nome:** SagB (Sistema Autônomo GrupoB)
**Versão Atual:** 1.6.4 (Ergonomia Chat)
**Responsável Técnico:** Cássio Mendes (AI Architect)
**Chairman:** Douglas Rodrigues

Este documento serve como a "memória de longo prazo" do projeto. Ao iniciar um novo chat, a IA deve ler este arquivo para entender o contexto técnico e as regras de negócio vigentes.

---

## 2. Protocolo Golden Seal (Módulos Blindados) 🔒

As telas abaixo foram aprovadas pelo Chairman e **NÃO DEVEM** ser alteradas em sua lógica estrutural sem ordem explícita para "Quebrar o Selo".

- **`components/ManagementView.tsx`**: (ClickUp Style) - Entrada rápida de dados implementada. Não retornar para modelo puramente conversacional.
- **`components/SystemicVision.tsx`**: (Cluster View) - Chat ajustado com sidebar redimensionável e avatares visíveis.

---

## 3. Arquitetura Atual

### Estrutura de Pastas
- **`/components`**: Interface Visual (React + Tailwind).
  - `HubView.tsx`: Tela principal (Visão Orbital).
  - `SystemicVision.tsx`: (Cluster View) Visualização de Agentes e Chat Split-View.
  - `AgentFactory.tsx`: (RH) Criação e definição de DNA de agentes (Tulian Zagoto).
  - `UnitView.tsx`: (War Room) Sala de chat específica de uma Unidade de Negócio.
  - `ManagementView.tsx`: (Klaus) **[LOCKED]** Gestão de Tarefas hibrida (Lista Rápida + Chat).
- **`/services`**: Lógica de Backend/AI.
  - `gemini.ts`: Conexão com Google Gemini 2.0 Flash Exp. Gerenciamento de streams e prompts.
- **`/data`**: Dados Estáticos e Seeds.
  - `agents.ts`: Lista Mestre de Agentes (Seed inicial).
  - `prompts.ts`: As 3 camadas de DNA (Constituição, Contexto, Identidade).

### Fluxos Principais
1. **Navegação**: Sidebar (Desktop) controla a `activeTab`. `HubView` é a home.
2. **Interação com Agente**:
   - Se Agente **Planejado** -> Redireciona para `AgentFactory` (Onboarding).
   - Se Agente **Ativo** -> Redireciona para `SystemicVision` (Modo Chat/Split View).
3. **Gestão de Tarefas (Novo)**:
   - Entrada direta via Input no topo da lista "A Fazer".
   - Chat serve apenas para debate estratégico.

---

## 4. Histórico de Mudanças (Changelog)

### [v1.6.4] - Ergonomia Chat
- **Resizable Sidebar**: Barra lateral de histórico agora pode ser arrastada para aumentar a largura (ideal para telas 24").
- **Avatares**: Fotos do Agente (esquerda) e Douglas (direita) restauradas em todas as mensagens do chat individual.

### [v1.6.3] - Fast Track & Golden Seal
- **ManagementView**: Adicionado input direto estilo ClickUp no topo da lista. O chat agora é secundário à operação de entrada de dados.
- **Processo**: Instituído protocolo de blindagem de módulos (Golden Seal).

### [v1.6.2] - Consolidação de Chat
- **Ajuste Crítico**: Restaurada a lógica de clique no Agente.
- **Rota Inteligente**: Clicar em agente "Planejado" abre o RH. Clicar em "Ativo" abre o Chat.
- **UI**: O `SystemicVision` agora aceita um `forcedAgent` para abrir diretamente na conversa, sem mostrar o grid.

---

## 5. Padrões de Código (Diretrizes Cássio)
1. **XML Output**: Todas as alterações de código devem ser entregues em blocos XML `<changes>`.
2. **Sem Alucinação**: Se uma funcionalidade não existe, não invente que ela funciona.
3. **Clean Code**: Componentes pequenos, tipagem TypeScript estrita.
4. **Estética**: Tailwind CSS, foco em "Clean & Professional" (Grayscale + Cores da Marca).

## 6. Próximos Passos (Backlog Técnico)
- [ ] Refinar a persistência de memória dos agentes (além do localStorage).
- [ ] Implementar busca global no Ecossistema.
- [ ] Conectar n8n para automações externas (webhook).
