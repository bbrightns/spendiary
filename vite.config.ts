import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'
import pkg from './package.json'

const commitHash = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim()
  } catch {
    return 'dev'
  }
})()

const version = pkg.version ?? '1.0.0'
const builtAt = new Date().toISOString()

/**
 * Writes /version.json next to the app, so an open tab can tell a newer deploy is out
 * (src/hooks/useNewVersion.ts) and offer a refresh.
 */
const versionFile: Plugin = {
  name: 'spendiary-version-file',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version, commit: commitHash, builtAt }) })
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), versionFile],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __BUILD_TIME__: JSON.stringify(builtAt),
  },
  server: {
    // A preview launcher may assign another port when 3000 is taken
    port: Number(process.env.PORT) || 3000,
  },
  build: {
    chunkSizeWarningLimit: 1600,
  },
})

