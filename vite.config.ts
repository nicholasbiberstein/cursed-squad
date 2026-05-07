import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@data':    path.resolve(__dirname, 'src/data'),
      '@systems': path.resolve(__dirname, 'src/systems'),
      '@ai':      path.resolve(__dirname, 'src/ai'),
      '@ui':      path.resolve(__dirname, 'src/ui'),
      '@lib':     path.resolve(__dirname, 'src/lib'),
      '@store':   path.resolve(__dirname, 'src/store.ts'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
})