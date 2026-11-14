import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill } from "remotion";
import { proj, Cam } from "./geo";
import { C, FONT, tracked } from "./palette";
import { getEntries, SIDE_FILL, SIDE_EDGE } from "./paint";
import { sideAt } from "./world";

/* ═══════════════════════════════════════════
   封面：4:3 与 3:4
   复用正片的投影 / 势力配色 / 红框标题，
   但不依赖 geo 里写死的 1920×1080 视口。
   ═══════════════════════════════════════════ */

export type Variant = "wide" | "tall";

const CFG: Record<Variant, { W: number; H: number; lon: number; lat: number; zoom: number }> = {
  wide: { W: 1440, H: 1080, lon: 15.0, lat: 49.5, zoom: 0.35 },
  tall: { W: 1080, H: 1440, lon: 11.5, lat: 49.5, zoom: 0.34 },
};

/** 封面定格时刻：1942 扩张顶点——红蓝对比最强 */
const T_MOMENT = 58.0;

const CORE = new Set(["Germany", "Austria", "Czechia", "Slovakia"]);
const BIG = new Set(["Russia", "Algeria", "Egypt", "Saudi Arabia"]);

const camFor = (c: (typeof CFG)[Variant]): Cam => {
  const [x, y] = proj(c.lon, c.lat);
  return { x, y, zoom: c.zoom };
};

/* ── 背景 ── */
const drawBG = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
  const g = ctx.createRadialGradient(W * 0.5, H * 0.46, 40, W * 0.5, H * 0.5, W * 0.92);
  g.addColorStop(0, C.bg2);
  g.addColorStop(0.55, C.bg0);
  g.addColorStop(1, "#020306");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
};

/* ── 地图 ── */
const paintMap = (ctx: CanvasRenderingContext2D, W: number, H: number, cam: Cam, t: number) => {
  const list = getEntries();
  const A = (zoomK: number) => Math.max(zoomK, 0.05);

  ctx.save();
  ctx.setTransform(cam.zoom, 0, 0, cam.zoom, W / 2 - cam.x * cam.zoom, H / 2 - cam.y * cam.zoom);

  // 经纬网格
  ctx.lineWidth = 1 / A(cam.zoom);
  ctx.strokeStyle = "rgba(80,130,200,0.07)";
  ctx.beginPath();
  for (let lon = -20; lon <= 60; lon += 5) {
    const [X] = proj(lon, 0);
    ctx.moveTo(X, -7000);
    ctx.lineTo(X, 7000);
  }
  for (let lat = 20; lat <= 78; lat += 5) {
    const [, Y] = proj(0, lat);
    ctx.moveTo(-7000, Y);
    ctx.lineTo(7000, Y);
  }
  ctx.stroke();

  // 陆地
  ctx.fillStyle = C.land;
  for (const e of list) ctx.fill(e.path);
  ctx.lineWidth = 1.3 / A(cam.zoom);
  ctx.strokeStyle = C.landLine;
  for (const e of list) ctx.stroke(e.path);

  // 势力填充
  for (const e of list) {
    if (!e.def) continue;
    const s = sideAt(e.def, t);
    if (s === "neutral") continue;
    let fill: string;
    if (BIG.has(e.name)) fill = s === "axis" ? "rgba(196,36,54,0.26)" : "rgba(34,80,168,0.24)";
    else if (s === "axis" && CORE.has(e.name)) fill = "rgba(172,12,30,0.86)";
    else fill = SIDE_FILL[s];
    ctx.fillStyle = fill;
    ctx.fill(e.path);
  }

  // 边界：先压暗线，再描亮边（宽半透明当光晕）
  ctx.lineWidth = 4.2 / A(cam.zoom);
  ctx.strokeStyle = "rgba(6,3,10,0.5)";
  for (const e of list) {
    if (!e.def) continue;
    const s = sideAt(e.def, t);
    if (s === "neutral" || s === "gone") continue;
    ctx.stroke(e.path);
  }
  ctx.globalAlpha = 0.34;
  ctx.lineWidth = 6 / A(cam.zoom);
  for (const e of list) {
    if (!e.def) continue;
    const s = sideAt(e.def, t);
    if (s === "neutral" || s === "gone") continue;
    ctx.strokeStyle = SIDE_EDGE[s];
    ctx.stroke(e.path);
  }
  ctx.globalAlpha = 0.95;
  ctx.lineWidth = 1.5 / A(cam.zoom);
  for (const e of list) {
    if (!e.def) continue;
    const s = sideAt(e.def, t);
    if (s === "neutral" || s === "gone") continue;
    ctx.strokeStyle = SIDE_EDGE[s];
    ctx.stroke(e.path);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
};

/* ── 压角渐变：给文字留出可读区 ── */
const drawShade = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const top = ctx.createLinearGradient(0, 0, 0, H * 0.32);
  top.addColorStop(0, "rgba(3,5,10,0.86)");
  top.addColorStop(1, "rgba(3,5,10,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H * 0.32);

  const bot = ctx.createLinearGradient(0, H * 0.46, 0, H);
  bot.addColorStop(0, "rgba(3,5,10,0)");
  bot.addColorStop(0.55, "rgba(3,5,10,0.5)");
  bot.addColorStop(1, "rgba(2,3,7,0.93)");
  ctx.fillStyle = bot;
  ctx.fillRect(0, H * 0.46, W, H * 0.54);

  // 四周轻微压暗
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.34, W / 2, H / 2, Math.max(W, H) * 0.78);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.7)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // 扫描网线（屏幕质感，非颗粒）
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "rgba(120,170,240,0.05)";
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  ctx.globalAlpha = 1;
  ctx.restore();
};

