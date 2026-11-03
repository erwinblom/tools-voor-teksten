/**
 * Send the SDK's 46 MB WASM core in a lossless gzip envelope below the static
 * host's 25 MiB file limit. The browser restores the original exact bytes.
 * Does not modify node_modules, inference, SDK licence checks or telemetry.
 */
export function redactCompressedCore() {
  let transformed = false;
  const original = 'module = fetch(new URL("RedactWeb.wasm", import.meta.url))';
  const replacement = process.env.VITE_REMOTE_MODELS === 'true' ? `module = fetch('https://unpkg.com/@desert-ant-labs/redact@4.2.3/dist/RedactWeb.wasm').then(async (response) => {
      if (!response.ok) throw new Error('De officiële AI-runtime kon niet worden geladen.');
      const bytes = await response.arrayBuffer();
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
      if (hash !== '960f9b9d498ac984f37f6baf8c5bc674b0d4fe0bc4a6ea23570a10a9cf4a9558') throw new Error('De AI-runtime heeft een onverwachte inhoud.');
      return new Response(bytes,{headers:{'Content-Type':'application/wasm'}});
    })` : `module = fetch(new URL("vendor/redact-core.wasm-gzip.bin", document.baseURI)).then((response) => {
      if (!response.ok || !response.body) throw new Error("De lokale AI-runtime kon niet worden geladen (HTTP " + response.status + ").");
      if (typeof DecompressionStream === "undefined") throw new Error("Deze browser kan de lokale AI-runtime niet uitpakken. Gebruik een actuele Chrome, Edge of Safari.");
      return new Response(response.body.pipeThrough(new DecompressionStream("gzip")), { headers: { "Content-Type": "application/wasm" } });
    })`;
  return {
    name: 'redact-lossless-compressed-core',
    enforce: 'pre',
    buildStart() { transformed = false; },
    transform(code, id) {
      const clean = id.split('?')[0].replaceAll('\\', '/');
      if (!clean.endsWith('/@desert-ant-labs/redact/dist/index.js')) return null;
      if (code.split(original).length !== 2) {
        this.error('Redact SDK loader changed: expected exactly one original WASM fetch. Review the compressed transport integration before building.');
      }
      transformed = true;
      return { code: code.replace(original, replacement), map: null };
    },
    generateBundle(_options, bundle) {
      if (!transformed) this.error('Redact compressed-core loader was not applied.');
      for (const [name, output] of Object.entries(bundle)) {
        if (output.type === 'asset' && /RedactWeb.*\.wasm$/i.test(name)) {
          this.error('An uncompressed Redact WASM core remains in the bundle: ' + name);
        }
      }
    },
  };
}
