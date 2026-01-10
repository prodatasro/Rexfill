import juno from "@junobuild/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), juno(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split React and related libraries
          'react-vendor': ['react', 'react-dom', 'react-i18next', 'i18next'],
          // Split Juno/Internet Computer libraries
          'juno-vendor': ['@junobuild/core', '@junobuild/functions'],
          // Split document processing libraries (large)
          'docx-vendor': ['docxtemplater', 'pizzip'],
          // Split UI libraries
          'ui-vendor': ['lucide-react', 'sonner'],
        },
      },
    },
    // Increase chunk size warning limit to 600kb
    chunkSizeWarningLimit: 600,
  },
});
