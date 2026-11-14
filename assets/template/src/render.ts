import {
  W, H, FPS, Cam, screen, proj, applyCam, resetT, clamp01, lerp, mix,
  easeOut, easeOutQuint, easeInOut, easeIn, span, overshoot, BEAT, beatTime,
} from "./geo";
import { C, FONT, tracked, radial, drawVignette, drawScanlines } from "./palette";
import { drawGrid, drawLand, drawControl, drawGlowEdges, drawPatches, drawPatchEdges, drawCountryInBox, getEntries } from "./paint";
import {
  drawArrow, drawRing, drawCity, drawPlane, drawExplosion, drawBracket, drawDots,
  flagUnionJack, flagStarsStripes, emblemHammerSickle, emblemLorraine, LL,
} from "./fx";
import { SHOTS, Shot, TOTAL, shotAt, dateAt, titleP } from "./shots";
import { drawDate, drawEvent, drawBigTitle, drawReadout, drawProgress, drawCardTitle } from "./hud";

const L = (lon: number, lat: number): LL => [lon, lat];

/* ── 背景 ───────────────────────────────────────────── */
const drawBG = (ctx: CanvasRenderingContext2D, t: number, warm = 0) => {
  resetT(ctx);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  const g = ctx.createRadialGradient(W * 0.5, H * 0.46, 60, W * 0.5, H * 0.5, W * 0.82);
  if (warm > 0) {
    g.addColorStop(0, `rgb(${lerp(12, 46, warm)},${lerp(18, 34, warm)},${lerp(32, 18, warm)})`);
    g.addColorStop(0.55, `rgb(${lerp(7, 22, warm)},${lerp(11, 16, warm)},${lerp(20, 9, warm)})`);
    g.addColorStop(1, "#020306");
  } else {
    g.addColorStop(0, C.bg2);
    g.addColorStop(0.55, C.bg0);
    g.addColorStop(1, C.void0);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
};

/* ── 通用：地图三件套 ─────────────────────────────────── */
const drawMap = (ctx: CanvasRenderingContext2D, cam: Cam, t: number, mul = 1, landA = 1) => {
  ctx.save();
  ctx.globalAlpha = landA;
  drawLand(ctx, cam, t);
  ctx.restore();
  drawControl(ctx, cam, t, mul);
  drawGrid(ctx, cam, 0.6);
  drawGlowEdges(ctx, cam, t, mul);
};

/* ── 城市战术板 ─────────────────────────────────────── */
const drawCityBoard = (
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  t: number,
  opts: { river?: boolean; center?: [number, number] } = {}
) => {
  const [cx, cy] = screen(...(opts.center || [44.5, 48.7]), cam);
  resetT(ctx);
  ctx.save();
  // 屏幕尺度网格：城市街区
  const step = 52;
  ctx.strokeStyle = "rgba(96,132,186,0.11)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const ox = ((cx % step) + step) % step;
  const oy = ((cy % step) + step) % step;
  for (let x = ox - step; x < W + step; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = oy - step; y < H + step; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();
  // 更粗的街区边界
  ctx.strokeStyle = "rgba(110,150,205,0.2)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
      if ((i + j) % 3 !== 0) continue;
      ctx.rect(cx + i * step * 3, cy + j * step * 3, step * 3, step * 3);
    }
  }
  ctx.stroke();
  ctx.restore();

  // 河
  if (opts.river) {
    applyCam(ctx, cam);
    ctx.save();
    const [rx, ry] = opts.center || [44.5, 48.7];
    const A = proj(rx + 0.22, ry + 0.9);
    const B = proj(rx + 0.42, ry + 0.2);
    const Cc = proj(rx + 0.14, ry - 0.5);
    const D = proj(rx + 0.3, ry - 1.2);
    ctx.strokeStyle = "rgba(84,142,214,0.6)";
    ctx.lineWidth = 9;
    ctx.shadowColor = "rgba(84,150,230,0.95)";
    ctx.shadowBlur = 18;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(A[0], A[1]);
    ctx.bezierCurveTo(B[0], B[1], Cc[0], Cc[1], D[0], D[1]);
    ctx.stroke();
    // 河面反光
    ctx.strokeStyle = "rgba(160,210,255,0.35)";
    ctx.lineWidth = 4;
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();
  }
};

/* ═══════════════════════════════════════════════════
   主绘制
   ═══════════════════════════════════════════════════ */
