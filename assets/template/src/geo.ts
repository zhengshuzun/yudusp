/** 投影与缓动：全程固定机位，每镜给一个固定 cam，不做插值运镜 */
export const W = 1920;
export const H = 1080;
export const FPS = 30;

export const LON0 = 12;
export const LAT0 = 50;
const KX = Math.cos((50 * Math.PI) / 180);
const UPD = 100;

export const proj = (lon: number, lat: number): [number, number] => [
  (lon - LON0) * KX * UPD,
  (LAT0 - lat) * UPD,
];

export type Cam = { x: number; y: number; zoom: number };

export const camAt = (lon: number, lat: number, zoom: number): Cam => {
  const [x, y] = proj(lon, lat);
  return { x, y, zoom };
};

export const screenX = (X: number, cam: Cam) => W / 2 + (X - cam.x) * cam.zoom;
export const screenY = (Y: number, cam: Cam) => H / 2 + (Y - cam.y) * cam.zoom;
export const screen = (lon: number, lat: number, cam: Cam) => {
  const [X, Y] = proj(lon, lat);
  return [screenX(X, cam), screenY(Y, cam)] as const;
};

export const applyCam = (ctx: CanvasRenderingContext2D, cam: Cam) => {
  ctx.setTransform(cam.zoom, 0, 0, cam.zoom, W / 2 - cam.x * cam.zoom, H / 2 - cam.y * cam.zoom);
};

export const resetT = (ctx: CanvasRenderingContext2D) => ctx.setTransform(1, 0, 0, 1, 0, 0);

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const mix = (a: number, b: number, t: number) => a + (b - a) * clamp01(t);

export const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - clamp01(t), 5);
export const easeIn = (t: number) => Math.pow(clamp01(t), 3);
export const easeInOut = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/** [t0,t1] 内的归一化进度 */
export const span = (t: number, t0: number, t1: number) =>
  clamp01((t - t0) / Math.max(0.0001, t1 - t0));

/** 弹出：超过 1 再回落的过冲 */
export const overshoot = (t: number, k = 1.7) => {
  const x = clamp01(t);
  return 1 + (k + 1) * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2);
};

export const beatGrid = { bpm: 136, phase: 0.4058823529411764 };
export const BEAT = 60 / beatGrid.bpm;
export const beatTime = (k: number) => beatGrid.phase + k * BEAT;

/** 当前时间距最近拍点的距离（秒） */
export const beatDist = (t: number) => {
  const k = Math.round((t - beatGrid.phase) / BEAT);
  return Math.abs(t - beatTime(k));
};
