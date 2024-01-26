import { defineConfig } from 'tsup';

export default defineConfig(options => ({
  entry: ['src/index.ts'],
  splitting: true,
  treeshake: true,
  dts: true,
  shims: true,
  sourcemap: true,
  clean: !options.watch,
  metafile: !options.watch,
  platform: 'browser',
  outDir: 'lib',
}));
