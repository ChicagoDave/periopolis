/**
 * @file Vite for the Board: one self-contained page, so it can still be published the way the sketch was.
 * Owner context: Board (adapter).
 */
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [viteSingleFile()],
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
});
