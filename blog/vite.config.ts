import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    manifest: true,
    rollupOptions: {
      input: 'src/main.ts',
      output: {
        entryFileNames: 'assets/bundle-[hash].js',
        assetFileNames: 'assets/bundle-[hash][extname]',
      },
    },
  },
})
