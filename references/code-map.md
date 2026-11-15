# 代码地图

引擎层与主题层分开。换题材只动最后一节列出的三个文件，其余不用碰。

---

## 引擎层

### `geo.ts` — 投影与缓动

等距圆柱投影 + 纬度压缩（`cos(50°)`），`UNITS_PER_DEG = 100`。欧洲尺度下这个投影够用，不用 Mercator（Mercator 会把北欧拉得过大）。

```ts
W = 1920, H = 1080, FPS = 30
LON0 = 12, LAT0 = 50          // 投影原点
proj(lon, lat) → [X, Y]
camAt(lon, lat, zoom) → Cam
screenX(Y) / screen(lon, lat, cam) → 屏幕坐标
applyCam(ctx, cam)            // 设变换矩阵
resetT(ctx)                   // ★ 复位，屏幕元素前必调
```

缓动：`clamp01 / clamp / lerp / mix / smooth / easeOut / easeOutQuint / easeIn / easeInOut / span / overshoot`。

节拍：`beatGrid{bpm, phase}`、`BEAT`、`beatTime(k)`、`beatDist(t)`。

### `palette.ts` — 视觉系统

配色常量见 `references/visual-system.md`。工具函数：

```ts
tracked(ctx, txt, x, y, spacing, align)  // 字距（用 ctx.letterSpacing）
glow(ctx, color, blur, fn)               // 包一层 shadowBlur
radial(ctx, x, y, r, color, a)           // 中心径向发光
drawVignette(ctx, 0.5)                   // 暗角（离屏 canvas 已缓存）
drawScanlines(ctx, 0.5)                  // 扫描网线（pattern 已缓存）
```

### `paint.ts` — 地图绘制

```ts
getEntries()                  // 解析 GeoJSON 成 Path2D（模块级缓存，只跑一次）
SIDE_FILL / SIDE_EDGE         // 阵营填色 / 描边色
fillGrow(ctx, path, box, dir, prog, color)   // 单块区域沿 dir 生长（⚠ 不是势力推进，见下）
drawLand(ctx, cam, t, dim)          // 陆地底
drawControl(ctx, cam, t, mul)       // 势力填色（调 fillGrow）
drawGrid(ctx, cam, a)               // 经纬网格
drawGlowEdges(ctx, cam, t, mul)     // 国界发光（双层宽描边）
drawPatches / drawPatchEdges        // 局部占领区块（默认空，见坑）
drawLabels(ctx, cam, t, a)          // 国家名小字
drawCountryInBox(ctx, ...)          // 卡片里画国家轮廓
```

> ⚠️ `fillGrow` 只解决"一个多边形沿某方向被填到几成"，**不是波前系统**。用它逐块做领土易主，就会得到 E4 里那种"边界重叠 + 啪一下变色"。势力推进请用下面的 `front-push.ts`。

`drawMap()` 的图层顺序固定：**land → control → grid → glowEdges**。

### `front-push.ts` — 势力推进（波前）

独立模块，零依赖（`proj` 由调用方传入），纯几何 + 纯 canvas，拷贝即用。

```ts
makeFronts({ regions, order, stateAt, proj, evGap? })
  → { frontOf(r, keyT), keyTAt(r, t), raw(r) }

frontWave(f, t, rad)          // 锋线的有机起伏（两侧共用，保证严丝合缝）
frontGeom(f, prog)            // 本帧波前位置 → { f, rad, p, span }
clipSide(o, g, side, path?)   // 裁到波前内侧(+1) / 外侧(-1)，世界坐标构造
frontLine(f, rad, span?)      // 锋线 Path2D
paintFrontLine(o, g, unionPath, zoom, color?, alpha?)   // 三层辉光 + 白芯

CHANGE_DUR = 3.0              // 单次易主的秒数
easeInOut(t)                  // 别用 easeOut
```

接入到 `drawPolities` 里的顺序：

