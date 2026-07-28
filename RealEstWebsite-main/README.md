# Home Nº 134

A cinematic luxury real estate experience — scroll-driven film walkthrough inspired by the NplusJ Studio Carbon Home Nº 134 presentation.

## Stack

- React + Vite + TypeScript
- GSAP + ScrollTrigger
- Lenis smooth scroll
- Tailwind CSS v4
- Framer Motion / React Icons (supporting)

## Getting started

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal (default `http://localhost:5173`).

```bash
npm run build    # production build
npm run preview  # preview production build
```

## Project layout

```
references/
  screen-recording.mp4   # UX & animation reference
  cinematic-video.mp4    # Master visual asset
public/videos/
  cinematic.mp4          # Served film asset
  poster.jpg
src/
  components/            # Loader, Cursor, Navbar, VideoStage
  sections/              # Intro, Chapter overlay, Scroll track, Closing
  context/               # Lenis + experience state
  lib/constants.ts       # Sections, copy, video ranges
```

## Experience notes

- The cinematic MP4 is scrubbed by scroll progress across six chapters: Arrival → Living → Kitchen → Bedroom → Bath → Terrace.
- Lenis powers momentum scrolling; GSAP ScrollTrigger drives video time and reveals.
- `prefers-reduced-motion` disables smooth scrubbing and shortens transitions.
