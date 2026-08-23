import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 4175,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: "http://localhost:3334",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      devOptions: {
        enabled: false,
        type: "module",
      },
      manifest: {
        name: "SISLOTE - Gestão de Loteamentos",
        short_name: "SISLOTE",
        description: "Sistema de gestão de loteamentos imobiliários",
        start_url: "/",
        display: "standalone",
        background_color: "#f0fdf4",
        theme_color: "#10b981",
        orientation: "portrait-primary",
        lang: "pt-BR",
        icons: [
          {
            src: "/lp/assets/brand/sislote-simbolo.png",
            sizes: "1254x1254",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/lp/assets/brand/sislote-simbolo.png",
            sizes: "1254x1254",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/lp/assets/brand/sislote-simbolo.png",
            sizes: "1254x1254",
            type: "image/png",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
