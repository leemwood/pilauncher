# Mod List 组件 UI/UX 审计报告

> **审计日期**：2026-05-26  
> **审计范围**：`src/features/InstanceDetail/components/tabs/mods/components/list/` 目录下全部 10 个组件文件  
> **分析维度**：布局、响应式、可访问性、渲染性能、视觉一致性

---

## 一、组件层级总览

```
ModList.tsx                        ← 顶层容器 + 状态编排
├── ModListOverlay.tsx             ← 同步中浮层提示
├── ModListHeader.tsx              ← 搜索 / 过滤 / 批量操作工具栏
├── ModListGridHeader.tsx          ← 表格列头（仅 standard 视图）
└── FocusBoundary                  ← Norigin 空间导航边界
    ├── FocusItem × 5 (guards)     ← 焦点守卫节点
    ├── ModListEmptyState.tsx      ← 空态 / 加载态 / 过滤空态
    └── ModAccordionVirtualList.tsx ← Virtuoso 虚拟化手风琴列表
        ├── ModListGroupHeader.tsx  ← 分类组折叠头（sticky）
        └── ModRowItem.tsx         ← React.memo 行容器 + FocusItem
            ├── ModRowView.tsx     ← 行渲染（standard / compact 双模式）
            └── ModRowActionCluster.tsx ← 行内操作按钮组
```

### 各组件职责

| 组件 | 文件大小 | 职责 |
|------|---------|------|
| `ModList` | 8.3 KB | 顶层编排：拼装 Header/GridHeader/VirtualList/EmptyState，管理主题状态 |
| `ModListHeader` | 11.3 KB | 搜索框、快速过滤标签、视图模式切换、批量操作按钮、暗色/亮色切换、元数据/更新检查按钮 |
| `ModListGridHeader` | 5.1 KB | standard 视图下的列头：全选 checkbox、名称/文件名/版本排序、操作列标签 |
| `ModAccordionVirtualList` | 6.1 KB | 使用 `react-virtuoso` 渲染虚拟化列表，处理分组 sticky 头、滚动跟随焦点 |
| `ModListGroupHeader` | 2.8 KB | 分类组折叠/展开头部：显示分类名、描述、mod 计数 |
| `ModRowItem` | 6.4 KB | 单行 mod 容器，React.memo 包装，桥接 FocusItem 与 ModRowView |
| `ModRowView` | 11.7 KB | 行渲染核心：standard（5 列 grid）和 compact（3 列 grid）两种布局 |
| `ModRowActionCluster` | 3.7 KB | 行内操作：升级按钮、启用/禁用开关、删除按钮 |
| `ModListEmptyState` | 3.4 KB | 三种空态：加载中、列表为空、过滤无结果 |
| `ModListOverlay` | 1.3 KB | 右上角浮层：显示"正在同步模组..."动画 |

---

## 二、发现问题明细

### 🔴 严重问题（Critical）

#### C-1. 标准视图 Grid 列在窄屏下溢出截断

**涉及文件**：
- `modListShared.ts` — L30-31（grid 模板定义）
- `ModRowView.tsx` — L231（standard 视图行 grid）
- `ModListGridHeader.tsx` — L93（列头 grid）

**当前代码**：
```
grid-cols-[2.875rem_minmax(10rem,1.25fr)_minmax(10rem,1.35fr)_minmax(9rem,1fr)_minmax(9rem,auto)]
```

**问题描述**：  
该 5 列 grid 的最小总宽度约 `2.875rem + 10rem + 10rem + 9rem + 9rem ≈ 40.875rem（654px）`。当 ModList 容器宽度不足（如侧边栏展开时容器 < 650px）时：
- 行内容水平溢出，部分列被裁剪不可见
- GridHeader 和 RowView 共享同一 grid 模板，但 GridHeader 只在 standard 视图下显示，compact 视图使用独立的 3 列 `grid-cols-[32px_minmax(0,1fr)_auto]`——两者 grid 不同步时列头与内容会错位

**建议方案**：
- 在容器宽度 < 700px 时自动切换到 compact 视图，或将 standard 视图的版本列和文件名列折叠到名称列下方
- 使用 CSS container query 或 ResizeObserver 做自适应降级

---

#### C-2. ModRowActionCluster 删除按钮 title 属性乱码

**涉及文件**：`ModRowActionCluster.tsx` — L91

**当前代码**：
```tsx
title="鍒犻櫎妯＄粍"  // 应为 "删除模组"
```

