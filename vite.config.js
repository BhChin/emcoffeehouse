import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/* Two entry points. Vite only builds index.html by default, so /menu would 404
   in production while working perfectly in dev — the kind of gap that only
   shows up after deploy. */
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        menu: resolve(__dirname, 'menu.html'),
      },
    },
  },
});
