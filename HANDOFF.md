# 秘封的列车旅行

一段秋日黄昏的虚构北海道观景铁路旅程。运行入口是 `dist/index.html`，可以在桌面浏览器直接打开。场景采用米为单位，沿 X 轴行驶，旭岳位于默认座位的右侧车窗外（−Z）。运行时没有网络依赖。

## 天空实验分支

`experiment/dream-sky` 从 `main` 的 `ead91c1` 分出。车窗左侧的落日从杏金渐入玫瑰色，右侧晴空由淡紫转深蓝。旭岳上方有随风弯折的高空卷云，山顶右侧的云隙露出一弯月牙。太阳位置同时决定月牙的朝向和体积云的受光面。[在线播放](https://hifuu-asahidake-dream-sky.workspace-817094.chatgpt.site) · [开场同机位对照图](preview/sky-comparison.jpg)

从车窗复验时，暂停在 13.6 秒，回到默认座位，垂直视角保持 57°。对照图上下两幅分别取自主线与实验版，使用相同的相机、投影和裁剪。

天空在 `tools/generate_panorama.cpp` 中生成。`highClouds` 控制高云的形状，`crescent` 控制月相，`sky` 处理暮光和中低层云。按源码开头的命令重建 7168 × 3584 的 `src/horizon.jpg` 后，运行 `python3 tools/assemble.py` 更新离线成片。WebGL、软件渲染和湖面倒影都读取同一份全景。

公开分支和在线发布版分别从同一份源码构建。按交付版本核对下表中的 SHA-256。在线版本的源码提交为 `32818dcaafc5c8346dbb2f4d6791043d453de4e0`。

| 交付版本 | 全景 JPEG | 独立 HTML |
| --- | --- | --- |
| 公开分支 | `f563656a1a241e6fa80684a90d052d53abe7e75094aa6211442bec3c88578841` | `9d126c3dfab39d8878aa5d82a7b22c125a481ac916458ae7f79faae0b1f9601f` |
| 在线发布版 | `952f970b8896aa847b4c417a13aad7b500aa51cbe774131714d47b85440dbdd1` | `ab5a93eb1ffba6a7494f5c2c3b6bf619b41523f6f929b11b33a8f78712bad752` |

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
