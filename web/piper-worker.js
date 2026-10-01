/* eslint-disable */
/**
 * My Book Reader — natural Italian voice (Piper neural TTS) in a Web Worker.
 *
 * Everything runs on the device: the phonemizer (espeak-ng compiled to
 * WebAssembly) turns text into phonemes and the Piper voice model (ONNX, run by
 * onnxruntime-web) turns phonemes into audio. The voice model is downloaded once
 * from Hugging Face and kept in the Cache Storage, so it works offline.
 *
 * Messages in:  {id, type: 'status'|'download'|'remove'|'synthesize', text?, rate?}
 * Messages out: {id, type: 'result', ...} | {id, type: 'error', message} | {id, type: 'progress', loaded, total}
 */
var HERE = self.location.href.replace(/[^/]*$/, '');
var CACHE_NAME = 'mbr-piper-v1';
var VOICE_BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT/paola/medium/it_IT-paola-medium';
var FILES = [
  { url: VOICE_BASE + '.onnx.json', size: 7099 },
  { url: VOICE_BASE + '.onnx', size: 63511038 },
  { url: HERE + 'piper_phonemize.data', size: 18077249 },
  { url: HERE + 'piper_phonemize.wasm', size: 635212 },
  { url: HERE + 'ort-wasm-simd.wasm', size: 10595041 },
];
var TOTAL_SIZE = FILES.reduce(function (s, f) { return s + f.size; }, 0);

function mimeFor(url) {
  if (/\.wasm$/.test(url)) return 'application/wasm';
  if (/\.json$/.test(url)) return 'application/json';
  return 'application/octet-stream';
}

/** Returns a cached file, downloading it (with progress) the first time. */
async function cachedBlob(url, onBytes) {
  var cache = await caches.open(CACHE_NAME);
  var hit = await cache.match(url);
  if (hit) return new Blob([await hit.arrayBuffer()], { type: mimeFor(url) });
  var res = await fetch(url);
  if (!res.ok) throw new Error('Download non riuscito (' + res.status + '): ' + url);
  var parts = [];
  if (res.body && res.body.getReader) {
    var reader = res.body.getReader();
    for (;;) {
      var chunk = await reader.read();
      if (chunk.done) break;
      parts.push(chunk.value);
      if (onBytes) onBytes(chunk.value.length);
    }
  } else {
    var buf = await res.arrayBuffer();
    parts.push(new Uint8Array(buf));
    if (onBytes) onBytes(buf.byteLength);
  }
  var blob = new Blob(parts, { type: mimeFor(url) });
  await cache.put(url, new Response(blob, { headers: { 'Content-Type': mimeFor(url) } }));
  return blob;
}

async function isDownloaded() {
  var cache = await caches.open(CACHE_NAME);
  for (var i = 0; i < FILES.length; i++) if (!(await cache.match(FILES[i].url))) return false;
  return true;
}

async function downloadAll(id) {
  var loaded = 0;
  var cache = await caches.open(CACHE_NAME);
  for (var i = 0; i < FILES.length; i++) {
    if (await cache.match(FILES[i].url)) {
      loaded += FILES[i].size;
      continue;
    }
    var lastPost = 0;
    await cachedBlob(FILES[i].url, function (n) {
      loaded += n;
      var now = Date.now();
      if (now - lastPost > 250) {
        lastPost = now;
        self.postMessage({ id: id, type: 'progress', loaded: Math.min(loaded, TOTAL_SIZE), total: TOTAL_SIZE });
      }
    });
  }
  self.postMessage({ id: id, type: 'progress', loaded: TOTAL_SIZE, total: TOTAL_SIZE });
}

// ---- engine --------------------------------------------------------------
var engine = null;

