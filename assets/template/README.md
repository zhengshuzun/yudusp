# 工程骨架（参考实现：二战欧洲战场）

这套工程**已经能渲出成片**，不是空壳。接手时先 `npx remotion still` 渲一帧看看它长什么样，再开始改。

## 这是什么

Remotion 4 + React 18 + Canvas 2D 逐帧绘制。没有 React 组件树，整个画面由一个 `<canvas>` 加一个 `renderFrame(ctx, t, frame)` 函数画出来。

```
src/
  index.ts        registerRoot
  Root.tsx        3 个 Composition：主片 + 两张封面
  Scene.tsx       canvas + <Audio>
  ── 引擎层（换题材不用动）──────────────
  geo.ts          投影 / 缓动 / 节拍网格
  palette.ts      配色 / 字距 / 暗角 / 扫描线
  paint.ts        地图：陆地 / 势力填色 / 网格 / 边界发光
  fx.ts           箭头 / 城市 / 冲击环 / 爆炸 / 国旗徽记
  hud.ts          三层文字（日期 / 事件 / 大标题）
  Cover.tsx       封面（4:3 与 3:4 两个 variant）
  ── 主题层（换题材只改这三个）──────────
  world.ts        立场表：谁在哪一秒变成什么颜色
  shots.ts        镜头表：起止时间 / 机位 / 日期 / 事件
  render.ts       每镜画什么（switch 分发）
  ── 数据 ──────────────────────────────
  europe-borders.json   原始国界（未裁剪）
  europe-clip.json      裁剪后国界（paint 用的就是它）
  europe-land.json      陆块
  card-shapes.json      卡片用的归一化国家轮廓
work/
  cues.json       配乐工程（音效落点表），给 scripts/build_audio.py 用
```

## 跑起来

```bash
# 依赖：不要 cp node_modules，几万个文件会超时
node -e "require('fs').symlinkSync('<已有工程>/node_modules','node_modules','junction')"

npx remotion still src/index.ts WW2Timeline out/chk.png --frame=1050
npx remotion render src/index.ts WW2Timeline out/final.mp4 --concurrency=12 --log=info
```

`remotion.config.ts` 里的 `Config.setChromiumOpenGlRenderer("angle")` 是硬性要求，改成 `swangle` 会让渲染慢 12 倍。

> ⚠️ `public/audio/score.wav` 现在是**1 秒静音占位**（为了不让 skill 背着 26MB 的成片音频）。
> 开机第一件事就是跑一次配乐合成覆盖它，否则渲出来是无声片：
>
> ```bash
> python <skill>/scripts/build_audio.py --project work/cues.json --out public/audio/score.wav
> ```
>
> `work/cues.json` 里的 `music` 路径要改成你实际用的曲子，`duration` 改成新片的时长。

## 换题材的改法

1. `world.ts` 的 `DEFS` 换成立场表。`gis` 用 world-atlas 的国名（`node -e "console.log(Object.keys(require('./src/europe-clip.json').countries).join())"` 先 dump 一遍核对）。
2. `shots.ts` 重写镜头表。所有 `t0/t1` 必须落在 `beatTime(k)` 上。
3. `render.ts` 的 `switch` 按需改 case。用现成的 `drawArrow / drawCity / drawRing / drawExplosion / drawCityBoard` 拼。

如果换了地理范围，重新跑 `extract_geo.js` + `clip_geo.py` 生成数据，并把 `geo.ts` 的 `LON0/LAT0` 调成新区域的中心。
