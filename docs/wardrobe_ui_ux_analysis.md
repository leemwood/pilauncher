# 衣挂 (Wardrobe) UI/UX 深度分析与优化建议报告

本报告针对衣挂（Wardrobe）页面及其关联子组件（如皮肤面板、披风面板、预览卡片、属性模态窗及 3D 查看器等）在 UI（用户界面）与 UX（用户体验）方面的设计与实现进行深度剖析。分析维度涵盖：**一致性与可预测性、清晰的视觉层级、即时且明确的反馈、焦点管理与空间导航、像素级对齐、微交互与动画曲线**。

---

## 一、 一致性与可预测性 (Consistency & Predictability)

一致性是建立用户信任和降低认知负荷的基石。当前衣挂模块在与主设计规范（OreUI）以及其他页面组件（设置、资源库等）的对接上存在若干不一致性问题。

### 1.1 分段页签 (Tab Nav) 未启用自适应缩放与统一类名
* **现状分析**：
  * 在 [Wardrobe.tsx](file:///H:/VSCodeWork/pilauncher/src/pages/Wardrobe.tsx#L474-L485) 中，渲染“皮肤”和“披风”分段的 `OreToggleButton` 缺少 `uiScale="adaptive"` 属性，且其 `className` 仅配置了普通的 `w-full`，没有添加 `.ore-tab-nav-toggle` 样式类。
  * 相比之下，设置（Settings）页面和资源库（Library）页面已完成了对页签导航的高度比例对齐和 fluid clamp 缩放改造。
* **优化建议**：
  * 将衣挂页签组件统一修改为 `<OreToggleButton uiScale="adaptive" className="ore-tab-nav-toggle w-full" ... />`，使其高度、边距、字号能通过标准 css 类自适应缩放，保证全局视觉高度与字重一致。

### 1.2 皮肤与披风菜单模态窗 (Menu Modal) 动作逻辑及关闭逻辑分裂
* **现状分析**：
  * **关闭交互不统一**：[WardrobeSkinMenuModal.tsx](file:///H:/VSCodeWork/pilauncher/src/features/wardrobe/components/WardrobeSkinMenuModal.tsx) 使用了默认的 `OreModal`（保留右上角 X 按钮，但**没有**底部的“取消”或“关闭”按钮）。而 [WardrobeCapeMenuModal.tsx](file:///H:/VSCodeWork/pilauncher/src/features/wardrobe/components/WardrobeCapeMenuModal.tsx) 则在底部显式提供了“取消”按钮，却配置了 `hideCloseButton` 隐藏了右上角的 X 按钮。
  * **激活态的按钮缺陷**：当某张皮肤已经是激活（Active）状态时，`WardrobeSkinMenuModal` 内不会渲染任何应用或删除操作按钮。因为没有配置“取消/关闭”按钮，这导致手柄和仅使用键盘的用户无法通过可视化的控件关闭该对话框，只能依赖键盘 ESC 键或点击遮罩，十分令人困惑。
* **优化建议**：
  * 统一两处模态窗的退出和关闭逻辑：均保留底部取消按钮（如 `OreButton variant="secondary" onClick={onClose}`）以保证手柄等无指针设备的退出可达性，并采用统一的 `hideCloseButton` 配置，维持一致的心智模型。

### 1.3 披风面板 (Cape Panel) 存在硬编码乱码文本与国际化缺失
* **现状分析**：
  * 在 [WardrobeCapePanel.tsx:L93](file:///H:/VSCodeWork/pilauncher/src/features/wardrobe/components/WardrobeCapePanel.tsx#L93) 与 [L106](file:///H:/VSCodeWork/pilauncher/src/features/wardrobe/components/WardrobeCapePanel.tsx#L106) 中，存在硬编码的提示字符，且因编码格式转换问题发生了严重的 Mojibake 乱码：
    * `鎶鍒囨崲闇€瑕佷娇鐢ㄥ井杞鐗堣处鍙风櫥褰曘€?`（原意应为：披风切换需要使用微软正版账号登录。）
    * `褰撳墠璐﹀彿娌℃湁鍙犹鎶銆?`（原意应为：当前账号没有可用披风。）
* **优化建议**：
  * 移除所有硬编码文本，将两处文字抽象并写入 `zh.json` 等国际化语言包中，使用 `t('wardrobe.cape.microsoftRequired')` 与 `t('wardrobe.cape.noCapes')` 渲染，根除乱码，统一 i18n 规范。

---

## 二、 清晰的视觉层级 (Clear Visual Hierarchy)

清晰的层级设计可以合理引导视线，帮助用户快速聚焦核心内容。目前衣挂页面的多处布局遮挡和信息缺失对这种层级造成了干扰。

### 2.1 控制提示面板 (Viewer Hints) 对 3D 画布区域的物理遮挡
* **现状分析**：
  * [Wardrobe.tsx](file:///H:/VSCodeWork/pilauncher/src/pages/Wardrobe.tsx#L443-L469) 的左侧 3D 查看器底部叠加了绝对定位的黑底半透明提示条 `.wardrobe-viewer-hints`（用于手柄与键盘的操作映射提示）。
  * 这一提示条的 `z-index: 20` 且横跨整个左侧面板底部。由于 3D 模型是全高渲染的，提示条会不可避免地遮挡住 3D 角色模型的靴子与小腿，导致用户无法在一屏内无障碍预览角色全身。
* **优化建议**：
  * 调整布局，将查看器底部的物理尺寸略微向上收缩，让提示面板放置在 3D 查看器画布的下方外部，或做成轻量可折叠按钮，避免直接覆盖渲染画面。

### 2.2 预览卡片 (Skin & Cape Card) 彻底缺失元数据与标签文字
* **现状分析**：
  * 在 [WardrobeSkinPanel.tsx](file:///H:/VSCodeWork/pilauncher/src/features/wardrobe/components/WardrobeSkinPanel.tsx#L45-L56) 的 `SkinCardItem` 中，卡片仅包裹了一个 3D 旋转缩略图，完全没有输出关于该皮肤的任何文字信息。同理，披风卡片也是纯图展示。
  * 然而，在样式表 [Wardrobe.css:L408-L434](file:///H:/VSCodeWork/pilauncher/src/style/pages/Wardrobe.css#L408) 中，其实早已精心定义了 `.wardrobe-skin-card__meta`、`.wardrobe-skin-card__title` 与 `.wardrobe-skin-card__subtitle` 等文字图层样式。
* **优化建议**：
  * 完善 React 组件的渲染逻辑，在卡片底部补全 `.wardrobe-skin-card__meta` 标签，分别用 `asset.title`（如皮肤名/备注）与 `asset.subtitle`（如 Classic/Slim 模型）填补，还原设计初衷。使用户无需逐个点击卡片就能辨认具体文件。

### 2.3 空账号状态 (Empty State) 过于简陋且呈“交互死路”
* **现状分析**：
  * 当用户没有激活任何游戏账号时，右侧主体面板只显示一个普通的不可交互文本 [Wardrobe.tsx:L487-L491]。
  * 这在 UX 上构成了一条“死胡同”，用户无法获得后续行动的引导。
* **优化建议**：
  * 将空状态升级为带功能性的引导卡片，增加“去添加账号”或“切换活跃账号”的按钮，直接导流至设置页面或主页的账号管理器，修复断裂的用户流。

---

## 三、 即时且明确的反馈 (Immediate & Clear Feedback)

即时、准确的交互反馈能够增强系统确信感，避免由于“无响应”带来的困惑。

### 3.1 3D 模型异步加载时视口处于“零反馈”空档
* **现状分析**：
  * 在 [useWardrobeViewerControl.ts](file:///H:/VSCodeWork/pilauncher/src/features/wardrobe/hooks/useWardrobeViewerControl.ts) 中，当用户切换皮肤、修改模型或切换披风时，程序会向远程/本地发送异步加载请求。
  * 整个加载期间，[WardrobeViewer.tsx](file:///H:/VSCodeWork/pilauncher/src/features/wardrobe/components/WardrobeViewer.tsx) 没有显示任何 Loading 指示器。当网络缓慢时，3D 人物模型可能会出现消失或卡死数秒的空白期。
* **优化建议**：
  * 在 `WardrobeViewer` 内部增加一个半透明的像素风加载覆盖层（如 `loader` 动画），在 `loadViewerState` 的 Promise 处于 pending 时显示，在 resolved 时淡出。

### 3.2 本地资产同步时缺乏加载指示器
* **现状分析**：
  * 微软账号在后台或手动刷新时会调用 `hydrateWardrobe` 以同步皮肤和披风，这在 [useWardrobeSession.ts](file:///H:/VSCodeWork/pilauncher/src/features/wardrobe/hooks/useWardrobeSession.ts) 中通过 `isLoadingProfile` 指示。
  * 披风面板对该状态进行了处理，展示了骨架屏网格 `.wardrobe-skeleton-grid`；然而皮肤面板 `WardrobeSkinPanel` 却**完全忽略了**这个状态，依然显示静态的旧皮肤列表。
* **优化建议**：
  * 使 `WardrobeSkinPanel` 也响应 `isLoadingProfile` 状态，当处于加载中且本地暂无资产时渲染骨架卡片（Skeleton Card），或在网格上覆盖一层轻量置灰遮罩，告知用户同步正在进行。

---

## 四、 焦点管理与空间导航 (Focus Management & Spatial Navigation)

作为一个支持手柄与全键盘操作的现代 Launcher，焦点流转在没有鼠标指针的环境下是保证交互可行的唯一命脉。

### 4.1 属性模态窗关闭后焦点重置到初始位置 (关键 UX 漏洞)
* **现状分析**：
  * 用户在使用键盘/手柄选择皮肤列表（例如第 15 个皮肤卡片）并回车打开 `WardrobeSkinMenuModal` 后，执行应用或直接关闭模态窗。
  * 模态窗关闭时，当前焦点对应的 DOM 销毁。由于没有记录之前的焦点状态，[Wardrobe.tsx:L323-L368] 里的焦点纠错机制将被激活，强行执行 `resolveWardrobeFocusKey()`，将焦点重置回最前方的 `'wardrobe-upload-card'` 或 `'wardrobe-skin-0'`。
  * 这导致滚动条瞬间被强行拉回顶部，用户不得不重新向下搜寻之前的行数。对于拥有大体积皮肤库的玩家，这是极其严重的负面体验。
* **优化建议**：
  * 仿照资源库的修复逻辑，在打开模态窗前利用一个 Ref 记录先前触发模态窗的卡片 Key（如 `lastFocusedKeyRef.current`）。在关闭模态窗后，优先将焦点还给该 Key。

### 4.2 皮肤详情模态窗 (Skin Menu Modal) 缺失默认焦点配置
* **现状分析**：
  * [WardrobeSkinMenuModal.tsx](file:///H:/VSCodeWork/pilauncher/src/features/wardrobe/components/WardrobeSkinMenuModal.tsx) 的 `OreModal` 容器未配置 `defaultFocusKey`。
  * 当用户使用键盘/手柄按 Enter 打开该窗口时，焦点将飘散在窗口之外，必须盲按方向键来碰运气激活焦点。
* **优化建议**：
  * 为模态窗外壳补充配置 `defaultFocusKey="wardrobe-skin-menu-apply"`（或者在仅能删除时指向 `"wardrobe-skin-menu-delete"`），保证模态窗一经显现，焦点即可完美停留在首选动作按钮上。

### 4.3 模态窗展示时的方向/翻页键输入“穿透”漏洞
* **现状分析**：
  * 在 [Wardrobe.tsx:L382-L393](file:///H:/VSCodeWork/pilauncher/src/pages/Wardrobe.tsx#L382-L393) 中，对 LB/RB 切换页签的 input 监听（`TAB_LEFT` 等）仅拦截了 `skinMenuAsset` 开启状态：
    ```typescript
    useInputAction('TAB_RIGHT', () => {
      if (!skinMenuAsset) setActiveSection('cape');
    });
    ```
  * 这意味着如果打开的是披风模态窗 `capeMenuAsset`，用户按下翻页键时，后台的页签仍会悄悄地被切为 `skin`。
* **优化建议**：
  * 将所有全局页面热键拦截的判断条件修正为同时排除两处模态窗：`if (!skinMenuAsset && !capeMenuAsset)`，彻底断绝输入溢出到背景层引起的意外行为。

---

## 五、 像素级对齐与 OreUI 设计规范 (Pixel-level Alignment & OreUI Spec)

像素级精度对于复古像素风 UI 是核心设计要求，任何模糊的矢量缩放和抗锯齿平滑都会严重剥夺游戏原本的艺术美感。

### 5.1 图标流式 clamp 缩放产生的亚像素模糊 (Icon Blur)
* **现状分析**：
  * 衣挂头部的 `ArrowLeft`、`RefreshCw` [Wardrobe.tsx:L406, L418] 以及上传卡片的 `ImagePlus` [WardrobeSkinPanel.tsx:L82] 的尺寸均被硬编码为了流式大小：
    * `w-[clamp(1.125rem,3vh,1.75rem)]`
    * `w-[clamp(1.5rem,4vh,2.5rem)]`
  * 在大量非整数倍高分屏分辨率下，计算出来的像素宽度带有小数值（如 21.34px），从而让矢量图标在网格渲染时发生亚像素插值，边缘严重模糊、发虚。
* **优化建议**：
  * 移除所有针对图标的 `clamp` 尺寸，统一规定为固定的偶数像素（如返回与刷新按钮固定为 `size={16}` (1rem)，上传大图标固定为 `size={32}`），依靠容器外边距或填充来响应屏幕变化。

### 5.2 皮肤与披风缩略图采用 auto 平滑渲染
* **现状分析**：
  * [Wardrobe.css:L399](file:///H:/VSCodeWork/pilauncher/src/style/pages/Wardrobe.css#L399) 与 [L464](file:///H:/VSCodeWork/pilauncher/src/style/pages/Wardrobe.css#L464) 对 `.wardrobe-skin-card-preview__image` 与披风小图设置了：
    ```css
    image-rendering: auto;
    ```
  * 对于分辨率仅有 64px 级别的 Minecraft 原生皮肤文件，`auto` 渲染会强制进行双线性过滤，使用户的皮肤面部和细节在缩小卡片里变得模糊一团。
* **优化建议**：
  * 纠正渲染模式，强制使用像素级对齐的缩放参数：
    ```css
    image-rendering: pixelated;
    image-rendering: crisp-edges; /* 跨浏览器兼容 */
    ```
  * 这能还原 Minecraft 原汁原味的锐利颗粒感。

### 5.3 不符合像素风美学的圆形元素与非规整尺寸
* **现状分析**：
  * [Wardrobe.css](file:///H:/VSCodeWork/pilauncher/src/style/pages/Wardrobe.css#L313,L344) 里的上传图标背景圆圈 `.wardrobe-upload-card__icon` 与选中徽章 `.wardrobe-card-active-badge` 使用了 `border-radius: 999px;`。
  * 卡片网格的 `.wardrobe-skin-card` 具有不符合 4/8 像素栅格的奇数高度 `min-h: 215px` 与 3px 粗描边。
* **优化建议**：
  * 将所有圆角元素改为纯直角或微小的像素块角。
  * 将 3px 描边修改为 Minecraft 标配的 2px 或 4px 偶数粗细描边，并将卡片高度和间距修正为偶数像素倍数，消除 fractional scaling 带来的单边像素缺失和描边断裂。

### 5.4 3D 查看器背景偏离 OreUI 定义的立体渐变
* **现状分析**：
  * [Wardrobe.tsx](file:///H:/VSCodeWork/pilauncher/src/pages/Wardrobe.tsx#L436-L439) 对 3D 查看器底板应用了行内的单层渐变，完全绕过了 `Wardrobe.css` 中精心设计好的 `.wardrobe-viewer-surface` 三重立体混合背景色。
* **优化建议**：
  * 将包裹查看器的 div 类名变更为 `wardrobe-viewer-surface`，并移除 inline 样式，使查看器获得具有立体景深感和微弱绿色漫反射的精致背景。

---

## 六、 微交互与动画曲线 (Micro-interactions & Animation Curves)

好的微交互是应用展现高品质质感的秘诀。

### 6.1 卡片 Hover 3D 翻转的“旋转风暴”
* **现状分析**：
  * 当鼠标快速划过皮肤列表时，卡片翻转触发过度灵敏，多张卡片同时进行 rotateY(180deg) 翻转，导致界面发生极为晃眼的旋转杂音，造成视觉焦点涣散。
* **优化建议**：
  * 为 Hover/Focus 触发翻转增加一个微小的延迟（如通过 Framer Motion 的 `hover` transition delay），或者将翻转改为更克制、高级的像素斜切浮动（如 OreUI 标准的 `bedrockCardHover`）。

### 6.2 键盘与手柄操作时的物理按压手感缺失
* **现状分析**：
  * 卡片只有在鼠标点击时才能依靠 `:active` 样式触发 `translate-y-[2px]` 的按压反馈。键盘和手柄用户选中卡片按下回车或 A 键时，并不会触发 `:active` 状态。
* **优化建议**：
  * 对卡片引入 Framer Motion 的 `whileTap={{ y: 2 }}`，或者使用 React 状态同步控制一个表示按下的 `.is-pressed` 类，提供全局一致的物理触感。

### 6.3 3D 手柄旋转摇杆无视惯性
* **现状分析**：
  * [useWardrobeViewerControl.ts:L80](file:///H:/VSCodeWork/pilauncher/src/features/wardrobe/hooks/useWardrobeViewerControl.ts#L80) 针对手柄右摇杆（Right Stick）控制角色模型旋转的处理是“硬delta累加”：
    ```typescript
    engine.raw.playerWrapper.rotation.y += delta;
    ```
  * 这与鼠标拖拽时 skinview3d 原生自带的阻尼和平滑缓动（inertia）不一致，导致摇杆控制时的旋转起步与停止非常突兀硬朗。
* **优化建议**：
  * 引入简易的差值插值，让摇杆输入改变的是 `targetRotationRef.current`，而实际角度在每帧利用 `lerp` 算法向其匀速平滑逼近，为手柄控制赋予丝滑的高级感。

---

## 优化优先级与路线图建议 (Roadmap & Priority)

基于上述六维深度分析，我们整理出了以下优化优先级建议清单，以便后续实施改进：

| 优先级 | 优化方向 | 对应维度 | 预期提升效果 |
| :--- | :--- | :--- | :--- |
| **P0 (致命)** | **重构模态窗关闭后的焦点恢复机制** | 焦点管理与空间导航 | 彻底消除用户在关闭模态窗后，焦点被重置回最顶部卡片导致的滚动条重置 Bug，保障浏览连续性。 |
| **P0 (致命)** | **重构并国际化 CapePanel 处的乱码文本** | 一致性与可预测性 | 纠正 Mojibake 乱码错误，使用 `t(...)` 国际化，恢复正常的提示说明可读性。 |
| **P1 (高)** | **修复模态窗的默认焦点与输入穿透漏洞** | 焦点管理与空间导航 | 阻止披风详情模态窗开启时方向/翻页输入穿透到背景卡片；为皮肤窗指明默认首个焦点。 |
| **P1 (高)** | **修正卡片图片为像素缩放 (`pixelated`)** | 像素级对齐与规范 | 解决 64x64 皮肤图片在被缩放时产生的边缘双线性过滤模糊，呈现清脆利落的原生像素画风。 |
| **P1 (高)** | **将流式 clamp 图标与非规整尺寸规范化** | 像素级对齐与规范 | 废除图标 `clamp` 产生的亚像素边缘毛刺；将描边粗细重构为 2px/4px，高度重构为偶数对齐。 |
| **P2 (中)** | **移出 ViewerHints 并补全卡片 Title 元数据** | 清晰的视觉层级 | 释放底部 3D 渲染物理遮挡，让角色靴腿完整展示；补全卡片底部元数据，使用户直观阅读皮肤名称及类型。 |
| **P2 (中)** | **统一 ToggleButton 样式与模态窗取消交互** | 一致性与可预测性 | 统衣挂页签高度与字体为自适应比例，对齐设置页标准；为皮肤详情模态窗补全“取消”动作按钮。 |
| **P2 (中)** | **重构衣挂 3D 查看器底板为 `.wardrobe-viewer-surface`** | 像素级对齐与规范 | 移除硬编码单层渐变，还原带有漫反射高光与立体质感的多层精致背景。 |
| **P3 (低)** | **加入 3D 画布贴图加载的 Loading 状态** | 即时且明确的反馈 | 移除皮肤异步更新加载时的局部画面闪烁和白屏空档，增强视觉过度连续性。 |
| **P3 (低)** | **优化卡片 Hover 翻转灵敏度与手柄旋转惯性** | 微交互与动画曲线 | 减少快速扫过列表时的乱舞现象，为摇杆旋转模型配置阻尼缓动，实现高阶微动效。 |
