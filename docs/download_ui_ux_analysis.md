# PiLauncher 下载功能组件 UI/UX 与空间导航专项审计报告

本报告针对 `src/features/Download/components/` 及其子目录中的所有 TSX 组件文件进行了全方位的代码走查与用户体验（UI/UX）审计。评估与调整完全贴合本项目的特殊交互设计逻辑（如依靠手柄 LT/RT 肩键进行大模块切换，避免焦点移入顶部导航，减少视觉冗余）。

---

## 总体评估与严重缺陷摘要

经过重新排查与设计对齐，过滤掉了符合设计预期的 LT/RT 快捷切换逻辑与无键盘指示器的极简风格，锁定了以下真实存在的焦点死锁、事件冲突与操作阻力问题：

1. ⚠️ **整合包实例创建模态框导航完全失效 (ModpackCreateModal.tsx)**:
   - 在处理方向按键（`onArrowPress`）时，代码中错误地将方向字符串比对为大写（如 `DOWN`、`UP`、`RIGHT`），而 `norigin-spatial-navigation` 传递的实际方向全为小写（`down`、`up`、`right`）。这导致键盘与手柄用户在输入实例名称后，**完全无法将焦点下移至“确认”和“取消”按钮**，造成键盘导航死锁。
2. ⚠️ **全局动作按键冲突 Bug (TaskItem.tsx)**:
   - 每个下载任务组件 `TaskItem` 均独立注册了 `useInputAction('ACTION_Y', ...)` 监听。这意味着当用户打开下载管理器面板，若存在多个下载任务，按下手柄 Y 键或键盘对应键时，**所有任务的日志面板将同时被展开或收起**。且在未聚焦该任务时，该快捷键依旧会全局触发。
3. ⚠️ **已有模组集 Portal 列表无法使用按键导航 (FavoritePlaceholderModal.tsx)**:
   - 通过 `createPortal` 渲染的已存模组集列表项按钮没有包裹在 `FocusItem` 中，键盘与手柄用户在输入名称后，焦点完全无法移动到列表项上进行选择，成为交互盲区。

---

## 逐组件审计与改进建议

### 1. [BottomNav.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/BottomNav.tsx) (底部导航栏)
- **发现的问题**:
  - **事件重复处理与按键冲突**:
    - 在 `FocusItem` (第 76-88 行) 中自定义了 `onArrowPress` 来处理左右方向键并切换焦点。然而在底层的 `button` 上 (第 101-121 行)，又在 `onKeyDown` 中监听了 `ArrowLeft` / `ArrowRight` 并手动调用 `switchTabBy`。这种双重监听极易引起焦点竞争、重复触发 Tab 切换或空间导航系统紊乱。
  - **非受控焦点绑定**:
    - 第 100 行 `onFocus={() => setFocus(getFocusKey(tab.id))}` 会在 button 接收到 HTML 原生 focus 时反向通知空间导航系统。当空间导航系统也在触发 focus 时，可能会导致焦点切换的循环竞争。
- **改进方案**:
  - 移除 `button` 原生的 `onKeyDown` 左右方向键监听，交由 `FocusItem` 的 `onArrowPress` 统一托管。
  - 删去 `onFocus` 中的主动 `setFocus` 动作，让 `norigin-spatial-navigation` 自动决定焦点流向。
  - 采用标准 Vanilla CSS Transitions（如 `transition-all duration-200`）来处理指示线位置切换，确保轻量流畅。

### 2. [ContextualActionBar.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/ContextualActionBar.tsx) (上下文操作栏)
- **发现的问题**:
  - **焦点无法自动进入 (孤岛问题)**:
    - 作为一个绝对定位悬浮在最底部的操作栏 (第 31 行)，当用户进入选择模式并显示操作栏时，焦点依然停留在原有的 `ResourceCard` 上。手柄或方向键导航由于惯性限制，不会自动引导或转移焦点至该操作栏，用户也很难向下按键“自然地”滑入该操作栏。
  - **视觉层级遮挡**:
    - 悬浮在内容之上会遮挡最底部的资源卡片。如果 `ResourceGrid` 底部的 `padding-bottom` 缓冲区不够大，用户将无法看到或操作被该操作栏遮挡的卡片内容。
