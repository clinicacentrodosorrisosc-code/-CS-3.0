import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'next/navigation': path.resolve(__dirname, './src/crm/lib/next-bridge.tsx'),
      'next/link': path.resolve(__dirname, './src/crm/lib/next-bridge.tsx'),
    },
    dedupe: ['react', 'react-dom']
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        // Mantém o arquivo de entrada estável para que o HTML e o bundle
        // publicado pela Vercel não se desencontrem por cache de hash.
        entryFileNames: 'assets/app.js',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three')) {
              return 'vendor-three';
            }
            if (id.includes('xlsx')) {
              return 'vendor-xlsx';
            }
            if (id.includes('recharts') || id.includes('d3')) {
              return 'vendor-charts';
            }
            if (id.includes('@xyflow') || id.includes('@dnd-kit')) {
              return 'vendor-flow';
            }
            return 'vendor';
          }
        }
      }
    },
    chunkSizeWarningLimit: 2000
  },
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
})
