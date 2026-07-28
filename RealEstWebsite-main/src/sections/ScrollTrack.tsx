import { SECTIONS } from '@/lib/constants'

/** Invisible scroll markers — one viewport per chapter */
export function ScrollTrack() {
  return (
    <div className="relative z-10">
      {SECTIONS.map((section) => (
        <section
          key={section.id}
          id={`section-${section.id}`}
          className="h-[100svh] w-full"
          aria-label={section.title}
        />
      ))}
    </div>
  )
}
