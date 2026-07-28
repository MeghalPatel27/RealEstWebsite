# 02 — Performance Audit

**Project:** Home Nº 134  
**Audit date:** 2026-07-28  
**Method:** Full static code + asset binary inspection (MP4 `moov` walk), architecture review. No runtime profiler attached (no `node_modules` / no live Chrome session in this pass). Estimates are engineering judgments grounded in measured asset properties and hot-path code.

---

## 1. Performance thesis

The site’s jank is **not primarily “Lenis is broken”** and **not primarily “React re-renders everything.”**

The dominant cost is:

> **Scroll-linked scrubbing of a 1080p H.264 stream that has only 9 keyframes and B-frames, driven every display frame from the main thread, while six full-viewport text layers continuously update opacity/transform.**

Secondary costs: unified GSAP ticker with `lagSmoothing(0)`, dual progress timelines, full-HD decode on mobile, `preload="metadata"` causing seek-time network stalls, and context-driven Navbar re-renders at chapter boundaries.

---

## 2. Measured media facts (evidence)

From `public/videos/cinematic.mp4` moov parse:

| Metric | Value |
|--------|-------|
| Resolution | 1920×1080 |
| Duration | 15.042 s |
| Frames | 361 |
| FPS | 24 |
| Codec | H.264 (`avc1`) |
| Keyframes | **9** (samples 1,45,77,121,162,187,211,242,274) |
| Avg GOP | ~40 frames ≈ **1.67 s** |
| B-frames | **Yes** (`ctts` box) |
| Fast-start | **Yes** (moov before mdat) |
| Size / bitrate | 8.63 MB ≈ **4.6 Mbps** |

**Why this matters:** Each `video.currentTime = t` (especially reverse) forces the decoder to find the previous I-frame and decode ~0–1.7s of dependents. At ~30 reverse seeks/sec (`REVERSE_SEEK_MIN_MS = 33`), this saturates CPU/GPU decode on integrated graphics.

---

## 3. Hot path map (every frame)

`ExperienceContext` → `gsap.ticker` `onTick`:

1. `lenis.raf(time * 1000)`  
2. Lerp `filmProgress` toward scroll  
3. Maybe `ScrollTrigger.update()` if progress > 0.78  
4. `driveVideoToward(...)` (play/pause/rate/seek/style)  
5. `resolveFilmProgress`  
6. Invoke **all** `filmHandlers` (Navbar, Intro, Chapter, VideoStage controls)  
7. Maybe `setActiveSection` → React render  

`ChapterOverlay` handler alone: compute 6 raised-cosine lobes, peak suppress, write up to 6 × (opacity + visibility + transform).

---

## 4. Findings by severity

Impact scales (approximate, mid-tier Windows iGPU / modern MacBook / mid Android):

| Scale | Meaning |
|-------|---------|
| FPS impact | Expected sustained FPS delta while scrubbing |
| CPU | Main + decode related |
| GPU | Composite + video texture upload |
| Memory | Steady-state / growth while browsing |
| User impact | Felt smoothness / trust |
| Complexity | Implementation difficulty 1–5 |

---

### CRITICAL

#### C1 — Sparse keyframes + B-frames make scroll scrub decoder-bound

| | |
|--|--|
| **Why it exists** | Film was encoded for playback, not scrubbing. Only 9 sync samples; `ctts` confirms B-frames. |
| **Why it matters** | Reverse/forward seeks in `filmClock.ts` cannot be cheap. This alone can prevent Apple-level scrub feel. |
| **Evidence** | `stss keyframes=9`; `ctts size=2840`; `driveVideoToward` sets `currentTime` up to ~30Hz reverse and ~42Hz forward. |
| **Severity** | Critical |
| **CPU** | Very high (decode storms) |
| **GPU** | High (texture thrash) |
| **Memory** | Medium–high (decoder reference frames) |
| **FPS** | −15 to −40 while scrubbing on iGPU; mobile often worse |
| **User impact** | Heavy scroll, stutter, delayed picture vs wheel |
| **Complexity** | 4–5 (re-encode and/or new scrub pipeline) |
| **Recommendation** | Re-encode scrub master: short GOP (≤0.25s) or all-intra; or replace scrub with WebCodecs/canvas frame atlas / sprite sheet / dual-res pipeline. Provide 720p/540p mobile sources. |
| **Estimated benefit** | **Largest single win in the project** (often +10–25 FPS while scrubbing) |

