# 端到端流程

阶段 0～8，其中 **5B 是可选增强**，其余顺序不能乱。**先分析音乐再定分镜**——反过来做就会出现"分镜时长凑不上拍点"的返工。

---

## 阶段 0：先摸清音乐（不要跳过）

在写任何代码之前，先把音乐的结构摸清楚。决定整片气质的是 drop 在哪、breakdown 在哪、最响的一段在哪。这些位置直接决定剧情节奏的落点。

```bash
# 解出波形峰值与 RMS，找最强 drop / breakdown / 最响段
ffmpeg -i music.mp3 -filter_complex "ebur128=peak=true" -f null - 2>&1 | tail -20
```

这次的经验是：音乐的**最强 drop** 就应该是**剧情最强的一拍**（扩张顶点 / 高潮爆炸），**breakdown** 就应该是**最安静的抒情段**（城市战术图 / 单一战场），**最响段**就应该是**终局**。

时间轴要按音乐长度**重新裁**，不要迁就原始素材的长度。这次把 161.5s 的曲子裁到 150.41s（≈91 小节），音乐结构才和剧情严格对齐。

---

## 阶段 1：节奏分析

```bash
python scripts/analyze_beats.py --music "F:/音乐库/沙盘.mp3" --dur 150.41 --out work/audio/beatmap.json
```

输出 `bpm / beat / phase / beats / strong / top`。`phase` 是第一拍的时间偏移，节拍网格是：

```
t = phase + k * beat
```

把 `bpm` 和 `phase` 抄进 `src/geo.ts`：

```ts
export const beatGrid = { bpm: 136, phase: 0.4058823529411764 };
export const BEAT = 60 / beatGrid.bpm;
export const beatTime = (k: number) => beatGrid.phase + k * BEAT;
```

**所有镜头切点必须是 `beatTime(k)` 的某个值**，写 shots.ts 时直接用算出来的数，不要手写近似值。

---

## 阶段 2：写分镜表

见 `references/storyboard-and-beats.md`。产出 `src/shots.ts`。

这一步先确定：镜头数、每镜起止时间、每镜的机位（lon/lat/zoom）、每镜左上角日期序列、左下角事件文字。**此时不写任何绘制细节。**

定完先用脚本核一遍切点偏差：

```bash
python - <<'PY'
BEAT, PH = 60/136, 0.40588
for name, t in [("m6",27.76),("m11",64.82),("m15",84.23),("m17",94.82),("m22",127.46)]:
    k = round((t-PH)/BEAT)
    print(f"{name} t={t:.3f} beat#{k} err={(t-(PH+k*BEAT))*1000:+.1f}ms")
PY
```

偏差要控制在 ±10ms 内（30fps 一帧是 33ms，相当于 1/3 帧以内）。

---

## 阶段 3：地理数据

```bash
cd <工程目录>
mkdir -p src work
# 1) 从 world-atlas 抽国界（窗口内）
node ../scripts/extract_geo.js --mode countries --win -28 18 60 76 --tol 0.022 --out src/europe-borders.json
node ../scripts/extract_geo.js --mode land      --win -28 18 60 76 --tol 0.035 --out src/europe-land.json
# 2) 裁到窗口（必须做，否则跨 180° 的大国投影后会盖住整屏）
python ../scripts/clip_geo.py --src src/europe-borders.json --win -28 18 60 76 --out src/europe-clip.json
# 3) 卡片轮廓（可选，做四国快切才需要）
python ../scripts/card_shapes.py --euro src/europe-borders.json --out src/card-shapes.json
```

`--win` 是 `lon0 lat0 lon1 lat1`。

**国名必须核对**——`world-atlas` 的 `properties.name` 用的是 Natural Earth 的写法：`United Kingdom`、`Czechia`、`Bosnia and Herz.`、`United States of America`、`Macedonia`。写立场表前先 dump 一遍 key：

```bash
node -e "console.log(Object.keys(require('./src/europe-clip.json').countries).sort().join(' | '))"
```

---

## 阶段 4：搭工程骨架

```bash
cp -r assets/template <你的工程目录>
cd <你的工程目录>
# 依赖：不要 cp node_modules（几万个文件会超时）
node -e "require('fs').symlinkSync('<已有工程的绝对路径>/node_modules','node_modules','junction')"
```

依赖清单（`package.json` 已含）：`remotion`、`@remotion/cli`、`react`、`react-dom`、`topojson-client`、`world-atlas`。

`remotion.config.ts` 有两处必须确认：

```ts
Config.setCrf(17);                        // 高质量
Config.setChromiumOpenGlRenderer("angle"); // ★ 千万不要用 swangle
```

`swangle` 是软件 GL，1080p 全靠 CPU 光栅，实测比 `angle` 慢 **12 倍**。

模板里的 `public/audio/score.wav` 是 1 秒静音占位，阶段 6 会用真正的配乐覆盖它。在跑完阶段 6 之前渲出来的片是无声的，别急着交付。

---

## 阶段 5：写主题层