1. `polityAt(r, t)` 取 `[prev, cur, p]`，`p` 用 `easeInOut`；
2. `frontOf(r, keyTAt(r, t))` 查这次变化用的锋线；
3. 画**让出方**的残块：`clipSide(side=-1)` + 旧色，浓度随 `p` 从 1 衰减；
4. 画**接收方**剪影：`clipSide(side=+1)` + 新色；
5. 最后画锋线：按「事件 + 进度」去重，一条线只画一次。

细节与踩坑见 `pitfalls.md`「势力推进（波前）」。

### `fx.ts` — 特效

全部收经纬度参数，内部自己 `applyCam`，屏幕空间的函数（`drawRing / drawCity / drawExplosion / drawBracket / drawDots`）**开头自己 `resetT`**。

```ts
drawArrow(ctx, cam, pts: [lon,lat][], prog, color, w=26, head=46, alpha=1)
  // 带状箭身（offset 样条）+ 三角箭头 + 中心亮线 + 外发光

drawRing(ctx, cam, lon, lat, radiusKm, p, color, a)   // 冲击环
drawCity(ctx, cam, lon, lat, name, a)                  // 城市点 + 标签
drawPlane(ctx, ...)                                    // 飞机剪影
drawExplosion(ctx, cx, cy, p, scale)                   // 白闪 + 火球 + 4 层冲击波 + 34 条射线
drawBracket(ctx, x0, y0, x1, y1, color, len, a, w)     // UI 角标框
drawDots(ctx, cx, cy, n, ...)                          // 战术单位光点

flagUnionJack / flagStarsStripes / emblemHammerSickle / emblemLorraine
  // 卡片用的国旗与徽记，纯代码绘制，不用图片素材
```

### `hud.ts` — 三层文字

```ts
drawDate(ctx, date, kicker, a, popT)        // 左上
drawEvent(ctx, text, a, accent)             // 左下
drawBigTitle(ctx, { main, sub, a, p, color, size, box, y })  // 中央
drawReadout(ctx, lon, lat, zoom, a)         // 右上坐标读数
drawProgress(ctx, t, total, a)              // 底部进度条
drawCardTitle(ctx, text, sub, x, y, a, color, size)
```

⚠️ 每个函数开头都有 `resetT(ctx)`，新写的 HUD 函数也必须加。

### `assets.ts` — 事件插图（可选）

只在片中有 AI 生成的节点配图时才需要。`NODE_IMGS` 为空时全部函数是空操作，不影响模板跑。

```ts
NODE_IMGS: string[]                     // public/img/<name>.png 的名字，不含扩展名
loadAllImages() → Promise<void>         // onload/onerror 都 resolve，失败也不会卡死渲染
hasImg(name) → boolean                  // ★ 判"图在内存里没"，不要用 ready 状态
nodeAlpha(t, t0, t1, inDur=0.7, outDur=1.0)  // 镜头内的淡入淡出
drawNodePic(ctx, name, cx, cy, w, a, push=0, ratio=9/16)
  // 内部：裁底部 7% 水印 → 四边渐变羽化（destination-in）→ 推镜 → 暖调 + 扫描网纹
```

⚠️ `drawNodePic` 第一件事是 `setTransform(1,0,0,1,0,0)`。见 `references/pitfalls.md` 的"插图完全看不见"。

### `render.ts` — 主绘制

```ts
drawBG(ctx, t, warm)                        // 背景（warm>0 时偏暖，终局金色用）
drawMap(ctx, cam, t, mul, landA)            // 4 层地图
drawCityBoard(ctx, cam, t, { river, center })  // 城市战术图（屏幕尺度 52px 街区网格）
renderFrame(ctx, t, frame, ready = false)   // 入口：switch (shot.id) 分发
```

`renderFrame` 的固定骨架：

1. `const s = shotAt(t)` → `drawBG` → `drawMap`
2. `switch (s.id)` 画该镜专属内容（箭头、城市、卡片…）
3. 通用 HUD：`drawDate` / `drawEvent` / `drawProgress` / `drawReadout`
4. `drawVignette` + `drawScanlines`
5. 转场压黑（每镜前 0.055s）
6. 全片结尾淡出（`t > total-3`）

### 入口三件套

