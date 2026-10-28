import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // served under https://waterfirst.pro/circuit/
  base: "/circuit/",
})
