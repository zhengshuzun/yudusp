import { Cam, camAt } from "./geo";

export type Datum = { t: number; text: string };

export type Shot = {
  id: number;
  t0: number;
  t1: number;
  cam: Cam;
  dates: Datum[];
  event?: string;
  kicker?: string;
  /** 标题镜 */
  title?: {
    main: string;
    sub?: string;
    sub2?: string;
    color?: "red" | "white" | "gold";
    size?: number;
    box?: boolean;
    y?: number;
  };
  kind?: "map" | "title" | "cards" | "city" | "boom" | "finale";
};

const S = (
  id: number,
  t0: number,
  t1: number,
  lon: number,
  lat: number,
  zoom: number,
  dates: Datum[],
  event?: string,
  extra: Partial<Shot> = {}
): Shot => ({
  id,
  t0,
  t1,
  cam: camAt(lon, lat, zoom),
  dates,
  event,
  ...extra,
});

export const SHOTS: Shot[] = [
  S(1, 0.0, 2.17, 11.5, 50.2, 0.42, [{ t: -99, text: "1939" }], undefined, { kicker: "PROLOGUE" }),

  S(
    2, 2.17, 9.23, 19.5, 52.2, 1.02,
    [
      { t: 2.17, text: "1939.9.1" },
      { t: 4.2, text: "1939.9.17" },
      { t: 6.4, text: "1939.9.27" },
    ],
    "德苏瓜分波兰",
    { kicker: "闪 击 · 波 兰" }
  ),

  S(
    3, 9.23, 16.29, 8.2, 54.4, 0.9,
    [
      { t: 9.23, text: "1940.4.9" },
      { t: 11.0, text: "1940.5.10" },
      { t: 12.6, text: "1940.5.14" },
      { t: 14.2, text: "1940.5.28" },
    ],
    "黄色方案 · 西欧闪击",
    { kicker: "北 欧 · 低 地" }
  ),

  S(
    4, 16.29, 21.58, 3.4, 47.9, 1.32,
    [
      { t: 16.29, text: "1940.6.14" },
      { t: 19.2, text: "1940.6.22" },
    ],
    "敦刻尔克撤退",
    { kicker: "法 国 沦 陷" }
  ),

  S(
    5, 21.58, 27.76, 0.5, 51.6, 1.55,
    [
      { t: 21.58, text: "1940.7.10" },
      { t: 24.4, text: "1940.9.15" },
    ],
    "皇家空军誓死抵抗",
    { kicker: "不 列 颠 空 战" }
  ),

  S(6, 27.76, 29.52, 12, 50, 0.42, [], undefined, {
    kind: "title",
    title: { main: "1941", sub: "巴巴罗萨", color: "white", size: 200 },
  }),

  S(
    7, 29.52, 43.65, 25.5, 53.0, 0.5,
    [
      { t: 29.52, text: "1941.6.22" },
      { t: 32.4, text: "1941.7" },
      { t: 35.4, text: "1941.9" },
      { t: 38.2, text: "1941.9.8" },
      { t: 40.8, text: "1941.12" },
    ],
    "德军战线推进至极限",
    { kicker: "巴 巴 罗 萨 行 动" }
  ),

  S(8, 43.65, 45.40, 11.0, 51.2, 1.5, [{ t: 43.65, text: "1941.12.11" }], "德意志第三帝国", {
    kicker: "轴 心 国 顶 峰",
  }),

  S(9, 45.40, 50.70, 12, 50, 0.42, [{ t: 45.40, text: "1942" }], "", {
    kind: "cards",
    kicker: "敌 人 名 单",
  }),

  S(
    10, 50.70, 64.82, 16.5, 42.5, 0.34,
    [
      { t: 50.70, text: "1942.6" },
      { t: 54.0, text: "1942.7" },
      { t: 57.4, text: "1942.8" },
      { t: 60.0, text: "1942.8.23" },
    ],
    "1942 扩张的顶点",
    { kicker: "最 大 版 图" }
  ),

  S(11, 64.82, 67.47, 12, 50, 0.42, [{ t: 64.82, text: "1942.11" }], "转折点", {
    kind: "title",
    title: { main: "转折点", color: "white", size: 190 },
  }),

  S(
    12, 67.47, 74.52, 44.6, 48.75, 7.2,
    [
      { t: 67.47, text: "1942.11.19" },
      { t: 71.0, text: "1943.2.2" },
    ],
    "斯大林格勒战役",
    { kind: "city", kicker: "天 王 星 行 动" }
  ),

  S(
    13, 74.52, 79.82, 22.0, 30.6, 0.77,
    [
      { t: 74.52, text: "1942.10.23" },
      { t: 78.0, text: "1943.5" },
    ],
    "沙漠之狐止步",
    { kicker: "阿 拉 曼" }
  ),

  S(
    14, 79.82, 84.23, 36.2, 51.6, 3.6,
    [
      { t: 79.82, text: "1943.7.5" },
      { t: 82.2, text: "1943.7.13" },
    ],
    "史上最大坦克战",
    { kind: "city", kicker: "库 尔 斯 克" }
  ),

  S(15, 84.23, 86.88, 12, 50, 0.42, [{ t: 84.23, text: "1943" }], "攻守易势", {
    kind: "title",
    title: { main: "1943", sub: "攻守易势", color: "white", size: 200 },
  }),

  S(
    16, 86.88, 94.82, 13.5, 41.5, 2.1,
    [
      { t: 86.88, text: "1943.7.10" },
      { t: 89.6, text: "1943.9.8" },
      { t: 91.8, text: "1943.10" },
    ],
    "轴心国第一个退出战争",
    { kicker: "意 大 利 投 降" }
  ),

  S(17, 94.82, 96.58, 0.5, 50.2, 1.2, [{ t: 94.82, text: "1944.6.6" }], "D-Day", {
    kind: "title",
    title: { main: "D-Day", sub: "诺曼底", color: "white", size: 210 },
  }),

  S(
    18, 96.58, 109.82, 0.8, 48.9, 2.0,
    [
      { t: 96.58, text: "1944.6.6" },
      { t: 99.6, text: "1944.6.27" },
      { t: 102.6, text: "1944.7.25" },
      { t: 105.4, text: "1944.8.15" },
      { t: 107.4, text: "1944.8.25" },
    ],
    "西线开辟",
    { kicker: "霸 王 行 动" }
  ),

  S(
    19, 109.82, 117.76, 26.5, 52.5, 0.58,
    [
      { t: 109.82, text: "1944.6" },
      { t: 112.6, text: "1944.8" },
      { t: 115.2, text: "1944.10" },
    ],
    "维斯瓦河 — 奥得河攻势",
    { kicker: "东 线 大 反 攻" }
  ),

  S(
    20, 117.76, 122.17, 5.9, 50.1, 4.4,
    [
      { t: 117.76, text: "1944.12.16" },
      { t: 120.4, text: "1945.1.16" },
    ],
    "德军最后一搏",
    { kicker: "阿 登 反 击 战" }
  ),

  S(
    21, 122.17, 127.46, 13.5, 49.5, 0.46,
    [
      { t: 122.17, text: "1945.2" },
      { t: 124.0, text: "1945.3" },
      { t: 125.8, text: "1945.4" },
    ],
    "第三帝国被三面合围",
    { kicker: "三 线 合 围" }
  ),

  S(22, 127.46, 129.23, 12, 50, 0.42, [], undefined, { kind: "boom" }),

  S(23, 129.23, 134.52, 13.42, 52.52, 9.5, [{ t: 129.23, text: "1945.5.2" }], "国会大厦插上红旗", {
    kind: "city",
    kicker: "柏 林 陷 落",
  }),

  S(24, 134.52, 141.58, 10.2, 50.8, 1.25, [{ t: 134.52, text: "1945.5.8" }], "欧洲战场胜利日", {
    kicker: "无 条 件 投 降",
  }),

  S(25, 141.58, 150.41, 11.0, 49.0, 0.415, [], undefined, { kind: "finale", kicker: "终 局" }),
];

export const TOTAL = SHOTS[SHOTS.length - 1].t1;

export const shotAt = (t: number): Shot => {
  for (const s of SHOTS) if (t >= s.t0 && t < s.t1) return s;
  return SHOTS[SHOTS.length - 1];
};

/** 当前日期（含切换瞬间的信息，供翻牌动画用） */
export const dateAt = (s: Shot, t: number) => {
  let cur = s.dates[0];
  let prev = s.dates[0];
  for (const d of s.dates) {
    if (t >= d.t) {
      prev = cur;
      cur = d;
    }
  }
  const el = t - cur.t;
  return { cur: cur.text, prev: prev.text, age: el };
};

/** 标题镜的弹出进度（0..1，占整个镜长） */
export const titleP = (s: Shot, t: number) => {
  const d = s.t1 - s.t0;
  return Math.min(1, (t - s.t0) / Math.max(0.3, d * 0.62));
};
