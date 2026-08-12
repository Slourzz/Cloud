const API_BASE = 'https://lrclib.net/api';
const CLIENT_HEADER = 'Cloud Lyrics Prep v1.0 (https://slourzz.github.io/Cloud/)';

const form = document.querySelector('#lyrics-search-form');
const queryInput = document.querySelector('#lyrics-query');
const searchButton = document.querySelector('#search-button');
const feedback = document.querySelector('#search-feedback');
const resultsElement = document.querySelector('#search-results');
const inputElement = document.querySelector('#lyrics-input');
const outputElement = document.querySelector('#lyrics-output');
const sourceLabel = document.querySelector('#source-label');
const outputSummary = document.querySelector('#output-summary');
const copyButton = document.querySelector('#copy-output');
const clearButton = document.querySelector('#clear-input');
const resetButton = document.querySelector('#reset-settings');
const settingInputs = [...document.querySelectorAll('[data-setting]')];

const defaults = {
  removeTimestamps: true,
  processDashes: true,
  splitBackground: false,
  splitWords: true,
  splitCjk: false,
  removeEmpty: false,
};

let activeRequest = null;
let selectedResultId = null;

const getSettings = () => Object.fromEntries(
  settingInputs.map(input => [input.dataset.setting, input.checked]),
);

const normalizeDashes = line => line
  .replace(/[‐‑‒–—―]/g, '—')
  .replace(/\s+-\s+/g, ' — ')
  .replace(/(^|\s)-(?!\d)(?=\S)/g, '$1—')
  .replace(/(\S)-(?=\s|$)/g, '$1—');

const stripLrc = line => line
  .replace(/^(?:\[(?:\d{1,3}:)?\d{1,2}(?:[.:]\d{1,3})?\]\s*)+/, '')
  .replace(/^\[(?:ar|al|ti|au|by|offset|re|ve|length):[^\]]*\]\s*/i, '');

const splitBackgroundVocals = line => {
  const backgrounds = [];
  const foreground = line.replace(/\(([^()]*)\)/g, (match, content) => {
    const clean = content.trim();
    if (clean) backgrounds.push(`(${clean})`);
    return ' ';
  }).replace(/\s{2,}/g, ' ').trim();
  return [...(foreground ? [foreground] : []), ...backgrounds];
};

const splitCjkCharacters = line => line.replace(
  /([\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af])/g,
  ' $1 ',
).replace(/\s{2,}/g, ' ').trim();

const separateWords = line => {
  const trimmed = line.trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/).join('\\ \\');
};

function processLyrics(rawLyrics, settings) {
  const normalized = rawLyrics.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '');
  const processed = [];

  normalized.split('\n').forEach(sourceLine => {
    let line = settings.removeTimestamps ? stripLrc(sourceLine) : sourceLine;
    if (settings.processDashes) line = normalizeDashes(line);

    const lines = settings.splitBackground ? splitBackgroundVocals(line) : [line.trim()];
    lines.forEach(candidate => {
      let current = candidate;
      if (settings.splitCjk) current = splitCjkCharacters(current);
      if (settings.splitWords) current = separateWords(current);
      if (current || !settings.removeEmpty) processed.push(current);
    });
  });

  return processed.join('\n').replace(settings.removeEmpty ? /\n{2,}/g : /$^/, '\n');
}

function updateOutput() {
  const value = processLyrics(inputElement.value, getSettings());
  outputElement.value = value;
  const lineCount = value ? value.split('\n').filter(Boolean).length : 0;
  outputSummary.textContent = `${lineCount} ${lineCount === 1 ? 'línea preparada' : 'líneas preparadas'}`;
}

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

function getLyricsKind(result) {
  if (result.instrumental) return 'Instrumental';
  if (result.syncedLyrics) return 'Sincronizada';
  if (result.plainLyrics) return 'Normal';
  return 'Sin letra';
}

