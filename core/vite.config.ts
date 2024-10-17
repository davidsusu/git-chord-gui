import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
    plugins: [
        react(),
        dts({ include: ['lib'] })
    ],
    server: {
        host: '127.0.0.1',
        port: 3000,
    },
    build: {
        lib: {
            entry: resolve(__dirname, 'lib/main.tsx'),
            formats: ['es'],
            name: 'GitChordGui',
            fileName: 'git-chord-gui',
        },
        rollupOptions: {
            external: ['react', 'react/jsx-runtime'],
        },
    },
})