**问题描述**：  
鼠标悬浮时 tooltip 显示乱码 `鍒犻櫎妯＄粍`，而非预期的 `删除模组`。这是编码/转换过程中 UTF-8 → GBK 或其他编码损坏导致的。

**建议方案**：  
直接修正为 `title="删除模组"`。

---

#### C-3. Compact 视图下的隐藏操作按钮无键盘/手柄可达性

**涉及文件**：`ModRowActionCluster.tsx` — L42-44

**当前代码**：
```tsx
const secondaryActionsClass = compactActions && !isSelected
  ? 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 ...'
  : 'opacity-100';
```

**问题描述**：  
在 compact 视图下，删除按钮默认 `pointer-events-none` + `opacity-0`，仅在 `group-hover` 或 `group-focus-within` 时才显现。但：
- 可见性切换依赖鼠标 hover，对**手柄/键盘导航**不友好
- `group-focus-within` 虽然有设置，但因父元素有 `onClick stopPropagation`，实际键盘焦点可能不触发 `focus-within`
- 焦点从 `OreSwitch` 按右箭头导航到 delete 按钮时，该按钮此时 `pointer-events-none`，可能被 Norigin 跳过

**建议方案**：
- 使用 `[data-focused="true"]` 或 focus 状态 class 代替 hover 显隐
- 让 Norigin focus 管理器在焦点导航时忽略 `opacity` / `pointer-events`

---

### 🟡 中等问题（Moderate）

#### M-1. ModListHeader 工具栏在窄宽度下布局溢出

**涉及文件**：`ModListHeader.tsx` — L121-174（第一行）、L176-299（第二行）

**问题描述**：
- 第一行（搜索 + 视图切换）使用 `flex-wrap`，换行时搜索框和视图 segment 各占一行，视觉上"断裂"
- 第二行（过滤标签 + 操作按钮）也 `flex-wrap`，当 `isBatchMode=true` 时最多同时显示 **8 个按钮**（亮色/暗色、启用、禁用、删除、退出多选、元数据、检查更新），极易溢出并换行
- 批量操作容器 `<div>` 本身有独立的 `border` 和 `bg`，换行时边框和背景也被换行分裂，视觉上混乱

**建议方案**：
- 将批量操作按钮组改为固定在工具栏底部的独立行，或使用 `overflow-x-auto` + 横向滚动
- 考虑将低频操作（元数据、检查更新、暗色切换）收纳到 dropdown menu 中

---

#### M-2. ModListGridHeader 全选按钮区域过窄且无 sticky 定位

**涉及文件**：`ModListGridHeader.tsx` — L93-109

**问题描述**：
- 全选按钮 (`Square` / `CheckSquare`) 放在 grid 第一列，列宽仅 `2.875rem`（46px），按钮 `40px × 40px`，边距极窄
- 选中计数 badge 也挤在同一个 46px 列中，当数量 ≥ 100 时会溢出
- 整个 GridHeader **没有设置 `position: sticky`**，在长列表滚动时不可见。反而 GroupHeader 使用了 sticky，两者行为不一致

**建议方案**：
- GridHeader 增加 `position: sticky; top: 0; z-index: 50` 固定在列表顶部
- 选中计数移到名称列或独立到工具栏中

---

#### M-3. Compact 视图缺少行内 Checkbox

**涉及文件**：
- `ModRowItem.tsx` — L89-110（leading prop 渲染 checkbox）
- `ModRowView.tsx` — L293-341（compact 布局）

**问题描述**：
- **standard 视图**：checkbox 通过 `leading` prop 渲染在 grid 第一列（独立列）
- **compact 视图**：`leading` prop 未被使用！compact 的 3 列 grid `grid-cols-[32px_minmax(0,1fr)_auto]` 第一列是图标，**完全没有 checkbox 的位置**
- 在 compact 视图下，用户**无法通过点击 checkbox 选择/取消选择单个 mod**，只能通过 GridHeader 的全选按钮操作

**建议方案**：
- compact 视图中增加 checkbox 列，或允许点击行触发选择（当前点击行是 `onRowClick → onSelectMod` 而非 `onToggleSelection`）

---

#### M-4. ModListOverlay 不跟随列表主题切换

**涉及文件**：`ModListOverlay.tsx` — L30-34

**当前代码**：
```tsx
style={{
  backgroundColor: 'var(--ore-downloadDetail-surface)',
  borderColor: 'var(--ore-downloadDetail-divider)',
  boxShadow: 'var(--ore-downloadDetail-sectionShadow)'
}}
```