function renderResults(results) {
  resultsElement.replaceChildren();
  results.forEach(result => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'result-item';
    button.dataset.resultId = result.id;

    const copy = document.createElement('span');
    copy.className = 'result-copy';
    const title = document.createElement('strong');
    title.textContent = result.trackName || 'Canción sin título';
    const subtitle = document.createElement('small');
    subtitle.textContent = [result.artistName, result.albumName].filter(Boolean).join(' · ');
    copy.append(title, subtitle);

    const meta = document.createElement('span');
    meta.className = 'result-meta';
    const duration = document.createElement('span');
    duration.textContent = formatDuration(result.duration);
    const badge = document.createElement('span');
    badge.className = 'result-badge';
    badge.textContent = getLyricsKind(result);
    meta.append(duration, badge);
    button.append(copy, meta);

    button.addEventListener('click', () => selectResult(result, button));
    resultsElement.append(button);
  });
}

function selectResult(result, button) {
  selectedResultId = result.id;
  resultsElement.querySelectorAll('.result-item').forEach(item => {
    item.classList.toggle('selected', item === button);
  });

  if (result.instrumental) {
    inputElement.value = '';
    sourceLabel.textContent = `${result.trackName} es instrumental`;
    setFeedback('LRCLIB marca esta canción como instrumental.', false);
  } else {
    inputElement.value = result.syncedLyrics || result.plainLyrics || '';
    sourceLabel.textContent = `${result.trackName} — ${result.artistName}`;
    setFeedback(result.syncedLyrics
      ? 'Letra sincronizada cargada. Puedes conservar o quitar sus tiempos.'
      : 'Letra normal cargada desde LRCLIB.', false);
  }
  updateOutput();
  inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function setFeedback(message, isError = false) {
  feedback.textContent = message;
  feedback.classList.toggle('error', isError);
}

async function fetchLyrics(query) {
  if (activeRequest) activeRequest.abort();
  activeRequest = new AbortController();
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`${API_BASE}/search?${params}`, {
    signal: activeRequest.signal,
    headers: { 'Lrclib-Client': CLIENT_HEADER },
  });

  if (response.status === 429) throw new Error('LRCLIB recibió demasiadas búsquedas. Espera unos segundos e inténtalo de nuevo.');
  if (!response.ok) throw new Error(`LRCLIB no respondió correctamente (${response.status}).`);
  return response.json();
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const query = queryInput.value.trim();
  if (query.length < 2) {
    setFeedback('Escribe el nombre de una canción, artista o álbum.', true);
    queryInput.focus();
    return;
  }

  searchButton.disabled = true;
  searchButton.textContent = 'Buscando…';
  resultsElement.replaceChildren();
  selectedResultId = null;
  setFeedback('Buscando coincidencias en LRCLIB…');

  try {
    const results = await fetchLyrics(query);
    if (!Array.isArray(results) || results.length === 0) {
      setFeedback('No encontramos letras. Prueba con “canción + artista”.', true);
      return;
    }
    renderResults(results);
    setFeedback(`${results.length} ${results.length === 1 ? 'coincidencia encontrada' : 'coincidencias encontradas'}. Elige la versión correcta.`);
  } catch (error) {
    if (error.name !== 'AbortError') setFeedback(error.message || 'No fue posible consultar LRCLIB.', true);
  } finally {
    searchButton.disabled = false;
    searchButton.textContent = 'Buscar letras';
    activeRequest = null;
  }
});

inputElement.addEventListener('input', updateOutput);
settingInputs.forEach(input => input.addEventListener('change', updateOutput));

resetButton.addEventListener('click', () => {
  settingInputs.forEach(input => { input.checked = defaults[input.dataset.setting]; });
  updateOutput();
});

clearButton.addEventListener('click', () => {
  inputElement.value = '';
  selectedResultId = null;
  sourceLabel.textContent = 'Pega una letra o busca una canción';
  resultsElement.querySelectorAll('.result-item').forEach(item => item.classList.remove('selected'));
  updateOutput();
  inputElement.focus();
});

copyButton.addEventListener('click', async () => {
  if (!outputElement.value) {
    copyButton.querySelector('span').textContent = 'Sin texto';
    setTimeout(() => { copyButton.querySelector('span').textContent = 'Copiar'; }, 1300);
    return;
  }
  try {
    await navigator.clipboard.writeText(outputElement.value);
  } catch {
    outputElement.select();
    document.execCommand('copy');
    window.getSelection()?.removeAllRanges();
  }
  copyButton.querySelector('span').textContent = 'Copiado';
  setTimeout(() => { copyButton.querySelector('span').textContent = 'Copiar'; }, 1500);
});

updateOutput();
