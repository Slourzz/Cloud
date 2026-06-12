/*
 * Adapted from Spicy Lyrics.
 * Source: https://github.com/Spikerko/spicy-lyrics
 * Commit: 99f3c89c2cec1de579363d712774a770b7925f18
 * License: GNU AGPL-3.0. See LICENSE and NOTICE.md in this directory.
 */

// @ts-ignore cubic-spline does not publish TypeScript declarations.
import Spline from "cubic-spline";
import { easeSinOut } from "d3-ease";

const SLEEP_OFFSET_SQ_LIMIT = (1 / 3840) ** 2;
const SLEEP_VELOCITY_SQ_LIMIT = 1e-2 ** 2;
const EPS = 1e-5;

const pi = Math.PI;
const exp = Math.exp;
const sin = Math.sin;
const cos = Math.cos;
const sqrt = Math.sqrt;

// Ported by Spicy Lyrics from Fraktality/spr (MIT).
export class Spring {
  private d: number;
  private f: number;
  private g: number;
  private p: number;
  private v: number;

  constructor(
    startPosition: number,
    frequency: number,
    dampingRatio: number,
    goal?: number,
  ) {
    this.d = dampingRatio;
    this.f = frequency;
    this.g = goal ?? startPosition;
    this.p = startPosition;
    this.v = 0;
  }

  Step(dt: number): number {
    const d = this.d;
    const f = this.f * (2 * pi);
    const g = this.g;
    let p = this.p;
    let v = this.v;

    if (d === 1) {
      const q = exp(-f * dt);
      const w = dt * q;
      const c0 = q + w * f;
      const c2 = q - w * f;
      const c3 = w * f * f;
      const o = p - g;

      p = o * c0 + v * w + g;
      v = v * c2 - o * c3;
    } else if (d < 1) {
      const q = exp(-d * f * dt);
      const c = sqrt(1 - d * d);
      const i = cos(dt * f * c);
      const j = sin(dt * f * c);

      let z: number;
      if (c > EPS) {
        z = j / c;
      } else {
        const a = dt * f;
        z = a + ((a * a * (c * c) * (c * c)) / 20 - c * c) * ((a * a * a) / 6);
      }

      let y: number;
      if (f * c > EPS) {
        y = j / (f * c);
      } else {
        const b = f * c;
        y =
          dt +
          ((dt * dt * (b * b) * (b * b)) / 20 - b * b) * ((dt * dt * dt) / 6);
      }

      const o = p - g;
      p = (o * (i + z * d) + v * y) * q + g;
      v = (v * (i - z * d) - o * (z * f)) * q;
    } else {
      const c = sqrt(d * d - 1);
      const r1 = -f * (d + c);
      const r2 = -f * (d - c);
      const ec1 = exp(r1 * dt);
      const ec2 = exp(r2 * dt);
      const o = p - g;
      const co2 = (v - o * r1) / (2 * f * c);
      const co1 = ec1 * (o - co2);

      p = co1 + co2 * ec2 + g;
      v = co1 * r1 + co2 * ec2 * r2;
    }

    this.p = p;
    this.v = v;
    return p;
  }

  CanSleep(): boolean {
    if (this.v * this.v > SLEEP_VELOCITY_SQ_LIMIT) return false;
    const offset = this.p - this.g;
    return offset * offset <= SLEEP_OFFSET_SQ_LIMIT;
  }

  GetGoal(): number {
    return this.g;
  }

  SetGoal(goal: number, replacePosition?: boolean): void {
    this.g = goal;
    if (replacePosition) {
      this.p = goal;
      this.v = 0;
    }
  }

  SetDampingRatio(dampingRatio: number): void {
    this.d = dampingRatio;
  }

  SetFrequency(frequency: number): void {
    this.f = frequency;
  }
}

export interface AnimationPoint {
  Time: number;
  Value: number;
}

export const GetSpline = (range: AnimationPoint[]) => {
  const times = range.map((point) => point.Time);
  const values = range.map((point) => point.Value);
  return new Spline(times, values);
};

export const Clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

export const ScaleRange = [
  { Time: 0, Value: 0.95 },
  { Time: 0.7, Value: 1.075 },
  { Time: 1, Value: 1 },
];

export const YOffsetRange = [
  { Time: 0, Value: 1 / 100 },
  { Time: 0.9, Value: -(1 / 52.5) },
  { Time: 1, Value: 0 },
];

export const SimpleYOffsetRange = [
  { Time: 0, Value: 1 / 100 },
  { Time: 1, Value: -0.04 },
];

export const GlowRange = [
  { Time: 0, Value: 0 },
  { Time: 0.15, Value: 1 },
  { Time: 0.6, Value: 1 },
  { Time: 1, Value: 0 },
];

