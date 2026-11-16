import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const isDev = command === 'serve';

  const devManifest = {
    name: "Liminal Horror [DEV]",
    version: "1.0.0-dev",
    manifest_version: 1,
    author: "Liminal Horror RPG (DEV)",
    description: "Servidor local de desarrollo para Liminal Horror OBR",
    icon: "/icon-dev.svg",
    action: {
      title: "Liminal Horror [DEV]",
      icon: "/icon-dev.svg",
      popover: "/",
      width: 410,
      height: 680
    }
  };

  return {
    plugins: [
      react(),
      {
        name: 'vite-plugin-dev-manifest',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            // Servir manifest de desarrollo cuando se solicite /manifest.json en local/túnel
            if (req.url && (req.url === '/manifest.json' || req.url.startsWith('/manifest.json?'))) {
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify(devManifest, null, 2));
              return;
            }
            next();
          });
        }
      }
    ],
    base: isDev ? '/' : './',
    server: {
      port: 5173,
      cors: true,
      host: true, // Permite conexiones externas (LAN y túneles)
      allowedHosts: true // Permite Cloudflare Quick Tunnels, ngrok, etc. sin bloqueo de Host
    }
  };
});
