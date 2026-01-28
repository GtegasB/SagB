
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega as variáveis de ambiente baseadas no modo (development/production)
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // INJEÇÃO FORÇADA: Define a chave diretamente aqui para garantir que o navegador receba.
      // O JSON.stringify é necessário para que o Vite entenda que é uma string.
      'process.env.API_KEY': JSON.stringify("AIzaSyBEOgPmOrquY54NIV2p6YoClk17ZFOSL6k"),
      'process.env.VITE_DEEPSEEK_API_KEY': JSON.stringify("sk-b6725e26ad154430836dbfda506214bb"), // New Key

      // Polyfill de segurança
      'process.env': JSON.stringify({}),
    },
    resolve: {
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
    },
    server: {
      port: 3000,
      host: true
    }
  }
})