export const DotScaleRange = [
  { Time: 0, Value: 0.75 },
  { Time: 0.7, Value: 1.05 },
  { Time: 1, Value: 1 },
];

export const DotYOffsetRange = [
  { Time: 0, Value: 0 },
  { Time: 0.9, Value: -0.12 },
  { Time: 1, Value: 0 },
];

export const DotGlowRange = [
  { Time: 0, Value: 0 },
  { Time: 0.6, Value: 1 },
  { Time: 1, Value: 1 },
];

export const DotOpacityRange = [
  { Time: 0, Value: 0.35 },
  { Time: 0.6, Value: 1 },
  { Time: 1, Value: 1 },
];

export const LineGlowRange = [
  { Time: 0, Value: 0 },
  { Time: 0.5, Value: 1 },
  { Time: 1, Value: 0 },
];

export const ScaleSpline = GetSpline(ScaleRange);
export const YOffsetSpline = GetSpline(YOffsetRange);
export const SimpleYOffsetSpline = GetSpline(SimpleYOffsetRange);
export const GlowSpline = GetSpline(GlowRange);
export const DotScaleSpline = GetSpline(DotScaleRange);
export const DotYOffsetSpline = GetSpline(DotYOffsetRange);
export const DotGlowSpline = GetSpline(DotGlowRange);
export const DotOpacitySpline = GetSpline(DotOpacityRange);
export const LineGlowSpline = GetSpline(LineGlowRange);

export const SpringSettings = {
  yOffset: { damping: 0.4, frequency: 1.25 },
  scale: { damping: 0.6, frequency: 0.7 },
  glow: { damping: 0.5, frequency: 1 },
  lineGlow: { damping: 0.5, frequency: 1 },
} as const;

export type ElementState = "NotSung" | "Active" | "Sung";

export function getElementState(
  currentTime: number,
  startTime: number,
  endTime: number,
): ElementState {
  if (currentTime < startTime) return "NotSung";
  if (currentTime >= endTime) return "Sung";
  return "Active";
}

export function getProgressPercentage(
  currentTime: number,
  startTime: number,
  endTime: number,
): number {
  if (currentTime <= startTime) return 0;
  if (currentTime >= endTime) return 1;
  return (currentTime - startTime) / (endTime - startTime);
}

export function getWordGradientPosition(
  state: ElementState,
  percentage: number,
  simpleMode: boolean,
): number {
  if (state === "NotSung") return simpleMode ? -50 : -20;
  if (state === "Sung") return 100;
  return (simpleMode ? -50 : -20) + 120 * percentage;
}

export function getLetterGradientPosition(
  state: ElementState,
  percentage: number,
  simpleMode: boolean,
): number {
  if (state === "NotSung") return simpleMode ? -50 : -20;
  if (state === "Sung") return 100;
  return (simpleMode ? -50 : -20) + 120 * easeSinOut(percentage);
}

export function getLineGradientPosition(
  state: ElementState,
  percentage: number,
): number {
  if (state === "NotSung") return -20;
  if (state === "Sung") return 100;
  return percentage * 100;
}

function spicyScrollEasing(progress: number): number {
  if (progress < 0.4) return 2.5 * progress ** 2;
  if (progress < 0.65) return 0.7 + (progress - 0.4) * 1.2;
  if (progress < 0.85) return 1 + (progress - 0.65) * 0.15;
  return 1.03 - (progress - 0.85) * 0.2;
}

export function scrollIntoCenterView(
  container: HTMLElement,
  element: HTMLElement,
  options: {
    duration?: number;
    offset?: number;
    instant?: boolean;
    onFrame?: (frameId: number) => void;
  } = {},
): number {
  const { duration = 800, offset = 0, instant = false, onFrame } = options;
  const targetScrollTop =
    element.offsetTop -
    (container.clientHeight / 2 - element.clientHeight / 2) -
    offset;
  const maxScrollTop = Math.max(
    0,
    container.scrollHeight - container.clientHeight,
  );
  const target = Clamp(targetScrollTop, 0, maxScrollTop);

  if (instant) {
    container.scrollTop = target;
    return 0;
  }

  const startScrollTop = container.scrollTop;
  const distance = target - startScrollTop;
  const startTime = performance.now();
  let frameId = 0;

  const smoothScroll = (currentTime: number) => {
    const progress = Math.min((currentTime - startTime) / duration, 1);
    container.scrollTop =
      startScrollTop + distance * spicyScrollEasing(progress);

    if (progress < 1) {
      frameId = requestAnimationFrame(smoothScroll);
      onFrame?.(frameId);
    } else {
      container.scrollTop = target;
    }
  };

  frameId = requestAnimationFrame(smoothScroll);
  onFrame?.(frameId);
  return frameId;
}
