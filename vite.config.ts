
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// Import process from node:process to ensure Node.js types are used instead of browser types
import process from 'node:process';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ""),
    }
  };
});
