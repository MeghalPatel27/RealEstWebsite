export const NAV_ITEMS = [
  { id: 'arrival', label: 'ARRIVAL' },
  { id: 'living', label: 'LIVING' },
  { id: 'kitchen', label: 'KITCHEN' },
  { id: 'bedroom', label: 'BEDROOM' },
  { id: 'bath', label: 'BATH' },
  { id: 'terrace', label: 'TERRACE' },
] as const

export type SectionId = (typeof NAV_ITEMS)[number]['id']

export interface SectionContent {
  id: SectionId
  index: string
  total: string
  title: string
  eyebrow: string
  description: string
  verticalLabel: string
  /** Normalized video time range [0–1] within the film */
  videoRange: [number, number]
}

/**
 * Video ranges mapped to cinematic-video.mp4 (~15s):
 * 0–2.2s exterior · 2.2–5.5s living · 5.5–8.2s kitchen
 * 8.2–9.2s transitional (bedroom beat) · 9.2–11.5s bath · 11.5–15s terrace
 */
export const SECTIONS: SectionContent[] = [
  {
    id: 'arrival',
    index: '01',
    total: '06',
    title: 'The Arrival',
    eyebrow: 'Home Nº 134',
    description:
      'A secluded refuge nestled in the quiet hills of Waccabuc — where architecture meets the landscape in golden light.',
    verticalLabel: 'ARRIVAL',
    videoRange: [0, 0.15],
  },
  {
    id: 'living',
    index: '02',
    total: '06',
    title: 'Living Hall',
    eyebrow: 'Gather',
    description:
      'Floor-to-ceiling glass dissolves the boundary between interior calm and the surrounding forest.',
    verticalLabel: 'LIVING',
    videoRange: [0.15, 0.37],
  },
  {
    id: 'kitchen',
    index: '03',
    total: '06',
    title: 'The Kitchen',
    eyebrow: 'Craft',
    description:
      'Warm wood, stone, and dappled sunlight compose a space made for quiet mornings and long evenings.',
    verticalLabel: 'KITCHEN',
    videoRange: [0.37, 0.55],
  },
  {
    id: 'bedroom',
    index: '04',
    total: '06',
    title: 'Bedroom',
    eyebrow: 'Private Spaces',
    description:
      'A sanctuary of soft neutrals and panoramic views — designed for rest without compromise.',
    verticalLabel: 'BEDROOM',
    videoRange: [0.55, 0.62],
  },
  {
    id: 'bath',
    index: '05',
    total: '06',
    title: 'Bath',
    eyebrow: 'Ritual',
    description:
      'Stone, wood, and light — a spa-like retreat defined by material honesty and serene proportion.',
    verticalLabel: 'BATH',
    videoRange: [0.62, 0.78],
  },
  {
    id: 'terrace',
    index: '06',
    total: '06',
    title: 'Terrace',
    eyebrow: 'Horizon',
    description:
      'An elevated living room open to the valley — evenings framed by sky, water, and distant mountains.',
    verticalLabel: 'TERRACE',
    videoRange: [0.78, 1],
  },
]

export const SITE = {
  brand: 'HOME Nº 134',
  studio: 'NPLUSJ STUDIO',
  credit: 'A FILM BY NPLUSJ STUDIO',
  logoMark: 'nPLUSJ',
  cta: 'ENQUIRE',
  videoSrc: '/videos/cinematic.mp4',
  posterSrc: '/videos/poster.jpg',
} as const

export const EASING = {
  luxury: 'power3.out',
  soft: 'power2.inOut',
  expo: 'expo.out',
} as const

/** Map overall page progress (0–1) to a video time using chapter ranges */
export function videoTimeFromProgress(
  progress: number,
  duration: number,
): number {
  const chapterProgress = Math.min(1, Math.max(0, progress / 0.86))
  const index = Math.min(
    SECTIONS.length - 1,
    Math.floor(chapterProgress * SECTIONS.length),
  )
  const local = chapterProgress * SECTIONS.length - index
  const [start, end] = SECTIONS[index].videoRange
  const normalized = start + (end - start) * Math.min(1, Math.max(0, local))
  return normalized * Math.max(0, duration - 0.05)
}

/**
 * Inverse of videoTimeFromProgress — map film time back to page progress.
 * Lets overlays lock to the footage playhead (video-first timeline).
 */
export function progressFromVideoTime(
  time: number,
  duration: number,
): number {
  const safeDuration = Math.max(0.001, duration - 0.05)
  const normalized = Math.min(1, Math.max(0, time / safeDuration))

  let index = SECTIONS.length - 1
  for (let i = 0; i < SECTIONS.length; i++) {
    const [, end] = SECTIONS[i].videoRange
    if (normalized <= end || i === SECTIONS.length - 1) {
      index = i
      break
    }
  }

  const [start, end] = SECTIONS[index].videoRange
  const span = Math.max(0.0001, end - start)
  const local = Math.min(1, Math.max(0, (normalized - start) / span))
  const chapterProgress = (index + local) / SECTIONS.length
  return chapterProgress * 0.86
}

