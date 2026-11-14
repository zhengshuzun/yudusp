import { Cam, applyCam, proj, clamp01, easeOut, easeOutQuint, screen, resetT } from "./geo";
import { C, FONT, glow } from "./palette";

export type LL = [number, number];

const projPath = (pts: LL[]) => pts.map(([lon, lat]) => proj(lon, lat));

const segLen = (a: number[], b: number[]) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** 折线按进度截取，返回可见点集与剩余长度 */
const cut = (P: number[][], prog: number) => {
  let total = 0;
  const L: number[] = [];
  for (let i = 1; i < P.length; i++) {
    const l = segLen(P[i - 1], P[i]);
    L.push(l);
    total += l;
  }
  const target = total * clamp01(prog);
  let acc = 0;
  const out: number[][] = [P[0]];
  for (let i = 1; i < P.length; i++) {
    const l = L[i - 1];
    if (acc + l <= target) {
      out.push(P[i]);
      acc += l;
    } else {
      const r = (target - acc) / l;
      const x = P[i - 1][0] + (P[i][0] - P[i - 1][0]) * r;
      const y = P[i - 1][1] + (P[i][1] - P[i - 1][1]) * r;
      out.push([x, y]);
      acc = target;
      break;
    }
  }
  return { pts: out, total, done: target };
};

/** 进军箭头：带状箭身 + 三角箭头 + 尾迹发光 */
export const drawArrow = (
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  pts: LL[],
  prog: number,
  color: string,
  w = 26,
  head = 46,
  alpha = 1
) => {
  if (prog <= 0.001 || alpha <= 0.01) return;
  const P = projPath(pts);
  const { pts: V } = cut(P, easeOutQuint(prog));
  if (V.length < 2) return;

  // 总长
  let total = 0;
  for (let i = 1; i < V.length; i++) total += segLen(V[i - 1], V[i]);
  const hp = Math.min(total * 0.55, head * 1.55); // 头长
  const bodyEnd = Math.max(0, total - hp * 0.78);

  // 采样箭身中线到 bodyEnd
  const body: number[][] = [];
  let acc = 0;
  body.push(V[0]);
  for (let i = 1; i < V.length; i++) {
    const l = segLen(V[i - 1], V[i]);
    if (acc + l <= bodyEnd) {
      body.push(V[i]);
      acc += l;
    } else {
      const r = (bodyEnd - acc) / l;
      body.push([V[i - 1][0] + (V[i][0] - V[i - 1][0]) * r, V[i - 1][1] + (V[i][1] - V[i - 1][1]) * r]);
      break;
    }
  }
  if (body.length < 2) return;

  // 左右边界
  const left: number[][] = [];
  const right: number[][] = [];
  for (let i = 0; i < body.length; i++) {
    const a = body[Math.max(0, i - 1)];
    const b = body[Math.min(body.length - 1, i + 1)];
    let dx = b[0] - a[0],
      dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const nx = -dy,
      ny = dx;
    // 尾部略收窄，更有指向感
    const wid = (w / 2) * 0.7 * (i === 0 ? 0.72 : 1);
    left.push([body[i][0] + nx * wid, body[i][1] + ny * wid]);
    right.push([body[i][0] - nx * wid, body[i][1] - ny * wid]);
  }
  const tip = V[V.length - 1];
  const axisEnd = body[body.length - 1];
  let tx = tip[0] - axisEnd[0],
    ty = tip[1] - axisEnd[1];
  const tl = Math.hypot(tx, ty) || 1;
  tx /= tl;
  ty /= tl;
  const bx = -ty,
    by = tx;
  const bw = w * 1.02;

  ctx.save();
  applyCam(ctx, cam);
  ctx.globalAlpha = alpha;

  // 箭身路径
  const bodyPath = new Path2D();
  bodyPath.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < left.length; i++) bodyPath.lineTo(left[i][0], left[i][1]);
  bodyPath.lineTo(axisEnd[0] + bx * bw, axisEnd[1] + by * bw);
  bodyPath.lineTo(tip[0], tip[1]);
  bodyPath.lineTo(axisEnd[0] - bx * bw, axisEnd[1] - by * bw);
  for (let i = right.length - 1; i >= 0; i--) bodyPath.lineTo(right[i][0], right[i][1]);
  bodyPath.closePath();

  // 外发光：宽描边代替大范围模糊
  ctx.save();
  ctx.globalAlpha = alpha * 0.22;
  ctx.strokeStyle = color;
  ctx.lineWidth = w * 0.55;
  ctx.stroke(bodyPath);
  ctx.restore();

  // 实心
  ctx.fillStyle = color;
  ctx.fill(bodyPath);

  // 顶部亮边：让箭头有厚度感
  ctx.save();
  ctx.clip(bodyPath, "nonzero");
  const grad = ctx.createLinearGradient(
    left[0][0], left[0][1],
    right[0][0], right[0][1]
  );
  grad.addColorStop(0, "rgba(255,255,255,0.34)");
  grad.addColorStop(0.42, "rgba(255,255,255,0.06)");
  grad.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = grad;
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const q of [...left, ...right, tip]) {
    if (q[0] < bx0) bx0 = q[0];
    if (q[0] > bx1) bx1 = q[0];
    if (q[1] < by0) by0 = q[1];
    if (q[1] > by1) by1 = q[1];
  }
  const pad = w * 3;
  ctx.fillRect(bx0 - pad, by0 - pad, bx1 - bx0 + pad * 2, by1 - by0 + pad * 2);
  ctx.restore();

  // 中轴亮线：指向感
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.32)";
  ctx.lineWidth = Math.max(1.2 / cam.zoom, w * 0.07);
  ctx.beginPath();
  ctx.moveTo(body[0][0], body[0][1]);
  for (let i = 1; i < body.length; i++) ctx.lineTo(body[i][0], body[i][1]);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
};

