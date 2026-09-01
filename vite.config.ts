import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Served from https://<user>.github.io/SD8000/ — every absolute asset/route path needs this prefix.
const base = '/SD8000/'

// GITHUB_RUN_NUMBER/GITHUB_SHA are set automatically by Actions on every workflow run; fall back
// to git/`dev` for local builds so `npm run build` still works outside CI.
function shortSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

const buildInfo = {
  runNumber: process.env.GITHUB_RUN_NUMBER ?? 'local',
  commit: shortSha(),
  builtAt: new Date().toISOString(),
}

export default defineConfig({
  base,
  define: {
    __BUILD_INFO__: JSON.stringify(buildInfo),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Puanteur Idle',
        short_name: 'Puanteur',
        description: "Idle game data science — accumule de la puanteur, redouble, passe d'année, réoriente-toi.",
        theme_color: '#0f1115',
        background_color: '#0f1115',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico}'],
      },
    }),
  ],
})
