import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/timezone-sync/',
  build: {
    rollupOptions: {
      // index.html — current interface (src/v2, 10 languages); v1.html — the original one. Both share src/lib
      input: { main: 'index.html', v1: 'v1.html' },
    },
  },
})
