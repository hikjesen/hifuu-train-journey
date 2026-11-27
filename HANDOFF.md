# 秘封的列车旅行

一段秋日黄昏的虚构北海道观景铁路旅程。运行入口是 `dist/index.html`，可以在桌面浏览器直接打开。场景采用米为单位，沿 X 轴行驶，旭岳位于默认座位的右侧车窗外（−Z）。运行时没有网络依赖。

## 天空实验分支

`experiment/dream-sky` 从 `main` 的 `ead91c1` 分出。低空的杏金色渐入玫瑰粉和蓝紫色，旭岳右侧有一弯朝向落日的月牙。天上的卷云随风横过雪峰，湖面按反射方向采样同一片天空。[在线播放](https://hifuu-asahidake-dream-sky.workspace-817094.chatgpt.site) · [六秒延时片段](preview/cloud-drift.mp4)

在默认座位暂停于 00:14、02:40 和 03:17，可以看到月牙从晴空中显露到被卷云遮住大半。时间和风场绑定，暂停、定位与黑场循环都会保留对应的云位。延时片段以 14 倍速播放 02:00 至 03:24。第一版的[静态调色对照](preview/sky-comparison.jpg)保留在仓库，代码版本为 `01f43fe`。

`tools/generate_panorama.cpp` 生成 7168 × 3584 的地形及低云底图和 2048 × 1024 的无损天气图集。图集上半幅保存晴空颜色和低云、山脊的透射率，下半幅保存卷云颜色和覆盖率。`src/atmosphere.js` 中的 `cloudOffset` 控制 7.6 公里高度的风场，月球投影固定在世界方向。`src/shaders.js` 和 `src/software.js` 分别实现 GPU 与软件合成。

按 C++ 文件开头的四条命令重建 `src/horizon.jpg` 和 `src/sky-layers.webp`，再运行 `python3 tools/assemble.py` 更新离线 HTML。本版成片 SHA-256 为 `217158acfb6c139598843bd589de366b215fe53785a3e9871fb10303b544ace4`。

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
