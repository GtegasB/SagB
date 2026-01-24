
# SagB - Sistema Autônomo GrupoB

**Versão:** 1.6.4 (Hub Consolidation)  
**Codename:** Systemic Vision

O **SagB** é o ecossistema central de inteligência e gestão do GrupoB. Uma aplicação React (Vite) focada em arquitetura multi-agente, onde cada unidade de negócio possui especialistas virtuais (IAs) orquestrados para operações de alta performance.

![Status](https://img.shields.io/badge/Status-Production-green)
![Tech](https://img.shields.io/badge/Stack-React%20%7C%20TypeScript%20%7C%20Tailwind%20%7C%20Gemini%202.0-blue)

## 🏗 Arquitetura

O sistema opera sob o conceito de **"Cluster View"**, permitindo visão orbital de todas as empresas do grupo e acesso granular via **"War Rooms"** (Salas de Guerra) ou Chat Direto com Agentes.

### Módulos Principais
*   **HubView:** Visão sistêmica das 19 unidades de negócio.
*   **SystemicVision:** Interface de chat e gestão de agentes (DeepSeek + Gemini).
*   **AgentFactory:** Módulo de RH para criação e "contratação" de novos agentes (Prompt Engineering automatizado).
*   **GovernanceView:** Painel de controle da Constituição Global e regras do sistema.
*   **ManagementView:** Gestão de tarefas híbrida (Chat + Lista Rápida).

## 🚀 Como Rodar Localmente

1.  **Clone o repositório**
    ```bash
    git clone https://github.com/SEU_USUARIO/sagb.git
    cd sagb
    ```

2.  **Instale as dependências**
    ```bash
    npm install
    # ou
    yarn
    ```

3.  **Configure as Variáveis de Ambiente**
    Crie um arquivo `.env` na raiz e adicione suas chaves (não inclusas no repo por segurança):
    ```env
    VITE_GOOGLE_API_KEY=sua_chave_aqui
    VITE_DEEPSEEK_API_KEY=sua_chave_aqui
    ```

4.  **Rode o projeto**
    ```bash
    npm run dev
    ```

## 🔒 Protocolo de Segurança (Golden Seal)

Certos módulos possuem "Golden Seal" e não devem ter sua lógica alterada sem aprovação do Chairman (Douglas Rodrigues):
*   `ManagementView.tsx` (ClickUp Logic)
*   `SystemicVision.tsx` (Cluster Logic)

## 🛠 Stack Tecnológica

*   **Frontend:** React 18+, TypeScript, TailwindCSS.
*   **AI Core:** Google GenAI SDK (Gemini 2.0 Flash Exp) & DeepSeek API (V3).
*   **Build:** Vite.
*   **Deploy:** Firebase Hosting (configurado).

---
*Desenvolvido pela Arquitetura de Sistemas GrupoB.*
" " 
