import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/timezone-sync/',
  build: {
    rollupOptions: {
      // index.html — v1 interface, v2.html — redesigned interface; both share src/lib
      input: { main: 'index.html', v2: 'v2.html' },
    },
  },
})
