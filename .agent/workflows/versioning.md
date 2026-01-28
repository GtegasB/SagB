---
description: Como atualizar as versões do SagB (v1.x.x)
---

Para garantir que o sistema, o GitHub e os usuários estejam sempre sincronizados, siga este fluxo de versionamento:

### 1. Escolha o Incremento (SemVer)
- **v1.1.X (Patch):** Correções de bugs, ajustes de texto ou pequenas melhorias visuais.
- **v1.X.0 (Minor):** Novas funcionalidades que não quebram o sistema (ex: novo agente, novo módulo).
- **X.0.0 (Major):** Mudanças estruturais grandes no banco de dados ou refatoração completa.

### 2. Atualize os Arquivos de Metadados
Sempre atualize a versão nestes dois locais:
1. **[metadata.json](file:///d:/GrupoB%20-%20C%C3%A9rebro/APLICATIVOS%20GRUPOB/SagB/SagB_App/SagB_App/metadata.json):** Altere a chave `"version"`. Isso atualiza o rodapé do Sidebar.
2. **[package.json](file:///d:/GrupoB%20-%20C%C3%A9rebro/APLICATIVOS%20GRUPOB/SagB/SagB_App/SagB_App/package.json):** Altere a chave `"version"` para manter a compatibilidade com o ecossistema Node.js.

### 3. Procedimento de Deploy
1. **Build Local:** `npm run build`
2. **Commit:** Use o número da versão na mensagem.
   - Exemplo: `git commit -m "feat: deploy v1.1.1 - fix neural collision error"`
3. **Push/Deploy:** `git push` ou `firebase deploy`.

### 4. Dica de Automação (Newton)
Para futuras automações, o GitHub Actions pode ser configurado para ler o `package.json` e criar uma **Release** automática no GitHub assim que o código chegar na branch `main`.
