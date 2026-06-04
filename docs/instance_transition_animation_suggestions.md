# 实例列表至详情页面过渡动画设计建议

为了提升启动器（Launcher）的 UI 质感与响应流畅度，针对“从实例列表页面进入实例详情页面”这一典型的 Parent-Child 层级切换场景，提出以下几种契合现代桌面端与游戏启动器风格的动画转场方案指南。

---

## 1. 方案一：共享元素过渡（Shared Element Transition）🌟【最推荐】
模拟无缝的物理连续性，类似于 macOS、iOS App Store、Epic Games Launcher 的流畅过渡。

### 1.1 动画逻辑
- **被点击实例卡片**：卡片的**图标（Icon）**、**实例名称（Title）**和**卡片容器背景**作为共享元素，平滑地改变宽高、位置并放大，最终融为详情页的头部 Header。
- **列表页其他卡片**：就地淡出（Opacity `1` $\rightarrow$ `0`），并伴随轻微缩小（Scale `1` $\rightarrow$ `0.97`）。
- **详情页新增面板**：从共享元素区域下方，以带微弱位移的淡入（TranslateY `20px` $\rightarrow$ `0`，Opacity `0` $\rightarrow$ `1`）优雅显现。

### 1.2 体验效果
消除界面因完全重建而产生的生硬感，用户能建立极强的心理映射（“卡片在眼前展开成为详情”）。

---

## 2. 方案二：视差深度缩放转场（Depth & Zoom Transition）
强调 3D 纵深感与空间层级，类似于 Xbox App、Steam 大屏幕模式的游戏风体验。

### 2.1 动画逻辑
- **列表页**：整体退向屏幕深处（Scale `1` $\rightarrow$ `0.95`，模糊度 Blur `0px` $\rightarrow$ `4px`，透明度 Opacity `1` $\rightarrow$ `0`）。
- **详情页**：作为悬浮于上层的新画布，从屏幕前方或下方滑入（Scale `1.05` $\rightarrow$ `1.0`，或 TranslateY `10%` $\rightarrow$ `0`，Opacity `0` $\rightarrow$ `1`）。

### 2.2 体验效果
强调了界面的纵深（Z 轴）关系，通过前景与背景的视差模糊，强化当前详情面板的交互专注度。

---

## 3. 方案三：带阻尼的弹性右侧滑入（Elastic Slide-in from Right）
经典、易实现，且符合逻辑深度的转场方式。

### 3.1 动画逻辑
- **列表页**：向左滑出（TranslateX `0` $\rightarrow$ `-5%`，Opacity `1` $\rightarrow$ `0`）。
- **详情页**：从右侧向左滑入（TranslateX `10%` $\rightarrow$ `0`，Opacity `0` $\rightarrow$ `1`）。
- **核心：缓动曲线（Spring Easing）**：
  避免使用普通的 `ease-in-out`，推荐使用阻尼弹性缓动曲线：
  - **弹性回弹效果**：`cubic-bezier(0.34, 1.56, 0.64, 1)`（会在接近终点时产生轻微回弹）。
  - **极致平滑减速**：`cubic-bezier(0.16, 1, 0.3, 1)`（超快速切入，平滑减速结束）。

### 3.2 体验效果
符合“点击进入下一级，返回退回上一级”的物理运动直觉，运行高效轻快。

---

## 4. 方案四：卡片圆心波纹扩散转场（Radial Clip-path Transition）
适用于渐变色丰富、大面积卡片底图的沉浸式启动器 UI。

### 4.1 动画逻辑
- **详情页**：在点击发生的瞬间，以鼠标指针或卡片中心作为圆心点。
- **扩散动画**：使用 CSS 的 `clip-path` 属性进行径向遮罩扩散动画：
  ```css
  /* 初始态 */
  clip-path: circle(0% at x y);
  /* 终态 */
  clip-path: circle(120% at x y);
  transition: clip-path 300ms cubic-bezier(0.16, 1, 0.3, 1);
  ```

### 4.2 体验效果
有一种“翻开水面”的视觉冲击力，非常酷炫。

---

## 5. UI/UX 动效开发核心准则

1. **时值法则（Duration）**：
   转场动画时长应当控制在 **250ms ~ 350ms** 之间。低于 150ms 丢失细节显得刺眼；高于 400ms 会使用户产生操作延时感。
2. **错落编排（Staggered Animation）**：
   当详情页进入后，内部的元素（如版本标识、启动按钮、侧边功能栏）不要同步淡入。为每个模块依次加上 `15ms` 到 `30ms` 的错落延迟（Animation Delay），界面会在极短的时间内像多米诺骨牌一样顺次生动展开，品质感倍增。
