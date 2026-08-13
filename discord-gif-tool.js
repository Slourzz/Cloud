import { Kawarp } from "./assets/vendor/kawarp-core.js";
import { GIFEncoder, quantize } from "./assets/vendor/gifenc.esm.js";

const DEFAULT_COLORS = ["#FFD1DC", "#A2CFFE", "#AAF0D1", "#E3E4FA", "#FFFACD", "#FFDAB9", "#DCD0FF", "#B0E0E6"];
const OPTIONS = { warpIntensity: 1.85, blurPasses: 10, animationSpeed: 0.82, saturation: 2.15, dithering: 0.012, transitionDuration: 0, tintIntensity: 0.28, scale: 1.08 };
const PRESETS = {
  square: { width: 512, height: 512, label: "Cuadrado" },
  profile: { width: 600, height: 240, label: "Perfil" },
  server: { width: 960, height: 540, label: "Servidor" }
};
const previewCanvas = document.querySelector("#kawarp-preview");
const colorsRoot = document.querySelector("#kawarp-colors");
const darkness = document.querySelector("#palette-darkness");
const darknessValue = document.querySelector("#darkness-value");
const colorCount = document.querySelector("#color-count");
const colorCountValue = document.querySelector("#color-count-value");
const paletteTitle = document.querySelector("#palette-title");
const activeColors = document.querySelector("#active-colors");
const generateButton = document.querySelector("#generate-gif");
const downloadButton = document.querySelector("#download-custom-gif");
const status = document.querySelector("#gif-status");
const sizeControl = document.querySelector(".banner-size-control");
const dimensions = document.querySelector("#selected-dimensions");
const editorStage = document.querySelector("#editor-stage");
const imageUpload = document.querySelector("#image-upload");
const scaleControl = document.querySelector("#image-scale");
const scaleValue = document.querySelector("#image-scale-value");
const centerButton = document.querySelector("#center-image");
const deleteButton = document.querySelector("#delete-image");
const guideX = document.querySelector(".snap-guide-x");
const guideY = document.querySelector(".snap-guide-y");
let preview;
let updateTimer;
let generatedGifUrl;
let generatedGifSize = 0;
let selectedPreset = "square";
let selectedLayer;
const layers = [];

function paletteCanvas(colors, amount, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  Array.from({ length: 8 }, (_, index) => colors[index % colors.length]).forEach((color, index) => {
    const rgb = color.match(/[a-f\d]{2}/gi).map(value => Math.round(parseInt(value, 16) * (1 - amount / 100)));
    context.fillStyle = `rgb(${rgb.join(",")})`;
    context.fillRect((index % 4) * width / 4, Math.floor(index / 4) * height / 2, width / 4, height / 2);
  });
  return canvas;
}

const selectedColors = () => [...colorsRoot.querySelectorAll("input")].slice(0, Number(colorCount.value)).map(input => input.value);

function updateColorCount() {
  const count = Number(colorCount.value);
  colorCountValue.value = String(count);
  paletteTitle.textContent = `Paleta de ${count} colores`;
  activeColors.textContent = `${count} activos`;
  colorsRoot.querySelectorAll(".kawarp-color").forEach((item, index) => item.classList.toggle("is-unused", index >= count));
  schedulePreview();
}

function invalidateGif(message = "Cambios aplicados. Crea el GIF para actualizarlo.") {
  if (generatedGifUrl) URL.revokeObjectURL(generatedGifUrl);
  generatedGifUrl = undefined;
  generatedGifSize = 0;
  downloadButton.disabled = true;
  status.textContent = message;
}

function renderLayer(layer) {
  layer.element.style.left = `${layer.x * 100}%`;
  layer.element.style.top = `${layer.y * 100}%`;
  layer.element.style.width = `${layer.width * 100}%`;
}

function selectLayer(layer) {
  selectedLayer = layer;
  layers.forEach(item => item.element.classList.toggle("is-selected", item === layer));
  const disabled = !layer;
  scaleControl.disabled = disabled;
  centerButton.disabled = disabled;
  deleteButton.disabled = disabled;
  if (layer) {
    scaleControl.value = Math.round(layer.width * 100);
    scaleValue.value = `${scaleControl.value}%`;
  }
}

