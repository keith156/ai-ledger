import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // Direct replacement for the specific env var used by the Gemini SDK
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ""),
      // Polyfill process.env to prevent crashes if other libs check it
      'process.env': JSON.stringify(env),
    }
  };
});