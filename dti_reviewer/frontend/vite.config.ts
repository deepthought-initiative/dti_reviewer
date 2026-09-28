import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config";

const base = (process.env.APP_BASE_PATH || "/").replace(/\/+$/, "") + "/"
const apiProxy = {
  target: "http://localhost:5000",
  rewrite: (path: string) => path.slice(base.length - 1),
}

export default defineConfig({
  base,
  server: {
    proxy: {
      [`${base}auth/`]: apiProxy,
      [`${base}vectorize`]: apiProxy,
      [`${base}search`]: apiProxy,
      [`${base}status/`]: apiProxy,
    },
  },
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