function clampLayer(layer) {
  const stage = editorStage.getBoundingClientRect();
  let item = layer.element.getBoundingClientRect();
  if (!stage.width || !stage.height) return;
  if (item.width > stage.width || item.height > stage.height) {
    layer.width *= Math.min(stage.width / item.width, stage.height / item.height) * .98;
    renderLayer(layer);
    item = layer.element.getBoundingClientRect();
    if (layer === selectedLayer) {
      scaleControl.value = Math.round(layer.width * 100);
      scaleValue.value = `${scaleControl.value}%`;
    }
  }
  const halfX = Math.min(.5, item.width / stage.width / 2);
  const halfY = Math.min(.5, item.height / stage.height / 2);
  layer.x = Math.max(halfX, Math.min(1 - halfX, layer.x));
  layer.y = Math.max(halfY, Math.min(1 - halfY, layer.y));
  renderLayer(layer);
}

function enableDragging(layer) {
  layer.element.addEventListener("pointerdown", event => {
    if (event.target.closest(".resize-handle")) return;
    event.preventDefault();
    selectLayer(layer);
    layer.element.setPointerCapture(event.pointerId);
    const stage = editorStage.getBoundingClientRect();
    const item = layer.element.getBoundingClientRect();
    const offsetX = event.clientX - (item.left + item.width / 2);
    const offsetY = event.clientY - (item.top + item.height / 2);
    const halfX = Math.min(.5, item.width / stage.width / 2);
    const halfY = Math.min(.5, item.height / stage.height / 2);

    const move = moveEvent => {
      let x = (moveEvent.clientX - stage.left - offsetX) / stage.width;
      let y = (moveEvent.clientY - stage.top - offsetY) / stage.height;
      x = Math.max(halfX, Math.min(1 - halfX, x));
      y = Math.max(halfY, Math.min(1 - halfY, y));
      const thresholdX = 12 / stage.width;
      const thresholdY = 12 / stage.height;
      let snapX = null, snapY = null;
      if (Math.abs(x - .5) <= thresholdX) { x = .5; snapX = .5; }
      else if (Math.abs(x - halfX) <= thresholdX) { x = halfX; snapX = 0; }
      else if (Math.abs(x - (1 - halfX)) <= thresholdX) { x = 1 - halfX; snapX = 1; }
      if (Math.abs(y - .5) <= thresholdY) { y = .5; snapY = .5; }
      else if (Math.abs(y - halfY) <= thresholdY) { y = halfY; snapY = 0; }
      else if (Math.abs(y - (1 - halfY)) <= thresholdY) { y = 1 - halfY; snapY = 1; }
      layer.x = x;
      layer.y = y;
      renderLayer(layer);
      guideX.style.left = `${(snapX ?? .5) * 100}%`;
      guideY.style.top = `${(snapY ?? .5) * 100}%`;
      guideX.classList.toggle("is-visible", snapX !== null);
      guideY.classList.toggle("is-visible", snapY !== null);
    };
    const end = () => {
      guideX.classList.remove("is-visible");
      guideY.classList.remove("is-visible");
      layer.element.removeEventListener("pointermove", move);
      layer.element.removeEventListener("pointerup", end);
      layer.element.removeEventListener("pointercancel", end);
      invalidateGif("Posición actualizada con ajuste inteligente.");
    };
    layer.element.addEventListener("pointermove", move);
    layer.element.addEventListener("pointerup", end);
    layer.element.addEventListener("pointercancel", end);
  });
}

