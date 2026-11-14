import borders from "./europe-clip.json";

export type Side = "axis" | "allies" | "neutral" | "soviet" | "gone";

export type Key = { t: number; s: Side };

export type Def = {
  /** europe-borders.json 里的国名 */
  gis: string[];
  keys: Key[];
  /** 变色时的蔓延方向（世界坐标），默认自西向东 */
  dir?: [number, number];
  /** 该国在大地图上的标签 */
  at?: [number, number];
  small?: boolean;
};

const K = (t: number, s: Side): Key => ({ t, s });

/** 全程立场表（时间 = 视频秒） */
export const DEFS: Def[] = [
  // ── 轴心核心 ──
  { gis: ["Germany"], keys: [K(-99, "axis"), K(136.6, "gone")], at: [10.4, 51.2] },
  { gis: ["Austria"], keys: [K(-99, "axis")] },
  { gis: ["Czechia"], keys: [K(-99, "axis")] },
  { gis: ["Slovakia"], keys: [K(-99, "axis")], small: true },
  { gis: ["Luxembourg"], keys: [K(-99, "neutral"), K(12.4, "axis")], small: true },

  // ── 1939 波兰 ──
  { gis: ["Poland"], keys: [K(-99, "neutral"), K(2.55, "axis")], dir: [1, 0], at: [19, 52] },

  // ── 1940 北欧与低地 ──
  { gis: ["Denmark"], keys: [K(-99, "neutral"), K(11.1, "axis")], small: true },
  { gis: ["Norway"], keys: [K(-99, "neutral"), K(11.6, "axis")] },
  { gis: ["Netherlands"], keys: [K(-99, "neutral"), K(12.1, "axis")], small: true },
  { gis: ["Belgium"], keys: [K(-99, "neutral"), K(12.5, "axis")], small: true },
  { gis: ["France"], keys: [K(-99, "allies"), K(17.6, "axis"), K(107.2, "allies")], dir: [-1, 0.25], at: [2.3, 46.6] },

  // ── 英伦 ──
  { gis: ["United Kingdom"], keys: [K(-99, "allies")], at: [-2.4, 54.2] },
  { gis: ["Ireland"], keys: [K(-99, "neutral")], small: true },

  // ── 中立 ──
  { gis: ["Spain"], keys: [K(-99, "neutral")], at: [-3.7, 40.2] },
  { gis: ["Portugal"], keys: [K(-99, "neutral")], small: true },
  { gis: ["Switzerland"], keys: [K(-99, "neutral")], small: true },
  { gis: ["Sweden"], keys: [K(-99, "neutral")], at: [15.6, 62.5] },
  { gis: ["Turkey"], keys: [K(-99, "neutral")], at: [33, 39] },
  { gis: ["Iceland"], keys: [K(-99, "neutral")], small: true },

  // ── 巴尔干 1941.4 ──
  { gis: ["Hungary"], keys: [K(-99, "neutral"), K(31.2, "axis")], small: true },
  { gis: ["Romania"], keys: [K(-99, "neutral"), K(31.8, "axis"), K(113.0, "allies")] },
  { gis: ["Bulgaria"], keys: [K(-99, "neutral"), K(32.4, "axis"), K(114.6, "allies")], small: true },
  { gis: ["Yugoslavia", "Serbia", "Croatia", "Bosnia and Herz.", "Slovenia", "Montenegro", "Kosovo", "Macedonia"], keys: [K(-99, "neutral"), K(30.0, "axis"), K(119.4, "allies")], dir: [-0.4, 1] },
  { gis: ["Greece"], keys: [K(-99, "neutral"), K(30.4, "axis"), K(117.4, "allies")], dir: [0, -1] },
  { gis: ["Albania"], keys: [K(-99, "neutral"), K(17.2, "axis"), K(90.6, "allies")], small: true },

  // ── 意大利 ──
  { gis: ["Italy"], keys: [K(-99, "neutral"), K(17.2, "axis"), K(90.8, "allies")], dir: [0.3, -1], at: [12.5, 43.2] },
  { gis: ["San Marino"], keys: [K(-99, "axis"), K(90.8, "allies")], small: true },

  // ── 苏联 ──
  { gis: ["Russia"], keys: [K(-99, "neutral"), K(30.4, "allies")], at: [38, 56.5] },
  { gis: ["Belarus"], keys: [K(-99, "neutral"), K(30.4, "allies"), K(33.0, "axis"), K(110.5, "allies")], dir: [1, 0] },
  { gis: ["Ukraine"], keys: [K(-99, "neutral"), K(30.4, "allies"), K(34.6, "axis"), K(111.2, "allies")], dir: [1, 0] },
  { gis: ["Moldova"], keys: [K(-99, "neutral"), K(30.4, "soviet"), K(35.0, "axis"), K(112.0, "allies")], small: true },
  { gis: ["Estonia"], keys: [K(-99, "neutral"), K(30.2, "soviet"), K(31.9, "axis"), K(110.0, "allies")], small: true },
  { gis: ["Latvia"], keys: [K(-99, "neutral"), K(30.2, "soviet"), K(32.1, "axis"), K(110.2, "allies")], small: true },
  { gis: ["Lithuania"], keys: [K(-99, "neutral"), K(30.2, "soviet"), K(32.3, "axis"), K(110.4, "allies")], small: true },

  // ── 芬兰 ──
  { gis: ["Finland"], keys: [K(-99, "neutral"), K(32.6, "axis"), K(120.8, "neutral")], at: [26, 64] },

  // ── 北非 ──
  { gis: ["Libya"], keys: [K(-99, "neutral"), K(17.2, "axis"), K(78.4, "allies")], at: [18, 27.5] },
  { gis: ["Tunisia"], keys: [K(-99, "allies"), K(59.4, "axis"), K(79.0, "allies")], small: true },
  { gis: ["Algeria"], keys: [K(-99, "allies")] },
  { gis: ["Morocco"], keys: [K(-99, "allies")] },
  { gis: ["Egypt"], keys: [K(-99, "allies")], at: [30, 26.6] },
  { gis: ["Malta"], keys: [K(-99, "allies")], small: true },
  { gis: ["Cyprus"], keys: [K(-99, "allies")], small: true },

  // ── 近东 ──
  { gis: ["Syria"], keys: [K(-99, "allies")], small: true },
  { gis: ["Lebanon"], keys: [K(-99, "allies")], small: true },
  { gis: ["Iraq"], keys: [K(-99, "neutral")], small: true },
];

