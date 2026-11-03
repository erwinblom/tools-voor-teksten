/**
 * Optional on-device PII detection. Imports, model loading and inference only
 * happen after an explicit UI action; document content is never posted by us.
 * Desert Ant Labs' unmodified SDK sends its required licence usage signal.
 * Source: @desert-ant-labs/redact 4.2.3; model redact v0.4.2.
 */
export const MODEL_INFORMATION = Object.freeze({
  engine: 'Desert Ant Labs Redact',
  sdkVersion: '4.2.3',
  modelVersion: 'v0.4.2',
  attribution: 'On-device AI by Desert Ant Labs',
  attributionUrl: 'https://desertant.com',
  licenceUrl: 'https://license.desertant.com/1.0',
  privacyNotice: 'Je tekst wordt op dit apparaat verwerkt. De SDK gebruikt internet voor licentietelling, zonder documentinhoud.',
});

let loadedModel = null;
let loading = null;
let queue = Promise.resolve();

const localUrl = (path) => `${import.meta.env?.BASE_URL ?? '/'}${path}`;

function notify(onProgress, fraction) {
  if (typeof onProgress === 'function') onProgress(Math.max(0, Math.min(1, fraction)));
}

async function loadModel(onProgress) {
  if (loadedModel) {
    notify(onProgress, 1);
    return loadedModel;
  }
  if (!loading) {
    loading = (async () => {
      notify(onProgress, 0);
      // Fail before importing the large WASM runtime when the package has not
      // been prepared. This avoids parsing a missing-file HTML response as AI.
      const response = await fetch(localUrl('models/redact/manifest.json'));
      if (!response.ok || !(response.headers.get('content-type') ?? '').includes('json')) {
        throw new Error('Het lokale AI-model ontbreekt. Bereid de modelbestanden voor met npm run prepare-models en bouw de app opnieuw.');
      }
      const manifest = await response.json();
      if (manifest.model !== 'redact' || manifest.revision !== MODEL_INFORMATION.modelVersion) {
        throw new Error('De lokale modelversie past niet bij deze app. Bereid de modelbestanden opnieuw voor.');
      }
      notify(onProgress, 0.05);
      const { Redact } = await import('@desert-ant-labs/redact');
      const model = await Redact.load({
        modelBaseUrl: import.meta.env?.VITE_REMOTE_MODELS === 'true' ? 'https://huggingface.co/desert-ant-labs/redact/resolve/v0.4.2/' : localUrl('models/redact/'),
        litertWasmDir: import.meta.env?.VITE_REMOTE_MODELS === 'true' ? 'https://cdn.jsdelivr.net/npm/@litertjs/core@2.6.0/wasm/' : localUrl('vendor/litert/'),
        accelerator: 'wasm',
        onProgress: (p) => notify(onProgress, 0.1 + Number(p) * 0.9),
      });
      loadedModel = model;
      notify(onProgress, 1);
      return model;
    })().catch((error) => {
      loading = null;
      throw error;
    });
  }
  return loading;
}

/** SDK offsets are UTF-16, matching JavaScript String#slice, including emoji. */
export function normalizeEntities(text, items) {
  if (!Array.isArray(items)) throw new Error('Het model gaf geen geldige vondsten terug.');
  const entities = items.map((item, index) => {
    const start = Number(item.start);
    const end = Number(item.end);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > text.length || text.slice(start, end) !== item.original) {
      throw new Error('Een modelvondst past niet exact bij de brontekst. De scan is gestopt; er is niets gewijzigd.');
    }
    return {
      id: `pii-${index}-${start}-${end}`,
      start,
      end,
      label: String(item.label),
      text: item.original,
      confidence: Number.isFinite(item.confidence) ? item.confidence : null,
      placeholder: String(item.placeholder || '[AFGESCHERMD]'),
    };
  }).sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 1; i < entities.length; i += 1) {
    if (entities[i].start < entities[i - 1].end) {
      throw new Error('Het model gaf overlappende vondsten terug. Controleer de tekst handmatig; er is niets gewijzigd.');
    }
  }
  return entities;
}

/**
 * Explicitly invoked by the user. Never silently substitute heuristic matches.
 * Calls are serialized because this SDK model has one active inference session.
 */
export async function detectPersonalData(text, { onProgress, minimumConfidence = 0.6, labels } = {}) {
  if (typeof text !== 'string') throw new TypeError('Kies eerst een tekstbestand of zet je document om naar Markdown.');
  if (!text.trim()) return { entities: [], engine: MODEL_INFORMATION.engine, modelVersion: MODEL_INFORMATION.modelVersion, empty: true };
  const task = async () => {
    const model = await loadModel(onProgress);
    const options = { minimumConfidence: Math.min(1, Math.max(0, minimumConfidence)) };
    if (labels) options.labels = labels;
    const result = await model.redaction(text, options);
    return {
      entities: normalizeEntities(text, result.items),
      engine: MODEL_INFORMATION.engine,
      modelVersion: MODEL_INFORMATION.modelVersion,
      needsReview: true,
    };
  };
  const result = queue.then(task, task);
  queue = result.catch(() => undefined);
  return result;
}

/** Pure reviewed replacement: original text remains the caller's source. */
export function applyRedactions(text, entities, selectedIds, replacement = '[AFGESCHERMD]') {
  const chosen = selectedIds == null ? null : new Set(selectedIds);
  const sorted = entities.filter((item) => chosen === null || chosen.has(item.id)).sort((a, b) => a.start - b.start);
  let result = '';
  let cursor = 0;
  for (const entity of sorted) {
    if (entity.start < cursor || text.slice(entity.start, entity.end) !== entity.text) {
      throw new Error('De tekst is gewijzigd sinds de scan. Scan opnieuw voordat je een kopie maakt.');
    }
    result += text.slice(cursor, entity.start) + replacement;
    cursor = entity.end;
  }
  return result + text.slice(cursor);
}

export function isModelLoaded() { return loadedModel !== null; }