function enableResizing(layer, handle) {
  handle.addEventListener("pointerdown", event => {
    event.preventDefault();
    event.stopPropagation();
    selectLayer(layer);
    handle.setPointerCapture(event.pointerId);
    const stage = editorStage.getBoundingClientRect();
    const item = layer.element.getBoundingClientRect();
    const corner = handle.dataset.corner;
    const east = corner.includes("e");
    const south = corner.includes("s");
    const anchorX = east ? item.left : item.right;
    const anchorY = south ? item.top : item.bottom;
    const directionX = east ? 1 : -1;
    const directionY = south ? 1 : -1;
    const aspect = layer.image.naturalWidth / layer.image.naturalHeight;
    const maxWidthX = east ? stage.right - anchorX : anchorX - stage.left;
    const maxHeight = south ? stage.bottom - anchorY : anchorY - stage.top;
    const maxWidth = Math.max(24, Math.min(maxWidthX, maxHeight * aspect));

    const move = moveEvent => {
      let pointerX = Math.max(stage.left, Math.min(stage.right, moveEvent.clientX));
      let pointerY = Math.max(stage.top, Math.min(stage.bottom, moveEvent.clientY));
      const threshold = 12;
      const targetsX = [stage.left, stage.left + stage.width / 2, stage.right];
      const targetsY = [stage.top, stage.top + stage.height / 2, stage.bottom];
      let snapX = null, snapY = null;
      for (const target of targetsX) if (Math.abs(pointerX - target) <= threshold) { pointerX = target; snapX = (target - stage.left) / stage.width; break; }
      for (const target of targetsY) if (Math.abs(pointerY - target) <= threshold) { pointerY = target; snapY = (target - stage.top) / stage.height; break; }
      const widthFromX = Math.abs(pointerX - anchorX);
      const widthFromY = Math.abs(pointerY - anchorY) * aspect;
      const newWidth = Math.max(24, Math.min(maxWidth, Math.max(widthFromX, widthFromY)));
      const newHeight = newWidth / aspect;
      const centerX = anchorX + directionX * newWidth / 2;
      const centerY = anchorY + directionY * newHeight / 2;
      layer.width = newWidth / stage.width;
      layer.x = (centerX - stage.left) / stage.width;
      layer.y = (centerY - stage.top) / stage.height;
      renderLayer(layer);
      scaleControl.value = Math.round(layer.width * 100);
      scaleValue.value = `${scaleControl.value}%`;
      guideX.style.left = `${(snapX ?? .5) * 100}%`;
      guideY.style.top = `${(snapY ?? .5) * 100}%`;
      guideX.classList.toggle("is-visible", snapX !== null);
      guideY.classList.toggle("is-visible", snapY !== null);
    };
    const end = () => {
      guideX.classList.remove("is-visible");
      guideY.classList.remove("is-visible");
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      clampLayer(layer);
      invalidateGif("Tamaño actualizado con ajuste inteligente.");
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  });
}

async function addImage(file) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  await image.decode();
  image.className = "editor-layer-image";
  image.alt = file.name;
  image.draggable = false;
  const element = document.createElement("div");
  element.className = "editor-layer";
  element.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
  element.append(image);
  ["nw", "ne", "sw", "se"].forEach(corner => {
    const handle = document.createElement("span");
    handle.className = "resize-handle";
    handle.dataset.corner = corner;
    handle.setAttribute("aria-hidden", "true");
    element.append(handle);
  });
  const layer = { element, image, url, x: .5, y: .5, width: .3 };
  layers.push(layer);
  editorStage.append(element);
  enableDragging(layer);
  element.querySelectorAll(".resize-handle").forEach(handle => enableResizing(layer, handle));
  renderLayer(layer);
  selectLayer(layer);
  requestAnimationFrame(() => clampLayer(layer));
}

function updatePreview() {
  const preset = PRESETS[selectedPreset];
  darknessValue.value = `${darkness.value}%`;
  preview.loadImageElement(paletteCanvas(selectedColors(), Number(darkness.value), preset.width, preset.height));
  preview.isTransitioning = false;
  preview.start();
  if (generatedGifUrl) URL.revokeObjectURL(generatedGifUrl);
  generatedGifUrl = undefined;
  generatedGifSize = 0;
  downloadButton.disabled = true;
  status.textContent = "La vista previa ya usa tus colores.";
}

function selectBannerSize(name) {
  selectedPreset = name;
  const preset = PRESETS[name];
  preview.stop();
  previewCanvas.width = preset.width;
  previewCanvas.height = preset.height;
  preview.resize();
  const previewFrame = document.querySelector(".discord-gif-preview");
  previewFrame.style.setProperty("--banner-ratio", preset.width / preset.height);
  previewFrame.dataset.preset = name;
  dimensions.textContent = `${preset.width} × ${preset.height} px`;
  sizeControl.dataset.active = name;
  sizeControl.querySelectorAll(".banner-size-option").forEach(button => {
    const active = button.dataset.preset === name;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  updatePreview();
  setTimeout(() => layers.forEach(clampLayer), 680);
  status.textContent = `Formato ${preset.label}: ${preset.width} × ${preset.height} px.`;
}

function schedulePreview() {
  clearTimeout(updateTimer);
  updateTimer = setTimeout(updatePreview, 70);
}

function buildColorInputs(colors) {
  colorsRoot.replaceChildren();
  colors.forEach((color, index) => {
    const label = document.createElement("label");
    label.className = "kawarp-color";
    label.style.background = color;
    label.title = `Color ${index + 1}: ${color}`;
    const input = document.createElement("input");
    input.type = "color";
    input.value = color;
    input.setAttribute("aria-label", `Color ${index + 1}`);
    input.addEventListener("input", () => {
      label.style.background = input.value;
      label.title = `Color ${index + 1}: ${input.value.toUpperCase()}`;
      schedulePreview();
    });
    label.append(input);
    colorsRoot.append(label);
  });
}

const nextPaint = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));

