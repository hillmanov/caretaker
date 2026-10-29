import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import svgr from "vite-plugin-svgr";
import tailwindcss from "@tailwindcss/vite"

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 3027,
    host: "0.0.0.0",
  },
  plugins: [
    tailwindcss(),
    react(),
    svgr(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, './src'),
    },
  }
})
