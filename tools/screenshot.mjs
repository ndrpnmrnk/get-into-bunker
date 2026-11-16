// Usage: node tools/screenshot.mjs <url> <out.png> [view]
import { chromium } from 'playwright';

const [url, out, view = 'overview'] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`${url}${url.includes('?') ? '&' : '?'}view=${view}`);
await page.waitForFunction(() => window.__probeReady === true, null, { timeout: 120000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: out });
if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));
await browser.close();
console.log('WROTE', out);
