import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// 部署到 GitHub Pages 项目页（如 https://<user>.github.io/TouchstoneCV/）时，
// 资源必须挂在子路径下。fork 者若换仓库名，设环境变量 VITE_BASE_PATH 覆盖即可。
const basePath = process.env.VITE_BASE_PATH || "/TouchstoneCV/";

export default defineConfig({
  // 构建产物前缀：本地 dev 用 /，GitHub Pages 用 /TouchstoneCV/（或环境变量覆盖）
  base: process.env.NODE_ENV === "production" ? basePath : "/",
  plugins: [
    // Supported browsers use WOFF2; omit duplicate WOFF fallback assets from local fonts.
    {
      name: "local-font-woff2",
      enforce: "pre",
      transform(code, id) {
        if (id.includes("@fontsource/") && id.endsWith(".css")) {
          return code.replace(/,\s*url\([^)]+\.woff\)\s*format\('woff'\)/g, "");
        }
      },
    },
    react(), tailwindcss(),
  ],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    // HMR websocket 默认跟随实际 server 端口；仅当页面经外部代理映射到别的端口时
    // 才需要固定（设 VITE_HMR_PORT）。写死 3000 会让任何第二实例的 HMR
    // 连接失败并抛未捕获异常（页面不白屏，但热更新失效、控制台报错）。
    ...(process.env.VITE_HMR_PORT ? { hmr: { port: Number(process.env.VITE_HMR_PORT) } } : {}),
  },
});
