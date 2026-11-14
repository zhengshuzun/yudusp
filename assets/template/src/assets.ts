import { staticFile } from "remotion";

/**
 * 事件插图（节点配图）：做旧铜版画风格的画面，压在某个关键镜头的地图上。
 *
 * 用法：
 *   1. 把图放进 public/img/<name>.png
 *   2. 下面 NODE_IMGS 里填上 name（不含扩展名）
 *   3. Scene.tsx 用 loadAllImages() + delayRender 等图加载完
 *   4. render.ts 的对应 case 里调 drawNodePic()
 *
 * 不改这个文件就不用管它——NODE_IMGS 为空时 loadAllImages 直接 resolve。
 */
export const NODE_IMGS: string[] = [
  // "raid", "siege", "laststand",
];

const IMGS: Record<string, HTMLImageElement> = {};

export const loadAllImages = () =>
  Promise.all(
    NODE_IMGS.map(
      (n) =>
        new Promise<void>((res) => {
          const im = new Image();
          im.onload = () => {
            IMGS[n] = im;
            res();
          };
          // 加载失败也要 resolve，否则整片卡在 delayRender 上渲不出来
          im.onerror = () => res();
          im.src = staticFile(`img/${n}.png`);
        })
    )
  );

export const getImg = (n: string) => IMGS[n];
export const hasImg = (n: string) => !!IMGS[n];

/** 羽化后的离屏图，按尺寸缓存 */
const MASKED = new Map<string, HTMLCanvasElement>();

const feather = (name: string, w: number, h: number): HTMLCanvasElement | null => {
  const key = `${name}-${w}x${h}`;
  const hit = MASKED.get(key);
  if (hit) return hit;
  const im = IMGS[name];
  if (!im) return null;

  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const c = cv.getContext("2d");
  if (!c) return null;

  // 生成器往往在底部压一条水印，直接不取那 7%
  const srcH = im.height * 0.93;
  c.drawImage(im, 0, 0, im.width, srcH, 0, 0, w, h);

  // 四边羽化：让插图从暗背景里长出来，而不是贴一张矩形海报
  c.globalCompositeOperation = "destination-in";
  const gx = c.createLinearGradient(0, 0, w, 0);
  gx.addColorStop(0, "rgba(0,0,0,0)");
  gx.addColorStop(0.26, "rgba(0,0,0,1)");
  gx.addColorStop(0.74, "rgba(0,0,0,1)");
  gx.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = gx;
  c.fillRect(0, 0, w, h);

  const gy = c.createLinearGradient(0, 0, 0, h);
  gy.addColorStop(0, "rgba(0,0,0,0)");
  gy.addColorStop(0.24, "rgba(0,0,0,1)");
  gy.addColorStop(0.76, "rgba(0,0,0,1)");
  gy.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = gy;
  c.fillRect(0, 0, w, h);

  MASKED.set(key, cv);
  return cv;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * 插图在镜头内的透明度：淡入 inDur 秒，末尾 outDur 秒淡出。
 * t0 / t1 直接传镜头的起止时间。
 */
export const nodeAlpha = (t: number, t0: number, t1: number, inDur = 0.7, outDur = 1.0) =>
  clamp01((t - t0 - 0.15) / inDur) * (1 - clamp01((t - (t1 - outDur)) / 0.8));

/**
 * 画一张事件插图。
 * ★ 必须在 ctx.save() 之后立刻 setTransform 归位——前面的 drawMap 会把
 *   cam 的缩放留在画布上，不归位插图就画到屏幕外去了（图上什么都看不到，
 *   日志却一切正常，这个坑极其费时间）。
 *
 * @param w     绘制宽度（像素），高度按 ratio 算
 * @param a     整体透明度，用 nodeAlpha() 给
 * @param push  推镜进度 0..1（1.06 → 1.0），传 span(t, t0, t1) 即可
 * @param ratio 高宽比，默认 9/16
 */
export const drawNodePic = (
  ctx: CanvasRenderingContext2D,
  name: string,
  cx: number,
  cy: number,
  w: number,
  a: number,
  push = 0,
  ratio = 9 / 16
) => {
  if (a <= 0.01) return;
  const img = feather(name, 1280, Math.round(1280 * ratio));
  if (!img) return;

  const h = w * ratio;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = a;
  const sc = 1.06 - 0.06 * push;
  const dw = w * sc;
  const dh = h * sc;
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);

  // 上下压暗，让插图自然沉进暗场；再铺一层扫描网纹，和地图同一"物质感"
  const g = ctx.createLinearGradient(cx, cy - dh / 2, cx, cy + dh / 2);
  g.addColorStop(0, "rgba(6,4,10,0.34)");
  g.addColorStop(0.45, "rgba(10,4,8,0.10)");
  g.addColorStop(1, "rgba(6,3,8,0.42)");
  ctx.globalAlpha = a * 0.9;
  ctx.fillStyle = g;
  ctx.fillRect(cx - dw / 2, cy - dh / 2, dw, dh);

  ctx.globalAlpha = a * 0.16;
  ctx.fillStyle = "rgba(240,196,120,0.5)";
  for (let y = cy - dh / 2; y < cy + dh / 2; y += 3) {
    ctx.fillRect(cx - dw / 2, y, dw, 1);
  }
  ctx.restore();
};
