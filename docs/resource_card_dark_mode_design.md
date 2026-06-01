# ResourceCard 暗色模式设计方案与无障碍标准规范

本方案针对 `src/features/Download/components/ResourceCard.tsx` 组件在暗色模式（Dark Mode）下的视觉展现和无障碍访问（Accessibility, A11y）进行系统性设计。卡片的基础底色设定为 `#494949`（中暗灰色），在此基础上根据 **WCAG 2.1 AA/AAA 级规范** 与 **PiLauncher (OreUI) 像素风设计规范**，对徽标、标签、文字等交互与展示元素进行精细色彩设计与对比度计算。

---

## 一、 设计原则与无障碍标准 (WCAG 2.1)

为了确保视障、色弱或在低光照环境下操作的用户能无障碍地使用此卡片，本设计严格遵守以下无障碍对比度指标：
*   **文本内容对比度（WCAG 2.1 AA 级）**：正文、标题及核心元数据文本与 `#494949` 底色的对比度必须 **≥ 4.5:1**。
*   **小字号/次要文本对比度**：尽可能达到 **≥ 5:1**，确保清晰可读。
*   **非文本交互元素及边界对比度（WCAG 2.1 AA 级）**：卡片边框、焦点指示器、状态徽标背景等与底色的对比度必须 **≥ 3:1**。
*   **信息冗余设计**：绝不单独依赖颜色来传达核心状态（例如：安装状态和环境支持除了颜色区分外，还必须配有图标与对应的屏幕阅读器文本说明）。

---

## 二、 色彩方案与对比度计算

### 2.1 基础与状态色彩对照表

卡片容器和文字在暗色模式下的具体取值及对比度计算结果如下：

