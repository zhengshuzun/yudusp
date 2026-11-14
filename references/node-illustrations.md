# 事件插图（节点配图）

地图讲的是"谁占到了哪里"，讲不了"那一刻发生了什么"。在真正的高潮镜头上压一张做旧版画插图，画面立刻从"数据图"变成"叙事片"。

这一步是**可选增强**，但历史战争、灾难、工程类题材几乎都值得做。

---

## 一、什么时候加

**只给有具体画面的节点加**，5～8 张，不超过 8 张。

选点标准（三条全中才加）：

1. 是一个**瞬间**，不是一段过程（"城破那一刻"可以，"三年征战"不行）
2. 有一个**可画的物件**（攻城锤、投石机、云梯、火船、断裂的桥）
3. 是**剧情拐点**（第一座城陷落、决定性会战、首领死亡、王朝终结）

节奏约束：

- 相邻两张至少隔 **3 个镜头**，否则整片会退化成幻灯片
- 一张图占满**一整镜**，该镜时长 5～8s（短于 5s 图还没看就被切走）
- 加图的镜头**不要再堆复杂 HUD**，地图压到背景层，只留标题 + 插图

---

## 二、一个事件怎么变成一张图

拆成三要素，缺一个就会画成"泛泛的古代战争场景"，放哪一镜都行 = 等于没信息。

| 要素 | 说明 | 本次实例 |
|---|---|---|
| 地点 | 有辨识度的建筑 / 地貌 | 梁赞的木栅城墙、基辅的金顶教堂、巴格达的圆城与底格里斯河 |
| 器械 | 一件具体的攻防器具 | 攻城锤、配重投石机、云梯、燃烧的攻城塔 |
| 动作 | 一个正在发生的瞬间 | 城门被撞裂、城墙塌出缺口、守军从缺口退入内城 |

反例：`蒙古骑兵在草原上冲锋`——没有地点、没有器械、没有瞬间，任何一镜都能用。
正例：`蒙古军以配重投石机轰击巴格达城墙，墙体崩裂，守军沿缺口后退，底格里斯河在远处反光`。

**图里绝对不要写文字。** 标题、日期由 canvas 画（见第四节 `nodeTitle`），
一是生成模型的中文必错，二是文字烘进图里就没法改。

---

## 三、生成提示词

用英文，模型对版画术语的响应更稳。

```
aged copperplate engraving, etching with fine cross-hatching, 19th-century historical book plate style,
<SUBJECT: 地点 + 器械 + 动作>,
deep crimson and antique gold palette on parchment-dark ground, dramatic chiaroscuro, fine linework,
no text, no letters, no captions, no watermark, no border, no frame
```

要点：

- **带一张参考图最稳**。`assets/style-ref/engraving-1.png`（攻城）、`engraving-2.png`（轰城）就是这套风格的成品，生图时一并传进去，六张图的色调和线密度才一致；光靠文字描述，每张都会漂。
- **`no watermark` 也要防**。多数生成器仍会在右下/底部压标，所以代码里固定裁掉底部 7%（见 `assets.ts` 的 `srcH = im.height * 0.93`）。
- **`no border / no frame`**：图要羽化融进暗背景，带边框就露馅。
- **构图主体居中偏下，上方留暗**：标题会压在 `y ≈ 0.155H` 的位置，上方太空会显得标题悬着。
- **尺寸 1536×1024（3:2）**：绘制时按 16:9 横向铺开，四周羽化后多余部分被吃掉，够用。
- **色调对齐正片**：红金为主，和沙盘的"红 = 扩张方 / 金 = 强调"同一套语言；蓝调插图留给抵抗方获胜的镜头（如艾因贾鲁特）也成立，但整片不要一半红一半蓝。

成本：每张约 **5～10 积分**，一部片 5～8 张，交付时要向用户说明这一步的消耗。

本次六张的选题对照：

| name | 事件 | 画面 |
|---|---|---|
| `raid` | 1237 冬 梁赞围城 | 攻城锤撞裂木栅，雪地上军队列阵 |
| `kiev` | 1240.12.6 基辅陷落 | 金顶教堂在火中，城墙缺口涌入骑兵 |
| `mohi` | 1241.4.11 莫希 | 赛约河石桥争夺，弓骑压制桥头 |
| `baghdad` | 1258.2 巴格达围城 | 配重投石机轰城，圆城墙体崩裂 |
| `caliph` | 1258.2 末代哈里发 | 裹毯的哈里发被置于城门下，围观者环绕 |
| `aynjalut` | 1260.9.3 艾因贾鲁特 | 马穆鲁克骑阵正面冲击蒙古骑兵 |

---

## 四、接进工程

### 步骤 1：放图

```bash
mkdir -p public/img
# 按事件命名，全小写、无空格
cp raid.png public/img/raid.png
```

### 步骤 2：复制 `src/assets.ts`

`assets/template/src/assets.ts` 已是通用版，把它拷进工程，`NODE_IMGS` 填上图名：

```ts
export const NODE_IMGS: string[] = ["raid", "kiev", "mohi", "baghdad", "caliph", "aynjalut"];
```

