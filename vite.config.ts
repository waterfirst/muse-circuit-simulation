import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // relative base: works on both waterfirst.pro/circuit-muse/ and
  // waterfirst.github.io/muse-circuit-simulation/ (GitHub Pages)
  base: "./",
})
