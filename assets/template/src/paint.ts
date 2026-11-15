import { Cam, W, H, proj, applyCam, resetT, clamp01, screen, easeOut, easeInOut } from "./geo";
import { BORDERS, DEFS, PATCHES, Def, Side, transAt, sideAt, Patch } from "./world";
import { C, FONT, tracked, glow } from "./palette";
import cardShapes from "./card-shapes.json";

type Entry = {
  name: string;
  path: Path2D;
  bbox: [number, number, number, number]; // world units
  def: Def | null;
};

let entries: Entry[] | null = null;

const build = (): Entry[] => {
  const list: Entry[] = [];
  const byName = new Map<string, Def>();
  for (const d of DEFS) for (const g of d.gis) byName.set(g, d);
  for (const name of Object.keys(BORDERS)) {
    const rings = BORDERS[name];
    const p = new Path2D();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, any = false;
    for (const r of rings) {
      for (let i = 0; i < r.length; i++) {
        const [X, Y] = proj(r[i][0], r[i][1]);
        if (!isFinite(X) || !isFinite(Y)) continue;
        if (i === 0) p.moveTo(X, Y);
        else p.lineTo(X, Y);
        if (X < x0) x0 = X;
        if (X > x1) x1 = X;
        if (Y < y0) y0 = Y;
        if (Y > y1) y1 = Y;
        any = true;
      }
      p.closePath();
    }
    if (!any) continue;
    list.push({ name, path: p, bbox: [x0, y0, x1, y1], def: byName.get(name) || null });
  }
  return list;
};

export const getEntries = () => (entries ||= build());

const view = (cam: Cam): [number, number, number, number] => {
  const hw = W / 2 / cam.zoom + 80 / cam.zoom;
  const hh = H / 2 / cam.zoom + 80 / cam.zoom;
  return [cam.x - hw, cam.y - hh, cam.x + hw, cam.y + hh];
};

const hit = (b: number[], v: number[], pad = 0) =>
  !(b[2] < v[0] - pad || b[0] > v[2] + pad || b[3] < v[1] - pad || b[1] > v[3] + pad);

export const SIDE_FILL: Record<Side, string> = {
  axis: "rgba(214,42,60,0.42)",
  allies: "rgba(34,80,168,0.40)",
  neutral: "rgba(16,24,40,0.9)",
  soviet: "rgba(34,80,168,0.40)",
  gone: "rgba(30,26,24,0.55)",
};

/** 轴心本土用更深的红，与被占领区拉开层次 */
const CORE_AXIS = "rgba(172,12,30,0.86)";
const CORE = new Set(["Germany", "Austria", "Czechia", "Slovakia"]);

export const SIDE_EDGE: Record<Side, string> = {
  axis: "rgba(255,104,120,0.95)",
  allies: "rgba(112,172,255,0.85)",
  neutral: "rgba(96,126,172,0.34)",
  soviet: "rgba(112,172,255,0.85)",
  gone: "rgba(150,130,110,0.5)",
};

const dot = (x: number, y: number, dx: number, dy: number) => x * dx + y * dy;

/** 沿 dir 方向以 p 为进度填充区域，边界带柔和过渡。
 *
 *  ⚠️ 这不是"势力推进"。它只处理**单个**多边形沿一个方向被填到几成。
 *  用它逐块做领土易主，会得到"红蓝交界错位成两条边"和"整块啪一下变色"
 *  这两个已被用户点名的问题——因为每块地各按自己的 dir 推。
 *  真正的推进要**按事件共用一条锋线**，见 assets/template/src/front-push.ts。 */