function applyHighQualityPalette(rgba, palette, width, height) {
  const indexed = new Uint8Array(width * height);
  let current = new Float32Array((width + 2) * 3);
  let next = new Float32Array((width + 2) * 3);
  const nearestCache = new Int16Array(65536);
  nearestCache.fill(-1);
  const clamp = value => Math.max(0, Math.min(255, value));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const source = (y * width + x) * 4;
      const error = (x + 1) * 3;
      const red = clamp(rgba[source] + current[error]);
      const green = clamp(rgba[source + 1] + current[error + 1]);
      const blue = clamp(rgba[source + 2] + current[error + 2]);
      const key = (Math.round(red) >> 3) << 11 | (Math.round(green) >> 2) << 5 | Math.round(blue) >> 3;
      let nearest = nearestCache[key];
      if (nearest < 0) {
        let distance = Infinity;
        for (let color = 0; color < palette.length; color += 1) {
          const candidate = palette[color];
          const dr = red - candidate[0], dg = green - candidate[1], db = blue - candidate[2];
          const candidateDistance = dr * dr + dg * dg + db * db;
          if (candidateDistance < distance) {
            distance = candidateDistance;
            nearest = color;
          }
        }
        nearestCache[key] = nearest;
      }
      indexed[y * width + x] = nearest;

      // Floyd–Steinberg diffusion removes broad color bands from gradients.
      const chosen = palette[nearest];
      const errors = [red - chosen[0], green - chosen[1], blue - chosen[2]];
      for (let channel = 0; channel < 3; channel += 1) {
        current[error + 3 + channel] += errors[channel] * 7 / 16;
        next[error - 3 + channel] += errors[channel] * 3 / 16;
        next[error + channel] += errors[channel] * 5 / 16;
        next[error + 3 + channel] += errors[channel] / 16;
      }
    }
    current = next;
    next = new Float32Array((width + 2) * 3);
  }
  return indexed;
}

function canvasFromImageData(imageData) {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  canvas.getContext("2d").putImageData(imageData, 0, 0);
  return canvas;
}

async function generateGif() {
  generateButton.disabled = true;
  downloadButton.disabled = true;
  try {
    status.textContent = "Preparando Kawarp real…";
    await nextPaint();
    const { width, height } = PRESETS[selectedPreset];
    const totalFrames = 80, overlap = 16, fps = 16;
    const renderCanvas = document.createElement("canvas");
    renderCanvas.width = width;
    renderCanvas.height = height;
    const kawarp = new Kawarp(renderCanvas, OPTIONS);
    kawarp.loadImageElement(paletteCanvas(selectedColors(), Number(darkness.value), width, height));
    kawarp.isTransitioning = false;
    const capture = document.createElement("canvas");
    capture.width = width;
    capture.height = height;
    const captureContext = capture.getContext("2d", { willReadFrequently: true });
    const composite = document.createElement("canvas");
    composite.width = width;
    composite.height = height;
    const context = composite.getContext("2d", { willReadFrequently: true });
    const rawFrames = [];

    for (let frame = 0; frame < totalFrames; frame += 1) {
      kawarp.render(frame / fps * OPTIONS.animationSpeed, frame / fps * 1000);
      captureContext.drawImage(renderCanvas, 0, 0);
      rawFrames.push(captureContext.getImageData(0, 0, width, height));
      if (frame % 8 === 0) {
        status.textContent = `Renderizando fondo… ${Math.round((frame + 1) / totalFrames * 45)}%`;
        await nextPaint();
      }
    }

    const gif = GIFEncoder();
    const outputFrames = totalFrames - overlap;
    for (let frame = 0; frame < outputFrames; frame += 1) {
      context.globalAlpha = 1;
      context.clearRect(0, 0, width, height);
      if (frame < outputFrames - overlap) {
        context.putImageData(rawFrames[frame + overlap], 0, 0);
      } else {
        const blendIndex = frame - (outputFrames - overlap);
        context.putImageData(rawFrames[outputFrames + blendIndex], 0, 0);
        context.globalAlpha = (blendIndex + 1) / overlap;
        context.drawImage(canvasFromImageData(rawFrames[blendIndex]), 0, 0);
        context.globalAlpha = 1;
      }
      for (const layer of layers) {
        const layerWidth = width * layer.width;
        const layerHeight = layer.image.naturalHeight / layer.image.naturalWidth * layerWidth;
        context.drawImage(layer.image, width * layer.x - layerWidth / 2, height * layer.y - layerHeight / 2, layerWidth, layerHeight);
      }
      const rgba = context.getImageData(0, 0, width, height).data;
      const palette = quantize(rgba, 256, { format: "rgb565" });
      gif.writeFrame(applyHighQualityPalette(rgba, palette, width, height), width, height, { palette, delay: Math.round(1000 / fps), repeat: 0, colorDepth: 8 });
      if (frame % 4 === 0) {
        status.textContent = `Aplicando color de alta calidad… ${45 + Math.round((frame + 1) / outputFrames * 55)}%`;
        await nextPaint();
      }
    }
    kawarp.dispose();
    gif.finish();
    const blob = new Blob([gif.bytes()], { type: "image/gif" });
    if (generatedGifUrl) URL.revokeObjectURL(generatedGifUrl);
    generatedGifUrl = URL.createObjectURL(blob);
    generatedGifSize = blob.size;
    downloadButton.disabled = false;
    status.textContent = `GIF listo (${(blob.size / 1024 / 1024).toFixed(1)} MB). Pulsa “Descargar mi GIF” cuando quieras guardarlo.`;
  } catch (error) {
    console.error(error);
    status.textContent = "No se pudo crear el GIF. Prueba de nuevo con WebGL activado.";
  } finally {
    generateButton.disabled = false;
  }
}