#### C2 — Per-frame `currentTime` seeks + variable `playbackRate` on the same element

| | |
|--|--|
| **Why it exists** | Soft-play for small forward deltas; seek for catch-up/reverse (`filmClock.ts`). |
| **Why it matters** | Mixing `play()` at up to **3.5×** rate with frequent seeks fights the decoder pipeline; Safari is especially sensitive. |
| **Evidence** | `playbackRate = clamp(0.85 + delta * 4.2, 0.85, 3.5)`; forward seek gate 24ms; reverse 33ms. |
| **Severity** | Critical |
| **CPU/GPU** | High |
| **FPS** | −10 to −25 on mid devices during fast scroll |
| **User impact** | Micro-stutters, audio pitch risk if unmuted mid-scrub |
| **Complexity** | 3–4 |
| **Recommendation** | Pick one strategy per mode: (A) seek-only at display-aligned cadence with keyframe-dense media, or (B) play-only with coarser scroll quantization. Cap rate ≤1.5–2×. Never seek while `play()` is accelerating. |
| **Benefit** | Large FPS stability improvement |

#### C3 — Full 1080p decode on mobile / integrated GPU while compositing overlays

| | |
|--|--|
| **Why it exists** | Single source `SITE.videoSrc`; no responsive variants; `object-cover` full viewport. |
| **Why it matters** | Phone screens rarely need 1080p for a covered hero; bandwidth + decode watts destroy thermal headroom. |
| **Evidence** | 1920×1080 only; no `<source>` media queries; no Network Information branching. |
| **Severity** | Critical (mobile), High (laptop iGPU) |
| **CPU/GPU** | High |
| **Memory** | High (decoded frame buffers scale with resolution) |
| **FPS** | −10 to −30 on phones |
| **User impact** | Heat, battery, jank after ~30–60s browsing |
| **Complexity** | 3 |
| **Recommendation** | `cinematic-720.mp4` / `cinematic-540.mp4` (+ optional HEVC/AV1); select by `matchMedia`, DPR, `navigator.connection`. |
| **Benefit** | Major mobile + iGPU win |

#### C4 — `preload="metadata"` vs continuous scrubbing (seek stalls + memory spikes)

| | |
|--|--|
| **Why it exists** | Protect LCP/critical path (correct for first paint). |
| **Why it matters** | First scroll seeks into unbuffered regions → network + decode stalls; feels like scroll heaviness. |
| **Evidence** | `VideoStage` `preload="metadata"`; no explicit `video.load()` / Range warm-up after boot. |
| **Severity** | Critical on slower networks; High on fast LAN |
| **CPU** | Medium (main thread waits / event churn) |
| **Memory** | Grows as buffer fills during browse |
| **FPS** | Spikes of dropped frames on first scrub through each GOP |
| **User impact** | “Video behind scroll,” hitching |
| **Complexity** | 2–3 |
| **Recommendation** | After boot: idle `requestIdleCallback` / delayed `preload="auto"` or fetch Range for whole file into MSE/blob for short 15s film (8.6MB is cacheable). |
| **Benefit** | Removes early-scroll cliff |

---

### HIGH

#### H1 — GSAP ticker `lagSmoothing(0)` keeps doing full work when behind

| | |
|--|--|
| **Why** | `gsap.ticker.lagSmoothing(0)` in Provider — disables frame skipping under load. |
| **Matters** | When a seek stalls a frame, the ticker still queues full Lenis+film+overlay work → death spiral. |
| **Evidence** | `ExperienceContext.tsx` ~L200–201 |
| **CPU** | High under load |
| **FPS** | Cascading drops |
| **Complexity** | 1 |
| **Recommendation** | Restore default lag smoothing or custom “degrade scrub quality when frame time > 20ms.” |
| **Benefit** | Better recovery; fewer multi-frame stalls |