export const fillGrow = (
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  bbox: number[],
  dir: [number, number],
  p: number,
  color: string,
  soft = 120
) => {
  if (p <= 0) return;
  const len = Math.hypot(dir[0], dir[1]) || 1;
  const dx = dir[0] / len,
    dy = dir[1] / len;
  const c0x = (bbox[0] + bbox[2]) / 2,
    c0y = (bbox[1] + bbox[3]) / 2;
  const corners = [
    [bbox[0], bbox[1]],
    [bbox[2], bbox[1]],
    [bbox[0], bbox[3]],
    [bbox[2], bbox[3]],
  ].map(([x, y]) => dot(x, y, dx, dy));
  const pmin = Math.min(...corners),
    pmax = Math.max(...corners);
  const bound = pmin + (pmax - pmin) * Math.min(1, p);

  ctx.save();
  // 直接用 path 填色，不依赖 clip：超大国家做 clip 会失效
  if (p >= 1) {
    ctx.fillStyle = color;
  } else {
    const mid = dot(c0x, c0y, dx, dy);
    const s0 = bound - soft,
      s1 = bound + soft;
    const ax = c0x + dx * (s0 - mid),
      ay = c0y + dy * (s0 - mid);
    const bx = c0x + dx * (s1 - mid),
      by = c0y + dy * (s1 - mid);
    const g = ctx.createLinearGradient(ax, ay, bx, by);
    const base = color.replace(/[\d.]+\)$/, "");
    const a0 = parseFloat(color.match(/([\d.]+)\)$/)?.[1] || "1");
    g.addColorStop(0, `${base}${a0})`);
    g.addColorStop(0.72, `${base}${a0})`);
    g.addColorStop(1, `${base}0)`);
    ctx.fillStyle = g;
  }
  ctx.fill(path, "nonzero");
  ctx.restore();
};

/** 经纬网格：淡淡的科技底纹 */
export const drawGrid = (ctx: CanvasRenderingContext2D, cam: Cam, a = 1) => {
  applyCam(ctx, cam);
  ctx.save();
  ctx.lineWidth = 1 / cam.zoom;
  ctx.strokeStyle = `rgba(80,130,200,${0.075 * a})`;
  ctx.beginPath();
  for (let lon = -20; lon <= 60; lon += 5) {
    const [X] = proj(lon, 0);
    ctx.moveTo(X, -6000);
    ctx.lineTo(X, 6000);
  }
  for (let lat = 20; lat <= 75; lat += 5) {
    const [, Y] = proj(0, lat);
    ctx.moveTo(-6000, Y);
    ctx.lineTo(6000, Y);
  }
  ctx.stroke();
  ctx.restore();
};

/** 陆地：暗底 + 细边 */
export const drawLand = (ctx: CanvasRenderingContext2D, cam: Cam, t: number, dim = 1) => {
  const v = view(cam);
  applyCam(ctx, cam);
  const list = getEntries();
  ctx.save();
  for (const e of list) {
    if (!hit(e.bbox, v)) continue;
    ctx.fillStyle = C.land;
    ctx.fill(e.path);
  }
  ctx.lineWidth = 1.5 / cam.zoom;
  ctx.strokeStyle = C.landLine;
  for (const e of list) {
    if (!hit(e.bbox, v)) continue;
    ctx.stroke(e.path);
  }
  ctx.restore();
};

/** 势力填充：正在转换的国家用波前遮罩，已稳定的直接平涂 */
export const drawControl = (ctx: CanvasRenderingContext2D, cam: Cam, t: number, mul = 1) => {
  const v = view(cam);
  applyCam(ctx, cam);
  const list = getEntries();
  for (const e of list) {
    if (!e.def) continue;
    if (!hit(e.bbox, v)) continue;
    const [prev, cur, p] = transAt(e.def, t, 1.05);
    if (cur === "neutral" && prev === "neutral") continue;
    if (cur === "neutral" && p > 0.98) continue;

    const dir = e.def.dir || [1, 0];
    const soft = 150;

    // 旧势力残留（正在被替换）
    if (prev !== cur && p < 1 && prev !== "neutral") {
      const a = parseFloat(SIDE_FILL[prev].match(/([\d.]+)\)$/)?.[1] || "0.5");
      fillGrow(ctx, e.path, e.bbox, dir, 1, withAlpha(SIDE_FILL[prev], a * (1 - p) * mul), soft);
    }
    const bigBg = e.name === "Russia" || e.name === "Algeria" || e.name === "Egypt" || e.name === "Saudi Arabia";
    const fillSrc = bigBg
      ? cur === "axis"
        ? "rgba(196,36,54,0.26)"
        : "rgba(34,80,168,0.24)"
      : cur === "axis" && CORE.has(e.name)
      ? CORE_AXIS
      : SIDE_FILL[cur];
    const a = parseFloat(fillSrc.match(/([\d.]+)\)$/)?.[1] || "0.5");
    const prog = prev === cur ? 1 : easeOut(p);
    fillGrow(ctx, e.path, e.bbox, dir, prog, withAlpha(fillSrc, a * mul), soft);
  }
};

