/**
 * front-push.ts —— 势力推进（波前）模块
 * ================================================================
 * 解决的是"领土怎么变化"这一层，不关心具体是哪几个阵营。
 * 直接拷进新工程即可，唯一依赖是调用方传进来的 proj()。
 *
 * 核心设计（每一条都是用返工换来的，改之前先读 references/pitfalls.md
 * 的「势力推进」一章）：
 *
 *  1) 锋线按「事件」建，不按「区域」建。
 *     同一时刻变色的所有区域共用一个圆心、一个半径。
 *     否则同一次东征里甲地从南往北推、乙地从西往东推，
 *     红蓝交界处会留下一条"既红又蓝"的紫带。
 *
 *  2) 圆心取推进方"离战场最近的三块领土"的质心，不是全帝国质心。
 *     用全帝国质心会让一小块地易主时，锋线弧从千里之外扫过来，
 *     屏幕上就是一道横穿领土的巨大圆弧。
 *
 *  3) 所有裁剪路径在世界坐标里手算，绝不改当前变换。
 *     translate+rotate 之后再 fill(世界坐标) 会把整块地画到画面外，
 *     表现为"波前之外的地谁都不属于"。
 *
 *  4) 锋线带有机起伏（两层正弦），且两侧共用同一个函数 → 严丝合缝。
 *     纯圆弧在高机位下像拿尺子拉的一刀。
 *
 *  5) 推进时长 3.0s + easeInOut，别用 1.15s + easeOut。
 *     后者 90% 位移发生在头几帧，观感是"啪一下整块变色"。
 */

/* ── 类型 ────────────────────────────────────────────── */

/** 一条锋线：圆心 (ox,oy)、轴向 (ax,ay) 单位向量、沿轴向的径向区间 */
export type Front = {
  ox: number;
  oy: number;
  ax: number;
  ay: number;
  qmin: number;
  qmax: number;
};

/** 交给本模块的区域描述。字段名刻意与 polities 里的 Region 一致 */
export type FrontRegion<P extends string> = {
  id: string;
  /** 经纬度多边形 */
  poly: [number, number][];
  /** 该阵营首次登场时的推进方向（可选，用于兜底圆心） */
  dir?: [number, number];
  keys: { t: number; p: P }[];
};

export type FrontOpts<P extends string> = {
  regions: FrontRegion<P>[];
  /** 阵营优先级，低 → 高。重叠区归优先级高的那个 */
  order: P[];
  /** t 时刻某区域属于哪个阵营（取最后一个 t<=时刻 的 key） */
  stateAt: (r: FrontRegion<P>, t: number) => P;
  proj: (lon: number, lat: number) => [number, number];
  /** 秒：间隔小于此值的变化算同一次事件。默认 4.2（约 9.5 拍 @136BPM） */
  evGap?: number;
};

/* ── 事件聚类 ────────────────────────────────────────── */

