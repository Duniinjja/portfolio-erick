// Gera public/curriculo.pdf a partir de cv/curriculo.html com o Chrome (ou Edge) instalado: node cv/gerar-pdf.mjs
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const html = fileURLToPath(new URL('./curriculo.html', import.meta.url));
const pdf = fileURLToPath(new URL('../public/curriculo.pdf', import.meta.url));

const browsers = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
].filter(Boolean);
const browser = browsers.find((path) => existsSync(path));
if (!browser) throw new Error('Chrome ou Edge não encontrado; defina CHROME_PATH.');

execFileSync(browser, ['--headless', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, pathToFileURL(html).href], { stdio: 'inherit' });
console.log(`PDF gerado em ${pdf}`);
