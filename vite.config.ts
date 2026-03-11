import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Carrega somente variáveis VITE_ do .env conforme o modo
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  // Base padrão para deploy no domínio raiz
  // Se você quiser subpasta, defina VITE_BASE_PATH="/sua-subpasta/"
  const basePath = env.VITE_BASE_PATH && env.VITE_BASE_PATH.trim() ? env.VITE_BASE_PATH : '/'
  const aiProxyTarget = env.VITE_AI_PROXY_TARGET && env.VITE_AI_PROXY_TARGET.trim()
    ? env.VITE_AI_PROXY_TARGET
    : 'https://sagb.piblo.com.br'

  return {
    base: basePath,
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: aiProxyTarget,
          changeOrigin: true,
          secure: true
        }
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (id.includes('react-markdown')) return 'markdown'
            if (id.includes('@google/genai')) return 'ai-sdk'
            if (id.includes('react') || id.includes('scheduler')) return 'react-vendor'
            return 'vendor'
          }
        }
      }
    },

    resolve: {
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
    }
  }
})
