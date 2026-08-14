import { Kawarp } from "./assets/vendor/kawarp-core.js";

const canvas = document.querySelector("#profile-kawarp");
const banner = canvas?.closest(".cloud-profile-banner");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (canvas && banner && !reduceMotion.matches) {
  const palette = document.createElement("canvas");
  palette.width = 1024;
  palette.height = 512;
  const paletteContext = palette.getContext("2d");
  const blend = (from, to, amount) => from.map((value, index) => Math.round(value + (to[index] - value) * amount));
  const cssColor = color => `rgb(${color.join(" ")})`;
  const paintPalette = ({vibrant, dark, mid}) => {
    const colors = [
      vibrant,
      blend(vibrant, [255, 255, 255], .22),
      blend(vibrant, [255, 255, 255], .42),
      blend(vibrant, mid, .42),
      mid,
      blend(mid, [255, 255, 255], .2),
      blend(dark, mid, .5),
      dark
    ];
    colors.forEach((color, index) => {
      paletteContext.fillStyle = cssColor(color);
      paletteContext.fillRect((index % 4) * 256, Math.floor(index / 4) * 256, 256, 256);
    });
  };
  paintPalette({vibrant: [234, 154, 151], dark: [28, 18, 18], mid: [94, 62, 60]});

  const kawarp = new Kawarp(canvas, {
    warpIntensity: 1.55,
    blurPasses: 10,
    animationSpeed: .56,
    saturation: 1.45,
    dithering: .008,
    transitionDuration: 1050,
    tintIntensity: .18,
    scale: 1.08
  });
  kawarp.loadImageElement(palette);
  kawarp.isTransitioning = false;
  window.addEventListener("cloud-profile-theme", event => {
    if (!event.detail?.palette) return;
    paintPalette(event.detail.palette);
    kawarp.loadImageElement(palette);
  });

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
