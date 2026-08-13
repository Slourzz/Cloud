import { Kawarp } from "./assets/vendor/kawarp-core.js";
import { GIFEncoder, quantize } from "./assets/vendor/gifenc.esm.js";

const DEFAULT_COLORS = ["#FFD1DC", "#A2CFFE", "#AAF0D1", "#E3E4FA", "#FFFACD", "#FFDAB9", "#DCD0FF", "#B0E0E6"];
const OPTIONS = { warpIntensity: 1.85, blurPasses: 10, animationSpeed: 0.82, saturation: 2.15, dithering: 0.012, transitionDuration: 0, tintIntensity: 0.28, scale: 1.08 };
const previewCanvas = document.querySelector("#kawarp-preview");
const colorsRoot = document.querySelector("#kawarp-colors");
const darkness = document.querySelector("#palette-darkness");
const darknessValue = document.querySelector("#darkness-value");
const generateButton = document.querySelector("#generate-gif");
const downloadButton = document.querySelector("#download-custom-gif");
const status = document.querySelector("#gif-status");
const logo = document.querySelector(".discord-gif-logo");
let preview;
let updateTimer;
let generatedGifUrl;
let generatedGifSize = 0;

function paletteCanvas(colors, amount, size = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  colors.forEach((color, index) => {
    const rgb = color.match(/[a-f\d]{2}/gi).map(value => Math.round(parseInt(value, 16) * (1 - amount / 100)));
    context.fillStyle = `rgb(${rgb.join(",")})`;
    context.fillRect((index % 4) * size / 4, Math.floor(index / 4) * size / 2, size / 4, size / 2);
  });
  return canvas;
}

const selectedColors = () => [...colorsRoot.querySelectorAll("input")].map(input => input.value);

function updatePreview() {
  darknessValue.value = `${darkness.value}%`;
  preview.loadImageElement(paletteCanvas(selectedColors(), Number(darkness.value)));
  preview.isTransitioning = false;
  preview.start();
  if (generatedGifUrl) URL.revokeObjectURL(generatedGifUrl);
  generatedGifUrl = undefined;
  generatedGifSize = 0;
  downloadButton.disabled = true;
  status.textContent = "La vista previa ya usa tus colores.";
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
    const size = 512, totalFrames = 80, overlap = 16, fps = 16;
    const renderCanvas = document.createElement("canvas");
    renderCanvas.width = renderCanvas.height = size;
    const kawarp = new Kawarp(renderCanvas, OPTIONS);
    kawarp.loadImageElement(paletteCanvas(selectedColors(), Number(darkness.value), size));
    kawarp.isTransitioning = false;
    if (!logo.complete || !logo.naturalWidth) await logo.decode();
    const capture = document.createElement("canvas");
    capture.width = capture.height = size;
    const captureContext = capture.getContext("2d", { willReadFrequently: true });
    const composite = document.createElement("canvas");
    composite.width = composite.height = size;
    const context = composite.getContext("2d", { willReadFrequently: true });
    const rawFrames = [];

    for (let frame = 0; frame < totalFrames; frame += 1) {
      kawarp.render(frame / fps * OPTIONS.animationSpeed, frame / fps * 1000);
      captureContext.drawImage(renderCanvas, 0, 0);
      rawFrames.push(captureContext.getImageData(0, 0, size, size));
      if (frame % 8 === 0) {
        status.textContent = `Renderizando fondo… ${Math.round((frame + 1) / totalFrames * 45)}%`;
        await nextPaint();
      }
    }

    const gif = GIFEncoder();
    const outputFrames = totalFrames - overlap;
    for (let frame = 0; frame < outputFrames; frame += 1) {
      context.globalAlpha = 1;
      context.clearRect(0, 0, size, size);
      if (frame < outputFrames - overlap) {
        context.putImageData(rawFrames[frame + overlap], 0, 0);
      } else {
        const blendIndex = frame - (outputFrames - overlap);
        context.putImageData(rawFrames[outputFrames + blendIndex], 0, 0);
        context.globalAlpha = (blendIndex + 1) / overlap;
        context.drawImage(canvasFromImageData(rawFrames[blendIndex]), 0, 0);
        context.globalAlpha = 1;
      }
      const logoWidth = size * .58;
      const logoHeight = logo.naturalHeight / logo.naturalWidth * logoWidth;
      context.drawImage(logo, (size - logoWidth) / 2, (size - logoHeight) / 2, logoWidth, logoHeight);
      const rgba = context.getImageData(0, 0, size, size).data;
      const palette = quantize(rgba, 256, { format: "rgb565" });
      gif.writeFrame(applyHighQualityPalette(rgba, palette, size, size), size, size, { palette, delay: Math.round(1000 / fps), repeat: 0, colorDepth: 8 });
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
document.querySelector("#reset-palette").addEventListener("click", () => {
  darkness.value = "18";
  buildColorInputs(DEFAULT_COLORS);
  updatePreview();
});
generateButton.addEventListener("click", generateGif);
downloadButton.addEventListener("click", () => {
  if (!generatedGifUrl) return;
  const anchor = document.createElement("a");
  anchor.href = generatedGifUrl;
  anchor.download = "cloud-kawarp-personalizado.gif";
  anchor.click();
  status.textContent = `GIF descargado (${(generatedGifSize / 1024 / 1024).toFixed(1)} MB).`;
});