- **改进建议**:
  - 当 `selectedCount` 从 0 变为 1 时，主动调用 `setFocus` 将焦点移至该动作条的首个按钮（如批量下载）。
  - 使用 Vanilla CSS `transition: transform 0.2s ease-in-out, opacity 0.2s` 控制操作栏的滑入和淡入，避免生硬出现。

### 3. [DownloadDetailModal.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DownloadDetailModal.tsx) (下载详情模态框)
- **发现的问题**:
  - **脆弱的延时自动聚焦**:
    - 第 146-166 行代码中，使用 `setTimeout` 重试 5 次来寻找首个版本行进行聚焦。这类竞态条件代码极易在系统性能波动或动画卡住时失效，导致键盘焦点丢失。
  - **状态反馈不够直接**:
    - 点击下载按钮后只是设置了 `pendingVersion` 并弹出了第二个模态框，但原弹窗中被下载的这一行没有显示实时的“添加中/已在队列”的加载反馈。
- **改进建议**:
  - 弃用基于 `setTimeout` 的自动聚焦逻辑，改在 `useEffect` 中监听 `displayVersions.length` 或 `isLoadingVersions` 状态，并配合 `requestAnimationFrame` 在 DOM 树确立后安全地激活焦点。
  - 增加对应行的 Loading 态样式或置灰，使用户直观了解部署进程。

### 4. [FavoritePlaceholderModal.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/FavoritePlaceholderModal.tsx) (收藏夹占位模态框)
- **发现的问题**:
  - **重要操作按钮焦点键缺省**:
    - 第 370 行的“取消”按钮没有显式声明 `focusKey`。在弹出模态框中，确认与取消键是最高频的交互，使用自动生成的焦点键可能会导致在其他输入框（如模组集名称输入框）按下方向键时，焦点无法稳定移动到“取消”键上。
  - **⚠️ 下拉 Portal 中的列表无法使用按键导航**:
    - 第 472-522 行通过 `createPortal` 渲染的已存模组集列表项按钮没有包裹在 `FocusItem` 中，物理按键用户在输入名称后，焦点完全无法移动到列表项上进行选择。
- **改进建议**:
  - 为“取消”按钮补充 `focusKey="favorite-cancel"`。
  - 对下拉 Portal 中的每一个模组集项使用 `FocusItem` 包裹，并在外层声明 `FocusBoundary`，允许物理按键在列表内自由上下移动焦点进行选择。

### 5. [FilterBar.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/FilterBar.tsx) (过滤器侧栏)
- **设计对齐与审计**:
  - **顶部页签跳过（符合设计预期）**:
    - 模组/资源包/光影/整合包的切换由于绑定了手柄的 LT/RT 肩键，因此**特意设计了焦点不进入顶部导航**的逻辑，这避免了玩家上下频繁按键的繁琐。此处保持现有 `tabIndex={-1}` 和不加 `FocusItem` 的设定，不需要修改。
  - **重置反馈缺乏**:
    - 重置按钮 (第 407 行) 点击后，虽然清空了输入框和下拉框的值，但没有提供轻量级的反馈，用户在网格没有数据更新时可能不知道是否重置成功。
- **改进建议**:
  - 在重置或清空搜索过滤条件时，若列表发起重新请求，对卡片展示区域提供短暂的 Loading 状态或 Skeleton 骨架屏占位。

