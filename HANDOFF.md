# 秘封的列车旅行

一段秋日黄昏的虚构北海道观景铁路旅程。运行入口是 `dist/index.html`，可以在桌面浏览器直接打开。场景采用米为单位，沿 X 轴行驶，旭岳位于默认座位的右侧车窗外（−Z）。运行时没有网络依赖。

## 天空实验分支

`experiment/dream-sky` 从 `main` 的 `ead91c1` 分出。低空的杏金和玫瑰红渐入峰顶右侧的蓝紫色。高层卷云受风剪切，与下方的体积云分别生成。旭岳右侧的月牙和云使用同一太阳方向照明。

[播放已发布的实验版](https://hifuu-asahidake-dream-sky.workspace-817094.chatgpt.site)。发布版本的源码提交为 `32818dcaafc5c8346dbb2f4d6791043d453de4e0`。默认座位的对照取样时间为 13.6 秒，垂直视角为 57°。全景分辨率为 7168 × 3584，SHA-256 为 `952f970b8896aa847b4c417a13aad7b500aa51cbe774131714d47b85440dbdd1`。离线 HTML 共 2,685,469 字节，SHA-256 为 `ab5a93eb1ffba6a7494f5c2c3b6bf619b41523f6f929b11b33a8f78712bad752`。

## 开发接续

- `src/page.html`、`src/ui.js` 负责放映界面、旅程时间轴、鼠标与触摸输入。
- `src/geometry.js`、`src/shaders.js`、`src/renderer.js` 负责网格、材质、玻璃、曝光与快门。
- `src/carriage.js` 生成车厢和秘封俱乐部的随身物。`src/countryside.js` 生成田野、岸线、树林与树木图集。`src/tunnel.js` 生成隧道与路堑。
- `tools/generate_panorama.cpp` 从数学地形与云体积生成远景。`src/horizon.jpg` 为离线生成的球面光照缓存。制作过程使用的图像与模型全部来自本项目的代码。
- `python3 tools/assemble.py` 将源码及光照缓存打包进 `dist/index.html`。调试时应修改 `src/` 后再打包。
- 一圈 216 秒，列车以 14 m/s 穿行。首访落在开阔景段，之后每次循环都在隧道全黑段接合。

## 当前交付与复验

成片同时包含 WebGL 与 Canvas 2D 软件渲染路径。第一次从 13.6 秒的稻原进入，最终隧道的全黑区跨过 216 秒接缝。交互停下 5.5 秒后，视角和焦距平滑归位。浏览器中已检查拖动、滚轮、暂停、行程跳转和黑场重启。手机双指手势尚未在真机实测。

远景含 7168 × 3584 的程序化地形与体积云。重做远景请按 generate_panorama.cpp 文件开头的命令。车厢光照可用 python3 tools/bake_carriage.py --width 3072 --samples 16 重烘焙；需要 Node、Blender、NumPy、Pillow。日常前端修改只需重新运行打包脚本。src/software.js 负责软件投影、纹理与深度遮挡，src/landlight.js 负责树影。
