import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

// O canonical só entra quando o endereço do site é conhecido (VITE_SITE_URL no deploy):
// um href relativo "/" seria tratado pelo Vite como arquivo e quebraria o build.
const canonical = (siteUrl: string): Plugin => ({
  name: 'canonical-url',
  transformIndexHtml: (html) =>
    siteUrl ? html.replace('</title>', `</title>\n    <link rel="canonical" href="${siteUrl}/" />`) : html,
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [vue(), canonical(env.VITE_SITE_URL ?? '')],
  }
})
