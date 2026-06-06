# 3D Skin Viewer Performance Recommendations

## Background

The 3D skin preview is implemented around `SkinEngine`, a shared Three.js renderer used by the Home, Wardrobe, and donor skin preview flows. The current behavior can look like frame drops in two different cases:

- Idle preview is intentionally capped at 30 FPS.
- Interactive preview or page transitions can miss frames because rendering, animation, layout, and resource work overlap.

This document lists recommended changes in priority order. It is intentionally scoped to suggestions only and does not include code changes.

## Current Hot Spots

### 1. Idle FPS cap is expected behavior

`useSkinViewer` creates the engine with:

```ts
SkinEngine.getOrCreate({ enableRandomIdle: true, targetFps: 60, idleFps: 30 })
```

`SkinEngine.renderFrame` switches between `targetFps` and `idleFps` based on `interactionBoostUntil`. This means the preview normally renders at 30 FPS and only boosts to 60 FPS for a short period after interaction.

Recommendation:

- Treat 30 FPS idle as a product decision, not a bug.
- If smoothness matters more than battery/GPU usage, raise idle FPS to 45 or 60.
- If resource usage matters more, keep 30 FPS but avoid describing it as "dropped frames" in diagnostics.

Risk:

- Raising idle FPS increases GPU usage while the Home or Wardrobe page is open.

### 2. Damage flash shader sync traverses the model every rendered frame

`SkinEngine.renderFrame` calls `syncDamageFlashShader(this.playerModel, this.damageFlashIntensity)` every rendered frame. That helper traverses the full model tree and visits materials even when `damageFlashIntensity` is zero.

Recommendation:

- Install the damage flash shader once when the model is loaded.
- Cache the affected materials or shader uniforms in `SkinEngine`.
- Per frame, update only cached uniform values.
- Skip the update entirely when intensity is unchanged and zero.

Expected impact:

- Reduces steady CPU work on every frame.
- Helps both idle and interactive rendering.

Risk:

- Need to clear cached material references when the model is replaced or disposed.

### 3. Pixel ratio and antialiasing are expensive on high DPI screens

The renderer uses:

```ts
antialias: true
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
```

On a high DPI display, this can make the WebGL backbuffer up to 4x the CSS pixel area. Combined with antialiasing and alpha-to-coverage, small UI previews can still become GPU-heavy.

Recommendation:

- Consider a skin preview quality setting:
  - Performance: pixel ratio 1, antialias off.
  - Balanced: pixel ratio capped around 1.25 or 1.5.
  - Quality: current behavior.
- Alternatively, use a fixed cap such as `1.5` instead of `2`.

Expected impact:

- Reduces GPU fill cost and improves stability on integrated GPUs.

Risk:

- Skin edges may look slightly less smooth at lower quality.

### 4. Render loop keeps scheduling RAF even when throttled

The render loop schedules `requestAnimationFrame` every browser frame, then returns early when the target frame interval has not elapsed.

Recommendation:

- This is acceptable, but measure whether the early-return RAF overhead matters in Tauri WebView.
- If needed, switch to a hybrid strategy using RAF only near the intended render time, or keep RAF but reduce per-frame checks to the absolute minimum.

Expected impact:

- Usually minor compared with shader traversal and pixel ratio.

Risk:

- Timing logic can become more complex and less smooth if changed carelessly.

### 5. `controls.update()` runs even though controls are disabled

OrbitControls rotation, zoom, and pan are disabled. `controls.update()` still runs during render frames.

Recommendation:

- Verify whether `controls.update()` is needed after initialization and camera target updates.
- If not needed per frame, remove it from the hot render path and call it only after camera/target changes.

Expected impact:

- Small CPU reduction per frame.

Risk:

- Camera behavior may break if later code enables damping or interactive controls.

### 6. Page transitions and news loading can compete with WebGL

`App.tsx` wraps page changes in Motion animations. News cards also include image loading and skeleton animations. When returning to Home, the 3D preview resumes while React layout, Motion animation, image decode, and WebGL rendering may happen together.

Recommendation:

- Delay `engine.startRenderLoop()` until the Home page entrance animation is mostly finished.
- Or start with one static render, then begin the loop after a short delay.
- Reduce expensive infinite loading animations on pages with many cards.

Expected impact:

- Improves perceived smoothness during tab switches.

Risk:

- Skin animation starts slightly later after page entry.

### 7. Donor skin modal shares the same engine singleton

The donor skin modal uses `SkinEngine.getOrCreate()` and appends the shared canvas into its own container. It also rotates the model with a 16 ms interval.

Recommendation:

- Avoid sharing the main preview engine with modal previews.
- Either create a separate lightweight preview engine for modals or add explicit ownership/state management to `SkinEngine`.
- Replace the modal `setInterval(..., 16)` rotation with the engine render loop or RAF-based logic.

Expected impact:

- Prevents canvas ownership, size, skin, rotation, and render-loop state from leaking between Home, Wardrobe, and modal previews.

Risk:

- A separate engine increases memory usage while the modal is open.

### 8. Wardrobe right-stick polling runs continuously

Wardrobe viewer control polls gamepad state using `requestAnimationFrame` while mounted.

Recommendation:

- Run gamepad polling only when the Wardrobe tab is visible.
- If no gamepad is connected, poll less frequently or pause until `gamepadconnected`.

Expected impact:

- Reduces main-thread work on Wardrobe.

Risk:

- Gamepad connection detection needs to be handled carefully.

## Suggested Implementation Order

1. Cache damage flash material uniforms and remove full model traversal from every frame.
2. Add a renderer quality cap or lower the default pixel ratio cap from 2 to 1.5.
3. Remove unnecessary per-frame `controls.update()` if testing confirms it is safe.
4. Separate modal preview ownership from the main `SkinEngine` singleton.
5. Make Wardrobe gamepad polling visibility-aware.
6. Tune idle FPS only after the above changes are measured.

## Measurement Plan

Before and after each change, measure:

- Home idle preview FPS and CPU/GPU usage.
- Home preview during drag/click interaction.
- Home -> News -> Home transition smoothness.
- Wardrobe preview with and without gamepad connected.
- Donor skin modal open/close behavior.

Useful manual checks:

- Confirm idle FPS is expected 30/45/60 depending on chosen setting.
- Confirm no canvas disappears after switching Home, Wardrobe, Settings modal, and back.
- Confirm skin/cape/model changes still update correctly.
- Confirm damage flash still appears on repeated clicks.

## Recommended Target

For a launcher UI, a practical target is:

- Home idle: stable 30 FPS or 45 FPS with low GPU usage.
- User interaction: stable 60 FPS on mid-range hardware.
- Page transitions: no visible hitch longer than one frame after returning to Home.
- Low-end hardware: quality can degrade gracefully by reducing pixel ratio before animation quality is reduced.
