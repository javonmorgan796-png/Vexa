import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

const supabaseEnvPlugin = {
  name: 'vexa-supabase-env',
  transform(source: string, id: string) {
    if (!id.includes('/src/lib/supabase.ts')) return null;

    return {
      code: source
        .replace(
          /import\.meta\.env\.SUPABASE_URL/g,
          JSON.stringify(process.env.SUPABASE_URL ?? ''),
        )
        .replace(
          /import\.meta\.env\.SUPABASE_ANON_KEY/g,
          JSON.stringify(process.env.SUPABASE_ANON_KEY ?? ''),
        )
        .replace(
          /\b__SUPABASE_URL__\b/g,
          JSON.stringify(process.env.SUPABASE_URL ?? ''),
        )
        .replace(
          /\b__SUPABASE_ANON_KEY__\b/g,
          JSON.stringify(process.env.SUPABASE_ANON_KEY ?? ''),
        ),
      map: null,
    };
  },
};

export default defineConfig({
  base: basePath,
  // Do not expose arbitrary SUPABASE_* values. Only the URL and anon key
  // below are intentionally injected because the browser auth client needs
  // them. Never add a service-role key here.
  define: {
    // Inject the public Supabase connection values into the browser bundle.
    // Explicit import.meta.env keys work with Replit secrets at dev and build time.
    'import.meta.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL ?? ''),
    'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY ?? ''),
    // Keep compatibility with older modules that reference these constants.
    __SUPABASE_URL__: JSON.stringify(process.env.SUPABASE_URL ?? ''),
    __SUPABASE_ANON_KEY__: JSON.stringify(process.env.SUPABASE_ANON_KEY ?? ''),
  },
  plugins: [
    react(),
    tailwindcss(),
    supabaseEnvPlugin,
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