buildColorInputs(DEFAULT_COLORS);
try {
  preview = new Kawarp(previewCanvas, OPTIONS);
  updatePreview();
} catch (error) {
  console.error(error);
  status.textContent = "La vista previa necesita WebGL activado.";
  generateButton.disabled = true;
}

darkness.addEventListener("input", schedulePreview);
colorCount.addEventListener("input", updateColorCount);
document.querySelector("#reset-palette").addEventListener("click", () => {
  darkness.value = "18";
  colorCount.value = "8";
  buildColorInputs(DEFAULT_COLORS);
  updateColorCount();
  updatePreview();
});
generateButton.addEventListener("click", generateGif);
sizeControl.querySelectorAll(".banner-size-option").forEach(button => {
  button.addEventListener("click", () => selectBannerSize(button.dataset.preset));
});
downloadButton.addEventListener("click", () => {
  if (!generatedGifUrl) return;
  const anchor = document.createElement("a");
  anchor.href = generatedGifUrl;
  anchor.download = `cloud-kawarp-banner-${selectedPreset}.gif`;
  anchor.click();
  status.textContent = `GIF descargado (${(generatedGifSize / 1024 / 1024).toFixed(1)} MB).`;
});
document.querySelector("#upload-images").addEventListener("click", () => imageUpload.click());
imageUpload.addEventListener("change", async () => {
  const files = [...imageUpload.files];
  for (const file of files) await addImage(file);
  imageUpload.value = "";
  invalidateGif(`${files.length} imagen${files.length === 1 ? " añadida" : "es añadidas"}. Arrástrala y usa las guías para alinearla.`);
});
scaleControl.addEventListener("input", () => {
  if (!selectedLayer) return;
  selectedLayer.width = Number(scaleControl.value) / 100;
  scaleValue.value = `${scaleControl.value}%`;
  renderLayer(selectedLayer);
  clampLayer(selectedLayer);
  invalidateGif();
});
centerButton.addEventListener("click", () => {
  if (!selectedLayer) return;
  selectedLayer.x = selectedLayer.y = .5;
  renderLayer(selectedLayer);
  guideX.classList.add("is-visible");
  guideY.classList.add("is-visible");
  setTimeout(() => {
    guideX.classList.remove("is-visible");
    guideY.classList.remove("is-visible");
  }, 500);
  invalidateGif("Imagen centrada automáticamente.");
});
deleteButton.addEventListener("click", () => {
  if (!selectedLayer) return;
  const index = layers.indexOf(selectedLayer);
  URL.revokeObjectURL(selectedLayer.url);
  selectedLayer.element.remove();
  layers.splice(index, 1);
  selectLayer(layers.at(-1));
  invalidateGif("Imagen eliminada.");
});
editorStage.addEventListener("pointerdown", event => {
  if (event.target === editorStage) selectLayer(undefined);
});
