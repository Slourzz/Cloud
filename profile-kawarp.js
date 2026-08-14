import { Kawarp } from "./assets/vendor/kawarp-core.js";

const canvas = document.querySelector("#profile-kawarp");
const banner = canvas?.closest(".cloud-profile-banner");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (canvas && banner && !reduceMotion.matches) {
  const palette = document.createElement("canvas");
  palette.width = 1024;
  palette.height = 512;
  const paletteContext = palette.getContext("2d");
  const colors = ["#F2A68E", "#E8A2AE", "#C4A7E7", "#A8BFE0", "#9CCFD8", "#B8D9D7", "#D8B4D8", "#F1B48F"];
  colors.forEach((color, index) => {
    paletteContext.fillStyle = color;
    paletteContext.fillRect((index % 4) * 256, Math.floor(index / 4) * 256, 256, 256);
  });

  const kawarp = new Kawarp(canvas, {
    warpIntensity: 1.55,
    blurPasses: 10,
    animationSpeed: .56,
    saturation: 1.45,
    dithering: .008,
    transitionDuration: 0,
    tintIntensity: .18,
    scale: 1.08
  });
  kawarp.loadImageElement(palette);
  kawarp.isTransitioning = false;

  const resize = () => {
    const bounds = banner.getBoundingClientRect();
    if (bounds.width < 1 || bounds.height < 1) return;
    const density = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.round(bounds.width * density);
    const height = Math.round(bounds.height * density);
    if (canvas.width === width && canvas.height === height) return;
    kawarp.stop();
    canvas.width = width;
    canvas.height = height;
    kawarp.resize();
    kawarp.start();
    banner.classList.add("kawarp-ready");
  };

  const observer = new ResizeObserver(resize);
  observer.observe(banner);
  requestAnimationFrame(resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) kawarp.stop();
    else {
      resize();
      kawarp.start();
    }
  });
  window.addEventListener("pagehide", () => {
    observer.disconnect();
    kawarp.dispose();
  }, {once: true});
}
