import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    base: '/',
    server: {
        headers: {
            'Cross-Origin-Opener-Policy': 'unsafe-none',
        }
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom'],
                    'vendor-motion': ['framer-motion'],
                    'vendor-icons': ['lucide-react'],
                    'vendor-ai': ['@google/generative-ai']
                }
            }
        },
        chunkSizeWarningLimit: 1000 // Double the limit as well for larger combined vendor chunks if needed
    }
})
