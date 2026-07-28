# 05 — Final Summary

**Project:** Home Nº 134 — cinematic scroll film experience  
**Audit date:** 2026-07-28  
**Mode:** Analysis only (no code changes)  
**Companion docs:** `01_PROJECT_ARCHITECTURE.md` · `02_PERFORMANCE_AUDIT.md` · `03_RENDERING_ANALYSIS.md` · `04_OPTIMIZATION_ROADMAP.md`

---

## Executive summary

Home Nº 134 is a **small, coherent, senior-minded React/Vite SPA** that already uses several flagship patterns: HTML-first LCP shell, single GSAP ticker driving Lenis (`autoRaf: false`), imperative `useFilmSync` overlays (avoiding per-frame React), gated ScrollTrigger, fast-start H.264, and compositor-oriented transforms.

It still **does not feel** like Apple / Stripe / Linear / Vercel on mid hardware because the **film scrubbing substrate is wrong for continuous seeking**: a **15s 1080p24** stream with **only 9 keyframes** and **B-frames**, driven with **hybrid play-rate + high-frequency `currentTime` seeks**, while **six full-viewport text layers** update every tick. Lenis is not the root cause; **decode + composite amplification** is.

**Verdict:** Architecture is ~70% of a premium experience; **runtime media/rendering is ~40–55%**. Closing the gap is mostly **encode + drive policy + overlay layer budget**, not a framework rewrite.

---

## Scorecard (0–100)

| Score | Value | One-line rationale |
|-------|------:|--------------------|
| Overall architecture | **68** | Clear film-clock design; god-context + duplicate tree hurt |
| Performance | **52** | Scrub path decoder-bound; load/LCP stronger than runtime |
| Rendering | **54** | Good transform/opacity hygiene; layer + video cost high |
| Accessibility | **61** | Reduced motion + landmarks OK; overlays/ARIA incomplete |
| SEO | **48** | Title/description only; thin crawlable body; no OG |
| Code quality | **74** | Typed, focused modules, comments show intent |
| Maintainability | **72** | ~1.3k LOC; README/nested fork noise |
| Scalability | **55** | Great for one film; weak multi-page/asset system |
| Developer experience | **66** | Vite/Tailwind nice; duplicate project + missing baselines |
| Production readiness | **50** | Not ship-smooth on mid devices; deploy hygiene risks |
| **Composite (equal weight)** | **60** | Solid prototype → needs media production pass |

---

## Top 50 issues

| # | Issue | Sev |
|--:|-------|-----|
| 1 | Only 9 keyframes in scrub MP4 | Critical |
| 2 | B-frames (`ctts`) inflate seek decode | Critical |
| 3 | Hybrid `playbackRate` (≤3.5×) + frequent seeks | Critical |
| 4 | Single 1080p source for all devices | Critical |
| 5 | `preload="metadata"` vs continuous scrub | Critical |
| 6 | Reverse seeks ~30Hz into long GOPs | Critical |
| 7 | Forward seeks gated at 24ms | Critical |
| 8 | `lagSmoothing(0)` prevents ticker recovery | High |
| 9 | Six full-viewport chapter panels updated per frame | High |
| 10 | Dual progress (scroll vs film lerp) | High |
| 11 | Overlays lock to scroll; video to film | High |
| 12 | Lenis `syncTouch: true` on mobile Safari | High |
| 13 | Context fan-out on `activeSection` | High |
| 14 | `setActiveSection` from RAF → React | High |
| 15 | Unmute while scrubbing media | High |
| 16 | Nested duplicate project (~77MB) | High |
| 17 | `references/` 65MB master in tree | High |
| 18 | Eternal sine float/breath when idle | Medium |
| 19 | Extra fullscreen gradient grade layer | Medium |
| 20 | Closing logo `drop-shadow` | Medium |
| 21 | All 4 fonts preloaded | Medium |
| 22 | Duplicate `@font-face` HTML+CSS | Medium |
| 23 | Poster `decoding="sync"` main-thread risk | Medium |
| 24 | Module-global seek throttle state | Medium |
| 25 | Per-frame `FilmState` / opacities allocations | Medium |
| 26 | Redundant video visibility writes | Medium |
| 27 | `is-touch` class unused | Low |
| 28 | `useScrollSync` / subscribeScroll unused | Low |
| 29 | Dead exports (`EASING`, `progressFromVideoTime`, etc.) | Low |
| 30 | `react-icons` for 4 icons | Low |
| 31 | Unused `src/assets` Vite starters | Low |
| 32 | Unused `public/icons.svg` | Low |
| 33 | README lists Framer Motion (absent) | Low |
| 34 | README lists Cursor component (absent) | Low |
| 35 | `window.__lenis` debug global | Low |
| 36 | Lazy ClosingSection marginal vs video cost | Low |
| 37 | Large serif opacity fades (paint) | Medium |
| 38 | Vertical `writing-mode` labels | Low |
| 39 | Mobile `100svh` resize churn | Medium |
| 40 | No adaptive degrade on long frames | High |
| 41 | No keyframe-aware seek snapping | High |
| 42 | No post-boot full buffer strategy | Critical |
| 43 | No AV1/HEVC alternatives | Nice |
| 44 | No Service Worker / long-cache plan | Nice |
| 45 | No OG/Twitter meta | Low |
| 46 | Chapter root `aria-hidden` hides content from AT | Medium |
| 47 | No skip link / reduced-data mode | Medium |
| 48 | StrictMode double Lenis in dev skews feel | Low |
| 49 | No CI bundle/FPS budgets | Medium |
| 50 | Wide Experience context as god-object | High |

