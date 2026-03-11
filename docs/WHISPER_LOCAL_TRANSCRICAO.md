# Transcrição Local com Whisper (SagB)

## Objetivo
Permitir transcrição de áudio no chat do SagB em ambiente local, sem depender de chave Gemini para `transcribe_audio`.

## Status
- Implementado no frontend (`services/gemini.ts`).
- Implementado servidor local compatível OpenAI (`tools/local_whisper_server.py`).
- Script de execução criado: `npm run whisper:local`.

## Como subir (Windows, local)
1. Terminal A (servidor Whisper):
```bash
npm run whisper:local
```

2. Terminal B (app SagB):
```bash
npm run dev
```

3. No navegador, faça `Ctrl+F5`.

## Variáveis de ambiente (`.env.local`)
```env
VITE_TRANSCRIBE_PROVIDER=local_whisper
VITE_LOCAL_WHISPER_URL=http://127.0.0.1:8000
VITE_LOCAL_WHISPER_MODEL=whisper-1
VITE_LOCAL_WHISPER_LANGUAGE=pt
```

Observação:
- Se `VITE_TRANSCRIBE_PROVIDER=local_whisper`, o app não tenta usar `/api/ai` para transcrição.
- `VITE_LOCAL_WHISPER_API_KEY` é opcional (somente se seu endpoint exigir autenticação).

## Endpoint esperado
- Health: `GET http://127.0.0.1:8000/health`
- Transcrição: `POST http://127.0.0.1:8000/v1/audio/transcriptions`

## Diagnóstico rápido
### Erro: `Nenhuma conexão ... 127.0.0.1:8000`
O servidor local não está rodando. Subir com `npm run whisper:local`.

### Erro: `address already in use` na porta 8000
Já existe processo ocupando a porta. Encerrar o processo ou trocar porta e URL.

### Mensagem no chat: `(Não foi possível transcrever o áudio. Tente novamente.)`
- Verifique `VITE_LOCAL_WHISPER_URL`.
- Verifique se o endpoint `/health` responde.
- Reinicie `npm run dev` após alterar `.env.local`.

### Console com erro DeepSeek
É outro problema (chat LLM), separado da transcrição de áudio.

## Arquivos envolvidos
- `tools/local_whisper_server.py`
- `services/gemini.ts`
- `components/SystemicVision.tsx`
- `package.json` (`whisper:local`)
- `.env.example`