### 6. [ResourceCard.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/ResourceCard.tsx) (资源卡片)
- **发现的问题**:
  - **无物理按键的选择模式触发器**:
    - 代码中仅对鼠标右键（`onContextMenu`，第 148 行）和选择模式下的鼠标左键单选进行了选中逻辑（`onToggleSelection`）的响应。键盘/手柄用户在使用空间导航聚焦卡片时，没有分配对应的按键（如 Space）来切换选中状态。这导致手柄用户在多选模式下，无法选中任何卡片。
  - **文案不够精确**:
    - 第 303 行，卡片被多选后显示的角标标签中文文案为 `"命中"`。这非常不符合中文的软件交互习惯，应改为 `"已选"`。
- **改进建议**:
  - 在卡片的 `FocusItem` 上增加 `onKeyDown` 处理器，当捕获到 Space 键时，主动触发 `onToggleSelection`。
  - 将 `"命中"` 文案统一替换为国际化词条 `t('download.status.selected', { defaultValue: '已选择' })`。

### 7. [ResourceGrid.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/ResourceGrid.tsx) (资源展示网格)
- **发现的问题**:
  - **不对称内边距导致像素级偏斜**:
    - 第 172 行 `listClassName` 在默认状态下为 `px-[0.875rem] pb-[1.5rem] pt-[1.375rem]`，而在 `sm:` 断点下为 `sm:px-[1rem] sm:pt-[1.5rem]`。这导致视口大小改变时，顶部边距会在 `1.375rem` (22px) 和 `1.5rem` (24px) 之间跳变，造成垂直方向的视觉微动。
  - **加载更多时的焦点截断**:
    - 当滚动至底部触发 `onLoadMore` 时，若加载时间较长，焦点仍驻留在最后一个元素上。当数据终于插入并刷新布局时，Virtuoso 重新计算索引可能导致当前焦点瞬间滑出视口。
- **改进建议**:
  - 统一像素级对齐，修改 `listClassName` 保证在所有屏幕断点下均拥有对称的 Padding（例如统一设为 `p-4 sm:p-6`）。
  - 在加载更多数据期间，对底部 Loading Indicator 提供占位卡片，防止列表长度骤变造成焦点丢失。

### 8. [InstanceSelectModal.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DetailModal/InstanceSelectModal.tsx) (实例选择模态框)
- **发现的问题**:
  - **大量的 Hardcoded Unicode 转义字符**:
    - 纵观整个 TSX 文件（例如第 345, 352, 356, 380, 406 等行），大量的汉字字符串被硬编码为了十六进制 Unicode 编码（如 `\u6b63\u5728\u5206\u6790...`）。这极大地破坏了代码的清晰度和可维护性，也违背了项目中已经引入的 `useTranslation` 多语言一致性标准。
  - **缺乏防连击处理**:
    - 在异步检查依赖（`isCheckingDeps`）或扫描缓存时，没有在确认按钮上限制重复点按动作，可能触发重复部署指令。
- **改进建议**:
  - 重构所有 Unicode 转义字符，将它们放入语言 JSON 配置文件中，通过 `t()` 统一调用。
  - 在 `isCheckingDeps` 为真时，对确认部署按钮增加置灰变暗的状态反馈。

### 9. [ModpackCreateModal.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DetailModal/ModpackCreateModal.tsx) (整合包创建模态框)
- **发现的问题**:
  - **⚠️ 致命焦点死锁 Bug**:
    - 见第 96, 112, 116, 131, 135 行：
      ```typescript
      onArrowPress={(direction) => {
        if (direction === 'DOWN') { ... }
      }}
      ```
      代码错误地检查了全大写的 `'DOWN'` / `'UP'` / `'LEFT'` / `'RIGHT'`。由于 `norigin-spatial-navigation` 抛出的方向事件参数全部是小写，这些分支逻辑**永远不会被执行**。手柄或键盘用户在把焦点停留在 `OreInput` 时，按 Down 方向键将无法跳出输入框，焦点被锁死在输入框内部。
  - **UI 视觉风格不一致 (主题错乱)**:
    - 整个应用的其他模态框均采用 `#313233`、`#48494A` 等实体灰色调背景，以及粗像素边框的 Minecraft 像素设计语言。而本组件却使用了现代 Tailwind 的 `bg-[#18181B]`（深黑色）和 `bg-black/40`、`border-white/5` 细线条设计，导致视觉割裂。