| 界面元素 | 光色模式原色 (Light) | 暗色模式设计色 (Dark) | 对应的 Design Tokens 变量 | 对比度 (vs #494949) | WCAG AA 达标情况 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **卡片背景色** | `#C6C8CB` | **`#494949`** | *（用户指定）* | - | - |
| **悬停背景色** | `#D7DADF` | **`#555555`** | `color.background.surface.hover` | - | - |
| **聚焦背景色** | `#DDE0E3` | **`#5E5E5E`** | `color.background.surface.default` | - | - |
| **卡片主描边** | `#1E1E1F` | **`#1E1E1F`** | `border.color` | 1.83:1 (注1) | 达标 (非交互边缘) |
| **选中时描边** | `#1D4D13` | **`#6CC349`** | `color.border.success.default` | 4.11:1 | **达标 (≥ 3:1)** |
| **主标题文本** | `text-black` | **`#F2F2F2`** | `color.text.primary.default` | **8.08:1** | **超标达 AAA 级 (≥ 7:1)** |
| **作者文本** | `text-[#4A4C50]` | **`#D0D1D4`** | `color.text.secondary.default` | **5.90:1** | **达标 (≥ 4.5:1)** |
| **作者悬停高亮** | `hover:text-ore-green` | **`#8FED6B`** | `color.text.success.soft` | **6.24:1** | **达标 (≥ 4.5:1)** |
| **描述文字** | `text-[#242528]` | **`#D0D1D4`** | `color.text.secondary.default` | **5.90:1** | **达标 (≥ 4.5:1)** |
| **下载/点赞数据** | `text-[#161719]` | **`#C6C8CB`** | `color.text.muted.soft` | **5.38:1** | **达标 (≥ 4.5:1)** |
| **最后修改时间** | `text-[#231A0D]` | **`#D7CF9A`** | `color.text.warning.strong` | **5.65:1** | **达标 (≥ 4.5:1)** |

> **注1**：卡片本身通过 `FocusItem` 进行焦点流转，当获取焦点时会产生粗达 `4px` 且对比度为 **5.58:1** 的经典像素风金色焦点边框 (`#F5C542`)，因此默认的 `#1E1E1F` 描边主要起像素块分割作用，不承担焦点指示任务，符合无障碍标准。

---

### 2.2 徽标与标签色彩设计 (Badges & Tags)

卡片内部包含了多种类型的徽标与标签，为了确保暗色模式下各标签的视觉层级合理且均可读，设计方案如下：

#### 1. 已安装徽标 (Installed Tag)
*   **设计思路**：保持 Minecraft 经典的“生命值/绿宝石绿”品牌色，作为核心状态，高亮展示。
*   **色彩配置**：
    *   背景色：`#6CC349` (`color.background.success.default`)
    *   文字与图标：`#111214` (暗炭黑，对比度 **9.52:1**，满足 AAA 级)
    *   底沿 3D 阴影：`#3C8527` (深绿色，`color.background.success.hover`)

#### 2. 环境支持标签 (Client / Server Environment Tags)
*   **设计思路**：原方案采用深色 `#313233` 块与白字，在 `#494949` 的卡片底色上对比度仅有 `1.42:1`，对比度严重不足。暗色模式下，应将环境标签修改为更深的“凹陷式槽位”设计，增强物理质感和视觉识别度。
*   **色彩配置**：
    *   背景色：`#1E1E1F` (深炭黑，`color.background.surface.sunken`)
    *   文字与图标：`#F2F2F2` (乳白色，对比度 **12.3:1**，满足 AAA 级)
    *   描边：`#111214` (极深黑，`color.background.surface.deep`)
    *   顶沿 3D 高光：`rgba(255, 255, 255, 0.06)`

#### 3. 分类/特征标签 (Feature Tags)
*   **设计思路**：原软蓝色 `#90A6D6` 在暗色模式下对比度略低，微调为对比度更高的粉蓝/冰蓝色 `#9EB5E6`，配合深黑文字，创造极佳的可读性。
*   **色彩配置**：
    *   背景色：`#9EB5E6`
    *   文字：`#111214` (对比度 **7.90:1**，满足 AAA 级)
    *   底沿 3D 阴影：`#6C83B3`
    *   描边：`#1E1E1F`

#### 4. 加载器图标槽 (Loader Icon Chips)
*   **设计思路**：Loader 图标（Fabric、Forge 等）是导入的彩色静态 SVG，具有固定的深色图案。如果将其放置在暗色背景上，这些图案将无法看清。因此，**加载器图标槽必须保留亮色背景**以作衬底。
*   **色彩配置**：
    *   背景色：`#D7CF9A` (黄褐色，`color.background.neutral.default` / `library.resourceCard.loaderChipBg`)
    *   底沿 3D 阴影：`#9F955C`
    *   描边：`#262729` (确保小槽的边缘清晰度)

#### 5. 项目头像框 (Project Icon Container)
*   **设计思路**：创造一个内凹的 3D 像素框，使资源图标自然嵌入卡片中。
*   **色彩配置**：
    *   背景色：`#1E1E1F` (深凹槽背景)
    *   描边：`#1E1E1F`
    *   底沿 3D 阴影：`#111214` (内凹深黑影子)

---

## 三、 无障碍增强交互设计 (A11y UX)

1.  **焦点轮廓 (Focus Indicators)**：
    *   当组件获取焦点时，添加宽度为 `4px`、偏移量为 `0` 的 `#F5C542` 亮金色硬边框 (`outline-[4px] outline-[#F5C542]`)。
    *   该聚焦状态在暗色背景下的对比度为 **5.58:1**，符合 WCAG 2.1 规范。
2.  **多选模式状态反馈**：
    *   卡片被选中（`isSelected = true`）时，边框变为 `#6CC349`。
    *   卡片上方覆盖一层半透明的Ore绿色遮罩 `rgba(108, 195, 73, 0.12)` (`bg-[#6CC349]/12`)。在暗色模式下，该遮罩亮度适中，既能表明选中状态，又不会遮挡下方的文本内容。
    *   右上角显示的选中标签中文文本统一从非标准文案“命中”替换为规范化的 “**已选**” (`t('download.status.selected')`)。
3.  **键盘交互增强**：
    *   由于空间导航的限制，在 `FocusItem` 上增加 `Space` 键（空格键）事件的监听。在多选模式下，按空格键即可无缝切换卡片的选中状态，而无需依靠鼠标右键或触控点击。

---

## 四、 Tailwind CSS 代码实现参考

在 `src/features/Download/components/ResourceCard.tsx` 中，暗色模式的实现可以通过 Tailwind 的 `dark:` 前缀直接嵌入：

```tsx
// 1. 卡片外层容器样式重构
className={`
  group relative flex min-h-[8.5rem] w-full overflow-hidden border-[0.125rem] border-[#1E1E1F]
  text-left transition-none cursor-pointer
  ${focused
    ? 'z-20 bg-[#DDE0E3] brightness-[1.01] outline outline-[4px] outline-[#F5C542] outline-offset-0 dark:bg-[#5E5E5E]'
    : 'bg-[#C6C8CB] hover:bg-[#D7DADF] outline-none dark:bg-[#494949] dark:hover:bg-[#555555]'}
  ${isSelected ? 'border-[#1D4D13] dark:border-[#6CC349]' : ''}
`}

style={{
  contain: 'layout paint',
  boxShadow: isInstalled
    ? isDarkMode 
      ? 'inset 0 -0.25rem #3C8527, 0 0 0.5rem rgba(0,0,0,0.25)' 
      : 'inset 0 -0.25rem #1D4D13, 0 0 0.5rem rgba(0,0,0,0.12)'
    : isDarkMode
      ? 'inset 0 -0.25rem #2E2E2E, 0 0 0.5rem rgba(0,0,0,0.20)'
      : 'inset 0 -0.25rem #58585A, 0 0 0.5rem rgba(0,0,0,0.10)'
}}

// 2. 项目头像框暗色样式
className="relative flex h-[4.75rem] w-[4.75rem] shrink-0 items-center justify-center overflow-hidden border-[0.125rem] border-[#1E1E1F] bg-[#48494A] shadow-[inset_0_-0.25rem_0_#313233,inset_0.125rem_0.125rem_0_rgba(255,255,255,0.15)] dark:bg-[#1E1E1F] dark:shadow-[inset_0_-0.25rem_0_#111214,inset_0.125rem_0.125rem_0_rgba(255,255,255,0.05)]"

// 3. 主标题与作者信息
<div className="min-w-0 truncate font-minecraft text-[1.25rem] font-bold leading-[1.15] text-black dark:text-[#F2F2F2]">
  {project.title}
</div>
<button
  className="min-w-0 truncate text-[0.875rem] font-bold leading-none text-[#4A4C50] dark:text-[#D0D1D4] hover:text-ore-green dark:hover:text-[#8FED6B] hover:underline cursor-pointer transition-colors"
>
  by {authorLabel}
</button>

// 4. 环境支持标签 (Client/Server)
<div className="inline-flex h-[1.625rem] items-center gap-1 border-[0.125rem] border-[#1E1E1F] dark:border-[#111214] bg-[#313233] dark:bg-[#1E1E1F] px-[6px] text-[10px] leading-none font-minecraft uppercase tracking-[0.16em] text-white shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.12)] dark:shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.06)]">
  <Monitor className="h-[11px] w-[11px]" />
  Client
</div>

// 5. 描述文本
<p className="my-auto truncate text-[0.9375rem] leading-[1.35] text-[#242528] dark:text-[#D0D1D4]">
  {summary}
</p>

// 6. 分类/特征标签 (Feature Tags)
<span
  className="inline-flex h-[1.375rem] items-center gap-[5px] whitespace-nowrap border-[0.125rem] border-[#262729] bg-[#90A6D6] dark:bg-[#9EB5E6] px-[6px] text-[11px] font-minecraft uppercase tracking-[0.14em] text-black dark:text-[#111214] shadow-[inset_0_-0.125rem_0_#61749C] dark:shadow-[inset_0_-0.125rem_0_#6C83B3]"
>
  <Tags className="h-[0.6875rem] w-[0.6875rem]" />
  {tagName}
</span>

// 7. 底部统计数据与修改时间
<div className="flex h-full shrink-0 items-center justify-end gap-x-[0.875rem] gap-y-[0.25rem] text-[0.8125rem] font-minecraft uppercase tracking-[0.08em] text-[#161719] dark:text-[#C6C8CB]">
  <span className="flex h-full items-center gap-[0.375rem]">
    <Download className="h-[0.8125rem] w-[0.8125rem]" />
    <span>{downloads}</span>
  </span>
  ...
  <span className="flex h-full items-center gap-[0.375rem] text-[#231A0D] dark:text-[#D7CF9A]">
    <Clock3 className="h-[0.8125rem] w-[0.8125rem]" />
    <span>{timeAgo}</span>
  </span>
</div>

// 8. 选中遮罩状态
{isSelected && (
  <>
    <span className="pointer-events-none absolute inset-0 z-20 bg-[#1D4D13]/32 dark:bg-[#6CC349]/12" />
    <span className="pointer-events-none absolute right-3 top-3 z-40 inline-flex h-8 items-center gap-1.5 border-2 border-[#1D4D13] dark:border-[#6CC349] bg-[#6CC349] px-2 font-minecraft text-[0.6875rem] uppercase tracking-[0.12em] text-[#111214] shadow-[inset_0_-0.1875rem_0_#3C8527,inset_0.125rem_0.125rem_0_rgba(255,255,255,0.24)]">
      <Check size={13} strokeWidth={3} />
      已选
    </span>
  </>
)}
```
