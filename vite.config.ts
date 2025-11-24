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
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
          ],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-supabase': ['@supabase/supabase-js'],
          
          // Feature chunks
          'feature-charts': ['recharts'],
          'feature-excel': ['xlsx'],
          'feature-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'feature-date': ['date-fns', 'react-day-picker'],
          
          // Admin pages chunk
          'admin-pages': [
            './src/pages/AdminDashboard',
            './src/pages/EventsManagement',
            './src/pages/UserManagement',
            './src/pages/AuditLogs',
          ],
          
          // Member pages chunk
          'member-pages': [
            './src/pages/Dashboard',
            './src/pages/Give',
            './src/pages/History',
            './src/pages/Testimony',
            './src/pages/Prayer',
          ],
          
          // Reports chunk (heavy pages)
          'reports': [
            './src/pages/FinancialReports',
            './src/pages/AttendanceReport',
            './src/pages/ConversionDashboard',
            './src/pages/MobilizationReport',
          ],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
}));
