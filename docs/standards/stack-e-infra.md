# Stack e Infra Padrao - GrupoB

## Aplicacao base

Com base em `package.json`, `netlify.toml`, `.github/workflows/*` e docs tecnicas:

- Frontend: React + TypeScript + Vite.
- UI: Tailwind via CDN (com plugin typography).
- IA: Gemini, DeepSeek, Llama local, OpenAI, Claude e Qwen (via proxy backend).
- Banco/Auth: Supabase.
- Backend serverless: Netlify Functions (`netlify/functions/ai.mjs`).

## Deploy

- Provedor principal: Netlify.
- Config principal: `netlify.toml`.
- Redirect de API: `/api/ai -> /.netlify/functions/ai`.

## CI/CD

- GitHub Actions com build em Node 20:
  - `.github/workflows/deploy.yml`
  - `.github/workflows/netlify-deploy.yml`

## Variaveis de ambiente essenciais

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `GEMINI_API_KEY`
- `DEEPSEEK_API_KEY`

## Diretriz para novos sistemas

1. Reaproveitar esse stack por padrao.
2. Se houver desvio (ex.: outro backend/deploy), documentar motivacao e impacto.
3. Manter compatibilidade de integracao com SagB via APIs/contratos definidos.