- **改进方案**:
  - 将所有方向判断小写化（如 `direction === 'down'`、`direction === 'up'`）。
  - 将背景颜色与边框粗细微调修改为与 `InstanceSelectModal.tsx` 完全一致的方块像素像素风格，复用全局 Modal 变量。

### 10. [ProjectGallery.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DetailModal/ProjectGallery.tsx) (项目画廊展示)
- **发现的问题**:
  - **画廊预览图完全不响应物理导航**:
    - 第 112-122 行渲染的图片横向排列区域 `overflow-x-auto`，内部全是普通的 `<img>` 标签，没有任何一个元素能够被焦点捕获。键盘和手柄用户仅能展开预览，但无法聚焦到任何单张图片上，因此无法滚动查看超出视口的预览图。
- **改进方案**:
  - 对每一张图片包裹一个 `FocusItem` 允许其获取焦点，并使容器在检测到焦点变更时自动横向平移滚动（ScrollIntoView）。

### 11. [ProjectHeader.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DetailModal/ProjectHeader.tsx) (项目头部详情)
- **发现的问题**:
  - **“在浏览器中打开”操作为空间导航盲区**:
    - 第 103-120 行的 `button` 没有包裹在 `FocusItem` 中，也没有任何 `focusKey`。在详情页中，这是唯一的外部跳转链接按钮，使用物理遥控器或手柄的用户根本无法点按该链接。
- **改进方案**:
  - 使用 `FocusItem` 包裹此按钮，或将其替换为 `OreButton`，并显式指定 `focusKey="download-modal-header-open-web"`。

### 12. [VersionFilters.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DetailModal/VersionFilters.tsx) (版本过滤器)
- **发现的问题**:
  - **过滤单选按钮（Loader 切换）无法聚焦**:
    - 第 241-248 行的 `OreToggleButton` 设置了 `focusable={false}`。这导致键盘用户或没有特定肩键映射的用户无法直接按 D-pad 上移并选择不同的 Loader。这种设计阻断了常规的空间导航路径。
- **改进建议**:
  - 将 `focusable` 设为 `true`，或者确保键盘的 `Tab` 和左右方向键能够在 Loader 的不同页签间流转焦点。

### 13. [VersionList.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DetailModal/VersionList.tsx) (版本列表)
- **发现的问题**:
  - **输入模式之间的交互摩擦阻力极度不一致**:
    - **鼠标用户**: 能够直接点击卡片右侧的 `"下载版本"` 按钮 (第 206 行)，直接开始下载部署。
    - **手柄/键盘用户**: 由于卡片内部的“下载”按钮被置为了 `focusable={false}` (第 197, 209 行)，按 Enter 键触发的是外层卡片的 `onEnter` 行为。这会直接强制弹出一个 Changelog 模态弹窗（第 62 行），迫使按键用户多看一次日志，再次聚焦到该弹窗里的下载按钮并按 Enter 才能触发部署，交互阻力很大。
  - **强制突兀的方向导航重定向**:
    - 在第 44-60 行的 `handleVersionArrow` 中，如果用户在任意一版卡片上按 `Left` 或 `Right` 键，焦点将直接粗暴地跳跃到顶部的 `download-modal-mc-dropdown-0`。这在用户只是想做轻微左右调整或按错键时会造成非常强烈的跳跃感。
- **改进方案**:
  - 允许直接按键对卡片内部的下载按钮进行聚焦，或在使用手柄聚焦卡片时支持特定的快捷按键（例如按 Y 键直接触发下载，无需多弹窗看日志）。
  - 移除非第一行卡片按左/右的跳转逻辑。