---

## Top 25 quick wins

*(hours-ish, high leverage, low design risk)*

1. Re-encode with short GOP / no B-frames (even 1080-only)  
2. Add 720p (+540p) file and pick by viewport  
3. Restore lag smoothing / adaptive seek throttle  
4. Cap `playbackRate` ≤ 2×  
5. After boot, switch to `preload="auto"` or blob buffer  
6. Skip overlay style writes below opacity epsilon  
7. Drive nav active state via DOM attribute (no React)  
8. Disable breath/float on `pointer: coarse`  
9. Latch video visibility boolean  
10. A/B disable `syncTouch` on iOS  
11. Trim font preloads to 2 faces  
12. Remove `drop-shadow` on closing logo  
13. Delete unused assets / fix README  
14. Ignore nested duplicate + references in deploy  
15. Reuse FilmState object to cut GC  
16. Inline SVG icons; drop `react-icons`  
17. Bake grade into poster/video; drop grade div  
18. Seek only when `readyState` adequate  
19. Pause micro-motion whenever scrolling gap ≠ 0  
20. `content-visibility: auto` on closing section  
21. Deduplicate font-face definitions  
22. Poster WebP/AVIF  
23. Split UI context from film API  
24. Remove dead exports / unused scroll bus  
25. Add simple FPS overlay for QA (dev-only)

---

## Top 25 biggest performance wins

*(ordered by expected FPS / smoothness impact)*

1. **Keyframe-dense / all-intra scrub encode**  
2. **Resolution ladder (especially mobile 540/720)**  
3. **Seek policy rewrite (no play↔seek fighting)**  
4. **Full buffer after boot (eliminate Range stalls)**  
5. **Collapse to ≤2 chapter text layers**  
6. **Adaptive ticker degrade under frame budget**  
7. **Unify scroll/film master progress**  
8. **Disable `syncTouch` / touch-specific path**  
9. **Remove perpetual float/breath on mobile**  
10. **Cap playbackRate + keyframe-aware seeks**  
11. **DOM section indicator (kill React on boundaries)**  
12. **Opacity write latching**  
13. **Bake/remove grade overlay**  
14. **HEVC/AV1 where beneficial**  
15. **Defer non-critical fonts**  
16. **Remove drop-shadow filter**  
17. **Idle-only compositing when settled**  
18. **Reduced-data static poster mode**  
19. **Service Worker cache for mp4**  
20. **WebCodecs/canvas path (advanced)**  
21. **Frame-sequence fallback for weak GPUs**  
22. **Fewer fullscreen fixed layers overall**  
23. **Shorter Lenis inertia on low-end**  
24. **Avoid unmuted scrub**  
25. **Prevent deploy of 65MB reference master**

---

## Top 10 architectural concerns

1. Video scrub architecture vs codec reality mismatch  
2. `ExperienceProvider` as god-object (scroll+film+UI)  
3. Dual timelines without a single documented master clock for all UI  
4. Nested divergent project copy in repo  
5. No device/network tiering in asset graph  
6. README / dependency fiction (Framer Motion)  
7. Scroll height model tied to empty sections (fine) but no content strategy for SEO  
8. Module singleton state in `filmClock`  
9. Mixing GSAP timelines, GSAP ticker, Lenis, CSS transitions, media clock  
10. Limited path to multi-property / multi-film expansion  

---

## Top 10 rendering concerns