```tsx
// Scene.tsx — canvas 逐帧绘制，不用 React 组件树
useLayoutEffect(() => { renderFrame(ctx, frame / fps, frame, ready); }, [frame, fps, ready]);
<canvas width={W} height={H} /> + <Audio src={staticFile("audio/score.wav")} />

// 有事件插图时多两段：delayRender 等图，双 rAF 后再 continueRender
const [handle] = useState(() => delayRender("loading node images"));
useEffect(() => {
  loadAllImages().then(() => {
    setReady(true);
    requestAnimationFrame(() => requestAnimationFrame(() => continueRender(handle)));
  });
}, [handle]);

// Root.tsx — 一个主 Composition + 两张封面
<Composition id="..." component={Main} durationInFrames={TOTAL*30} fps={30} width={1920} height={1080} />
<Composition id="CoverWide" ... width={1440} height={1080} durationInFrames={1} />
<Composition id="CoverTall" ... width={1080} height={1440} durationInFrames={1} />
```

### `Cover.tsx` — 封面

复用 `paint.getEntries()` 和 `fx` 的绘制函数，定格在阵营对比最强的时刻（`T_MOMENT`）。两套 `CFG`（wide / tall）各给一组 lon/lat/zoom，标题位置与字号分开调。

---

## 主题层（换题材只改这三个）

### `world.ts` — 谁在哪一秒变成什么颜色

```ts
type Side = "axis" | "allies" | "neutral" | "soviet" | "gone";

export const DEFS: Def[] = [
  { gis: ["Germany"], keys: [K(-99,"axis"), K(136.6,"gone")], at: [10.4, 51.2] },
  { gis: ["Poland"],  keys: [K(-99,"neutral"), K(2.55,"axis")], dir: [1, 0] },
  { gis: ["France"],  keys: [K(-99,"allies"), K(17.6,"axis"), K(107.2,"allies")], dir: [-1, 0.25] },
  ...
];
```

- `gis`：可以写多个国名共用一条时间线（巴尔干那一堆碎国）
- `keys`：`[-99, 初始] → [t1, 变] → [t2, 再变]`，时间单位是**视频秒**，必须落在拍点上
- `dir`：变色时的蔓延方向（世界坐标），攻城战用 `[1,0]`（自西向东），登陆用 `[0,-1]`
- `at`：该国在大地图上的名字标签位置

`transAt(d, t, dur=1.0)` 返回 `[旧阵营, 新阵营, 进度]`，`paint.fillGrow` 用它做波前动画。

### `shots.ts` — 分镜表

见 `references/storyboard-and-beats.md`。

### `render.ts` — 每镜画什么

`switch` 里每个 case 独立写，互不影响。可用的"零件"：

| 需求 | 用什么 |
|---|---|
| 进军箭头 | `drawArrow(ctx, s.cam, [[lon,lat],...], span(t, a, b), C.redHot, 26, 46)` |
| 占领波前 | `fillGrow` 已由 `drawControl` 统一处理 |
| 城市 + 包围环 | `drawCity` + `drawRing`（半径按 km 给） |
| 空袭 / 登陆 | `drawPlane` + `drawDots` |
| 战术图 | `drawCityBoard` + `drawBracket` |
| 卡片 | `drawCountryInBox` + `flagUnionJack` 等 |
| 爆炸 | `drawExplosion` |

写新 case 的时候，先 `applyCam(ctx, s.cam)` 画地图坐标的东西，然后 `resetT(ctx)` 画屏幕坐标的东西（`drawArrow` 之类会自己处理，但自己手写的位置计算要注意）。

---

## 数据文件

| 文件 | 来源 | 用途 |
|---|---|---|
| `europe-borders.json` | `extract_geo.js --mode countries` | 国界原始环（未裁剪） |
| `europe-clip.json` | `clip_geo.py` | 裁剪后的国界，**运行时用的就是它** |
| `europe-land.json` | `extract_geo.js --mode land` | 陆块（海岸线、湖） |
| `card-shapes.json` | `card_shapes.py` | 卡片用的归一化国家轮廓 |