### 14. [FloatingButton.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DownloadManager/FloatingButton.tsx) (下载管理器悬浮按钮)
- **设计对齐与审计**:
  - **无键盘提示器设计（符合设计预期）**:
    - 为了界面的极致纯净性，该按钮无需添加键盘指示器，仅对已有的 Gamepad 模式做动态映射显示，符合设计预期，不需要修改。
  - **圆角几何风格偏离**:
    - 使用了完全的正圆形 `rounded-full` (第 43 行)。由于整个 Launcher UI 大面积采用 Minecraft 经典像素版硬核直角设计，圆形的浮动按钮在整体风格中显得突兀。
- **改进方案**:
  - 将正圆形按钮改为边角带有 2 像素或 4 像素黑边的硬切角方形，以契合整体“Ore”像素版方形视觉风格。

### 15. [TaskItem.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DownloadManager/TaskItem.tsx) (下载任务卡片项)
- **发现的问题**:
  - **⚠️ 致命快捷键监听冲突**:
    - 第 174 行直接调用了 `useInputAction('ACTION_Y', () => { setShowLogs((prev) => !prev); });`。由于该 Hook 属于全局静态绑定，且无 `focused` 防护，当页面上有多个 TaskItem 时，**每一次点击 Y 键都会无差别地反转所有 TaskItem 的日志折叠状态**。
- **改进方案**:
  - 仅在当前 TaskItem 内部的 `btn-log-task.id` 按钮处于 `focused` 状态，或者 TaskItem 处于活动区域时，才去响应对应的 Y 键。

### 16. [TaskPanel.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DownloadManager/TaskPanel.tsx) (下载任务管理器面板)
- **发现的问题**:
  - **列表滚动视口截断问题 ( autoScroll 为 false )**:
    - 在 TaskItem 的各个动作按钮上，`autoScroll` 属性全被设置为了 `false` (例如 [TaskItem.tsx](file:///H:/VSCodeWork/pilauncher/src/features/Download/components/DownloadManager/TaskItem.tsx) 第 285, 307, 324, 339 行)。如果下载管理器列表有很多任务溢出了 `max-h-[75vh]` 视口，用户使用手柄向下导航到屏幕外的任务按钮时，列表将不会自动滚动，使用户在盲区里聚焦操作。
- **改进方案**:
  - 将按钮上的 `autoScroll={false}` 移除，并在滚动容器外包裹能够感知焦点边界并自动计算 scrollOffset 的受控组件，确保焦点滚动可见。

---

## 四、 优化维度对照表

| 审计维度 | 状态 / 严重度 | 涉及主要文件 / 行号 | 核心改进建议 |
| :--- | :--- | :--- | :--- |
| **Consistency & Predictability** | 🔴 严重不一致 | `ModpackCreateModal.tsx:L68-70`<br>`VersionList.tsx:L193-221` | 统一 Modpack 模态框的主题风格；统一按键触发下载版本的通道。 |
| **Clear Visual Hierarchy** | 🟡 局部遮挡 | `ContextualActionBar.tsx:L31-33` | 增加 Grid 底部 padding，防止悬浮条遮挡列表底端。 |
| **Immediate & Clear Feedback** | 🟡 缺乏中转态 | `FilterBar.tsx:L394-417` | 在清空过滤器与发起异步搜索时提供骨架屏或局部 Loading 状态。 |
| **Focus Management** | 🔴 致命崩溃 | `ModpackCreateModal.tsx:L96-140`<br>`TaskItem.tsx:L174`<br>`FavoritePlaceholderModal.tsx:L472-522` | 修复大写按键判断；限制全局 Y 按键捕获范围；对 Portal 已存模组集项使用 `FocusItem` 包裹。 |
| **Pixel-level Alignment** | 🟢 良好 | `ResourceGrid.tsx:L172` | 规范网格的 padding 定义，消除屏幕尺寸突变时的垂直微动。 |
| **Micro-interactions** | 🟡 略微生硬 | `FloatingButton.tsx:L43` | 修改浮动按钮为硬方角以契合像素风主题。不使用 Framer Motion，使用原生 CSS 处理常规动画过渡。 |