export const makeFronts = <P extends string>(opts: FrontOpts<P>) => {
  const { regions, order, stateAt, proj, evGap = 4.2 } = opts;

  const rawCache = new Map<string, [number, number][]>();
  const raw = (r: FrontRegion<P>): [number, number][] => {
    let p = rawCache.get(r.id);
    if (!p) {
      p = r.poly.map(([lo, la]) => proj(lo, la));
      rawCache.set(r.id, p);
    }
    return p;
  };

  const centroid = (pts: [number, number][]): [number, number] => {
    let x = 0;
    let y = 0;
    for (const [X, Y] of pts) {
      x += X;
      y += Y;
    }
    return [x / pts.length, y / pts.length];
  };

  const table = new Map<string, Front>();
  let built = false;

  const keyOf = (id: string, t: number) => `${id}@${t}`;

  const build = () => {
    if (built) return;
    built = true;

    type Item = { r: FrontRegion<P>; t: number; p: P };
    const items: Item[] = [];
    for (const r of regions) for (const k of r.keys) items.push({ r, t: k.t, p: k.p });
    items.sort((a, b) => a.t - b.t);

    /* 按时间聚类。注意判据是与**组首**的间隔，不是与上一个的间隔——
     * 用后者会像链式反应一样把相邻事件全并成一组，一次"罗马五百年"。 */
    const groups: Item[][] = [];
    for (const it of items) {
      const g = groups[groups.length - 1];
      if (g && it.t - g[0].t < evGap) g.push(it);
      else groups.push([it]);
    }

    for (const g of groups) {
      const ids = new Set(g.map((q) => q.r.id));
      const pts: [number, number][] = [];
      for (const q of g) pts.push(...raw(q.r));
      const [cx, cy] = centroid(pts);

      // 推进方 = 组内目标阵营里优先级最高的那个
      let lead: P | null = null;
      for (const q of g) {
        if (q.p === ("none" as P)) continue;
        if (lead === null || order.indexOf(q.p) > order.indexOf(lead)) lead = q.p;
      }

      /* 圆心：推进方"离战场最近"的三块领土的质心（按顶点数加权）。
       * 全帝国质心在远处，半径上千，弧线会横穿整个屏幕。 */
      let ox = cx;
      let oy = cy;
      let owned = 0;
      if (lead !== null) {
        const cands: { d: number; x: number; y: number; n: number }[] = [];
        for (const r of regions) {
          if (ids.has(r.id)) continue;
          if (stateAt(r, g[0].t - 0.001) !== lead) continue;
          const p = raw(r);
          const [mx, my] = centroid(p);
          cands.push({ d: Math.hypot(mx - cx, my - cy), x: mx, y: my, n: p.length });
        }
        cands.sort((a, b) => a.d - b.d);
        const near = cands.slice(0, 3);
        const wsum = near.reduce((s, c) => s + c.n, 0);
        if (wsum > 0) {
          ox = near.reduce((s, c) => s + c.x * c.n, 0) / wsum;
          oy = near.reduce((s, c) => s + c.y * c.n, 0) / wsum;
          owned = wsum;
        }
      }

      /* 该阵营第一次登场（没有旧领土可参照，如"达契亚突然出现"）：
       * 圆心退到区域中心外侧一点，保证仍是一次单向推进而不是原地膨胀。 */
      if (owned === 0) {
        const d = g[0].r.dir ?? [1, 0];
        const L = Math.hypot(d[0], d[1]) || 1;
        let R = 0;
        for (const [X, Y] of pts) R = Math.max(R, Math.hypot(X - cx, Y - cy));
        ox = cx - (d[0] / L) * R * 0.35;
        oy = cy - (d[1] / L) * R * 0.35;
      }

      // 轴向 = 圆心 → 事件质心；锋线垂直于轴向推进
      let ax = cx - ox;
      let ay = cy - oy;
      const AL = Math.hypot(ax, ay) || 1;
      ax /= AL;
      ay /= AL;

      let qmin = Infinity;
      let qmax = -Infinity;
      for (const [X, Y] of pts) {
        const d = (X - ox) * ax + (Y - oy) * ay;
        if (d < qmin) qmin = d;
        if (d > qmax) qmax = d;
      }

      const f: Front = { ox, oy, ax, ay, qmin, qmax };
      for (const q of g) table.set(keyOf(q.r.id, q.t), f);
    }
  };

  /** 该区域在 t 时刻生效的那个 key 的时间戳 */
  const keyTAt = (r: FrontRegion<P>, t: number) => {
    let kt = -1e9;
    for (const k of r.keys) if (t >= k.t) kt = k.t;
    return kt;
  };

  /** 查这块地在「这次变化」里用的锋线。查不到就用自身包围盒兜底 */
  const frontOf = (r: FrontRegion<P>, keyT: number): Front => {
    build();
    const hit = table.get(keyOf(r.id, keyT));
    if (hit) return hit;
    const p = raw(r);
    const [cx, cy] = centroid(p);
    let qmax = 1;
    for (const [X, Y] of p) qmax = Math.max(qmax, Math.hypot(X - cx, Y - cy));
    return { ox: cx, oy: cy, ax: 1, ay: 0, qmin: 0, qmax };
  };

  return { frontOf, keyTAt, raw };
};

/* ── 锋线几何 ────────────────────────────────────────── */

/** 锋线的有机起伏。两侧共用同一个函数，因此红蓝永远严丝合缝。
 *  振幅按事件尺度自适应，避免大帝国边界抖成锯齿、小区域又看不出来。 */
export const frontWave = (f: Front, t: number, rad: number) => {
  const amp = Math.min(24, Math.max(5, (f.qmax - f.qmin) * 0.045));
  return rad + amp * (Math.sin(t / 58) * 0.62 + Math.sin(t / 24.5 + 1.7) * 0.38);
};

/** 本帧的波前位置（沿轴向的标量，随进度外扩） */
export const frontGeom = (f: Front, prog: number) => {
  const p = Math.min(1, Math.max(0, prog));
  const rad = Math.max(0.01, f.qmin + (f.qmax - f.qmin) * p);
  return { f, rad, p, span: f.qmax - f.qmin };
};

