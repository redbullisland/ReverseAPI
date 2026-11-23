import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { handleLookup } from './api/eyecon.js';

// No separate backend: the API route is handled by Vite's own middleware in
// both `npm run dev` and `npm run preview`.
function eyeconLookup() {
  const middleware = (req, res, next) => {
    if (req.url?.split('?')[0] !== '/api/lookup') return next();
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end('Method not allowed');
      return;
    }
    void handleLookup(req, res);
  };
  return {
    name: 'eyecon-lookup',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  plugins: [react(), eyeconLookup()],
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
});
