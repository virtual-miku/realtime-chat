import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
  server: {
      proxy: {
        '/signalr': 'http://localhost:3000',
        '/acs': 'http://localhost:3000',
      },
    },
})