async function initEngine() {
  if (engine) return engine;
  engine = (async function () {
    var blobs = {};
    for (var i = 0; i < FILES.length; i++) blobs[FILES[i].url] = await cachedBlob(FILES[i].url);
    importScripts(HERE + 'ort.wasm.min.js', HERE + 'piper_phonemize.js');
    var config = JSON.parse(await blobs[FILES[0].url].text());
    var urls = {
      phonemizeWasm: URL.createObjectURL(blobs[HERE + 'piper_phonemize.wasm']),
      phonemizeData: URL.createObjectURL(blobs[HERE + 'piper_phonemize.data']),
    };
    ort.env.wasm.numThreads = 1; // threads need cross-origin isolation, not available on GitHub Pages
    ort.env.wasm.wasmPaths = {
      'ort-wasm-simd.wasm': URL.createObjectURL(blobs[HERE + 'ort-wasm-simd.wasm']),
      'ort-wasm.wasm': HERE + 'ort-wasm.wasm',
    };
    var session = await ort.InferenceSession.create(await blobs[FILES[1].url].arrayBuffer(), {
      executionProviders: ['wasm'],
    });
    return { config: config, session: session, urls: urls };
  })();
  try {
    return await engine;
  } catch (e) {
    engine = null;
    throw e;
  }
}

function phonemize(e, text) {
  return new Promise(function (resolve, reject) {
    var done = false;
    createPiperPhonemize({
      print: function (data) {
        if (done) return;
        done = true;
        try {
          resolve(JSON.parse(data).phoneme_ids);
        } catch (err) {
          reject(err);
        }
      },
      // espeak prints warnings on stderr: only a failed run (onAbort) is an error.
      printErr: function () {},
      onAbort: function (reason) {
        if (done) return;
        done = true;
        reject(new Error('Fonetizzazione non riuscita: ' + reason));
      },
      locateFile: function (url) {
        if (url.endsWith('.wasm')) return e.urls.phonemizeWasm;
        if (url.endsWith('.data')) return e.urls.phonemizeData;
        return url;
      },
    })
      .then(function (module) {
        module.callMain(['-l', e.config.espeak.voice, '--input', JSON.stringify([{ text: text }]), '--espeak_data', '/espeak-ng-data']);
      })
      .catch(reject);
  });
}

function toWav(pcm, sampleRate) {
  var buffer = new ArrayBuffer(44 + pcm.length * 2);
  var view = new DataView(buffer);
  function str(offset, s) { for (var i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); }
  str(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); str(36, 'data');
  view.setUint32(40, pcm.length * 2, true);
  // Normalise: Piper output can exceed [-1, 1] slightly.
  var peak = 0;
  for (var i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]));
  var gain = peak > 0.98 ? 0.98 / peak : 1;
  for (var j = 0; j < pcm.length; j++) {
    var v = Math.max(-1, Math.min(1, pcm[j] * gain));
    view.setInt16(44 + j * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return buffer;
}

async function synthesize(text, rate) {
  var e = await initEngine();
  var clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return toWav(new Float32Array(0), e.config.audio.sample_rate);
  var ids = await phonemize(e, clean);
  var inf = e.config.inference;
  var feeds = {
    input: new ort.Tensor('int64', ids, [1, ids.length]),
    input_lengths: new ort.Tensor('int64', [ids.length]),
    // length_scale > 1 = slower: dividing by the rate changes speed without changing the pitch.
    scales: new ort.Tensor('float32', [inf.noise_scale, inf.length_scale / (rate || 1), inf.noise_w]),
  };
  if (e.config.speaker_id_map && Object.keys(e.config.speaker_id_map).length) {
    feeds.sid = new ort.Tensor('int64', [0]);
  }
  var out = await e.session.run(feeds);
  return toWav(out.output.data, e.config.audio.sample_rate);
}

// One request at a time: the ONNX session is not re-entrant.
var queue = Promise.resolve();

self.onmessage = function (event) {
  var msg = event.data || {};
  var id = msg.id;
  queue = queue.then(async function () {
    try {
      if (msg.type === 'status') {
        self.postMessage({ id: id, type: 'result', downloaded: await isDownloaded(), totalSize: TOTAL_SIZE });
      } else if (msg.type === 'download') {
        await downloadAll(id);
        self.postMessage({ id: id, type: 'result', downloaded: true });
      } else if (msg.type === 'remove') {
        engine = null;
        await caches.delete(CACHE_NAME);
        self.postMessage({ id: id, type: 'result', downloaded: false });
      } else if (msg.type === 'synthesize') {
        var wav = await synthesize(String(msg.text || ''), msg.rate);
        self.postMessage({ id: id, type: 'result', wav: wav }, [wav]);
      }
    } catch (err) {
      self.postMessage({ id: id, type: 'error', message: String((err && err.message) || err) });
    }
  });
};
