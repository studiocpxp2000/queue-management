import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const customRouteLogger = () => {
  const printRoutes = (server) => {
    const urls = server.resolvedUrls;
    // Prefer network URL if available (for VPS/external access), otherwise use local URL
    const baseUrl = urls?.network?.[0] || urls?.local?.[0] || 'http://localhost:3013';
    const cleanUrl = baseUrl.replace(/\/$/, '');
    
    console.log('\n  ➜  Available Application Routes:');
    console.log(`  ➜  Input Page:     ${cleanUrl}/`);
    console.log(`  ➜  Queue Page:     ${cleanUrl}/queue`);
    console.log(`  ➜  Promoter Page:  ${cleanUrl}/promoter`);
    console.log(`  ➜  Player Card:    ${cleanUrl}/player-card`);
    console.log(`  ➜  Admin Panel:    ${cleanUrl}/admin\n`);
  };

  return {
    name: 'custom-route-logger',
    configureServer(server) {
      const originalPrint = server.printUrls;
      server.printUrls = () => {
        originalPrint();
        printRoutes(server);
      };
    },
    configurePreviewServer(server) {
      const originalPrint = server.printUrls;
      server.printUrls = () => {
        originalPrint();
        printRoutes(server);
      };
    }
  };
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), customRouteLogger()],
  server: {
    port: 3013,
  }
})
