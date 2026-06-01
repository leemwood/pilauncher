# PiLauncher 无障碍 (Accessibility) 改进指南

> **审核标准**: WCAG 2.1 AA 级  
> **审核范围**: `src/ui/primitives/`、`src/ui/layout/`、`src/ui/navigation/`、`src/ui/components/`、`src/pages/`、`src/features/`  
> **生成日期**: 2026-06-01

---

## 目录

- [一、全局性问题](#一全局性问题)
- [二、UI 基础组件 (Primitives)](#二ui-基础组件-primitives)
- [三、布局组件 (Layout)](#三布局组件-layout)
- [四、导航组件 (Navigation)](#四导航组件-navigation)
- [五、页面级组件 (Pages)](#五页面级组件-pages)
- [六、功能模块组件 (Features)](#六功能模块组件-features)
- [七、修复优先级矩阵](#七修复优先级矩阵)
- [八、通用最佳实践清单](#八通用最佳实践清单)

---

## 一、全局性问题

### 1.1 `index.html` 缺少语言标识

**文件**: `index.html`  
**问题**: `<html lang="en">` 应改为实际使用的语言。项目默认语言为 `zh-CN`，应动态设置或设为中文。

```diff
- <html lang="en">
+ <html lang="zh-CN">
```

> **WCAG 参考**: 3.1.1 页面语言 (Level A)

### 1.2 全局禁用了右键菜单与触控操作

**文件**: `src/App.tsx` (L254-L279)  
**问题**: 
- `contextmenu` 事件被全局 `preventDefault()`，阻止了辅助技术用户访问上下文菜单
- `touchmove` 被全局阻止，影响触屏辅助设备用户

**建议**:
- 仅在特定交互区域（如 3D 皮肤查看器）禁用默认行为
- 为触控操作提供替代交互方式

### 1.3 所有交互元素 `tabIndex={-1}` 导致键盘不可达

**涉及文件**: 几乎所有 `src/ui/primitives/` 组件  
**问题**: 项目使用 `@noriginmedia/norigin-spatial-navigation` 空间导航引擎，所有按钮和控件的 `tabIndex` 被设为 `-1`，导致标准键盘用户（使用 Tab 键导航）完全无法聚焦任何元素。

**建议**:
```tsx
// 方案：根据输入模式动态设置 tabIndex
const tabIndex = inputMode === 'gamepad' ? -1 : 0;
```

或者在空间导航不可用时 fallback 到标准 Tab 导航：
```tsx
// 在 FocusItem 组件中增加降级逻辑
tabIndex={focusable && !spatialNavEnabled ? 0 : -1}
```

> **WCAG 参考**: 2.1.1 键盘可操作 (Level A)

### 1.4 缺少 Skip Navigation 链接

**问题**: 没有提供"跳过导航"的快捷链接，键盘用户必须逐一 Tab 过所有导航元素才能到达主内容。

**建议**:  
在 `App.tsx` 的 `<main>` 之前添加：
```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-ore-green focus:text-white">
  跳过导航
</a>
// ...
<main id="main-content" className="relative flex flex-1">
```

> **WCAG 参考**: 2.4.1 绕过内容块 (Level A)

### 1.5 缺少全局 `aria-live` 区域

**问题**: 页面切换、下载进度变化、实例启动状态等动态内容更新时，屏幕阅读器无法感知。

**建议**:  
在根组件添加一个全局通知区域：
```tsx
<div aria-live="polite" aria-atomic="true" className="sr-only" id="announcer">
  {/* 通过 store 注入公告文本 */}
</div>
```

> **WCAG 参考**: 4.1.3 状态消息 (Level AA)

---

## 二、UI 基础组件 (Primitives)

### 2.1 OreButton (`src/ui/primitives/OreButton.tsx`)

| 问题 | 严重度 | 说明 |
|------|--------|------|
| 缺少 `aria-label` 支持 | 🔴 高 | 当 children 为纯图标时，按钮没有可读名称 |
| `focus:outline-none` 移除焦点指示器 | 🔴 高 | 依赖自定义 `is-focused` 类，但非空间导航模式下不会触发 |
| `tabIndex` 未暴露 | 🟡 中 | 始终由 `FocusItem` 控制，标准键盘用户无法聚焦 |

**修复方案**:
```tsx
// OreButton.tsx
<button
  ref={ref}
  disabled={disabled}
  onClick={onClick}
  aria-label={props['aria-label']}   // ← 透传 aria-label
  aria-disabled={disabled}            // ← 用 aria-disabled 替代 disabled (可选)
  className={`
    ore-btn ...
    focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2
    ${focused ? 'is-focused' : ''}
    ...
  `}
  {...props}
>
  {children}
</button>
```

### 2.2 OreModal (`src/ui/primitives/OreModal.tsx`)

| 问题 | 严重度 | 说明 |
|------|--------|------|
| 缺少 `role="dialog"` | 🔴 高 | 模态框未声明为对话框角色 |
| 缺少 `aria-modal="true"` | 🔴 高 | 屏幕阅读器可能会读取遮罩层后面的内容 |
| 缺少 `aria-labelledby` | 🔴 高 | 对话框未关联标题 |
| 关闭按钮缺少 `aria-label` | 🟡 中 | 仅有 X 图标，无文字标签 |
| `backdrop` 缺少 `aria-hidden` | 🟡 中 | 遮罩层应对辅助技术隐藏 |

**修复方案**:
```tsx
// OreModal.tsx - 模态框容器
const titleId = `modal-title-${modalId}`;

<motion.div
  role="dialog"
  aria-modal="true"
  aria-labelledby={hasTitleBar ? titleId : undefined}
  aria-label={!hasTitleBar ? title : undefined}
  className={...}
>
  {hasTitleBar && (
    <h2 id={titleId} className="...">
      {title}
    </h2>
  )}
  
  {/* 关闭按钮 */}
  <button
    type="button"
    aria-label="关闭对话框"
    // ...
  >
    <X size={22} />
  </button>
</motion.div>
```

### 2.3 OreCheckbox (`src/ui/primitives/OreCheckbox.tsx`)

| 问题 | 严重度 | 说明 |
|------|--------|------|
| 使用 `<div>` 模拟，缺少 `role="checkbox"` | 🔴 高 | 辅助技术无法识别为复选框 |
| 缺少 `aria-checked` | 🔴 高 | 状态对屏幕阅读器不可见 |
| 缺少 `aria-label`/关联 label | 🟡 中 | 当没有传 `label` prop 时，控件无名称 |
| 禁用状态缺少 `aria-disabled` | 🟡 中 | 仅通过视觉样式表示 |

**修复方案**:
```tsx
<div
  ref={ref as any}
  role="checkbox"
  aria-checked={checked}
  aria-disabled={disabled}
  aria-label={!label ? ariaLabel : undefined}
  className={`ore-checkbox-wrapper ...`}
  onClick={...}
  onKeyDown={(e) => {
    if (e.key === ' ') {
      e.preventDefault();
      if (!disabled) onChange(!checked);
    }
  }}
  tabIndex={0}
>
```

### 2.4 OreSwitch (`src/ui/primitives/OreSwitch.tsx`)

| 问题 | 严重度 | 说明 |
|------|--------|------|
| 缺少 `role="switch"` | 🔴 高 | 辅助技术无法识别为开关控件 |
| 缺少 `aria-checked` | 🔴 高 | 开/关状态不可读 |
| 缺少 `aria-label` | 🟡 中 | 当没有传 `label` prop 时无名称 |
| `tabIndex={-1}` | 🟡 中 | 键盘不可达 |

**修复方案**:
```tsx
<div 
  ref={ref as any}
  role="switch"
  aria-checked={checked}
  aria-disabled={disabled}
  aria-label={label || ariaLabel}
  className={`ore-switch-wrapper ...`}
  onKeyDown={(e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!disabled) onChange(!checked);
    }
  }}
  tabIndex={0}
>
```

### 2.5 OreSlider (`src/ui/primitives/OreSlider.tsx`)

| 问题 | 严重度 | 说明 |
|------|--------|------|
| 缺少 `role="slider"` | 🔴 高 | 辅助技术无法识别为滑块 |
| 缺少 `aria-valuenow/min/max` | 🔴 高 | 当前值、最小值、最大值不可读 |
| 缺少 `aria-valuetext` | 🟡 中 | 当有 `valueFormatter` 时，应提供人类可读的值描述 |
| 缺少 `aria-label` | 🟡 中 | label 未与控件关联 |

**修复方案**:
```tsx
<div 
  ref={...}
  role="slider"
  aria-valuenow={value}
  aria-valuemin={min}
  aria-valuemax={max}
  aria-valuetext={valueFormatter ? valueFormatter(value) : String(value)}
  aria-label={label}
  aria-disabled={disabled}
  tabIndex={disabled ? -1 : 0}
  className={`ore-slider-wrapper ...`}
>
```

### 2.6 OreDropdown (`src/ui/primitives/OreDropdown.tsx`)

| 问题 | 严重度 | 说明 |
|------|--------|------|
| 触发按钮缺少 `aria-haspopup` | 🟡 中 | 未声明会弹出列表 |
| 触发按钮缺少 `aria-expanded` | 🟡 中 | 打开/关闭状态不可读 |
| 触发按钮缺少 `aria-controls` | 🟢 低 | 未关联下拉面板 |
| 下拉面板有 `role="listbox"` ✅ | — | 已正确设置 |
| 选项缺少 `role="option"` | 🟡 中 | 选项按钮应为 option 角色 |
| 选项缺少 `aria-selected` | 🟡 中 | 选中状态不可读 |
| 搜索输入框缺少 `aria-label` | 🟡 中 | 搜索框无辅助标签 |

**修复方案**:
```tsx
// 触发按钮
<button
  ref={triggerRef}
  type="button"
  disabled={disabled}
  onClick={toggleDropdown}
  aria-haspopup="listbox"
  aria-expanded={isOpen}
  aria-controls={isOpen ? panelId : undefined}
  aria-label={selectedOption?.label || placeholder}
  className={...}
>

// 选项
<button
  role="option"
  aria-selected={isSelected}
  tabIndex={-1}
>
```

### 2.7 OreSegmentedControl (`src/ui/primitives/OreSegmentedControl.tsx`)

| 问题 | 严重度 | 说明 |
|------|--------|------|
| 缺少 `role="tablist"` | 🟡 中 | 容器未声明为选项卡列表 |
| 选项缺少 `role="tab"` | 🟡 中 | 每个选项应为 tab 角色 |
| 缺少 `aria-selected` | 🟡 中 | 选中状态不可读 |
| `tabIndex={-1}` | 🟡 中 | 键盘不可达 |

**修复方案**:
```tsx
<div role="tablist" className="ore-segmented-track">
  {tabs.map((tab) => {
    const isActive = activeTab === tab.id;
    return (
      <button
        role="tab"
        aria-selected={isActive}
        aria-controls={`tabpanel-${tab.id}`}  // 可选
        tabIndex={isActive ? 0 : -1}           // roving tabindex 模式
      >
        ...
      </button>
    );
  })}
</div>
```

### 2.8 OreAccordion (`src/ui/primitives/OreAccordion.tsx`)

| 问题 | 严重度 | 说明 |
|------|--------|------|
| 按钮缺少 `aria-expanded` | 🟡 中 | 展开/折叠状态不可读 |
| 内容区域缺少 `role="region"` | 🟢 低 | 关联内容的语义不明确 |
| 按钮缺少 `aria-controls` | 🟢 低 | 未关联内容区域 |

**修复方案**:
```tsx
const contentId = useId();

<button
  aria-expanded={isExpanded}
  aria-controls={contentId}
>
  {title}
</button>

<div id={contentId} role="region" aria-labelledby={...}>
  {children}
</div>
```

### 2.9 OreProgressBar (`src/ui/primitives/OreProgressBar.tsx`)

| 问题 | 严重度 | 说明 |
|------|--------|------|
| 缺少 `role="progressbar"` | 🟡 中 | 辅助技术无法识别为进度条 |
| 缺少 `aria-valuenow/min/max` | 🟡 中 | 进度值不可读 |
| 缺少 `aria-label` | 🟡 中 | 进度条用途不明 |

**修复方案**:
```tsx
<div
  role="progressbar"
  aria-valuenow={Math.round(percent)}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label={typeof label === 'string' ? label : '进度'}
  className={...}
>
```

### 2.10 OreToast (`src/ui/primitives/OreToast.tsx`)

| 问题 | 严重度 | 说明 |
|------|--------|------|
| 容器缺少 `role="status"` 或 `aria-live` | 🟡 中 | 新 toast 出现时屏幕阅读器无感知 |
| 关闭按钮缺少 `aria-label` | 🟡 中 | 仅有 X 图标 |
| 单条 Toast 缺少 `role="alert"` | 🟡 中 | 错误类 toast 应使用 alert 角色 |

**修复方案**:
```tsx
// 容器
<div role="log" aria-live="polite" aria-label="通知区域" className="...">
  {toasts.map((t) => <ToastEntry key={t.id} item={t} />)}
</div>

// 单条 Toast
<div role={item.tone === 'error' ? 'alert' : 'status'}>
  ...
  <button onClick={dismiss} aria-label="关闭通知">
    <X size={14} />
  </button>
</div>
```

### 2.11 OreConfirmDialog (`src/ui/primitives/OreConfirmDialog.tsx`)

| 问题 | 严重度 | 说明 |
|------|--------|------|
| 继承 OreModal 的所有问题 | 🔴 高 | 缺少 `role="alertdialog"`、`aria-modal`、`aria-describedby` |
| 加载中图标缺少替代文字 | 🟡 中 | `Loader2` 旋转图标无 `aria-label` |

**修复方案**:
```tsx
// 应在 OreModal 基础上，将 role 覆盖为 "alertdialog"
<OreModal role="alertdialog" aria-describedby={descriptionId}>
  <div id={descriptionId}>
    {description}
  </div>
</OreModal>

// 加载中状态
{isConfirming && (
  <span aria-label="处理中">
    <Loader2 size={16} className="mr-2 animate-spin" aria-hidden="true" />
  </span>
)}
```

### 2.12 OreTooltip (`src/ui/primitives/OreTooltip.tsx`)

| 问题 | 严重度 | 说明 |
|------|--------|------|
| 缺少 `role="tooltip"` | 🟡 中 | 气泡未声明为工具提示角色 |
| 缺少 `aria-describedby` 关联 | 🟡 中 | 触发元素未关联工具提示内容 |
| 缺少 `id` | 🟡 中 | 工具提示需要 ID 用于 `aria-describedby` |

**修复方案**:
```tsx
const tooltipId = useId();

// 克隆触发元素时添加 aria-describedby
const trigger = React.cloneElement(children, {
  'aria-describedby': isShown ? tooltipId : undefined,
  ...
});

// 工具提示气泡
<motion.div
  id={tooltipId}
  role="tooltip"
  ...
>
```

### 2.13 OreToggleButton (`src/ui/primitives/OreToggleButton.tsx`)

| 问题 | 严重度 | 说明 |
|------|--------|------|
| 缺少 `role="radiogroup"` (容器) | 🟡 中 | 互斥选择组未声明语义 |
| 选项缺少 `role="radio"` | 🟡 中 | 选项应为 radio 角色 |
| 缺少 `aria-checked` | 🟡 中 | 选中状态不可读 |

**修复方案**:
```tsx
<div role="radiogroup" aria-label={title}>
  {options.map((option) => (
    <button
      role="radio"
      aria-checked={option.value === value}
      aria-label={typeof option.label === 'string' ? option.label : undefined}
    >
      {option.label}
    </button>
  ))}
</div>
```

### 2.14 OreInstanceCard (`src/ui/primitives/OreInstanceCard.tsx`)

| 问题 | 严重度 | 说明 |
|------|--------|------|
| 按钮缺少 `aria-label` | 🟡 中 | 整个卡片为按钮，需描述其内容 |
| 缺少 `aria-pressed`/`aria-selected` | 🟡 中 | 选中状态不可读 |
| 装饰性图标缺少 `aria-hidden` | 🟢 低 | Play 图标应隐藏 |

**修复方案**:
```tsx
<button
  aria-label={`${name} - ${mcVersion} ${loaderType}`}
  aria-pressed={isActive}
>
  {isActive && (
    <div aria-hidden="true">
      <Play size={12} fill="currentColor" />
    </div>
  )}
</button>
```

### 2.15 OreIconPicker / OrePinInput

| 组件 | 问题 | 严重度 |
|------|------|--------|
| `OreIconPicker` | 图标按钮缺少 `aria-label`，网格缺少 `role="grid"` | 🟡 中 |
| `OrePinInput` | 密码输入模式缺少 `aria-label`，各位数输入缺少关联 | 🟡 中 |

---

## 三、布局组件 (Layout)

### 3.1 TitleBar (`src/ui/layout/TitleBar.tsx`)

| 问题 | 严重度 | 说明 |
|------|--------|------|
| 最小化/最大化/关闭按钮缺少 `aria-label` | 🔴 高 | 三个窗口控制按钮仅有图标，无可读名称 |
| LB/RB 切换按钮使用 `<div>` 而非 `<button>` | 🟡 中 | 不可聚焦、无键盘事件、无语义 |
| 导航栏缺少 `role="navigation"` 或 `<nav>` | 🟡 中 | 导航区域无语义标记 |

**修复方案**:
```tsx
// 窗口控制按钮
<button type="button" onClick={handleMinimize} aria-label="最小化窗口">
  <Minus size={16} aria-hidden="true" />
</button>
<button type="button" onClick={handleMaximize} aria-label="最大化/还原窗口">
  <Square size={14} aria-hidden="true" />
</button>
<button type="button" onClick={() => void handleClose()} aria-label="关闭窗口">
  <X size={16} aria-hidden="true" />
</button>

// LB/RB 按钮改为 <button>
<button aria-label="上一个标签页" onClick={() => handleSwitchTab(-1)}>
  <GamepadButtonIcon button="LB" />
</button>

// 导航栏
<nav aria-label="主导航">
  <OreSegmentedControl ... />
</nav>
```

### 3.2 FormRow (`src/ui/layout/FormRow.tsx`)

| 问题 | 严重度 | 说明 |
|------|--------|------|
| label 未与 control 关联 | 🟡 中 | `label` 与 `control` 是独立的，无 `htmlFor`/`aria-labelledby` 关联 |
| 可点击行缺少角色 | 🟡 中 | `onClick` 行为在 `<div>` 上，无键盘响应 |

**建议**:
```tsx
// 方案 1: 用 aria-labelledby 关联
const labelId = useId();
<div id={labelId}>{label}</div>
<div aria-labelledby={labelId}>{control}</div>

// 方案 2: 可点击行改用 <button> 或添加键盘支持
{isClickable && (
  <div 
    role="button" 
    tabIndex={0} 
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
  >
```

---

## 四、导航组件 (Navigation)

### 4.1 NavItem (`src/ui/navigation/NavItem.tsx`)

| 问题 | 严重度 | 说明 |
|------|--------|------|
| 缺少 `aria-current="page"` | 🟡 中 | 当前活跃标签页未声明为当前页面 |
| 图标缺少 `aria-hidden="true"` | 🟢 低 | 装饰性图标应对辅助技术隐藏 |

**修复方案**:
```tsx
<button
  aria-current={isActive ? 'page' : undefined}
>
  <Icon size={20} aria-hidden="true" />
  <span>{label}</span>
</button>
```

### 4.2 VerticalNav (`src/ui/navigation/VerticalNav.tsx`)

| 问题 | 严重度 | 说明 |
|------|--------|------|
| 缺少 `role="navigation"` 或 `<nav>` | 🟡 中 | 侧边导航无语义标记 |
| 缺少 `aria-label` | 🟡 中 | 导航区域无描述 |

**修复方案**:
```tsx
<nav aria-label="侧边导航">
  <FocusBoundary ...>
    {items.map(item => <NavItem ... />)}
  </FocusBoundary>
</nav>
```

---

## 五、页面级组件 (Pages)

### 5.1 通用页面问题

所有页面共有的问题：

| 问题 | 涉及页面 | 严重度 |
|------|----------|--------|
| 缺少 `<h1>` 页面标题 | 所有页面 | 🔴 高 |
| `<main>` 标签缺少 `aria-label` | App.tsx | 🟡 中 |
| 页面切换无公告 | App.tsx | 🟡 中 |
| 列表/网格缺少 `role="list"`/`role="grid"` | Instances, Library, Downloads | 🟡 中 |

### 5.2 Home.tsx

| 问题 | 行号 | 说明 |
|------|------|------|
| 页面无 `<h1>` 标题 | — | 首页无页面标题 |
| 皮肤查看器 `cursor-grab` 无键盘替代 | L71 | 3D 交互无键盘操作支持 |
| 按钮文本可能仅来自 i18n | L80 | 需确保 i18n 键始终有值 |

### 5.3 Instances.tsx

| 问题 | 说明 |
|------|------|
| 实例列表/网格缺少 `role="list"` 或 `role="grid"` | 实例卡片的容器无语义 |
| 搜索/筛选区域缺少 `aria-label` | 筛选控件无描述 |
| 空状态提示缺少 `role="status"` | 无实例时的提示对屏幕阅读器不友好 |

### 5.4 Settings.tsx

| 问题 | 说明 |
|------|------|
| 分区标题使用 `<div>` 而非 `<h2>`/`<h3>` | 设置分组标题无语义 |
| 开关/滑块与文字说明未关联 | FormRow 中的 label 和 control 未通过 `aria-labelledby` 关联 |

### 5.5 News.tsx

| 问题 | 说明 |
|------|------|
| 新闻列表缺少 `<article>` 语义 | 每篇新闻应使用 `<article>` 元素 |
| 新闻图片可能缺少 `alt` 属性 | 需检查外部加载的图片是否提供替代文本 |
| Markdown 渲染内容缺少辅助属性 | `marked` 渲染的 HTML 可能缺少语义 |

### 5.6 Wardrobe.tsx

| 问题 | 说明 |
|------|------|
| 皮肤预览 3D canvas 缺少替代文本 | `<canvas>` 元素无 `aria-label` |
| 皮肤选择网格缺少 `role="grid"` | 皮肤选择列表无语义 |
| 拖拽操作缺少键盘替代 | 文件拖拽上传无键盘替代方式 |

### 5.7 LibraryPage.tsx / ResourceDownloadPage.tsx

| 问题 | 说明 |
|------|------|
| 资源列表缺少 `role="list"` 或 `role="feed"` | 资源条目容器无语义 |
| 图片 `alt` 可能不足 | 模组/资源包图标需要有意义的替代文本 |
| 分页/无限滚动无公告 | 加载更多内容时无屏幕阅读器通知 |

---

## 六、功能模块组件 (Features)

### 6.1 Download 模块

| 组件/文件 | 问题 | 严重度 |
|-----------|------|--------|
| `DownloadManager` | 下载进度缺少 `aria-live` 通知 | 🟡 中 |
| `DownloadManager` | 下载完成/失败无状态公告 | 🟡 中 |

### 6.2 GameLog 模块

| 组件/文件 | 问题 | 严重度 |
|-----------|------|--------|
| `GameLogSidebar` | 日志区域缺少 `role="log"` | 🟡 中 |
| `GameLogSidebar` | 日志区域缺少 `aria-live="polite"` | 🟡 中 |
| `LaunchingAnimation` | 动画缺少替代文本 | 🟡 中 |

### 6.3 home 模块

| 组件/文件 | 问题 | 严重度 |
|-----------|------|--------|
| `LaunchControls` | "启动游戏"按钮区域的图标按钮可能缺少 `aria-label` | 🟡 中 |
| `InstanceSelectModal` | 继承 OreModal 的所有问题 | 🔴 高 |
| `SkinViewerPlaceholder` | 3D canvas 缺少替代文本 | 🟡 中 |
| `StartupNewsModal` | 弹窗缺少无障碍属性 | 🟡 中 |

### 6.4 Settings 模块

| 组件/文件 | 问题 | 严重度 |
|-----------|------|--------|
| 设置项 | 大量 FormRow 中的 control 与 label 未关联 | 🟡 中 |
| `StartupUpdateChecker` | 更新提示弹窗继承 OreModal 问题 | 🟡 中 |

### 6.5 Setup 模块

| 组件/文件 | 问题 | 严重度 |
|-----------|------|--------|
| `SetupWizard` | 向导步骤缺少 `aria-current="step"` | 🟡 中 |
| `SetupWizard` | 步骤进度缺少 `role="progressbar"` 或描述 | 🟡 中 |

### 6.6 multiplayer / lan 模块

| 组件/文件 | 问题 | 严重度 |
|-----------|------|--------|
| 聊天区域 | 缺少 `role="log"` 和 `aria-live` | 🟡 中 |
| 玩家列表 | 缺少 `role="list"` | 🟢 低 |
| 房间创建表单 | 输入控件与标签关联不完整 | 🟡 中 |

### 6.7 runtime 模块

| 组件/文件 | 问题 | 严重度 |
|-----------|------|--------|
| `JavaGuard` | 提示弹窗继承 OreModal 问题 | 🟡 中 |
| `JavaEnvironmentChangedDialog` | 同上 | 🟡 中 |
| `RuntimeRepairDialogHost` | 同上 | 🟡 中 |

### 6.8 wardrobe 模块

| 组件/文件 | 问题 | 严重度 |
|-----------|------|--------|
| 皮肤编辑器 | 3D canvas 缺少 `aria-label` | 🟡 中 |
| 文件上传 | 拖拽区域缺少 `role="button"` 和键盘支持 | 🟡 中 |

### 6.9 DirectoryBrowserModal (`src/ui/components/DirectoryBrowserModal.tsx`)

| 问题 | 严重度 | 说明 |
|------|--------|------|
| 文件树缺少 `role="tree"` / `role="treeitem"` | 🟡 中 | 目录结构语义不明 |
| 继承 OreModal 所有问题 | 🔴 高 | 同 OreModal |

---

## 七、修复优先级矩阵

按照影响范围和严重度排序的建议修复顺序：

### 🔴 P0 - 立即修复 (影响 WCAG A 级合规)

| # | 修复项 | 影响范围 | 工作量 |
|---|--------|----------|--------|
| 1 | `OreModal` 添加 `role="dialog"` / `aria-modal` / `aria-labelledby` | 全部弹窗 (~15处) | 小 |
| 2 | `OreButton` 支持 `aria-label` 透传 + 恢复 `focus-visible` 焦点指示器 | 全部按钮 | 小 |
| 3 | `OreCheckbox` 添加 `role="checkbox"` / `aria-checked` | 设置页 (~20处) | 小 |
| 4 | `OreSwitch` 添加 `role="switch"` / `aria-checked` | 设置页 (~15处) | 小 |
| 5 | `OreSlider` 添加 `role="slider"` / `aria-valuenow/min/max` | 设置页 (~5处) | 小 |
| 6 | `TitleBar` 窗口控制按钮添加 `aria-label` | 标题栏 | 极小 |
| 7 | 解决全局 `tabIndex={-1}` 导致键盘不可达的问题 | 全局 | 中 |

### 🟡 P1 - 短期修复 (影响 WCAG AA 级合规)

| # | 修复项 | 影响范围 | 工作量 |
|---|--------|----------|--------|
| 8 | `OreDropdown` 添加 `aria-expanded` / `aria-haspopup` | 下拉选择 (~10处) | 小 |
| 9 | `OreSegmentedControl` 添加 `role="tablist"` / `role="tab"` | 导航/分类 | 小 |
| 10 | `OreProgressBar` 添加 `role="progressbar"` | 下载进度 | 极小 |
| 11 | `OreToast` 容器添加 `aria-live` | 全局通知 | 极小 |
| 12 | `OreAccordion` 添加 `aria-expanded` | 版本列表 (~3处) | 极小 |
| 13 | 每个页面添加 `<h1>` 可视/隐藏标题 | 所有页面 | 小 |
| 14 | `OreTooltip` 添加 `role="tooltip"` + `aria-describedby` | 工具提示 (~10处) | 小 |
| 15 | `NavItem` 添加 `aria-current="page"` | 导航 | 极小 |
| 16 | 添加 Skip Navigation 链接 | App.tsx | 小 |
| 17 | 添加全局 `aria-live` 公告区域 | App.tsx | 小 |

### 🟢 P2 - 中期完善

| # | 修复项 | 工作量 |
|---|--------|--------|
| 18 | `OreToggleButton` 添加 `role="radiogroup"` / `role="radio"` | 小 |
| 19 | `FormRow` label 与 control 关联 | 中 |
| 20 | 3D canvas (皮肤查看器) 添加键盘交互和替代文本 | 大 |
| 21 | 文件拖拽上传添加键盘替代 | 中 |
| 22 | `GameLogSidebar` 添加 `role="log"` | 极小 |
| 23 | `index.html` 修正 `lang` 属性 | 极小 |
| 24 | 装饰性图标统一添加 `aria-hidden="true"` | 中 |

---

## 八、通用最佳实践清单

### 8.1 组件开发规范

```tsx
// ✅ 每个交互组件应遵循的模式
interface AccessibleComponentProps {
  'aria-label'?: string;         // 外部提供的标签
  'aria-describedby'?: string;   // 关联描述文本
  'aria-disabled'?: boolean;     // 禁用状态
  id?: string;                   // 用于 label 关联
}
```

### 8.2 焦点管理清单

- [ ] 所有交互元素在非空间导航模式下 `tabIndex={0}`
- [ ] 弹窗打开时焦点移入，关闭时焦点恢复 ✅ (已实现)
- [ ] 弹窗 `Escape` 关闭 ✅ (已实现)
- [ ] `focus-visible` 指示器在所有交互元素上可见
- [ ] 焦点不会被困在不可见区域
- [ ] 复合控件使用 Roving TabIndex 模式

### 8.3 语义 HTML 清单

- [ ] 每个页面有且仅有一个 `<h1>`
- [ ] 标题层级递减不跳级 (`h1 → h2 → h3`)
- [ ] 导航使用 `<nav>` + `aria-label`
- [ ] 列表使用 `<ul>`/`<ol>` 或 `role="list"`
- [ ] 表单控件与标签关联 (`htmlFor` / `aria-labelledby`)
- [ ] 装饰性元素标记 `aria-hidden="true"`

### 8.4 动态内容清单

- [ ] 状态变化通过 `aria-live` 区域公告
- [ ] 加载状态有 `aria-busy="true"` 标记
- [ ] 错误消息通过 `role="alert"` 通知
- [ ] Toast 通知在 `aria-live` 容器中

### 8.5 颜色与对比度清单

- [ ] 文本对比度 ≥ 4.5:1 (正常文本) / 3:1 (大文本)
- [ ] 非文本交互元素对比度 ≥ 3:1
- [ ] 不仅依赖颜色传达信息 (如错误状态同时有图标)
- [ ] `ore-text-muted` 类的文本确保足够对比度

### 8.6 添加 `sr-only` 实用类

确保项目 CSS 中有屏幕阅读器专用的隐藏类：

```css
/* tailwind.config.js 中已内建 sr-only，可直接使用 */
/* 或在 index.css 中添加 */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

## 附录：有用的测试工具

| 工具 | 用途 |
|------|------|
| **axe DevTools** | Chrome 扩展，自动检测 WCAG 违规 |
| **Lighthouse** | Chrome 内建，提供无障碍评分 |
| **NVDA** (Windows) | 免费屏幕阅读器，用于测试实际朗读效果 |
| **键盘导航测试** | 断开鼠标，仅用 Tab/Enter/Escape/方向键操作全流程 |
| **Colour Contrast Checker** | 在线工具，验证文本/背景对比度 |
| **eslint-plugin-jsx-a11y** | ESLint 插件，编码时实时检测无障碍问题 |

### 建议添加 ESLint 无障碍插件

```bash
pnpm add -D eslint-plugin-jsx-a11y
```

```js
// eslint.config.js
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default [
  // ...existing config
  jsxA11y.flatConfigs.recommended,
];
```

---

> 💡 **提示**: 修复基础组件 (Primitives) 的无障碍问题具有最高的投入产出比，因为它们被全项目复用。修复 `OreModal`、`OreButton`、`OreCheckbox`、`OreSwitch`、`OreSlider` 这 5 个核心组件，即可覆盖约 70% 的无障碍问题。
