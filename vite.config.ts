import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  define: {
    // Ensure global is defined for browser compatibility
    global: 'globalThis',
  },
  server: {
    port: 5174,
    host: '0.0.0.0', // Allow access from any IP address
    cors: true,
    strictPort: false, // Try next port if 5174 is busy
    headers: {
      // Very permissive CSP for development to avoid Chrome blocking issues
      'Content-Security-Policy': process.env.NODE_ENV === 'development' 
        ? "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' data: blob:; style-src * 'unsafe-inline' data: blob:; img-src * data: blob:; font-src * data: blob:; connect-src * data: blob: wss:; worker-src * blob:; child-src * blob:; object-src 'none'; base-uri 'self';"
        : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co;",
      // Additional headers for better browser compatibility
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
      'Cross-Origin-Opener-Policy': 'unsafe-none'
    }
  }
});