#### H2 — ChapterOverlay per-frame style writes across 6 full-viewport panels

| | |
|--|--|
| **Why** | Cinematic overlapping lobes require continuous opacity envelopes. |
| **Matters** | Up to 6 compositor layer invalidations + text raster when opacity changes; all panels stay in DOM. |
| **Evidence** | `ChapterOverlay.tsx` loop writing `opacity`/`visibility`/`transform` every film tick |
| **CPU** | Medium–high |
| **GPU** | Medium (many layers) |
| **FPS** | −5 to −12 especially with large serif glyphs |
| **Complexity** | 3 |
| **Recommendation** | Keep max 2 live panels; use one shared text slot with crossfade; or CSS variables on root; skip writes when opacity delta < 0.01. |
| **Benefit** | Meaningful overlay-path win |

#### H3 — Dual timelines (scroll vs film progress) force extra work + perceptual “lag fight”

| | |
|--|--|
| **Why** | Film lerps with catchUp 0.45–0.7; overlays use raw scroll; video uses film. |
| **Matters** | Video and text can disagree; soft-play tries to chase; more seeks. |
| **Evidence** | Provider lerp; Chapter uses `scrollProgress`; `driveVideoToward` uses film progress |
| **CPU** | Medium |
| **User impact** | Feels “heavy” / out of sync |
| **Complexity** | 3 |
| **Recommendation** | Single master progress for both text and video *or* quantize scroll to video frames explicitly. |
| **Benefit** | Feels tighter; fewer corrective seeks |

#### H4 — Experience context fan-out re-renders

| | |
|--|--|
| **Why** | One context value includes `activeSection`, `isLoaded`, `isMuted`, `lenis`, etc. |
| **Matters** | `setActiveSection` re-renders Navbar **and** every `useExperience()` consumer. |
| **Evidence** | Provider `value` useMemo deps include `activeSection`; VideoStage/Intro/Chapter/Loader/Closing all call `useExperience` |
| **CPU** | Medium spikes at boundaries |
| **FPS** | 1–3 dropped frames at section changes (plus StrictMode ×2 in dev) |
| **Complexity** | 2 |
| **Recommendation** | Split contexts (`FilmAPI` stable vs `UIState`); or store `activeSection` in ref + DOM attribute like scrolled. |
| **Benefit** | Cleaner frame budget at chapter edges |

#### H5 — `syncTouch: true` on Lenis (iOS/Android scroll contention)

| | |
|--|--|
| **Why** | Cinematic touch inertia. |
| **Matters** | Can fight native scrolling, increase main-thread scroll handling, worsen Safari jank. |
| **Evidence** | Lenis config in Provider |
| **CPU** | Medium on touch devices |
| **User impact** | Rubber-banding weirdness, heavy finger-follow |
| **Complexity** | 2 |
| **Recommendation** | Test `syncTouch: false` on iOS; reduce `touchMultiplier`; consider native scroll + CSS scroll-snap for touch only. |
| **Benefit** | High on mobile Safari |

#### H6 — Unmuted scrub + rate changes (when user unmutes)

| | |
|--|--|
| **Why** | Mute toggle exists; video still scrubbed with rate/seek. |
| **Matters** | Audio decode + pitch artifacts + more media work. |
| **Evidence** | `isMuted` default true; scrub continues while unmuted |
| **Complexity** | 2 |
| **Recommendation** | If unmuted, play linearly without scrub, or duck audio during seek mode. |
| **Benefit** | Avoids worst media-thread spikes when unmuted |

#### H7 — Repository ships / contains huge non-runtime media

| | |
|--|--|
| **Why** | `references/` + nested `RealEstWebsite-main/` |
| **Matters** | Clone/deploy mistakes; CI cache; wrong-file editing |
| **Evidence** | ~68.5 MB + ~77.5 MB trees |
| **Complexity** | 1 |
| **Recommendation** | `.dockerignore` / remove from publish artifact; delete or submodule references; remove nested duplicate. |
| **Benefit** | Ops + accidental perf (CDN upload of 65MB master) |