**问题描述**：  
Overlay 使用 `var(--ore-downloadDetail-*)` CSS 变量，这是全局暗色主题的变量。当 ModList 切换到亮色主题 (`data-mod-list-theme="light"`) 时，overlay 仍然是暗色风格，与列表的亮色背景形成视觉撕裂。

**建议方案**：  
参考其他组件中 `isLightTheme` 的处理方式（如 `ModListEmptyState`），为 overlay 也做主题适配，接收 `listTheme` prop。

---

#### M-5. ModListEmptyState 三种状态的面板样式不统一

**涉及文件**：`ModListEmptyState.tsx` — L12-88

**问题描述**：

| 状态 | 边框 | 圆角 | 颜色来源 |
|------|------|------|---------|
| `loading` | `border-[0.125rem]` (2px) | 无 | CSS 变量 `--ore-downloadDetail-*` |
| `empty` | `border-[0.125rem]` (2px) | `rounded-sm` | CSS 变量 `--ore-downloadDetail-*` |
| `filtered` | `border` (1px) | 无 | 硬编码 `#B8BBC2`、`white/10` 等 |

三个状态的面板尺寸、圆角、边框粗细和颜色来源各不相同，视觉上不连贯。

**建议方案**：  
统一三个状态的面板基础样式（边框粗细、圆角、颜色 token），仅通过图标、文案和动画做区分。

---

### 🟢 建议改善（Minor / Enhancement）

#### E-1. ModRowView 颜色硬编码过多，缺少语义化 token

**涉及文件**：`ModRowView.tsx` — L186-226

**问题描述**：  
一个 `ModRowView` 组件内部通过三元嵌套定义了约 **20+ 个硬编码颜色值**（如 `#2B3346`、`#7AA2FF`、`#222734`、`#DDE0E3`）。类似问题也存在于 `ModListGridHeader`、`ModListGroupHeader`、`ModListHeader` 中。

影响：
- 任何颜色变更需要逐一在多个文件中修改
- 暗色/亮色主题的颜色映射散落在 JSX 中，无法统一管理
- 同一语义颜色在不同组件中使用了相近但不完全一致的值（如 `#8B93A7` vs `#8D96A8`）

**建议方案**：  
将颜色抽取为 CSS 变量或 JS token 对象（如 `theme.row.active.bg`），挂在 `[data-mod-list-theme]` 作用域下统一定义。

---

#### E-2. ModAccordionVirtualList 的 Item 组件在每次渲染时创建新引用

**涉及文件**：`ModAccordionVirtualList.tsx` — L156-183

**当前代码**：
```tsx
components={{
  Scroller: ModListOverlayScroller,
  Item: ({ children, item, style, ...props }) => {
    // 每次渲染生成一个新的匿名函数组件
  }
}}
```

**问题描述**：  
`Item` 是一个匿名内联组件，每次 `ModAccordionVirtualList` 重新渲染时都会生成新的函数引用，导致 Virtuoso 认为 Item 组件类型变了，可能触发所有可见行的**完整卸载 + 重新挂载**。对于 100+ mod 的列表会出现可感知的卡顿。

**建议方案**：  
将 `Item` 提取为独立的 `React.memo` 命名组件，或使用 `useMemo` 稳定引用。

---

#### E-3. GroupHeader 的 sticky 定位与 FocusBoundary padding 冲突

**涉及文件**：
- `ModAccordionVirtualList.tsx` — L160-167（sticky 定位）
- `ModList.tsx` — L164（`FocusBoundary` 的 `className="pt-[2px] px-2"`）

**问题描述**：  
`FocusBoundary` 容器有 `pt-[2px]` padding，而 GroupHeader sticky 的 `top: 0` 会让 sticky 头部抵到 FocusBoundary 的内边距上，导致 sticky 位置偏移 2px。视觉上 GroupHeader 会"悬浮"在 padding 区域内而非紧贴容器顶部。

---

#### E-4. 行内 Checkbox 是自实现 div 而非语义化表单元素

**涉及文件**：`ModRowItem.tsx` — L91-109

**问题描述**：  
行内 checkbox 是一个手工实现的 `<div>` + inline SVG，没有使用 `<input type="checkbox">` 或项目中的 `OreCheckbox`/`OreSwitch` 原语。缺失：
- `aria-checked`、`role="checkbox"` 等语义标记
- 键盘 Space 键切换支持
- `:focus-visible` 焦点环

---

#### E-5. 视图模式和快速过滤按钮不参与 Norigin 空间导航

**涉及文件**：`ModListHeader.tsx` — L160-171（视图切换）、L182-196（过滤标签）