export const renderFrame = (ctx: CanvasRenderingContext2D, t: number, frame: number) => {
  const s = shotAt(t);
  const p = span(t, s.t0, s.t1);
  const lt = t - s.t0;
  const cam = s.cam;

  const finaleWarm = s.id === 25 ? clamp01((t - s.t0) / 5.2) : 0;
  drawBG(ctx, t, finaleWarm);

  /* ── 各镜主体 ── */
  switch (s.id) {
    /* 1 开场 */
    case 1: {
      const k = easeOut(span(t, 0.05, 1.7));
      ctx.save();
      ctx.globalAlpha = k;
      drawGrid(ctx, { ...cam, zoom: cam.zoom * (1.06 - 0.06 * k) }, k);
      drawMap(ctx, cam, t, 1, k);
      ctx.restore();
      // 德国本土的红色脉冲
      const pl = 0.5 + 0.5 * Math.sin(lt * 6);
      drawRing(ctx, cam, 10.4, 51.2, 3.4, ((lt * 0.6) % 1), C.redHot, 0.5);
      const ta = clamp01((t - 0.55) / 0.25);
      if (ta > 0) {
        resetT(ctx);
        const dg = ctx.createRadialGradient(W * 0.5, H * 0.5, 40, W * 0.5, H * 0.5, 620);
        dg.addColorStop(0, `rgba(4,6,12,${0.72 * ta})`);
        dg.addColorStop(0.55, `rgba(4,6,12,${0.5 * ta})`);
        dg.addColorStop(1, "rgba(4,6,12,0)");
        ctx.fillStyle = dg;
        ctx.fillRect(0, 0, W, H);
      }
      drawBigTitle(ctx, {
        main: "野心",
        a: ta,
        p: span(t, 0.55, 2.1),
        color: "red",
        size: 168,
        box: false,
        y: H * 0.5,
      });
      break;
    }

    /* 2 波兰闪击 */
    case 2: {
      drawGrid(ctx, cam, 0.8);
      drawMap(ctx, cam, t, 1);
      const ap = span(t, 2.35, 4.6);
      drawArrow(ctx, cam, [L(13.6, 52.6), L(17.2, 52.5), L(20.6, 52.3)], ap, C.redHot, 26, 44);
      drawArrow(ctx, cam, [L(15.4, 50.6), L(18.8, 50.4), L(21.6, 50.6)], span(t, 3.0, 5.4), C.redHot, 22, 38);
      const ap2 = span(t, 4.6, 6.9);
      drawArrow(ctx, cam, [L(31.2, 53.4), L(27.4, 52.9), L(24.2, 52.2)], ap2, C.blueHot, 20, 36);
      drawCity(ctx, cam, 21.01, 52.23, "华沙", clamp01((t - 5.4) / 0.6));
      drawCity(ctx, cam, 13.4, 52.52, "柏林", 0.5);
      // 华沙沦陷脉冲
      if (t > 6.2) {
        const q = ((t - 6.2) * 0.9) % 1;
        drawRing(ctx, cam, 21.01, 52.23, 1.9, q, C.redHot, 0.9);
      }
      break;
    }

    /* 3 北欧与西欧 */
    case 3: {
      drawGrid(ctx, cam, 0.7);
      drawMap(ctx, cam, t, 1);
      drawArrow(ctx, cam, [L(9.6, 54.6), L(9.9, 57.6), L(10.6, 59.6)], span(t, 9.5, 11.4), C.redHot, 22, 38);
      drawArrow(ctx, cam, [L(9.9, 54.0), L(7.2, 53.4), L(5.4, 52.4)], span(t, 10.6, 12.2), C.redHot, 20, 34);
      drawArrow(ctx, cam, [L(8.6, 52.4), L(6.4, 52.1), L(4.4, 51.2)], span(t, 11.6, 13.2), C.redHot, 20, 34);
      drawCity(ctx, cam, 4.9, 52.37, "阿姆斯特丹", clamp01((t - 12.3) / 0.5));
      drawCity(ctx, cam, 4.35, 50.85, "布鲁塞尔", clamp01((t - 12.6) / 0.5));
      drawCity(ctx, cam, 10.75, 59.91, "奥斯陆", clamp01((t - 11.6) / 0.5));
      break;
    }

    /* 4 法国沦陷 */
    case 4: {
      drawGrid(ctx, cam, 0.6);
      drawMap(ctx, cam, t, 1);
      const ap = span(t, 16.4, 19.1);
      drawArrow(ctx, cam, [L(7.9, 49.6), L(5.4, 49.2), L(3.2, 48.4), L(2.35, 48.86)], ap, C.redHot, 24, 40);
      drawArrow(ctx, cam, [L(7.6, 48.2), L(4.9, 47.6), L(3.6, 47.2)], span(t, 16.9, 19.4), C.redHot, 18, 32, 0.9);
      drawCity(ctx, cam, 2.35, 48.86, "巴黎", clamp01((t - 18.4) / 0.5));
      drawCity(ctx, cam, 2.9, 49.4, "贡比涅", clamp01((t - 19.3) / 0.5));
      drawCity(ctx, cam, 2.38, 51.03, "敦刻尔克", clamp01((t - 17.4) / 0.5), "rgba(120,180,255,0.95)");
      // 敦刻尔克撤退
      if (t > 17.6 && t < 21) {
        const q = span(t, 17.6, 20.8);
        const x0 = screen(2.38, 51.03, cam);
        const x1 = screen(1.35, 51.25, cam);
        ctx.save();
        ctx.strokeStyle = "rgba(120,180,255,0.75)";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([9, 9]);
        ctx.beginPath();
        ctx.moveTo(x0[0], x0[1]);
        ctx.lineTo(lerp(x0[0], x1[0], q), lerp(x0[1], x1[1], q));
        ctx.stroke();
        ctx.restore();
      }
      // 「法国沦陷 6 周」白字
      if (t > 18.2 && t < 21.3) {
        const a = Math.min(clamp01((t - 18.2) / 0.3), clamp01((21.3 - t) / 0.4));
        drawBigTitle(ctx, { main: "6 周", a, p: span(t, 18.2, 18.9), color: "white", size: 132, box: false, y: H * 0.245 });
      }
      break;
    }

    /* 5 不列颠空战 */
    case 5: {
      drawGrid(ctx, cam, 0.7);
      drawMap(ctx, cam, t, 1);
      // 编队飞行
      for (let i = 0; i < 9; i++) {
        const off = i * 0.16;
        const q = clamp01((lt - 0.4 - off) / 4.4);
        if (q <= 0 || q >= 1) continue;
        const from = [3.4 + (i % 3) * 0.5, 50.4 + Math.floor(i / 3) * 0.45];
        const to = [-1.2 + (i % 3) * 0.35, 51.4 + Math.floor(i / 3) * 0.3];
        const lon = lerp(from[0], to[0], q);
        const lat = lerp(from[1], to[1], q) - Math.sin(q * Math.PI) * 0.35;
        const [x, y] = screen(lon, lat, cam);
        drawPlane(ctx, x, y, Math.atan2(-0.5, -0.9) + Math.sin(q * 6) * 0.1, 15, C.redHot, 0.95);
      }
      // 英国上空防空
      const aa = span(t, 2.2, 3.0);
      if (aa > 0) {
        for (let i = 0; i < 7; i++) {
          const lon = -3.4 + (i % 3) * 1.6;
          const lat = 52.2 + Math.floor(i / 3) * 1.0;
          const ph = ((t * 0.55 + i * 0.31) % 1);
          drawRing(ctx, cam, lon, lat, 0.5, ph, C.blueHot, aa * 0.8);
        }
        const bp = ((t * 0.4) % 1);
        drawRing(ctx, cam, -0.12, 51.5, 1.4, bp, C.yellow, aa);
        drawDots(ctx, screen(-0.12, 51.5, cam)[0], screen(-0.12, 51.5, cam)[1], 12, 90, C.yellow, 3, aa * 0.7, 3);
      }
      drawCity(ctx, cam, -0.12, 51.5, "伦敦", clamp01((t - 2.4) / 0.5), "rgba(255,220,120,0.95)");
      drawCity(ctx, cam, 2.35, 48.86, "巴黎", 0.35);
      break;
    }

    /* 6 标题 */
    case 6:
    case 11:
    case 15: {
      drawMap(ctx, cam, t, 0.14, 0.12);
      const tp = titleP(s, t);
      drawBigTitle(ctx, {
        main: s.title!.main,
        sub: s.title!.sub,
        color: s.title!.color,
        a: clamp01((t - s.t0) / 0.06),
        p: tp,
        size: s.title!.size,
        y: s.title!.sub ? H * 0.44 : H * 0.47,
      });
      break;
    }

    /* 7 巴巴罗萨 */
    case 7: {
      drawGrid(ctx, cam, 0.75);
      drawMap(ctx, cam, t, 1);
      // 三路箭头
      const a1 = span(t, 29.7, 34.2);
      const a2 = span(t, 29.9, 35.4);
      const a3 = span(t, 30.1, 37.0);
      drawArrow(ctx, cam, [L(21.2, 55.4), L(25.5, 56.6), L(29.4, 58.4), L(30.9, 59.7)], a1, C.redHot, 24, 40);
      drawArrow(ctx, cam, [L(21.8, 52.6), L(26.0, 53.6), L(30.4, 54.4), L(35.4, 55.2)], a2, C.redHot, 28, 46);
      drawArrow(ctx, cam, [L(22.4, 50.4), L(27.0, 50.2), L(31.2, 49.6), L(36.2, 49.2)], a3, C.redHot, 26, 42);
      // 莫斯科前的停止线
      if (t > 41.4) {
        const q = span(t, 41.4, 42.6);
        const A = screen(37.6, 54.2, cam);
        const B = screen(37.6, 57.4, cam);
        ctx.save();
        ctx.strokeStyle = C.redHot;
        ctx.globalAlpha = q * 0.9;
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.moveTo(A[0], A[1]);
        ctx.lineTo(B[0], B[1]);
        ctx.stroke();
        ctx.restore();
      }
      drawCity(ctx, cam, 32.05, 54.78, "斯摩棱斯克", clamp01((t - 32.8) / 0.5));
      drawCity(ctx, cam, 30.52, 50.45, "基辅", clamp01((t - 35.0) / 0.5));
      drawCity(ctx, cam, 30.31, 59.94, "列宁格勒", clamp01((t - 38.0) / 0.5));
      drawCity(ctx, cam, 37.62, 55.75, "莫斯科", clamp01((t - 40.4) / 0.5), "rgba(120,180,255,0.95)");
      break;
    }

    /* 8 轴心国顶峰 */
    case 8: {
      drawMap(ctx, cam, t, 1.0);
      const q = span(t, 0 + s.t0, s.t0 + 0.5);
      // 德国轮廓高亮
      const g = getEntries().find((e) => e.name === "Germany");
      if (g) {
        applyCam(ctx, cam);
        ctx.save();
        ctx.globalAlpha = q * 0.9;
        ctx.fillStyle = "rgba(196,16,36,0.4)";
        ctx.fill(g.path);
        ctx.strokeStyle = C.redHot;
        ctx.lineWidth = 3 / cam.zoom;
        ctx.shadowColor = C.redHot;
        ctx.shadowBlur = 30 / cam.zoom;
        ctx.stroke(g.path);
        ctx.restore();
      }
      // 铁十字
      const cx = W * 0.5,
        cy = H * 0.40;
      const k = overshoot(span(t, s.t0 + 0.08, s.t0 + 0.5), 1.6);
      ctx.save();
      ctx.globalAlpha = clamp01((t - s.t0 - 0.08) / 0.12);
      ctx.translate(cx, cy);
      ctx.scale(k, k);
      cross(ctx, 86, C.white, 0.9);
      ctx.restore();
      drawCardTitle(ctx, "德意志第三帝国", "GROSSDEUTSCHES REICH", W * 0.5 - 330, H * 0.62, clamp01((t - s.t0 - 0.3) / 0.4), C.white, 84);
      break;
    }

    /* 9 四国卡片 */
    case 9: {
      const cards = [
        { cn: "大英帝国", en: "THE BRITISH EMPIRE", gis: "United Kingdom", kind: "flag" },
        { cn: "苏联", en: "UNION OF SOVIET SOCIALIST REPUBLICS", gis: "Russia", kind: "sickle" },
        { cn: "美国", en: "UNITED STATES OF AMERICA", gis: "United States of America", kind: "stars" },
        { cn: "自由法国", en: "FRANCE LIBRE", gis: "France", kind: "lorraine" },
      ];
      const seg = 0.9;
      const idx = Math.min(3, Math.floor(lt / seg));
      const inSum = lt > seg * 4;

      // 深底，把地图完全压掉
      resetT(ctx);
      ctx.fillStyle = "rgba(4,7,14,0.94)";
      ctx.fillRect(0, 0, W, H);

      const card = (c: (typeof cards)[0], i: number, pop: number, alpha: number, tight: boolean) => {
        resetT(ctx);
        ctx.save();
        ctx.globalAlpha = alpha;
        // 背景大编号
        ctx.font = `900 400px ${FONT}`;
        ctx.fillStyle = "rgba(70,120,200,0.06)";
        ctx.textAlign = "right";
        ctx.fillText(String(i + 1).padStart(2, "0"), tight ? W * 0.5 : W * 0.44, H * 0.94);
        ctx.textAlign = "left";

        // 左侧文字块
        const x = tight ? 60 : 140;
        const ty = tight ? H * 0.44 : H * 0.42;
        ctx.save();
        ctx.translate(x, ty);
        ctx.scale(pop, pop);
        // 竖线
        ctx.fillStyle = C.blueHot;
        ctx.shadowColor = C.blueHot;
        ctx.shadowBlur = 22;
        ctx.fillRect(-26, -108, 6, 128);
        ctx.shadowBlur = 0;
        // 主标题
        const fs = tight ? 40 : 108;
        ctx.font = `900 ${fs}px ${FONT}`;
        ctx.fillStyle = C.white;
        ctx.shadowColor = "rgba(95,166,255,0.85)";
        ctx.shadowBlur = 34;
        ctx.fillText(c.cn, 0, 0);
        ctx.shadowBlur = 0;
        // 英文
        ctx.font = `600 ${Math.max(10, fs * 0.17)}px ${FONT}`;
        ctx.fillStyle = "rgba(150,186,232,0.72)";
        ctx.letterSpacing = `${Math.max(1, fs * 0.05)}px`;
        ctx.fillText(c.en, 2, fs * 0.52);
        ctx.letterSpacing = "0px";
        ctx.restore();

        // 徽记
        const ix = tight ? x + 40 : W * 0.71;
        const iy = tight ? ty + 150 : H * 0.80;
        const ir = tight ? 26 : 54;
        if (c.kind === "flag") flagUnionJack(ctx, ix - ir * 2.2, iy - ir * 0.8, ir * 4.4, ir * 1.6, 0.95);
        if (c.kind === "stars") flagStarsStripes(ctx, ix - ir * 2.2, iy - ir * 0.8, ir * 4.4, ir * 1.6, 0.95);
        if (c.kind === "sickle") emblemHammerSickle(ctx, ix, iy, ir, C.white, 0.95);
        if (c.kind === "lorraine") emblemLorraine(ctx, ix, iy, ir * 1.15, C.white, 0.95);

        // 右侧地图
        if (!tight) drawCountryInBox(
          ctx, c.gis,
          [W * 0.44, H * 0.18, W * 0.94, H * 0.70],
          C.blueHot, "rgba(38,92,190,0.24)", 3
        );
        ctx.restore();

        if (!tight) drawBracket(ctx, 90, H * 0.155, W - 90, H * 0.86, "rgba(95,166,255,0.42)", 34, 0.85, 1.5);
      };

      if (!inSum) {
        const c = cards[idx];
        const q = (lt - idx * seg) / seg;
        const pop = overshoot(clamp01(q / 0.3), 2.0);
        card(c, idx, pop, 1, false);
      } else {
        const q0 = clamp01((lt - seg * 4) / 0.4);
        resetT(ctx);
        ctx.save();
        ctx.globalAlpha = q0;
        ctx.font = `900 62px ${FONT}`;
        ctx.fillStyle = C.white;
        ctx.textAlign = "center";
        ctx.shadowColor = C.blueHot;
        ctx.shadowBlur = 24;
        tracked(ctx, "三 线 受 敌", W / 2, H * 0.155, 10, "center");
        ctx.restore();

        for (let i = 0; i < 4; i++) {
          const cw = 380,
            ch = 300;
          const x = W / 2 - cw - 24 + (i % 2) * (cw + 48);
          const y = H * 0.26 + Math.floor(i / 2) * (ch + 44);
          const kk = overshoot(clamp01((lt - seg * 4 - 0.05 * i) / 0.3), 1.8);
          const a = clamp01((lt - seg * 4 - 0.05 * i) / 0.18);
          ctx.save();
          ctx.globalAlpha = a;
          ctx.translate(x + cw / 2, y + ch / 2);
          ctx.scale(kk, kk);
          ctx.strokeStyle = "rgba(95,166,255,0.32)";
          ctx.lineWidth = 1.5;
          ctx.fillStyle = "rgba(10,18,34,0.7)";
          ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
          ctx.strokeRect(-cw / 2, -ch / 2, cw, ch);
          drawCountryInBox(ctx, cards[i].gis, [-cw / 2 + 20, -ch / 2 + 16, cw / 2 - 20, ch / 2 - 62], C.blueHot, "rgba(38,92,190,0.16)", 2.2);
          ctx.font = `800 30px ${FONT}`;
          ctx.fillStyle = C.white;
          ctx.textAlign = "center";
          ctx.fillText(cards[i].cn, 0, ch / 2 - 24);
          ctx.restore();
        }
      }
      break;
    }

    /* 10 扩张顶点 */
    case 10: {
      drawGrid(ctx, cam, 0.7);
      drawMap(ctx, cam, t, 1);
      // 南北两路指向伏尔加与埃及
      drawArrow(ctx, cam, [L(38.0, 48.0), L(42.4, 48.4), L(44.4, 48.5)], span(t, 52.0, 57.4), C.redHot, 22, 38);
      drawArrow(ctx, cam, [L(36.4, 45.6), L(39.8, 45.2), L(42.4, 44.2)], span(t, 53.4, 58.6), C.redHot, 20, 34);
      drawArrow(ctx, cam, [L(24.0, 32.0), L(27.4, 31.2), L(29.4, 30.4)], span(t, 55.0, 60.2), C.redHot, 18, 32);
      // 最大范围脉冲
      if (t > 60.0) {
        const q = span(t, 60.0, 64.6);
        drawRing(ctx, cam, 24, 48, 16, q, C.redHot, 0.42 * (1 - q * 0.5));
        drawRing(ctx, cam, 24, 48, 22, clamp01(q - 0.16), C.redHot, 0.3 * (1 - q * 0.5));
      }
      drawCity(ctx, cam, 44.5, 48.7, "斯大林格勒", clamp01((t - 59.6) / 0.6));
      drawCity(ctx, cam, 29.9, 31.2, "阿拉曼", clamp01((t - 57.0) / 0.6));
      drawCity(ctx, cam, 33.5, 44.6, "塞瓦斯托波尔", clamp01((t - 51.4) / 0.5));
      drawCity(ctx, cam, 10.4, 51.2, "柏林", 0.4);
      break;
    }

    /* 12 斯大林格勒 */
    case 12: {
      drawCityBoard(ctx, cam, t, { river: true, center: [44.5, 48.7] });
      const [cx, cy] = screen(44.5, 48.7, cam);
      // 红点收缩
      const shrink = 1 - easeInOut(span(t, 68.4, 71.4));
      drawDots(ctx, cx, cy, 90, 260 * shrink + 40, C.redHot, 11, 0.85, 4.5);
      drawDots(ctx, cx + 60, cy + 40, 80, 300 * (1 - 0.7 * shrink), C.blueHot, 23, 0.8, 4.5);
      // 包围圈
      for (let i = 0; i < 3; i++) {
        const rq = 1 - span(t, 68.2 + i * 0.5, 72.0 + i * 0.5);
        if (rq <= 0.02) continue;
        ctx.save();
        ctx.strokeStyle = C.blueHot;
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 3;
        ctx.setLineDash([14, 10]);
        ctx.lineDashOffset = -t * 30;
        ctx.beginPath();
        ctx.arc(cx, cy, (300 + i * 55) * rq + 60, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      // 最后覆灭
      if (t > 71.0) {
        const q = ((t - 71.0) * 0.8) % 1;
        drawRing(ctx, cam, 44.5, 48.7, 1.2, q, C.yellow, 0.9);
      }
      drawCity(ctx, cam, 44.5, 48.7, "斯大林格勒", 0.85, "rgba(255,255,255,0.95)");
      // 城市标注框
      resetT(ctx);
      const bx = screen(44.5, 48.7, cam);
      drawBracket(ctx, bx[0] - 520, bx[1] - 360, bx[0] + 520, bx[1] + 360, "rgba(120,170,240,0.34)", 40, 0.8);
      break;
    }

    /* 13 阿拉曼 */
    case 13: {
      drawGrid(ctx, cam, 0.7);
      drawMap(ctx, cam, t, 1);
      // 英军东→西
      drawArrow(ctx, cam, [L(29.9, 30.9), L(26.0, 31.4), L(21.0, 32.0), L(16.0, 32.4)], span(t, 75.0, 78.4), C.blueHot, 26, 44);
      // 德意军西撤
      drawArrow(ctx, cam, [L(24.0, 31.0), L(18.0, 31.6), L(12.0, 32.6), L(9.4, 34.4)], span(t, 76.4, 79.6), C.redHot, 20, 34, 0.85);
      drawCity(ctx, cam, 28.95, 30.83, "阿拉曼", clamp01((t - 74.8) / 0.5));
      drawCity(ctx, cam, 23.9, 32.08, "托布鲁克", clamp01((t - 76.8) / 0.5));
      drawCity(ctx, cam, 10.2, 36.8, "突尼斯", clamp01((t - 78.4) / 0.5));
      drawCity(ctx, cam, 31.2, 30.05, "开罗", 0.6, "rgba(255,220,120,0.9)");
      break;
    }

    /* 14 库尔斯克 */
    case 14: {
      drawCityBoard(ctx, cam, t, { center: [36.2, 51.6] });
      const [cx, cy] = screen(36.2, 51.6, cam);
      // 同心圆
      for (let i = 1; i <= 4; i++) {
        ctx.save();
        ctx.strokeStyle = `rgba(120,170,240,${0.085 - i * 0.012})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, i * 120, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      resetT(ctx);
      const push = easeOut(span(t, 79.9, 82.4));
      const stall = 1 - easeInOut(span(t, 82.4, 83.9)) * 0.72;
      // 红军（蓝）自东向西顶住
      drawDots(ctx, cx + 240, cy, 110, 220, C.blueHot, 5, 0.85, 4.5);
      // 德军（红）从西向东冲，然后停住
      drawDots(ctx, cx - 300 * (1 - 0.42 * push) * (1 + (1 - stall) * 0.3), cy, 100, 200, C.redHot, 17, 0.85, 4.5);
      // 对冲爆点
      for (let i = 0; i < 5; i++) {
        const q = ((t * 0.75 + i * 0.21) % 1);
        drawRing(ctx, cam, 36.2 - 0.9 + i * 0.42, 51.3 + (i % 2) * 0.6, 0.22, q, i % 2 ? C.redHot : C.blueHot, 0.9);
      }
      // 停止线
      if (t > 82.3) {
        const q = span(t, 82.3, 83.2);
        const A = screen(35.2, 49.8, cam);
        const B = screen(35.2, 53.4, cam);
        ctx.save();
        ctx.globalAlpha = q;
        ctx.strokeStyle = C.yellow;
        ctx.lineWidth = 4;
        ctx.setLineDash([16, 10]);
        ctx.beginPath();
        ctx.moveTo(A[0], A[1]);
        ctx.lineTo(B[0], B[1]);
        ctx.stroke();
        ctx.restore();
      }
      break;
    }

    /* 16 意大利投降 */
    case 16: {
      drawGrid(ctx, cam, 0.7);
      drawMap(ctx, cam, t, 1);
      drawArrow(ctx, cam, [L(14.3, 37.5), L(15.4, 39.4), L(15.0, 41.2), L(13.2, 42.6)], span(t, 87.1, 91.0), C.blueHot, 24, 42);
      drawArrow(ctx, cam, [L(15.6, 38.3), L(17.2, 40.0), L(16.4, 41.4)], span(t, 88.0, 91.6), C.blueHot, 18, 32, 0.85);
      drawCity(ctx, cam, 14.3, 37.5, "西西里", clamp01((t - 87.0) / 0.5));
      drawCity(ctx, cam, 14.27, 40.85, "那不勒斯", clamp01((t - 89.0) / 0.5));
      drawCity(ctx, cam, 12.5, 41.9, "罗马", clamp01((t - 89.6) / 0.5));
      break;
    }

    /* 17 D-Day 标题 */
    case 17: {
      drawMap(ctx, { ...cam, zoom: cam.zoom }, t, 0.18, 0.1);
      const tp = titleP(s, t);
      drawBigTitle(ctx, {
        main: "D-Day",
        sub: "1944.6.6　诺曼底",
        color: "white",
        a: clamp01((t - s.t0) / 0.05),
        p: tp,
        size: 230,
        y: H * 0.47,
      });
      break;
    }

    /* 18 霸王行动 */
    case 18: {
      drawGrid(ctx, cam, 0.6);
      drawMap(ctx, cam, t, 1);
      const fan = span(t, 96.8, 101.4);
      drawArrow(ctx, cam, [L(-1.05, 49.35), L(-0.6, 48.6), L(0.4, 48.2), L(2.35, 48.86)], fan, C.blueHot, 22, 38);
      drawArrow(ctx, cam, [L(-1.3, 49.4), L(-1.2, 48.8), L(-0.6, 48.0), L(0.2, 47.4)], span(t, 97.2, 102.2), C.blueHot, 20, 34);
      drawArrow(ctx, cam, [L(-1.6, 49.4), L(-1.9, 48.6), L(-1.6, 47.6), L(-0.9, 46.6)], span(t, 97.6, 103.0), C.blueHot, 18, 32);
      // 南部登陆
      drawArrow(ctx, cam, [L(5.4, 43.2), L(5.0, 44.4), L(4.8, 45.8), L(5.4, 46.6)], span(t, 104.4, 107.2), C.blueHot, 20, 34, 0.9);
      // 滩头
      const heads: LL[] = [[-1.35, 49.38], [-1.15, 49.36], [-0.85, 49.36], [-0.6, 49.35], [-0.28, 49.33]];
      heads.forEach((h, i) => {
        const a = clamp01((lt - 0.5 - i * 0.12) / 0.3);
        if (a > 0) drawCity(ctx, cam, h[0], h[1], "", a, C.yellow);
      });
      drawCity(ctx, cam, -1.17, 49.29, "奥马哈", clamp01((t - 97.0) / 0.4), "rgba(255,220,120,0.95)");
      drawCity(ctx, cam, -0.37, 49.18, "卡昂", clamp01((t - 99.4) / 0.4));
      drawCity(ctx, cam, -1.62, 49.64, "瑟堡", clamp01((t - 99.4) / 0.4));
      drawCity(ctx, cam, 2.35, 48.86, "巴黎", clamp01((t - 107.2) / 0.4), "rgba(255,255,255,0.95)");
      if (t > 107.2) {
        const q = ((t - 107.2) * 0.9) % 1;
        drawRing(ctx, cam, 2.35, 48.86, 1.2, q, C.yellow, 0.9);
      }
      break;
    }

    /* 19 东线大反攻 */
    case 19: {
      drawGrid(ctx, cam, 0.75);
      drawMap(ctx, cam, t, 1);
      const a1 = span(t, 110.0, 114.4);
      drawArrow(ctx, cam, [L(35.6, 55.4), L(30.4, 54.6), L(25.2, 53.6), L(21.6, 53.2)], a1, C.blueHot, 28, 46);
      drawArrow(ctx, cam, [L(35.4, 50.4), L(30.0, 49.6), L(26.0, 48.6), L(23.0, 47.6)], span(t, 110.4, 115.0), C.blueHot, 26, 42);
      drawArrow(ctx, cam, [L(29.0, 46.4), L(26.4, 45.6), L(24.4, 44.4)], span(t, 112.4, 116.4), C.blueHot, 20, 34, 0.9);
      drawCity(ctx, cam, 30.52, 50.45, "基辅", clamp01((t - 112.8) / 0.5));
      drawCity(ctx, cam, 26.1, 44.43, "布加勒斯特", clamp01((t - 114.4) / 0.5));
      drawCity(ctx, cam, 21.2, 55.3, "柯尼斯堡", clamp01((t - 116.0) / 0.5));
      drawCity(ctx, cam, 21.0, 52.23, "华沙", clamp01((t - 115.6) / 0.5));
      break;
    }

    /* 20 突出部之战 */
    case 20: {
      drawGrid(ctx, cam, 0.5);
      drawMap(ctx, cam, t, 1);
      const a1 = span(t, 118.0, 119.9);
      const back = easeInOut(span(t, 120.2, 122.0));
      // bulge
      const bx = 5.6 + 1.4 * (1 - back) * 0.6;
      drawArrow(ctx, cam, [L(6.4, 50.3), L(5.8, 50.0), L(bx, 49.7)], a1 * (1 - back * 0.85), C.redHot, 30, 46, 1 - back * 0.6);
      // 两翼合拢
      drawArrow(ctx, cam, [L(4.2, 51.2), L(5.0, 50.4), L(6.2, 49.9)], span(t, 120.0, 121.8), C.blueHot, 18, 30);
      drawArrow(ctx, cam, [L(4.6, 48.6), L(5.4, 49.4), L(6.4, 49.8)], span(t, 120.3, 122.0), C.blueHot, 18, 30);
      // 包围圈
      if (t > 120.6) {
        const q = span(t, 120.6, 122.0);
        const [cx, cy] = screen(6.0, 49.9, cam);
        resetT(ctx);
        ctx.save();
        ctx.strokeStyle = C.blueHot;
        ctx.globalAlpha = q * 0.85;
        ctx.lineWidth = 3;
        ctx.setLineDash([12, 9]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, 230 * q + 40, 150 * q + 30, 0.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      drawCity(ctx, cam, 5.72, 50.2, "巴斯托涅", clamp01((t - 118.6) / 0.5));
      drawCity(ctx, cam, 5.8, 49.6, "阿登", 0.8, "rgba(255,220,120,0.9)");
      break;
    }

    /* 21 三线合围 */
    case 21: {
      drawGrid(ctx, cam, 0.7);
      drawMap(ctx, cam, t, 1);
      const w = span(t, 122.6, 125.6);
      drawArrow(ctx, cam, [L(4.6, 51.4), L(7.4, 51.0), L(10.2, 51.0)], w, C.blueHot, 26, 42);
      drawArrow(ctx, cam, [L(12.4, 42.4), L(12.0, 46.2), L(11.6, 49.4)], span(t, 123.2, 126.2), C.blueHot, 22, 38);
      drawArrow(ctx, cam, [L(30.4, 52.4), L(25.0, 52.6), L(19.4, 52.6), L(15.4, 52.6)], span(t, 123.6, 126.8), C.blueHot, 30, 48);
      drawCity(ctx, cam, 10.4, 51.2, "柏林", clamp01((t - 125.4) / 0.5), "rgba(255,220,120,0.95)");
      if (t > 125.4) {
        const q = ((t - 125.4) * 1.1) % 1;
        drawRing(ctx, cam, 10.4, 51.2, 1.6, q, C.yellow, 0.95);
        drawRing(ctx, cam, 10.4, 51.2, 2.6, clamp01(q - 0.25), C.redHot, 0.7);
      }
      break;
    }

    /* 22 爆炸 */
    case 22: {
      resetT(ctx);
      const q = span(t, s.t0, s.t0 + 1.5);
      drawExplosion(ctx, W / 2, H * 0.45, q, 1.12);
      break;
    }

    /* 23 柏林 */
    case 23: {
      drawCityBoard(ctx, cam, t, { center: [13.42, 52.52] });
      const [cx, cy] = screen(13.42, 52.52, cam);
      drawDots(ctx, cx, cy, 130, 300, C.redHot, 31, 0.9, 5);
      drawDots(ctx, cx - 80, cy + 60, 120, 340, C.blueHot, 41, 0.85, 5);
      // 红旗
      if (t > 132.0) {
        const q = overshoot(span(t, 132.0, 132.6), 1.9);
        resetT(ctx);
        ctx.save();
        ctx.globalAlpha = clamp01((t - 132.0) / 0.15);
        ctx.translate(cx + 120, cy - 150);
        ctx.scale(q, q);
        ctx.fillStyle = C.red;
        ctx.shadowColor = C.red;
        ctx.shadowBlur = 26;
        ctx.fillRect(0, -46, 86, 56);
        ctx.fillRect(-6, -50, 6, 190);
        ctx.shadowBlur = 0;
        emblemHammerSickle(ctx, 43, -18, 20, "#ffd94a", 0.95);
        ctx.restore();
      }
      drawCity(ctx, cam, 13.42, 52.52, "柏林", 0.9, "rgba(255,255,255,0.95)");
      drawBracket(ctx, cx - 560, cy - 400, cx + 560, cy + 400, "rgba(120,170,240,0.3)", 44, 0.8);
      break;
    }

    /* 24 德国投降 */
    case 24: {
      drawGrid(ctx, cam, 0.6);
      drawMap(ctx, cam, t, 1);
      const fade = clamp01((t - s.t0 - 0.6) / 3.2);
      drawArrow(ctx, cam, [L(6.2, 52.2), L(8.4, 51.8), L(10.0, 51.4)], span(t, 134.8, 137.0), C.blueHot, 20, 34, 1 - fade);
      drawArrow(ctx, cam, [L(21.6, 52.4), L(17.4, 52.4), L(13.6, 52.3)], span(t, 135.2, 137.4), C.blueHot, 20, 34, 1 - fade);
      drawCity(ctx, cam, 10.4, 51.2, "柏林", 0.6 * (1 - fade * 0.5));
      if (t > 135.4) {
        drawBigTitle(ctx, {
          main: "欧洲战场胜利日",
          sub: "VE DAY　1945.5.8",
          color: "white",
          a: clamp01((t - 135.4) / 0.25) * (1 - clamp01((t - 140.6) / 0.9)),
          p: span(t, 135.4, 137.4),
          size: 132,
          y: H * 0.5,
        });
      }
      break;
    }

    /* 25 终局 */
    case 25: {
      const warm = clamp01((t - s.t0) / 4.6);
      // 金色地图
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.45 * warm;
      drawGrid(ctx, cam, 0.5);
      drawLand(ctx, cam, t);
      ctx.restore();
      // 金色覆盖
      const list = getEntries();
      applyCam(ctx, cam);
      ctx.save();
      ctx.globalAlpha = easeOut(warm) * 0.9;
      ctx.fillStyle = `rgba(226,172,72,${0.14 + 0.34 * warm})`;
      for (const e of list) {
        ctx.fill(e.path);
      }
      ctx.strokeStyle = `rgba(240,205,130,${0.35 + 0.35 * warm})`;
      ctx.lineWidth = 1.6 / cam.zoom;
      for (const e of list) {
        ctx.stroke(e.path);
      }
      ctx.restore();
      // 边界光点
      if (warm > 0.5) {
        const q = (t - s.t0 - 2.6) / 6;
        drawDots(ctx, W / 2, H / 2, 60, 520, "rgba(255,215,130,0.75)", 7, clamp01(q) * 0.5, 2.5);
      }
      // 文字
      const ta = clamp01((t - s.t0 - 1.2) / 1.0);
      ctx.save();
      ctx.globalAlpha = ta * (1 - clamp01((t - 147.6) / 2.4));
      ctx.textAlign = "center";
      ctx.font = `900 86px ${FONT}`;
      ctx.fillStyle = "#fff6e2";
      ctx.shadowColor = "rgba(255,190,90,0.85)";
      ctx.shadowBlur = 36;
      tracked(ctx, "第二次世界大战・欧洲战场结束", W / 2, H * 0.36, 6, "center");
      ctx.shadowBlur = 0;
      ctx.font = `500 30px ${FONT}`;
      ctx.fillStyle = "rgba(255,236,205,0.92)";
      ctx.shadowColor = "rgba(30,16,0,0.95)";
      ctx.shadowBlur = 18;
      tracked(ctx, "1939.9.1 — 1945.5.8", W / 2, H * 0.42, 4, "center");
      ctx.shadowBlur = 0;
      ctx.restore();
      break;
    }
  }

  /* 镜22 说明文字：延续到柏林镜开头 */
  if (t > 128.05 && t < 130.6) {
    const a = Math.min(clamp01((t - 128.05) / 0.35), clamp01((130.6 - t) / 0.6));
    resetT(ctx);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = `700 34px ${FONT}`;
    ctx.fillStyle = "rgba(240,246,255,0.95)";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(255,120,60,0.9)";
    ctx.shadowBlur = 24;
    tracked(ctx, "1945.4.30　希特勒在柏林地堡自杀", W / 2, H * 0.815, 3, "center");
    ctx.restore();
  }

  /* ── 叠层：压角、扫描线、暗角 ── */
  resetT(ctx);
  if (s.kind !== "boom") {
    const foot = ctx.createLinearGradient(0, H * 0.66, 0, H);
    foot.addColorStop(0, "rgba(3,5,10,0)");
    foot.addColorStop(0.6, "rgba(3,5,10,0.28)");
    foot.addColorStop(1, "rgba(2,3,7,0.72)");
    ctx.fillStyle = foot;
    ctx.fillRect(0, H * 0.66, W, H * 0.34);

    const head = ctx.createLinearGradient(0, 0, 0, H * 0.24);
    head.addColorStop(0, "rgba(3,5,10,0.62)");
    head.addColorStop(1, "rgba(3,5,10,0)");
    ctx.fillStyle = head;
    ctx.fillRect(0, 0, W, H * 0.24);
  }

  drawScanlines(ctx, 1);
  drawVignette(ctx, s.kind === "boom" ? 0.3 : 0.55);

  /* ── HUD ── */
  const hudA = clamp01((t - 0.35) / 0.8) * (s.id === 25 ? 1 - clamp01((t - 146.6) / 1.6) : 1);
  if (s.kind !== "title" && s.kind !== "boom" && s.kind !== "finale") {
    const d = dateAt(s, t);
    const pop = clamp01(d.age / 0.14);
    drawDate(ctx, d.cur, s.kicker || "", hudA * (0.55 + 0.45 * pop), pop);
    drawReadout(ctx, 12 + (cam.x / 66.2), 50 - cam.y / 100, cam.zoom, hudA * 0.9);
    drawEvent(ctx, s.event || "", hudA * clamp01((t - s.t0 - 0.25) / 0.4), s.id === 18 || s.id === 19 || s.id === 21 || s.id === 24 ? C.blueHot : C.redHot);
  }
  if (s.id !== 22 && s.id !== 25) drawProgress(ctx, t, TOTAL, 0.42);

  /* ── 转场：极短压黑 ── */
  let dip = 0;
  for (const x of SHOTS) {
    if (x.id === s.id) continue;
    const d = Math.abs(t - x.t0);
    if (d < 0.055) dip = Math.max(dip, 1 - d / 0.055);
  }
  if (dip > 0) {
    resetT(ctx);
    ctx.fillStyle = `rgba(0,0,0,${dip * 0.45})`;
    ctx.fillRect(0, 0, W, H);
  }

  /* ── 全片结尾淡出 ── */
  if (t > 147.4) {
    const k = clamp01((t - 147.4) / 2.9);
    resetT(ctx);
    ctx.fillStyle = `rgba(0,0,0,${easeIn(k)})`;
    ctx.fillRect(0, 0, W, H);
  }
};

/** 铁十字：几何绘制 */
const cross = (ctx: CanvasRenderingContext2D, r: number, color: string, a = 1) => {
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  const w = r * 0.34;
  ctx.beginPath();
  ctx.moveTo(-w, -r);
  ctx.lineTo(w, -r);
  ctx.lineTo(w, -w);
  ctx.lineTo(r, -w);
  ctx.lineTo(r, w);
  ctx.lineTo(w, w);
  ctx.lineTo(w, r);
  ctx.lineTo(-w, r);
  ctx.lineTo(-w, w);
  ctx.lineTo(-r, w);
  ctx.lineTo(-r, -w);
  ctx.lineTo(-w, -w);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};