/** 苏联腹地被德军占领的区块（用经纬度窗口从 Russia 多边形里切） */
export type Patch = {
  gis: string[];
  box: [number, number, number, number]; // lon0, lat0, lon1, lat1
  t0: number;
  t1: number;
  dir: [number, number];
  from: Side;
  to: Side;
};

export const PATCHES: Patch[] = [];
// 注：苏联腹地的推进改由 Belarus / Ukraine / 波罗的海三国自身的阵营切换承载，
// 它们东界已到 40°E，足够表现"推进至莫斯科以西"。大块 Patch 在 canvas 上做遮罩不稳定，故弃用。

export type BorderSet = Record<string, number[][][]>;
export const BORDERS = (borders as any).countries as BorderSet;
export const BBOX = borders as any;

/** 国家在某时刻的阵营 */
const SIDE_COLOR: Record<Side, string> = {
  axis: "axis",
  allies: "allies",
  neutral: "neutral",
  soviet: "soviet",
  gone: "neutral",
};

export const sideAt = (d: Def, t: number): Side => {
  let s: Side = "neutral";
  for (const k of d.keys) if (t >= k.t) s = k.s;
  return s;
};

/** 返回 [旧阵营, 新阵营, 过渡进度] */
export const transAt = (d: Def, t: number, dur = 1.0): [Side, Side, number] => {
  let prev: Side = "neutral";
  let cur: Side = "neutral";
  let at = -99;
  for (const k of d.keys) {
    if (t >= k.t) {
      prev = cur;
      cur = k.s;
      at = k.t;
    }
  }
  const p = at < -90 ? 1 : Math.min(1, Math.max(0, (t - at) / dur));
  return [prev, cur, p];
};

export const labelOf = (name: string): string | null => {
  const map: Record<string, string> = {
    Germany: "德国",
    France: "法国",
    Italy: "意大利",
    Poland: "波兰",
    Spain: "西班牙",
    "United Kingdom": "英国",
    Sweden: "瑞典",
    Turkey: "土耳其",
    Russia: "苏联",
    Libya: "利比亚",
    Egypt: "埃及",
    Finland: "芬兰",
    Norway: "挪威",
  };
  return map[name] || null;
};

export { SIDE_COLOR };