### 步骤 3：`Scene.tsx` 改成异步

canvas 画图必须等 `Image.onload`，否则第一帧是空的，Remotion 不会自己等。

```tsx
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useCurrentFrame, useVideoConfig, AbsoluteFill, Audio, staticFile,
         delayRender, continueRender } from "remotion";
import { renderFrame } from "./render";
import { W, H } from "./geo";
import { loadAllImages } from "./assets";

export const Main: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const [handle] = useState(() => delayRender("loading node images"));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadAllImages().then(() => {
      if (!alive) return;
      setReady(true);
      // 等 React 提交 + 浏览器重绘，确保截图那一帧已经能画上插图
      requestAnimationFrame(() => requestAnimationFrame(() => { if (alive) continueRender(handle); }));
    });
    return () => { alive = false; };
  }, [handle]);

  useLayoutEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    renderFrame(ctx, frame / fps, frame, ready);
  }, [frame, fps, ready]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#03050a" }}>
      <canvas ref={ref} width={W} height={H} style={{ width: "100%", height: "100%" }} />
      <Audio src={staticFile("audio/score.wav")} />
    </AbsoluteFill>
  );
};
```

`renderFrame` 的签名相应多一个参数：`renderFrame(ctx, t, frame, ready = false)`。

### 步骤 4：`render.ts` 里画

```ts
import { drawNodePic, hasImg, nodeAlpha } from "./assets";

// 本镜的插图透明度
const nodeA = () => nodeAlpha(t, s.t0, s.t1);

// 插图标题：白字 + 深描边，压在 0.155H
const nodeTitle = (text: string, a: number, y = H * 0.155) => {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = a;
  ctx.font = `900 92px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 12;
  ctx.strokeStyle = "rgba(4,6,14,0.92)";
  ctx.strokeText(text, W / 2, y);
  ctx.fillStyle = "#fff";
  ctx.fillText(text, W / 2, y);
  ctx.restore();
};

// 一镜：地图压背景 + 插图 + 标题
const nodeOpen = (img: string, title: string) => {
  drawMap(ctx, cam, t, 0.55, 0.5);          // mul 降到 0.55，别让填色抢戏
  const a = nodeA();
  if (hasImg(img)) {
    drawNodePic(ctx, img, W / 2, H * 0.55, 1340, a, span(t, s.t0, s.t1));
  }
  nodeTitle(title, clamp01((t - s.t0 - 0.25) / 0.5) * (1 - clamp01((t - (s.t1 - 1.0)) / 0.7)));
};
```

case 里一行：

```ts
case 9: nodeOpen("kiev", "基 辅"); break;
```

标题字距用空格手动拉开（`"基 辅"`），比 `letterSpacing` 在 900 字重下更稳。

---

## 五、三个必须知道的坑

### 1. 插图完全看不见，但日志显示图片加载成功

**根因**：`drawMap()` 结尾停在 `applyCam` 留下的变换矩阵上（`cam.zoom` 缩放 + 平移）。
所有屏幕空间的绘制函数都靠 `resetT(ctx)` 复位，而 `drawNodePic` 如果漏了，插图会被按 cam 缩放画到画布范围外——
**图上什么都没有，控制台却打印 `[img ok] kiev 1536 1024`**，很容易误判成"图片没加载"。

**解法**：`ctx.save()` 之后第一件事 `ctx.setTransform(1, 0, 0, 1, 0, 0)`。`assets.ts` 已内置。

### 2. 渲染时 `public/img` 没被带到 bundle

`npx remotion bundle --out=build` **不会**自动复制 `public/`。用 build 目录渲染就会全部 `onerror`，插图静默消失。

```bash
rm -rf build                                  # 目录已存在会 EISDIR
npx remotion bundle --out=build
mkdir -p build/img build/audio
cp public/img/*.png build/img/
cp public/audio/score.wav build/audio/
```

### 3. 用 `ready` 判断而不是 `hasImg`

不要写 `if (ready) drawNodePic(...)`。`ready` 是 React 状态，可能比 canvas 那一帧晚一拍；
用 `hasImg(name)` 直接问"这张图到底在不在内存里"，逻辑才是对的。

---

## 六、验收

**只看 still 不够，要从成品 mp4 抽帧**——插图经过缩放和 H.264 压缩后可能糊、可能出现水印残留。

```bash
# 先看代码里插图第几秒淡入，取淡入结束后 0.3s 的时间点
for t in 22 62 92 137 145 168; do
  ffmpeg -v error -ss $t -i out/final.mp4 -frames:v 1 -y out/chk_$t.png
done
```

逐张确认四件事：

1. 插图**清晰可辨**（不是一团暗红）
2. 四边**没有硬矩形边界**（羽化生效）
3. **底部没有水印残留**
4. 标题**没有被插图吃掉**（对比度够）

任一项不达标就回去调 `nodeAlpha` 的时长、`drawNodePic` 的宽度（1340 是 1920 宽下比较稳的值），或插图本身的亮度。
