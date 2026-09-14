import path from 'path';
import os from 'os';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      cacheDir: path.resolve(os.tmpdir(), 'fincontrol-vite-cache'),
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      server: {
        allowedHosts: [
          'fincontrol.wmarks.com.br',
          // ...add other allowed hosts if needed...
        ],
        proxy: {
          '/api': {
            target: 'http://localhost:3001',
            changeOrigin: true,
          },
        },
      },
    };
});
