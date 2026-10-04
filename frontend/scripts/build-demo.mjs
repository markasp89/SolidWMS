// Builds the standalone demo (one HTML file) and prepares it for hosting as a
// page fragment: the host adds <!doctype>/<html>/<head>/<body> itself.
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

execSync('npx vite build --mode demo', { stdio: 'inherit' })

const html = readFileSync('dist-demo/index.html', 'utf8')
const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? ''
const body = html.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? ''

const keep = head
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta name="viewport"[^>]*>/i, '')
  .replace(/<link rel="(icon|manifest|apple-touch-icon)"[^>]*>/gi, '')
  .replace(/<meta name="apple-mobile-web-app-capable"[^>]*>/i, '')
  .replace(/<title>[^<]*<\/title>/i, '')

const page = `<title>SolidWMS Demo</title>\n${keep.trim()}\n${body.trim()}\n`
writeFileSync('dist-demo/solidwms-demo.html', page)
console.log(`dist-demo/solidwms-demo.html: ${(page.length / 1024).toFixed(0)} KiB`)
