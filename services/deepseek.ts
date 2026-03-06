import { callAiProxy } from './aiProxy';

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function* streamDeepSeekResponse(
  messages: DeepSeekMessage[],
  systemInstruction: string
) {
  try {
    const response = await callAiProxy<{ text: string }>('deepseek_chat', {
      messages,
      systemInstruction
    });

    yield { text: response.text || '' };
  } catch (error) {
    console.error("DeepSeek proxy request failed", error);
    yield { text: "\n\n[ERRO CRITICO DE CONEXAO COM DEEPSEEK API. VERIFIQUE A CHAVE OU QUOTA.]" };
  }
}
