/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/examples/tanstack-query-spa',
  server: {
    port: 4200,
    host: 'localhost',
  },
  preview: {
    port: 4300,
    host: 'localhost',
  },
  plugins: [react()],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    watch: false,
    globals: true,
    environment: 'jsdom',
    setupFiles: './setupTests.ts',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
  resolve: {
    alias: {
      src: resolve(__dirname, './src'),
      '@chimeric/core': resolve(__dirname, '../../packages/core/src'),
      '@chimeric/react': resolve(__dirname, '../../packages/react/src'),
      '@chimeric/react-query': resolve(
        __dirname,
        '../../packages/react-query/src',
      ),
      '@tanstack/react-query': resolve(
        __dirname,
        './node_modules/@tanstack/react-query',
      ),
      '@testing-library/react': resolve(
        __dirname,
        './node_modules/@testing-library/react',
      ),
    },
  },
  base: '/tanstack-query-spa/',
}));
