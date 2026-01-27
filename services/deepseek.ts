
// SERVIÇO DE INTEGRAÇÃO DEEPSEEK (AUDITORIA)
// Responsável pela inteligência do Agente Dr. Alex Chen

// SEGURANÇA: Prioriza variável de ambiente. Fallback mantido apenas para dev local.
const DEEPSEEK_API_KEY = process.env.VITE_DEEPSEEK_API_KEY || "sk-b6725e26ad154430836dbfda506214bb";
const API_URL = "https://api.deepseek.com/chat/completions";

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Simulador de Stream compatível com a interface do Gemini
// Isso permite que o SystemicVision consuma os dados da mesma forma
export async function* streamDeepSeekResponse(
  messages: DeepSeekMessage[],
  systemInstruction: string
) {

  if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY.includes("SUA_CHAVE")) {
    yield { text: "\n\n[ERRO DE CONFIGURAÇÃO: Chave DeepSeek não encontrada no .env]" };
    return;
  }

  // Prepara o payload
  const fullMessages = [
    { role: 'system', content: systemInstruction },
    ...messages
  ];

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat", // V3 (Equilibrado)
        messages: fullMessages,
        stream: true, // Habilita Streaming
        temperature: 0.5, // Analítico mas criativo
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`DeepSeek API Error: ${err}`);
    }

    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim() === "") continue;
        if (line.trim() === "data: [DONE]") return;

        if (line.startsWith("data: ")) {
          try {
            const json = JSON.parse(line.substring(6));
            const content = json.choices[0]?.delta?.content || "";
            if (content) {
              // Yield object compatible with Gemini Response format wrapper
              yield { text: content };
            }
          } catch (e) {
            console.warn("DeepSeek Parse Error", e);
          }
        }
      }
    }

  } catch (error) {
    console.error("DeepSeek Connection Failed", error);
    yield { text: "\n\n[ERRO CRÍTICO DE CONEXÃO COM DEEPSEEK API. VERIFIQUE A CHAVE OU QUOTA.]" };
  }
}
