import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Carrega somente variáveis VITE_ do .env conforme o modo
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  // Base padrão para deploy no domínio raiz
  // Se você quiser subpasta, defina VITE_BASE_PATH="/sua-subpasta/"
  const basePath = env.VITE_BASE_PATH && env.VITE_BASE_PATH.trim() ? env.VITE_BASE_PATH : '/'

  return {
    base: basePath,
    plugins: [react()],

    // Compatibilidade para libs que ainda consultam process.env no runtime do browser
    // Atenção: tudo que entrar aqui vira parte do bundle e pode ser visto no frontend
    define: {
      'process.env': {
        API_KEY: env.VITE_GEMINI_API_KEY || '',
        VITE_DEEPSEEK_API_KEY: env.VITE_DEEPSEEK_API_KEY || ''
      }
    },

    resolve: {
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
    }
  }
})