---

### MEDIUM

#### M1 — Micro-float / breath sine motion while idle

| | |
|--|--|
| **Evidence** | Intro + Chapter `Math.sin` transforms every other frame when not scrolling |
| **Cost** | Keeps compositor busy forever; prevents “fully idle” after settle |
| **FPS** | Usually fine; hurts thermals |
| **Recommendation** | Disable on mobile / reduced GPU; run at 10–15fps; or pure CSS animation with `prefers-reduced-motion` |

#### M2 — Gradient grade overlay + poster + video (multiple full-screen layers)

| | |
|--|--|
| **Evidence** | `.video-stage-grade`, LCP grade, video layer promotion via `translate3d` |
| **Cost** | Extra fullscreen composites every frame video updates |
| **Recommendation** | Bake grade into poster/video; or `mix-blend` carefully tested |

#### M3 — `drop-shadow` on closing logo text

| | |
|--|--|
| **Evidence** | `ClosingSection` `drop-shadow-[0_0_16px_...]` |
| **Cost** | Filter-like paint (can promote expensive layer) |
| **Recommendation** | Replace with pre-blurred asset or omit |

#### M4 — Font preload of all 4 faces on critical path

| | |
|--|--|
| **Evidence** | index.html preloads outfit 200/300/500 + cormorant 300 |
| **Cost** | Contends with poster for bandwidth; outfit-200 only used in closing |
| **Recommendation** | Preload only LCP fonts (300 serif + 300 sans); defer 200/500 |

#### M5 — Duplicate `@font-face` in HTML + CSS

| | |
|--|--|
| **Cost** | Maintenance; possible double registration noise |
| **Recommendation** | Single source |

#### M6 — `decoding="sync"` on LCP poster

| | |
|--|--|
| **Why** | Force decode for LCP |
| **Matters** | Can block main thread ~poster decode time |
| **Recommendation** | Measure; often `async` + preload still wins LCP without long tasks |

#### M7 — StrictMode double effects in development

| | |
|--|--|
| **Evidence** | `main.tsx` StrictMode; Lenis created in useEffect |
| **Matters** | Dev-only double destroy/create; skews perf perception |
| **Recommendation** | Profile production build; keep StrictMode |

#### M8 — Module-level seek throttles in `filmClock.ts`

| | |
|--|--|
| **Evidence** | `let lastReverseSeekAt` etc. at module scope |
| **Matters** | Shared mutable singleton; HMR/StrictMode oddities; not instance-safe |
| **Recommendation** | Move into per-video state object owned by Provider |

#### M9 — `react-icons` for four icons

| | |
|--|--|
| **Cost** | Dependency weight / resolve; usually tree-shaken but unnecessary |
| **Recommendation** | Inline 4 SVGs |

#### M10 — ScrollTrack creates 6 empty full-viewport sections

| | |
|--|--|
| **Cost** | Large scrollable document; Lenis must interpolate large range |
| **Recommendation** | Acceptable; alternatively one tall div with height `600svh` + data attributes (minor) |

#### M11 — Continuous `visibility` toggles on video near end

| | |
|--|--|
| **Evidence** | `driveVideoToward` sets `video.style.visibility` every call when past 0.86 |
| **Cost** | Redundant style writes |
| **Recommendation** | Latch with boolean |

#### M12 — No `content-visibility` / no offscreen containment for closing until needed

| | |
|--|--|
| **Recommendation** | `content-visibility: auto` on closing section |

---

### LOW

#### L1 — Unused exports / dead code path

`progressFromVideoTime`, `EASING`, `smoothstep`, `easeInOutCubic`, `useScrollSync` / `subscribeScroll` unused by UI.

#### L2 — `is-touch` class with no CSS

#### L3 — README claims Framer Motion / Cursor component

#### L4 — Unused `public/icons.svg`, `src/assets/*`

#### L5 — `window.__lenis` debug global

#### L6 — ClosingSection lazy import savings are small relative to video