只改三个文件：`src/world.ts`（谁在哪一秒变成什么颜色）、`src/shots.ts`（分镜表）、`src/render.ts`（每镜画什么）。引擎层（`geo / palette / paint / fx / hud`）不用动。

细节见 `references/code-map.md`。

---

## 阶段 5B：事件插图（可选，但历史/战争题材强烈建议）

先做这一步再去配乐，因为插图会影响到 `render.ts` 的镜头写法（该镜的地图要压到背景层）。

### 5B.1 选点

从 `shots.ts` 里挑 5～8 个**瞬间型**高潮节点。标准是三条全中：是一个瞬间（不是一段过程）、有一件可画的物件（攻城锤/投石机/断桥）、是剧情拐点。

相邻两张至少隔 3 个镜头。列成表再动手，避免边做边加导致节奏失衡。

### 5B.2 生成

每张图一句提示词，模板见 `references/node-illustrations.md`。核心是：
**具体地点 + 具体器械 + 一个正在发生的动作**，外加 `no text, no watermark, no border`。

图落 `public/img/<name>.png`，全小写无空格。每张约 5～10 积分，记得向用户报这笔消耗。

### 5B.3 接入

```bash
cp assets/template/src/assets.ts src/assets.ts   # 通用实现，填 NODE_IMGS
```

改三处：`NODE_IMGS` 列表、`Scene.tsx` 的异步加载（`delayRender` + 双 `requestAnimationFrame`）、`render.ts` 里各 case 调 `drawNodePic`。

`renderFrame` 签名加一个参数：`renderFrame(ctx, t, frame, ready = false)`。

### 5B.4 自检

```bash
npx remotion still src/index.ts <Id> out/node_check.png --frame=<插图淡入结束后 0.3s×30 的帧号>
```

看到插图 → 再往下走。**看不到就先查 transform 有没有归位**，不要怀疑图片路径。

---

## 阶段 6：配乐

```bash
python scripts/build_audio.py --project work/cues.json --out output/public/audio/score.wav
```

`cues.json` 里写：音乐路径、总时长、刹车段、淡出段、以及每一条音效的落点。模板见 `references/storyboard-and-beats.md`。

然后 `Scene.tsx` 里挂上：

```tsx
<Audio src={staticFile("audio/score.wav")} />
```

**音量自检**（这一步值得做，肉眼看不出来的削波会毁掉整片）：

```bash
# 看各时间点的峰值，确认卡点处推到满幅、其余不爆
ffmpeg -i output/public/audio/score.wav -af "volumedetect" -f null - 2>&1 | tail -5
```

---

## 阶段 7：渲染与验收

**先单帧，再短段，最后全片。** 顺序不能跳，否则错误会在 4500 帧里重复。

```bash
# 1) 单帧抽查（每镜挑一张，重点看：边界发光、占领区层次、标题排版）
npx remotion still src/index.ts <CompositionId> out/chk_1050.png --frame=1050

# 2) 40 帧短段测速，估算全片时间
time npx remotion render src/index.ts <CompositionId> out/bench.mp4 \
  --frames=1040-1079 --concurrency=12 --log=error

# 3) 全片（12 并发，1080p 约 0.18s/帧 → 4500 帧约 8 分钟）
npx remotion render src/index.ts <CompositionId> out/final.mp4 \
  --concurrency=12 --log=info
```

验收清单：

```bash
ffprobe -v error -show_entries format=duration,size \
  -show_entries stream=codec_type,width,height,r_frame_rate \
  -of default=noprint_wrappers=1 out/final.mp4

# 全片联系表：25 格缩略图一次看到所有镜头，最容易揪出空白/全黑/异常的镜头
ffmpeg -y -v error -i out/final.mp4 \
  -vf "fps=1/6,scale=384:216,tile=5x5:padding=4:color=0x111111" -frames:v 1 out/contact.png
```

联系表里只要有**一格明显偏空、全黑、或者整体一片糊红**，就回去查那一镜。

若片中有事件插图，再补一轮**从成品抽帧**的检查（still 看不出 H.264 压缩后的糊和水印残留）：

```bash
for t in 22 62 92 137; do ffmpeg -v error -ss $t -i out/final.mp4 -frames:v 1 -y out/chk_$t.png; done
```

四件事逐张确认：插图清晰、四边无硬边、底部无水印、标题没被吃掉。详见 `references/node-illustrations.md`。

---

## 阶段 8：封面与投放

封面**不要用 AI 生图**。地图上的国界和汉字都是 AI 画不对的东西，而且风格会脱离正片。用同一套绘制逻辑渲一张静态图（`src/Cover.tsx`），定格在全片阵营对比最强的时刻。

（事件插图是唯一的例外——那类画面不需要国界与汉字，用 AI 反而更好，见阶段 5B。）

```bash
npx remotion still src/index.ts CoverWide out/cover_wide.png --frame=0   # 1440×1080 = 4:3
npx remotion still src/index.ts CoverTall out/cover_tall.png --frame=0   # 1080×1440 = 3:4
```

只出 **4:3 与 3:4** 两种比例（横版 1440×1080、竖版 1080×1440），同时给 PNG 和 JPG。成品按项目落在图片库的子目录里。