const withAlpha = (rgba: string, a: number) =>
  rgba.replace(/[\d.]+\)$/, `${Math.max(0, Math.min(1, a)).toFixed(3)})`);

/** 势力边界发光：只描当前有阵营的国家 */
export const drawGlowEdges = (ctx: CanvasRenderingContext2D, cam: Cam, t: number, mul = 1) => {
  const v = view(cam);
  applyCam(ctx, cam);
  const list = getEntries();
  ctx.save();
  // 先压一条暗线，让相邻的红色块之间有分界
  ctx.lineWidth = 4.5 / cam.zoom;
  ctx.strokeStyle = "rgba(6,3,10,0.5)";
  ctx.shadowBlur = 0;
  for (const e of list) {
    if (!e.def) continue;
    if (!hit(e.bbox, v)) continue;
    const s = sideAt(e.def, t);
    if (s === "neutral" || s === "gone") continue;
    const [, , p] = transAt(e.def, t, 1.05);
    ctx.globalAlpha = clamp01(p) * 0.85 * mul;
    ctx.stroke(e.path);
  }
  // 再描亮边：外层宽半透明当作光晕，避免昂贵的 shadowBlur
  ctx.shadowBlur = 0;
  ctx.lineWidth = 5.5 / cam.zoom;
  for (const e of list) {
    if (!e.def) continue;
    if (!hit(e.bbox, v)) continue;
    const s = sideAt(e.def, t);
    if (s === "neutral" || s === "gone") continue;
    const [, , p] = transAt(e.def, t, 1.05);
    ctx.globalAlpha = clamp01(p) * 0.3 * mul;
    ctx.strokeStyle = SIDE_EDGE[s];
    ctx.stroke(e.path);
  }
  ctx.lineWidth = 1.6 / cam.zoom;
  for (const e of list) {
    if (!e.def) continue;
    if (!hit(e.bbox, v)) continue;
    const s = sideAt(e.def, t);
    if (s === "neutral" || s === "gone") continue;
    const [, , p] = transAt(e.def, t, 1.05);
    ctx.globalAlpha = clamp01(p) * 0.95 * mul;
    ctx.strokeStyle = SIDE_EDGE[s];
    ctx.stroke(e.path);
  }
  ctx.restore();
};

/** 苏联腹地这类跨大片国土的局部占领：全部用 fill，不用 clip */
let offCv: HTMLCanvasElement | null = null;
const getOff = () => {
  if (!offCv) {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    offCv = c;
  }
  return offCv;
};

export const drawPatches = (ctx: CanvasRenderingContext2D, cam: Cam, t: number, mul = 1) => {
  const list = getEntries();
  for (const p of PATCHES) {
    if (t < p.t0) continue;
    const prog = clamp01((t - p.t0) / (p.t1 - p.t0));
    if (prog <= 0) continue;
    const es = list.filter((e) => p.gis.includes(e.name));
    if (!es.length) continue;

    const [ax, ay, bx, by] = growLine(p.box, p.dir, prog);
    const rgbc = p.to === "axis" ? [196, 36, 54] : [34, 80, 168];

    const off = getOff();
    const o = off.getContext("2d")!;
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.globalCompositeOperation = "source-over";
    o.globalAlpha = 1;
    o.clearRect(0, 0, W, H);
    applyCam(o, cam);

    const g = o.createLinearGradient(ax, ay, bx, by);
    g.addColorStop(0, `rgba(${rgbc[0]},${rgbc[1]},${rgbc[2]},0.44)`);
    g.addColorStop(0.76, `rgba(${rgbc[0]},${rgbc[1]},${rgbc[2]},0.44)`);
    g.addColorStop(1, `rgba(${rgbc[0]},${rgbc[1]},${rgbc[2]},0)`);
    o.fillStyle = g;
    for (const e of es) o.fill(e.path, "nonzero");

    // 只保留经纬窗口以内
    o.globalCompositeOperation = "destination-in";
    o.fillStyle = "#fff";
    o.fill(rectPath(p.box), "nonzero");

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = mul;
    ctx.drawImage(off, 0, 0);
    ctx.restore();
  }
};