#### L7 — Oxlint surface narrow (no perf eslint rules)

#### L8 — No `will-change` budgeting (sometimes good — avoid overuse; document policy)

#### L9 — Navbar CSS `transition` on background while scrolling threshold

#### L10 — Tabular nums / large clamp() serif titles → expensive text shaping when opacity animates

---

### NICE-TO-HAVE

| ID | Item | Benefit |
|----|------|---------|
| N1 | Service Worker cache for mp4/poster/fonts | Repeat-visit instant scrub |
| N2 | AV1/HEVC alternate sources | Bandwidth/decode on capable browsers |
| N3 | WebCodecs + OffscreenCanvas scrub | Premium desktop path |
| N4 | RUM: FPS, seek time, long tasks | Guardrails |
| N5 | `Importance` / 103 Early Hints for poster | LCP |
| N6 | Reduce chapter copy length on mobile | Less text raster |
| N7 | Prefer `svh` carefully for mobile URL bar resize (reflow) | Layout stability |
| N8 | Remove nested duplicate project | DX |
| N9 | Bundle visualizer in CI | Prevent regressions |
| N10 | Poster as AVIF/WebP | LCP bytes |

---

## 5. Ranked issue table (all severities)

| Rank | ID | Issue | Sev | FPS | CPU | GPU | Mem | User | Diff |
|-----:|----|-------|-----|-----|-----|-----|-----|------|-----:|
| 1 | C1 | Sparse keyframes + B-frames | Crit | ★★★★★ | ★★★★★ | ★★★★ | ★★★ | ★★★★★ | 5 |
| 2 | C2 | Seek + playbackRate hybrid | Crit | ★★★★ | ★★★★★ | ★★★★ | ★★ | ★★★★★ | 4 |
| 3 | C3 | 1080p-only on mobile | Crit | ★★★★ | ★★★★ | ★★★★★ | ★★★★ | ★★★★★ | 3 |
| 4 | C4 | metadata preload vs scrub | Crit | ★★★ | ★★★ | ★★ | ★★★ | ★★★★ | 2 |
| 5 | H1 | lagSmoothing(0) | High | ★★★ | ★★★★ | ★★ | ★★ | ★★★★ | 1 |
| 6 | H2 | 6-panel per-frame styles | High | ★★★ | ★★★ | ★★★ | ★★ | ★★★ | 3 |
| 7 | H3 | Dual progress timelines | High | ★★ | ★★★ | ★★ | ★ | ★★★★ | 3 |
| 8 | H5 | Lenis syncTouch | High | ★★★ | ★★★ | ★★ | ★ | ★★★★ | 2 |
| 9 | H4 | Context re-render fan-out | High | ★★ | ★★★ | ★ | ★ | ★★★ | 2 |
| 10 | H6 | Unmute while scrubbing | High | ★★ | ★★★ | ★★ | ★★ | ★★★ | 2 |
| 11 | M1 | Eternal micro-motion | Med | ★ | ★★ | ★★ | ★ | ★★ | 1 |
| 12 | M4 | Over-eager font preload | Med | ★ | ★ | ★ | ★ | ★★ (LCP) | 1 |
| 13 | M3 | drop-shadow logo | Med | ★ | ★ | ★★ | ★ | ★ | 1 |
| 14 | M2 | Extra fullscreen grades | Med | ★ | ★ | ★★ | ★★ | ★ | 2 |
| 15 | H7 | Fat references/nested tree | High* | — | — | — | — | Ops | 1 |

\*H7 is critical for shipping hygiene, not runtime FPS.

---

## 6. React rendering audit

### What is already good

- `useFilmSync` / handler refs avoid scroll React updates  
- Navbar scrolled state via DOM attribute  
- `ClosingSection` lazy  
- Manual vendor chunks  

### What still hurts

| Pattern | File | Issue |
|---------|------|-------|
| Wide context | `ExperienceContext` | Any field change rebuilds consumers |
| `setActiveSection` in ticker | Provider | React setState from RAF |
| Conditional mount of mute controls | `VideoStage` | Remount when `isLoaded` |
| No `memo` | Most components | OK at this size **if** context narrows |
| StrictMode | `main.tsx` | Dev double Lenis |

