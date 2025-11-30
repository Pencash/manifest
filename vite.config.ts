import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger(),
    mode === "development" && visualizer({
      open: false,
      filename: "dist/stats.html",
      gzipSize: true,
      brotliSize: true,
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks - only split external dependencies
          if (id.includes('node_modules')) {
            // React ecosystem - must be in same chunk to avoid multiple instances
            if (id.includes('/node_modules/react/') || 
                id.includes('/react-dom/') || 
                id.includes('/react-router') ||
                id.includes('/scheduler/')) {
              return 'vendor-react';
            }
            if (id.includes('@radix-ui')) {
              return 'vendor-ui';
            }
            if (id.includes('@tanstack/react-query')) {
              return 'vendor-query';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
            if (id.includes('xlsx')) {
              return 'vendor-excel';
            }
            if (id.includes('date-fns') || id.includes('react-day-picker')) {
              return 'vendor-date';
            }
          }
          // Let Vite handle page chunks automatically via lazy loading
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
}));