/** 局部坐标（沿轴向 x、垂直轴向 t）→ 世界坐标 */
const toWorld = (f: Front, x: number, t: number): [number, number] => [
  f.ox + f.ax * x - f.ay * t,
  f.oy + f.ay * x + f.ax * t,
];

const BIG = 5200;
const SEG = 88;

/**
 * 只在波前已推进到的一侧（side=1）或尚未推进的一侧（side=-1）绘制。
 * 调用后必须 restore()，save() 由本函数负责。
 *
 * @param path     额外的裁剪路径（通常是这块地的 Path2D）
 * @param alsoPath 是否一并 clip 到 path
 */
export const clipSide = (
  o: CanvasRenderingContext2D,
  g: ReturnType<typeof frontGeom>,
  side: 1 | -1,
  path?: Path2D,
  alsoPath = false
) => {
  const f = g.f;
  o.save();
  const edge = new Path2D();
  const s0 = toWorld(f, -BIG, -BIG);
  edge.moveTo(s0[0], s0[1]);
  for (let i = 0; i <= SEG; i++) {
    const t = -BIG + (2 * BIG * i) / SEG;
    const q = toWorld(f, frontWave(f, t, g.rad), t);
    edge.lineTo(q[0], q[1]);
  }
  const s1 = toWorld(f, -BIG, BIG);
  edge.lineTo(s1[0], s1[1]);
  edge.closePath();

  if (side > 0) {
    o.clip(edge);
  } else {
    const m = new Path2D();
    const cs = [toWorld(f, -BIG, -BIG), toWorld(f, BIG, -BIG), toWorld(f, BIG, BIG), toWorld(f, -BIG, BIG)];
    m.moveTo(cs[0][0], cs[0][1]);
    for (let i = 1; i < 4; i++) m.lineTo(cs[i][0], cs[i][1]);
    m.closePath();
    m.addPath(edge);
    o.clip(m, "evenodd");
  }
  if (alsoPath && path) o.clip(path);
};

/** 锋线本身作为一条 Path2D（世界坐标）。
 *  画线时**不要**用 clipSide 裁圆——线正好躺在裁剪边界上，
 *  外侧半宽会被切掉，屏幕上只剩发丝，还断成几截。
 *  正确做法：o.clip(本次事件的地块并集) 之后再 stroke。 */
export const frontLine = (f: Front, rad: number, span = 3000): Path2D => {
  const p = new Path2D();
  const step = span / 60;
  for (let t = -span; t <= span; t += step) {
    const [X, Y] = toWorld(f, frontWave(f, t, rad), t);
    if (t === -span) p.moveTo(X, Y);
    else p.lineTo(X, Y);
  }
  return p;
};

/**
 * 画一条"推进中的战线"：宽晕 + 主体 + 白芯三层。
 * 白芯是让观众读出"正在推进"的关键，别省。
 *
 * @param unionPath 本次事件涉及地块的并集（Path2D），线只在里面画
 */
export const paintFrontLine = (
  o: CanvasRenderingContext2D,
  g: ReturnType<typeof frontGeom>,
  unionPath: Path2D,
  zoom: number,
  color = "rgba(255,198,142,0.95)",
  alpha = 0.8
) => {
  if (g.p <= 0.002 || g.p >= 0.998 || alpha <= 0.01) return;
  const line = frontLine(g.f, g.rad);

  o.save();
  o.clip(unionPath);
  o.lineCap = "round";
  o.lineJoin = "round";

  const bands: [number, number][] = [
    [Math.max(30 / zoom, 7), 0.09],
    [Math.max(11 / zoom, 2.8), 0.26],
    [Math.max(3.4 / zoom, 1.3), 0.95],
  ];
  for (const [lw, ga] of bands) {
    o.strokeStyle = color;
    o.lineWidth = lw;
    o.globalAlpha = alpha * ga;
    o.stroke(line);
  }
  o.strokeStyle = "rgba(255,240,218,0.92)";
  o.lineWidth = Math.max(1.15 / zoom, 0.55);
  o.globalAlpha = alpha * 0.9;
  o.stroke(line);

  o.globalAlpha = 1;
  o.restore();
};

/* ── 节奏常量（改之前想清楚）─────────────────────────── */

/** 单次领土易主的持续秒数。3.0 ≈ 7 拍 @136BPM，正好一个乐句。
 *  ⚠ 别调回 1.15：那样 90% 的位移发生在头几帧，观感是"啪一下变色"。 */
export const CHANGE_DUR = 3.0;

/** 易主用的缓动。⚠ 别用 easeOut —— 它会把位移全挤在前 1/3。 */
export const easeInOut = (t: number) => {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
