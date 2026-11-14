/** 视觉系统：暗场自发光 UI，扁平矢量，无颗粒无景深 */

export const C = {
  // 背景（深黑偏蓝）
  void0: "#03050a",
  bg0: "#060a14",
  bg1: "#080e1c",
  bg2: "#0b1424",

  // 轴心：高饱和警示红
  red: "#e6152b",
  redHot: "#ff2f42",
  redFill: "rgba(190,18,38,0.62)",
  redDeep: "rgba(112,8,22,0.55)",
  redEdge: "rgba(255,60,76,0.95)",

  // 同盟
  blue: "#2f6fd8",
  blueHot: "#5fa6ff",
  blueFill: "rgba(38,92,190,0.55)",
  blueEdge: "rgba(120,180,255,0.95)",

  yellow: "#f2c62c",
  gold: "#d9a63a",
  goldSoft: "#f0cf7a",

  white: "#ffffff",
  ink: "#e8eef8",
  dim: "rgba(214,226,244,0.55)",
  faint: "rgba(190,206,230,0.28)",

  // 地块基色
  land: "#141d30",
  landLine: "rgba(130,170,228,0.30)",
  sea: "#05080f",
} as const;

export const FONT = `"Microsoft YaHei", "PingFang SC", "Noto Sans SC", "Hiragino Sans GB", sans-serif`;
export const FONT_HEAVY = `"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif`;

/** 带字距 */
export const tracked = (
  ctx: CanvasRenderingContext2D,
  txt: string,
  x: number,
  y: number,
  spacing: number,
  align: CanvasTextAlign = "left"
) => {
  (ctx as any).letterSpacing = `${spacing}px`;
  ctx.textAlign = align;
  ctx.fillText(txt, x, y);
  (ctx as any).letterSpacing = "0px";
  ctx.textAlign = "left";
};

export const tnum = (ctx: CanvasRenderingContext2D) => {
  (ctx as any).fontVariantNumeric = "tabular-nums";
};

/** 屏幕发光：围绕形状描一遍模糊同色 */
export const glow = (
  ctx: CanvasRenderingContext2D,
  color: string,
  blur: number,
  fn: () => void
) => {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  fn();
  ctx.restore();
};

/** 中心径向发光 */
export const radial = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  a = 1
) => {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/** 暗角：只压边缘，保留中心亮度（不是胶片颗粒） */
let vig: HTMLCanvasElement | null = null;
export const drawVignette = (ctx: CanvasRenderingContext2D, s = 0.5) => {
  if (!vig) {
    const w = 480,
      h = 270;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d")!;
    const rg = g.createRadialGradient(w / 2, h / 2, h * 0.34, w / 2, h / 2, w * 0.78);
    rg.addColorStop(0, "rgba(0,0,0,0)");
    rg.addColorStop(0.66, "rgba(0,0,0,0.28)");
    rg.addColorStop(1, "rgba(0,0,0,0.82)");
    g.fillStyle = rg;
    g.fillRect(0, 0, w, h);
    vig = c;
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = s;
  ctx.drawImage(vig, 0, 0, 1920, 1080);
  ctx.restore();
};

/** 全屏扫描网线：轻微的显示屏质感，不是胶片颗粒 */
let scan: HTMLCanvasElement | null = null;
let scanPat: CanvasPattern | null = null;
export const drawScanlines = (ctx: CanvasRenderingContext2D, a = 0.5) => {
  if (!scan) {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 4;
    const g = c.getContext("2d")!;
    g.fillStyle = "rgba(120,170,240,0.055)";
    g.fillRect(0, 0, 4, 1);
    scan = c;
  }
  if (!scanPat) scanPat = ctx.createPattern(scan, "repeat");
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = a;
  ctx.fillStyle = scanPat!;
  ctx.fillRect(0, 0, 1920, 1080);
  ctx.restore();
};