**问题描述**：  
视图模式切换（标准/紧凑）和快速过滤按钮使用 `tabIndex={-1}` 的原生 `<button>`，不被 `FocusItem` 包裹，不参与 Norigin 空间导航。用户使用手柄时**无法操作这些按钮**。只有 `OreButton` 和 `OreInput` 通过 `FocusItem` 包装后可被导航到。

**建议方案**：  
将过滤标签和视图切换 segment 也用 `FocusItem` 包裹，或改用 `OreToggleButton`。

---

#### E-6. VersionBadge 的 size prop 未实际区分文字大小

**涉及文件**：`ModRowView.tsx` — L50-52

**当前代码**：
```tsx
const sizeClass = size === 'md'
  ? 'px-2 py-1 text-[1.0625rem]'
  : 'px-1.5 py-0.5 text-[1.0625rem]';
```

**问题描述**：  
`sm` 和 `md` 两个尺寸都使用了相同的 `text-[1.0625rem]`（17px），size prop 在文字大小上没有实际区分效果，仅在 padding 上有微小差异。

---

## 三、问题汇总矩阵

| # | 组件 | 严重级别 | 分类 | 概要 |
|---|------|---------|------|------|
| C-1 | ModRowView / GridHeader / modListShared | 🔴 Critical | 布局 | 5 列 grid 窄屏溢出截断 |
| C-2 | ModRowActionCluster | 🔴 Critical | 文本 | 删除按钮 title 乱码 |
| C-3 | ModRowActionCluster | 🔴 Critical | 可访问性 | Compact 下删除按钮键盘不可达 |
| M-1 | ModListHeader | 🟡 Moderate | 布局 | 工具栏批量按钮换行溢出 |
| M-2 | ModListGridHeader | 🟡 Moderate | 布局/UX | 全选按钮列太窄、无 sticky |
| M-3 | ModRowItem / ModRowView | 🟡 Moderate | 功能 | Compact 视图缺少 checkbox |
| M-4 | ModListOverlay | 🟡 Moderate | 主题 | 不跟随亮色主题 |
| M-5 | ModListEmptyState | 🟡 Moderate | 一致性 | 三种状态面板样式不统一 |
| E-1 | ModRowView 等多文件 | 🟢 Minor | 维护性 | 20+ 颜色硬编码无语义 token |
| E-2 | ModAccordionVirtualList | 🟢 Minor | 性能 | 内联 Item 组件每次生成新引用 |
| E-3 | ModAccordionVirtualList / ModList | 🟢 Minor | 布局 | Sticky 与 padding 冲突 2px |
| E-4 | ModRowItem | 🟢 Minor | 可访问性 | Checkbox 无语义标记 |
| E-5 | ModListHeader | 🟢 Minor | 可访问性 | 过滤/视图按钮不参与空间导航 |
| E-6 | ModRowView | 🟢 Minor | 视觉 | VersionBadge size 未实际区分 |

---

## 四、建议优先级排序

### 第一阶段：立即修复（预计 1-2 小时）

| 问题 | 改动量 | 说明 |
|------|-------|------|
| C-2 | 1 行 | 修正 `title` 属性字符串编码 |
| C-3 | ~10 行 | 修改 `secondaryActionsClass` 条件，让 focus 状态也触发显示 |

### 第二阶段：短期改善（预计 3-5 小时）

| 问题 | 改动量 | 说明 |
|------|-------|------|
| C-1 | ~30 行 | 增加 container query / ResizeObserver 自动切换视图模式 |
| M-2 | ~5 行 | GridHeader 增加 `sticky` + `z-index` |
| M-3 | ~20 行 | Compact grid 模板增加 checkbox 列 |
| M-4 | ~15 行 | ModListOverlay 接收 `listTheme` prop 并适配 |

### 第三阶段：中期重构（预计 1-2 天）

| 问题 | 改动量 | 说明 |
|------|-------|------|
| E-1 | ~100 行 | 抽取 CSS 变量，统一颜色 token |
| M-1 | ~40 行 | Header 按钮布局重构，引入 dropdown menu |
| M-5 | ~20 行 | EmptyState 统一面板基础样式 |

### 第四阶段：长期架构优化（跟随后续迭代）

| 问题 | 说明 |
|------|------|
| E-2 | 提取 Virtuoso Item 为命名组件 |
| E-3 | 修正 sticky offset |
| E-4 | Checkbox 改用语义化组件 |
| E-5 | 过滤/视图按钮接入空间导航 |
| E-6 | VersionBadge 尺寸区分 |
