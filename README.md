# yudusp 沙盘视频 Skill · 安装说明

这是一个 WorkBuddy / CodeBuddy 的 skill 包，用来把「谁在什么时候占到了哪里」的历史，
做成一张自己会生长的地图动画——暗场自发光 UI、固定机位、占领区随剧情蔓延、卡点音效，
输出 1920×1080 竖屏正片 + 4:3 / 3:4 封面。

---

## 一、装到哪

**个人级（推荐，所有项目都能用）**

| 系统 | 路径 |
|---|---|
| Windows | `C:\Users\<你的用户名>\.workbuddy\skills\yudusp\` |
| macOS / Linux | `~/.workbuddy/skills/yudusp/` |

**项目级（只在某个项目里生效，适合团队共用一个仓库）**

放到项目根目录的 `.workbuddy/skills/yudusp/`。

## 二、怎么装

1. 解压本压缩包，得到 `yudusp/` 文件夹和这份说明。
2. 把整个 `yudusp/` 文件夹（注意是**文件夹本身**，不是里面的文件）复制到上表对应路径。
   最终目录结构必须是：

   ```
   .workbuddy/skills/yudusp/SKILL.md          ← 必须在这一层
   .workbuddy/skills/yudusp/references/
   .workbuddy/skills/yudusp/scripts/
   .workbuddy/skills/yudusp/assets/
   ```

   ⚠️ 最常见的错误是多套了一层，变成 `skills/yudusp/yudusp/SKILL.md`，这样加载不到。
3. 重启 WorkBuddy（或新开一个会话）。
4. 验证：对 AI 说一句「用 yudusp 做一段沙盘视频」，它应该开始读 SKILL.md 并问你题材、
   时间线、地图范围。

## 三、对方环境需要什么

| 依赖 | 用途 | 说明 |
|---|---|---|
| Node.js 18+ | Remotion 渲染 | `npx remotion` 要能跑 |
| Python 3.9+ | 音乐节拍分析、配乐合成、地理裁剪 | **只用标准库**，不用 pip 装任何东西 |
| 一个能装 npm 包的网络 | 首次 `npm i` | remotion / world-atlas / topojson-client |

> `assets/template/` 是一套**已完成、能直接渲出成片**的参考工程（二战欧洲战场，25 镜 150 秒），
> 不是空壳。它自带 node_modules 的安装说明，但**不要把 node_modules 打进包里**——
> 几万个文件，要装时在工程目录跑 `npm i` 即可。

## 四、包里有什么

```
yudusp/
  SKILL.md                      主文件：七条不可变约束、9 步流程、换题材改哪三个文件
  references/
    pipeline.md                 每一步的精确命令
    storyboard-and-beats.md     分镜怎么对齐拍点
    visual-system.md            配色 / 字体 / 暗角 / 三层文字的规格
    code-map.md                 引擎层每个函数干什么
    node-illustrations.md       AI 版画插图怎么接入
    pitfalls.md                 踩过的坑（看这个能省几小时）
  scripts/
    analyze_beats.py            测 BPM / 拍长 / 相位 / 重音点
    build_audio.py              按落点表用代码合成配乐与音效
    extract_geo.js              从 world-atlas 抽国界 / 陆地
    clip_geo.py                 按窗口裁剪 + 抽稀
    card_shapes.py              抽卡片用的国家轮廓
  assets/
    template/                   可跑的参考工程（Remotion 4 + Canvas 2D）
      src/front-push.ts         ★ 势力推进（波前）模块，直接拷进新工程
    style-ref/                  两张做旧铜版画风格参考图
```

## 五、两个要改的本地路径

包里有几处示例路径是按原作者机器写的，第一次用时改成自己的：

- `F:/音乐库/沙盘.mp3` —— 出现在 `SKILL.md`、`references/pipeline.md`、
  `references/storyboard-and-beats.md`、`scripts/analyze_beats.py`、`scripts/build_audio.py` 的示例命令里。
  换成你自己的音乐文件路径即可，不影响逻辑。
- `F:\视频库\<主题>.mp4` —— 成片输出目录，按自己的习惯改。

## 六、建议的上手顺序

1. 先渲模板一帧看风格：进 `assets/template`，`npm i`，再
   `npx remotion still src/index.ts WW2Timeline out/chk.png --frame=1050`。
2. 读 `references/pitfalls.md`。这是这个 skill 最值钱的部分。
3. 再换一个自己的小题材试做（3～5 个镜头、30 秒左右），跑通全链路后再上正片。

---

版本：2026-11-15（新增 `front-push.ts` 波前模块、「推进感」规范与六项自检）