1. 1080p H.264 seek storms with 9 I-frames  
2. Too many promoted fullscreen layers over video  
3. Large type opacity crossfades (paint)  
4. Soft-play vs overlay desync (temporal)  
5. Permanent `translate3d` video layer memory  
6. Gradient grade extra composite  
7. `drop-shadow` at closing  
8. Mobile thermal throttling cascade  
9. Safari `currentTime` / `playbackRate` sensitivity  
10. Idle sine transforms preventing GPU rest  

---

## Top 10 React concerns

1. Context value churn on `activeSection`  
2. RAF → `setState` for section  
3. All cinematic consumers subscribe to wide context  
4. StrictMode double-mount effects (dev)  
5. Conditional remount of mute controls on load  
6. Unused hooks still exported (`useScrollSync`)  
7. Lazy boundary only around low-cost ClosingSection  
8. No Profiler budgets in CI  
9. `setLoaded` / mute cause full-tree consumers to render  
10. Over-reliance on one provider for future features  

---

## Top 10 animation concerns

1. Lenis lerp + film lerp double-smoothing  
2. Soft-play rate oscillation  
3. Chapter raised-cosine ×6 continuous  
4. Breath/float competing with scroll cinema  
5. CSS transitions vs ticker clocks  
6. Boot/LCP/Intro handoff triple choreography  
7. ScrollTrigger + Lenis (mitigated but present)  
8. Global reduced-motion CSS nuke vs GSAP  
9. Programmatic `scrollTo` 2.05s durations long on low-end  
10. Mobile menu transform delays during scroll lock  

---

## Top 10 asset concerns

1. Scrub MP4 GOP/B-frame structure  
2. No resolution variants  
3. 8.6MB still non-trivial on cellular without warm buffer  
4. 65MB reference master living beside public assets  
5. Poster only JPEG ~148KB 1920×1080 (could be lighter modern format)  
6. Four font files all preloaded  
7. Dead Vite assets & icons sprite  
8. Nested full project duplicate  
9. No hashed long-cache strategy documented for video  
10. No alternate codec packaging  

---

## Top 10 mobile concerns

1. 1080p decode on phone GPUs  
2. `syncTouch` contention  
3. Thermal throttling after sustained scrub  
4. Safari seek performance  
5. `100svh` URL-bar resize layout  
6. Touch inertia vs film catch-up  
7. Large serif paint on retina  
8. Bandwidth for first full scrub  
9. Autoplay/mute policy edge cases when unmuting  
10. Eternal micro-motion battery cost  

---

## Top 10 browser compatibility concerns

1. Safari scrub/`playbackRate` jank  
2. iOS low-power mode decode limits  
3. Firefox seek smoothness weaker  
4. HEVC/AV1 capability variance (if added later)  
5. `preload` / Range request behavior differences  
6. `svh` support older browsers (generally OK 2026)  
7. `matchMedia` reduced-motion differences  
8. Compositor layer limits on low-end Android WebViews  
9. Font `font-display: swap` FOUT on overlays  
10. Picture-in-picture / fullscreen quirks (mostly disabled — good)  

---

## What is already excellent (keep)

- HTML `#lcp-shell` + boot loader for LCP before React  
- Lenis driven by GSAP ticker (`autoRaf: false`) — single clock  
- `useFilmSync` imperative DOM updates  
- Navbar scrolled via `data-scrolled` (pattern to extend)  
- ScrollTrigger updates gated to closing region  
- Closing animation avoids blur filters  
- Fast-start MP4 (`moov` before `mdat`)  
- Self-hosted fonts (no Google Fonts RTT)  
- Wheel delta clamp  
- Clear section → videoRange mapping  

---

## Final verdict

| Question | Answer |
|----------|--------|
| Is the project “broken”? | No — it is a thoughtful cinematic SPA. |
| Why isn’t it Apple-smooth? | **Scrubbing the wrong kind of video the wrong way**, with **too many live overlay layers**, on a **non-adaptive** device path. |
| Is Lenis the problem? | **Mostly no** — integration is sound; touch sync needs tuning. |
| Is React the problem? | **Mostly no** — hot path is imperative; context boundaries still hitch. |
| Biggest unlock? | **Re-encode + resolution ladder + seek policy + ≤2 text layers.** |
| Production-ready now? | **Not for flagship smoothness claims** on mid Windows/mobile. Load story is closer than runtime story. |
| Recommended next step | Execute **Phase 0 + Phase 2.1–2.5** from `04_OPTIMIZATION_ROADMAP.md` before more Lenis tweaking. |

**Composite readiness for a premium launch: 50/100 today → estimated 85/100 after Phases 1–5 if media work lands.**

---

*End of audit deliverables (5/5).*
