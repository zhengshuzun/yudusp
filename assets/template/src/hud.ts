import { W, H, clamp01, easeOut, overshoot, easeOutQuint, resetT } from "./geo";
import { C, FONT, tracked, tnum, glow } from "./palette";

/** 左上角：日期 + 章节标签 */
export const drawDate = (
  ctx: CanvasRenderingContext2D,
  date: string,
  kicker: string,
  a: number,
  popT = 1
) => {
  if (a <= 0.01) return;
  resetT(ctx);
  ctx.save();
  ctx.globalAlpha = a;
  const x = 82;
  const y = 96;

  // 前导方块
  ctx.fillStyle = C.redHot;
  ctx.shadowColor = C.redHot;
  ctx.shadowBlur = 16;
  ctx.fillRect(x, y - 30, 6, 38);
  ctx.shadowBlur = 0;

  ctx.font = `600 17px ${FONT}`;
  ctx.fillStyle = "rgba(150,178,214,0.85)";
  tracked(ctx, kicker, x + 22, y - 6, 3);

  // 日期主字
  ctx.font = `700 40px ${FONT}`;
  ctx.fillStyle = C.white;
  (ctx as any).fontVariantNumeric = "tabular-nums";
  tracked(ctx, date, x + 20, y + 32, 1.5);
  ctx.restore();
};

/** 左下角：事件中字 + 左侧红线 */
export const drawEvent = (
  ctx: CanvasRenderingContext2D,
  text: string,
  a: number,
  accent = C.redHot
) => {
  if (a <= 0.01 || !text) return;
  resetT(ctx);
  ctx.save();
  ctx.globalAlpha = a;
  const x = 82;
  const y = H - 92;

  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 18;
  ctx.fillRect(x, y - 40, 5, 52);
  ctx.shadowBlur = 0;

  ctx.font = `700 44px ${FONT}`;
  ctx.fillStyle = C.white;
  tracked(ctx, text, x + 24, y + 2, 2);

  // 底衬
  const w = ctx.measureText(text).width + (text.length - 1) * 2;
  const g = ctx.createLinearGradient(x - 30, 0, x + w + 60, 0);
  g.addColorStop(0, "rgba(4,8,16,0.55)");
  g.addColorStop(1, "rgba(4,8,16,0)");
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = g;
  ctx.fillRect(x - 40, y - 62, w + 130, 92);
  ctx.restore();
};

/** 中央巨大粗体标题：弹出 + 冲击 */
export const drawBigTitle = (
  ctx: CanvasRenderingContext2D,
  opt: {
    main: string;
    sub?: string;
    sub2?: string;
    a: number;
    p: number; // 0..1 弹出进度
    color?: "red" | "white" | "gold";
    size?: number;
    box?: boolean;
    y?: number;
  }
) => {
  const { main, sub, sub2, a, p, color = "white", size = 176, box = true, y = H * 0.47 } = opt;
  if (a <= 0.01) return;
  resetT(ctx);
  const k = overshoot(clamp01(p / 0.55), 1.9);
  const sc = 0.62 + 0.38 * k;
  const flash = Math.max(0, 1 - p / 0.22);
  const col = color === "red" ? C.redHot : color === "gold" ? C.goldSoft : C.white;

  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(W / 2, y);
  ctx.scale(sc, sc);

  ctx.font = `900 ${size}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tw = ctx.measureText(main).width;

  // 红色矩形边框（贴合文字）
  if (box) {
    const padX = size * 0.26;
    const padY = size * 0.26;
    const bw = tw + padX * 2;
    const bh = size + padY * 2;
    const bp = clamp01((p - 0.06) / 0.3);
    ctx.save();
    ctx.globalAlpha = a * bp * (0.9 + 0.1 * Math.sin(p * 20));
    ctx.strokeStyle = C.red;
    ctx.lineWidth = 10;
    ctx.shadowColor = C.red;
    ctx.shadowBlur = 24;
    const w = bw * easeOutQuint(bp);
    const h = bh;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // 发光
  ctx.shadowColor = color === "red" ? C.red : "rgba(180,210,255,0.9)";
  ctx.shadowBlur = 46 + flash * 90;
  ctx.fillStyle = col;
  ctx.fillText(main, 0, 0);

  // 冲击亮闪
  if (flash > 0.02) {
    ctx.globalAlpha = a * flash * 0.9;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(main, 0, 0);
  }
  ctx.shadowBlur = 0;

  if (sub) {
    ctx.globalAlpha = a * clamp01((p - 0.3) / 0.3);
    ctx.font = `700 ${size * 0.2}px ${FONT}`;
    ctx.fillStyle = "rgba(232,240,252,0.92)";
    ctx.shadowColor = "rgba(2,4,10,0.9)";
    ctx.shadowBlur = 16;
    tracked(ctx, sub, 0, size * (box ? 1.1 : 0.95), 8, "center");
    ctx.shadowBlur = 0;
  }
  if (sub2) {
    ctx.globalAlpha = a * clamp01((p - 0.45) / 0.3);
    ctx.font = `500 ${size * 0.13}px ${FONT}`;
    ctx.fillStyle = "rgba(180,200,225,0.62)";
    tracked(ctx, sub2, 0, size * 1.26, 5, "center");
  }
  ctx.restore();
};

/** 右上角：坐标读数 */
export const drawReadout = (
  ctx: CanvasRenderingContext2D,
  lon: number,
  lat: number,
  zoom: number,
  a: number
) => {
  if (a <= 0.01) return;
  resetT(ctx);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = `500 15px ${FONT}`;
  ctx.fillStyle = "rgba(130,158,196,0.62)";
  (ctx as any).fontVariantNumeric = "tabular-nums";
  ctx.textAlign = "right";
  const x = W - 82;
  ctx.fillText(`LON ${lon.toFixed(2)}  LAT ${lat.toFixed(2)}`, x, 74);
  ctx.fillText(`SCALE ${(zoom * 100).toFixed(0)}%`, x, 98);
  // 十字准星
  ctx.strokeStyle = "rgba(130,158,196,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 168, 120);
  ctx.lineTo(x, 120);
  ctx.stroke();
  ctx.restore();
};

/** 底部该幕进度条 */
export const drawProgress = (
  ctx: CanvasRenderingContext2D,
  t: number,
  total: number,
  a = 1
) => {
  resetT(ctx);
  ctx.save();
  ctx.globalAlpha = a;
  const x0 = 82,
    x1 = W - 82,
    y = H - 40;
  ctx.strokeStyle = "rgba(120,150,190,0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
  const p = clamp01(t / total);
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, "rgba(255,60,80,0.85)");
  g.addColorStop(0.5, "rgba(255,120,80,0.9)");
  g.addColorStop(1, "rgba(240,200,110,0.95)");
  ctx.strokeStyle = g;
  ctx.lineWidth = 3;
  ctx.shadowColor = "rgba(255,80,90,0.9)";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x0 + (x1 - x0) * p, y);
  ctx.stroke();
  ctx.restore();
};

/** 卡片式标题（用于快切） */
export const drawCardTitle = (
  ctx: CanvasRenderingContext2D,
  text: string,
  sub: string,
  x: number,
  y: number,
  a: number,
  color = C.white,
  size = 74
) => {
  resetT(ctx);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = `900 ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 26;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  if (sub) {
    ctx.font = `600 22px ${FONT}`;
    ctx.fillStyle = "rgba(170,196,228,0.72)";
    tracked(ctx, sub, x + 2, y + 40, 6);
  }
  ctx.restore();
};