### Estimated re-render frequency (production, one full scroll)

| Event | Re-renders |
|-------|------------|
| Boot `isLoaded` | 1 × all consumers |
| Each chapter boundary | 1 × all `useExperience` consumers (~6) |
| Mute toggle | 1 × consumers |
| Per scroll frame | **0** React (handlers only) — good |

**Verdict:** React is not the primary FPS killer; section-boundary context updates are a secondary hitch.

---

## 7. Scroll / Lenis audit

| Setting | Value | Perf note |
|---------|-------|-----------|
| `lerp` | 0.22 | Smooth but extends animation frames after wheel stops |
| `wheelMultiplier` | 1.05 | Slightly amplifies |
| `MAX_WHEEL_DELTA` | 120 | Good spike control |
| `autoRaf` | false | Good — single clock |
| `syncTouch` | true | Risky on Safari |
| `virtualScroll` clamp | yes | Good |

Lenis itself is well integrated. The scroll *pipeline* cost is Lenis + film drive + overlays on one ticker.

---

## 8. Memory / GC pressure

| Source | Risk |
|--------|------|
| Video buffer growth after scrubbing whole file | Steady climb to ~full file + decoded refs |
| Object literals `FilmState` every frame | Minor GC churn (alloc per tick) |
| `opacities: number[]` alloc in ChapterOverlay each frame | Minor GC |
| Removing boot/LCP nodes | One-time |
| Module seek vars | Negligible |

**Recommendation:** Reuse a single `FilmState` object; reuse opacity array; consider MSE blob for predictable memory.

---

## 9. Network waterfall (idealized first visit)

1. HTML  
2. Parallel: poster (high), 4 fonts, JS modules  
3. Boot CSS inline (good)  
4. React hydrate/render  
5. Video metadata request  
6. On scrub: many Range requests / progressive download through GOPs  

**Lighthouse implications:** LCP can be good (poster). TBT depends on GSAP/React parse. **Main-thread scroll jank won’t show fully in Lighthouse** — needs Runtime Perf / scrolled FPS.

---

## 10. Core Web Vitals implications

| Metric | Likely status | Driver |
|--------|---------------|--------|
| LCP | Potentially Good | `#lcp-shell` poster + brand |
| INP | Risk on mobile menu / mute during load | Main thread busy with ticker+decode |
| CLS | Likely Good | Fixed layers; watch font swap |
| Smoothness (not CWV) | Poor while scrubbing | C1–C4 |

---

## 11. Browser matrix (performance)

| Browser | Primary risk |
|---------|--------------|
| Chrome | Seek storms still costly; generally best decode |
| Edge | Same as Chromium |
| Firefox | Video seek performance often weaker |
| Safari macOS | `currentTime` scrub + `playbackRate` jank |
| Safari iOS | syncTouch + 1080p + thermal throttling |
| Low-end Windows iGPU | Decode + composite saturation |

---

## 12. Accessibility performance note

`prefers-reduced-motion: reduce` short-circuits scrub drive and uses binary chapter opacity — **good**. Global CSS still forces near-zero transition durations. Reduced-motion users who still get `video.play()` (VideoStage) may see continuous decode — verify intent.

---

## 13. Summary scores (performance-only)

| Score | Value |
|-------|------:|
| Runtime scrub performance | **38 / 100** |
| Initial load / LCP architecture | **78 / 100** |
| Scroll integration quality | **72 / 100** |
| React hot-path discipline | **80 / 100** |
| Asset pipeline for cinematic scrub | **32 / 100** |
| **Overall performance** | **52 / 100** |

---

## 14. Consultant bottom line

You already applied several senior techniques (DOM sync hooks, gated ScrollTrigger, fast-start MP4, HTML LCP shell, single RAF clock). The remaining gap to Stripe/Apple feel is **media architecture for scrubbing**, then **mobile resolution**, then **overlay write amplification** — not a rewrite of Lenis.
