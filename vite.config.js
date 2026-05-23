import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  server: {
    port: 5174,
    proxy: {
      '/serpapi': {
        target: 'https://serpapi.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/serpapi/, ''),
      },
      '/pappers': {
        target: 'https://api.pappers.fr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/pappers/, ''),
      },
    },
  },
})
