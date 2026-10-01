#!/usr/bin/env node
/**
 * Copies the offline neural-voice runtime (Piper) into public/piper/ so that
 * the web app serves it from its own origin (no third-party CDN):
 * - web/piper-worker.js                       (our worker)
 * - onnxruntime-web 1.18 (wasm build)         (neural network runtime)
 * - @diffusionstudio/piper-wasm               (espeak-ng phonemizer)
 * The voice model itself is downloaded by the user from the app settings.
 * Runs on `npm install` (postinstall). The output is git-ignored.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'public', 'piper');
const files = [
  ['web/piper-worker.js', 'piper-worker.js'],
  ['node_modules/onnxruntime-web/dist/ort.wasm.min.js', 'ort.wasm.min.js'],
  ['node_modules/onnxruntime-web/dist/ort-wasm-simd.wasm', 'ort-wasm-simd.wasm'],
  ['node_modules/onnxruntime-web/dist/ort-wasm.wasm', 'ort-wasm.wasm'],
  ['node_modules/@diffusionstudio/piper-wasm/build/piper_phonemize.js', 'piper_phonemize.js'],
  ['node_modules/@diffusionstudio/piper-wasm/build/piper_phonemize.wasm', 'piper_phonemize.wasm'],
  ['node_modules/@diffusionstudio/piper-wasm/build/piper_phonemize.data', 'piper_phonemize.data'],
];

try {
  fs.mkdirSync(out, { recursive: true });
  for (const [from, to] of files) fs.copyFileSync(path.join(root, from), path.join(out, to));
  console.log(`[piper] copied ${files.length} files to public/piper/`);
} catch (error) {
  console.error(`[piper] ${error.message}`);
  process.exitCode = 1;
}