/** 地块的亮边，跟着 patch 一起出现 */
export const drawPatchEdges = (ctx: CanvasRenderingContext2D, cam: Cam, t: number, mul = 1) => {
  const list = getEntries();
  for (const p of PATCHES) {
    if (t < p.t0) continue;
    const prog = clamp01((t - p.t0) / (p.t1 - p.t0));
    if (prog <= 0) continue;
    const es = list.filter((e) => p.gis.includes(e.name));
    applyCam(ctx, cam);
    ctx.save();
    ctx.lineWidth = 1.6 / cam.zoom;
    ctx.strokeStyle = p.to === "axis" ? SIDE_EDGE.axis : SIDE_EDGE.allies;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 12 / Math.max(0.6, cam.zoom * 2);
    ctx.globalAlpha = 0.7 * Math.min(1, prog * 3) * mul;
    for (const e of es) {
      ctx.save();
      ctx.clip(rectPath(p.box), "nonzero");
      ctx.stroke(e.path);
      ctx.restore();
    }
    ctx.restore();
  }
};

const rectPath = (box: number[]): Path2D => {
  const p = new Path2D();
  const [a, b, c, d] = box;
  const p1 = proj(a, d),
    p2 = proj(c, d),
    p3 = proj(c, b),
    p4 = proj(a, b);
  p.moveTo(p1[0], p1[1]);
  p.lineTo(p2[0], p2[1]);
  p.lineTo(p3[0], p3[1]);
  p.lineTo(p4[0], p4[1]);
  p.closePath();
  return p;
};

/** 沿 dir 计算波前的两端点（世界坐标） */
const growLine = (box: number[], dir: [number, number], prog: number): [number, number, number, number] => {
  const [lon0, lat0, lon1, lat1] = box;
  const A = proj(lon0, (lat0 + lat1) / 2);
  const B = proj(lon1, (lat0 + lat1) / 2);
  const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const s = (dir[0] < 0 ? -1 : 1) * len * (1 - prog) * 0.5;
  return [A[0] + s, A[1], B[0] + s, B[1]];
};

/** 国家名小字 */
export const drawLabels = (ctx: CanvasRenderingContext2D, cam: Cam, t: number, a = 1) => {
  applyCam(ctx, cam);
  ctx.save();
  ctx.font = `500 17px ${FONT}`;
  ctx.textAlign = "center";
  for (const e of getEntries()) {
    if (!e.def || !e.def.at) continue;
    if (!e.def.small) continue;
    const [x, y] = proj(e.def.at[0], e.def.at[1]);
    ctx.fillStyle = `rgba(150,175,210,${0.35 * a})`;
    ctx.fillText((e.def as any).cn || "", x, y);
  }
  ctx.restore();
};

/** 卡片用的小图：读预归一化的轮廓，坐标已缩到 0..1 */
const cardCache = new Map<string, Path2D>();
const getCardPath = (name: string): Path2D | null => {
  if (cardCache.has(name)) return cardCache.get(name)!;
  const rings = (cardShapes as any)[name];
  if (!rings) {
    cardCache.set(name, null as any);
    return null;
  }
  const p = new Path2D();
  for (const r of rings) {
    r.forEach((pt: number[], i: number) => {
      if (i === 0) p.moveTo(pt[0], pt[1]);
      else p.lineTo(pt[0], pt[1]);
    });
    p.closePath();
  }
  cardCache.set(name, p);
  return p;
};

/** 在指定矩形里画一个国家的轮廓（用于卡片） */
export const drawCountryInBox = (
  ctx: CanvasRenderingContext2D,
  name: string,
  box: [number, number, number, number],
  color: string,
  fill: string,
  width = 3
) => {
  const p = getCardPath(name);
  if (!p) return;
  const [x0, y0, x1, y1] = box;
  const w = x1 - x0,
    h = y1 - y0;
  const s = Math.min(w, h) * 0.94;
  const ox = x0 + (w - s) / 2,
    oy = y0 + (h - s) / 2;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(s, s);
  ctx.fillStyle = fill;
  ctx.fill(p, "nonzero");
  ctx.lineWidth = width / s;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12 / s;
  ctx.stroke(p);
  ctx.restore();
};