/* ── 标题：白字 + 红框，与正片同一套语言 ── */
const drawTitle = (
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  opt: { main: string; size: number; y: number }
) => {
  const { main, size, y } = opt;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(W / 2, y);

  ctx.font = `900 ${size}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tw = ctx.measureText(main).width;

  // 红框
  const padX = size * 0.32;
  const padY = size * 0.26;
  const bw = tw + padX * 2;
  const bh = size + padY * 2;
  ctx.strokeStyle = C.red;
  ctx.lineWidth = Math.max(6, size * 0.06);
  ctx.shadowColor = C.red;
  ctx.shadowBlur = size * 0.24;
  ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
  ctx.shadowBlur = 0;

  // 红框内稍压暗，白字更跳
  const ig = ctx.createLinearGradient(0, -bh / 2, 0, bh / 2);
  ig.addColorStop(0, "rgba(4,8,16,0.30)");
  ig.addColorStop(1, "rgba(4,8,16,0.46)");
  ctx.fillStyle = ig;
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);

  // 主字
  ctx.shadowColor = "rgba(190,215,255,0.85)";
  ctx.shadowBlur = size * 0.12;
  ctx.fillStyle = C.white;
  ctx.fillText(main, 0, 0);
  ctx.shadowBlur = 0;
  ctx.restore();
};

/* ── 信息条 ── */
const drawInfo = (ctx: CanvasRenderingContext2D, W: number, H: number, v: Variant) => {
  const wide = v === "wide";
  const m = wide ? 64 : 72;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // 左上：年份
  ctx.fillStyle = C.redHot;
  ctx.shadowColor = C.redHot;
  ctx.shadowBlur = 14;
  ctx.fillRect(m, m, 6, 40);
  ctx.shadowBlur = 0;

  ctx.font = `600 ${wide ? 16 : 15}px ${FONT}`;
  ctx.fillStyle = "rgba(150,178,214,0.9)";
  tracked(ctx, "EUROPEAN THEATRE", m + 20, m + 12, 3.4);
  ctx.font = `700 ${wide ? 34 : 30}px ${FONT}`;
  ctx.fillStyle = C.white;
  tracked(ctx, "1939 — 1945", m + 20, m + 46, 1.4);

  // 右上：阵营图例
  const lx = W - m;
  const legend = [
    { c: C.redHot, t: "轴心国" },
    { c: C.blueHot, t: "同盟国" },
  ];
  ctx.font = `600 ${wide ? 17 : 16}px ${FONT}`;
  ctx.textAlign = "right";
  let ly = m + 14;
  for (const g of legend) {
    ctx.fillStyle = g.c;
    ctx.shadowColor = g.c;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(lx - 62, ly - 5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(206,222,244,0.82)";
    ctx.fillText(g.t, lx, ly);
    ly += wide ? 26 : 25;
  }
  ctx.textAlign = "left";

  // 底部：一行档案式信息
  const by = H - m + (wide ? 4 : 2);
  ctx.font = `500 ${wide ? 19 : 17}px ${FONT}`;
  ctx.fillStyle = "rgba(170,192,220,0.62)";
  tracked(ctx, "25 个镜头　·　136 BPM 卡点　·　全程固定机位", m, by, 2.2);

  // 底部红线
  ctx.fillStyle = "rgba(230,21,43,0.85)";
  ctx.fillRect(m, by + 16, wide ? 150 : 130, 3);
  ctx.restore();
};

/* ── 画面 ── */
export const Cover: React.FC<{ variant: Variant }> = ({ variant }) => {
  const c = CFG[variant];
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const { W, H } = c;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    drawBG(ctx, W, H);
    paintMap(ctx, W, H, camFor(c), T_MOMENT);
    drawShade(ctx, W, H);

    // 标题位置：横版压在下方三分之一，竖版压在下方
    const size = variant === "wide" ? 138 : 112;
    const titleY = variant === "wide" ? H * 0.66 : H * 0.72;
    drawTitle(ctx, W, H, { main: "第二次世界大战", size, y: titleY });

    // 标题下的副行：必须落在红框外
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const subY = titleY + size * 1.02;
    ctx.font = `700 ${size * 0.225}px ${FONT}`;
    ctx.fillStyle = C.goldSoft;
    ctx.shadowColor = "rgba(2,4,10,0.92)";
    ctx.shadowBlur = 18;
    tracked(ctx, "欧 洲 战 场 · 闪 电 战 到 柏 林 陷 落", W / 2, subY, variant === "wide" ? 4 : 2, "center");
    ctx.shadowBlur = 0;
    ctx.restore();

    drawInfo(ctx, W, H, variant);
  }, [variant]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#03050a" }}>
      <canvas ref={ref} width={c.W} height={c.H} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
