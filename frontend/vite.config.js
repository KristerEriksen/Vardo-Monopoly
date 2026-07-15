import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  cacheDir: 'C:/Users/kriae/AppData/Local/vite-cache/monopoly-frontend',
  server: {
    // Backend-rutene har ingen CORS-headers, så create/join må gå via proxy.
    // Socket.IO kobles direkte til :3000 (den har cors: "*").
    proxy: {
      '/createGame': 'http://localhost:3000',
      '/joinGame': 'http://localhost:3000',
      // Socket.IO proxyes med websocket-støtte i dev, så io() kan bruke samme opphav som i produksjon.
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
})
