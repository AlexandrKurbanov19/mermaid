import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // На GitHub Pages сайт живёт в подпапке /<repo>/, поэтому base задаётся при сборке:
  // VITE_BASE=/mermaid/ npm run build
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: { port: 5199, strictPort: true },
})
