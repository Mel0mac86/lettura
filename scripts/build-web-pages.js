#!/usr/bin/env node
/**
 * Builds the web version for GitHub Pages as an installable iPhone web app
 * ("Aggiungi alla schermata Home").
 *
 *   node scripts/build-web-pages.js [/base-path]   (default: /lettura)
 *
 * Output: dist-web/ (index.html + 404.html for client-side routes, icons, manifest).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const base = (process.argv[2] || '/lettura').replace(/\/$/, '');
const out = path.join(root, 'dist-web');

fs.rmSync(out, { recursive: true, force: true });
execSync(`npx expo export --platform web --output-dir dist-web`, {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, EXPO_BASE_URL: base, CI: '1' },
});

fs.copyFileSync(path.join(root, 'assets', 'icon.png'), path.join(out, 'apple-touch-icon.png'));
fs.writeFileSync(
  path.join(out, 'manifest.webmanifest'),
  JSON.stringify(
    {
      name: 'My Book Reader',
      short_name: 'Book Reader',
      start_url: `${base}/`,
      scope: `${base}/`,
      display: 'standalone',
      background_color: '#F7F4EE',
      theme_color: '#F7F4EE',
      icons: [{ src: `${base}/apple-touch-icon.png`, sizes: '1024x1024', type: 'image/png' }],
    },
    null,
    2,
  ),
);

const head = [
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-title" content="Book Reader" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
  '<meta name="theme-color" content="#F7F4EE" />',
  `<link rel="apple-touch-icon" href="${base}/apple-touch-icon.png" />`,
  `<link rel="manifest" href="${base}/manifest.webmanifest" />`,
].join('\n');
const indexPath = path.join(out, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8').replace('</head>', `${head}\n</head>`);
// viewport-fit=cover so the app uses the whole iPhone screen in standalone mode.
html = html.replace(/<meta name="viewport" content="([^"]*)"/, (m, c) => (c.includes('viewport-fit') ? m : `<meta name="viewport" content="${c}, viewport-fit=cover"`));
fs.writeFileSync(indexPath, html);
// GitHub Pages serves 404.html for unknown paths: reuse the app so deep links work.
fs.writeFileSync(path.join(out, '404.html'), html);
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log(`\nWeb app ready in dist-web/ (base path ${base}/)`);