/** 冲击环 */
export const drawRing = (
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  lon: number,
  lat: number,
  radiusKm: number,
  p: number,
  color: string,
  a = 1
) => {
  const [X, Y] = proj(lon, lat);
  applyCam(ctx, cam);
  ctx.save();
  ctx.globalAlpha = a * (1 - p) * 0.9;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3 / cam.zoom;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18 / cam.zoom;
  ctx.beginPath();
  ctx.arc(X, Y, radiusKm * 100 * (0.2 + easeOut(p) * 0.95), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

/** 城市点 */
export const drawCity = (
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  lon: number,
  lat: number,
  name: string,
  a = 1,
  color = "rgba(255,255,255,0.9)"
) => {
  const [X, Y] = proj(lon, lat);
  applyCam(ctx, cam);
  const s = 1 / cam.zoom;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12 * s * 12;
  ctx.beginPath();
  ctx.arc(X, Y, 5 * s * 1.6, 0, Math.PI * 2);
  ctx.fill();
  if (name) {
    ctx.shadowBlur = 0;
    ctx.font = `600 ${15 * s * 1.5}px ${FONT}`;
    ctx.textAlign = "left";
    ctx.lineWidth = 4 * s * 1.5;
    ctx.strokeStyle = "rgba(3,5,10,0.9)";
    ctx.lineJoin = "round";
    ctx.strokeText(name, X + 12 * s * 1.6, Y + 5 * s * 1.6);
    ctx.fillStyle = "rgba(240,246,255,0.95)";
    ctx.fillText(name, X + 12 * s * 1.6, Y + 5 * s * 1.6);
  }
  ctx.restore();
};

/** 航空编队小图标 */
export const drawPlane = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ang: number,
  size: number,
  color: string,
  a = 1
) => {
  resetT(ctx);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.globalAlpha = a;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.62, size * 0.5);
  ctx.lineTo(-size * 0.3, 0);
  ctx.lineTo(-size * 0.62, -size * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

/** 爆炸：白核 + 火球 + 冲击波 + 放射光 */
export const drawExplosion = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  p: number,
  scale = 1
) => {
  resetT(ctx);
  const grow = easeOutQuint(clamp01(p / 0.5));
  const fade = 1 - clamp01((p - 0.42) / 0.58);
  ctx.save();

  // 全屏白闪
  if (p < 0.11) {
    ctx.fillStyle = `rgba(255,255,255,${(1 - p / 0.11) * 0.92})`;
    ctx.fillRect(0, 0, 1920, 1080);
  }

  // 火球
  const r = (30 + 520 * grow) * scale;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgba(255,255,255,${1 * fade})`);
  g.addColorStop(0.07, `rgba(255,255,255,${0.99 * fade})`);
  g.addColorStop(0.2, `rgba(255,244,198,${0.94 * fade})`);
  g.addColorStop(0.42, `rgba(255,172,62,${0.8 * fade})`);
  g.addColorStop(0.68, `rgba(216,52,18,${0.42 * fade})`);
  g.addColorStop(1, "rgba(50,0,4,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // 冲击波环
  for (let i = 0; i < 4; i++) {
    const q = clamp01((p - 0.02 - i * 0.06) / 0.62);
    if (q <= 0 || q >= 1) continue;
    ctx.globalAlpha = Math.pow(1 - q, 1.6) * 0.72;
    ctx.strokeStyle = i === 0 ? "rgba(255,255,255,0.95)" : i < 2 ? "rgba(255,214,150,0.85)" : "rgba(255,132,60,0.7)";
    ctx.lineWidth = (2 + 14 * (1 - q)) * scale;
    ctx.beginPath();
    ctx.arc(cx, cy, (80 + 700 * easeOut(q)) * scale, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 放射光线
  if (p < 0.7) {
    const k = (1 - clamp01((p - 0.05) / 0.6));
    ctx.globalAlpha = k * 0.65;
    for (let i = 0; i < 34; i++) {
      const ang = (i / 34) * Math.PI * 2 + 0.17;
      const jitter = 0.55 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.9;
      const r0 = 60 * scale;
      const r1 = (200 + 880 * easeOut(p)) * scale * jitter;
      ctx.strokeStyle = i % 4 === 0 ? "rgba(255,252,235,0.95)" : "rgba(255,198,120,0.8)";
      ctx.lineWidth = (i % 4 === 0 ? 4 : 1.6) * scale;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
      ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
      ctx.stroke();
    }
  }
  ctx.restore();
};

/** UI 角标框 */
export const drawBracket = (
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  len = 26,
  a = 1,
  w = 2
) => {
  resetT(ctx);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x0, y0 + len);
  ctx.lineTo(x0, y0);
  ctx.lineTo(x0 + len, y0);
  ctx.moveTo(x1 - len, y0);
  ctx.lineTo(x1, y0);
  ctx.lineTo(x1, y0 + len);
  ctx.moveTo(x1, y1 - len);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x1 - len, y1);
  ctx.moveTo(x0 + len, y1);
  ctx.lineTo(x0, y1);
  ctx.lineTo(x0, y1 - len);
  ctx.stroke();
  ctx.restore();
};

/** 网点阵：战术态势里的单位光点 */
export const drawDots = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  n: number,
  spread: number,
  color: string,
  seed = 1,
  a = 1,
  size = 4
) => {
  resetT(ctx);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  for (let i = 0; i < n; i++) {
    const rx = (Math.abs(Math.sin(i * 12.9898 + seed) * 43758.5453) % 1) - 0.5;
    const ry = (Math.abs(Math.sin(i * 78.233 + seed) * 12345.6789) % 1) - 0.5;
    ctx.beginPath();
    ctx.arc(cx + rx * spread * 2, cy + ry * spread * 2, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

/** 米字旗 */
export const flagUnionJack = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  a = 1
) => {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y);
  ctx.fillStyle = "#0a1a3c";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = h * 0.16;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, h);
  ctx.moveTo(w, 0);
  ctx.lineTo(0, h);
  ctx.stroke();
  ctx.strokeStyle = "#d21f34";
  ctx.lineWidth = h * 0.07;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, h);
  ctx.moveTo(w, 0);
  ctx.lineTo(0, h);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(w * 0.36, 0, w * 0.28, h);
  ctx.fillRect(0, h * 0.34, w, h * 0.32);
  ctx.fillStyle = "#d21f34";
  ctx.fillRect(w * 0.41, 0, w * 0.18, h);
  ctx.fillRect(0, h * 0.41, w, h * 0.18);
  ctx.restore();
};

/** 星条 */
export const flagStarsStripes = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  a = 1
) => {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y);
  const sh = h / 13;
  for (let i = 0; i < 13; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#c1272d" : "#ffffff";
    ctx.fillRect(0, i * sh, w, sh + 0.5);
  }
  ctx.fillStyle = "#1a2456";
  ctx.fillRect(0, 0, w * 0.42, sh * 7);
  ctx.fillStyle = "#ffffff";
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 6; c++) {
      ctx.beginPath();
      ctx.arc(w * 0.045 + c * w * 0.068, sh * 0.7 + r * sh * 1.3, Math.max(1.4, sh * 0.16), 0, 6.3);
      ctx.fill();
    }
  ctx.restore();
};

/** 镰刀锤子（几何简化） */
export const emblemHammerSickle = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  a = 1
) => {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";

  // 镰刀：弧形刀身 + 斜柄
  ctx.save();
  ctx.rotate(-0.22);
  ctx.lineWidth = r * 0.17;
  ctx.beginPath();
  ctx.arc(0, r * 0.06, r * 0.64, Math.PI * 0.92, Math.PI * 1.96);
  ctx.stroke();
  ctx.lineWidth = r * 0.15;
  ctx.beginPath();
  ctx.moveTo(-r * 0.62, r * 0.46);
  ctx.lineTo(r * 0.3, -r * 0.12);
  ctx.stroke();
  ctx.restore();

  // 锤：旋转 -42°
  ctx.save();
  ctx.rotate(0.72);
  ctx.fillRect(-r * 0.085, -r * 0.74, r * 0.17, r * 1.5);
  ctx.beginPath();
  ctx.roundRect(-r * 0.44, -r * 0.82, r * 0.88, r * 0.3, r * 0.06);
  ctx.fill();
  ctx.restore();

  ctx.restore();
};

/** 洛林十字 */
export const emblemLorraine = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  a = 1
) => {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  const t = r * 0.19;
  ctx.fillRect(cx - t / 2, cy - r, t, r * 2);
  ctx.fillRect(cx - r * 0.52, cy - r * 0.46, r * 1.04, t);
  ctx.fillRect(cx - r * 0.36, cy - r * 0.08, r * 0.72, t * 0.86);
  ctx.restore();
};
