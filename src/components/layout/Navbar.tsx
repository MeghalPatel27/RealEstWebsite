import { useEffect, useRef, useState } from 'react'
import { NAV_ITEMS, SITE } from '@/lib/constants'
import { useExperience, useFilmSync } from '@/context/ExperienceContext'
import { HiOutlineMenuAlt4, HiOutlineX } from 'react-icons/hi'

export function Navbar() {
  const { activeSection, scrollToSection, isLoaded } = useExperience()
  const [menuOpen, setMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const scrolledRef = useRef(false)

  // DOM attribute toggle — avoids React re-renders on scroll threshold crosses
  useFilmSync((state) => {
    const next = state.progress > 0.02
    if (next === scrolledRef.current) return
    scrolledRef.current = next
    headerRef.current?.setAttribute('data-scrolled', next ? 'true' : 'false')
  })

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  return (
    <>
      <header
        ref={headerRef}
        className={`fixed inset-x-0 top-0 z-50 bg-transparent transition-[background-color,transform,opacity] duration-700 data-[scrolled=true]:bg-ink/90 ${
          isLoaded ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'
        }`}
      >
        <nav
          className="mx-auto flex h-14 items-center justify-between px-5 md:h-16 md:px-8 lg:px-10"
          aria-label="Primary"
        >
          <a
            href="#section-arrival"
            className="font-sans text-[11px] font-light tracking-[0.28em] text-white uppercase md:text-[12px]"
            onClick={(e) => {
              e.preventDefault()
              scrollToSection('arrival')
            }}
          >
            {SITE.brand}
          </a>

          <ul className="hidden items-center gap-6 lg:flex xl:gap-8">
            {NAV_ITEMS.map((item) => {
              const active = activeSection === item.id
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`relative pb-1 font-sans text-[10px] tracking-[0.32em] uppercase transition-opacity duration-300 xl:text-[11px] ${
                      active ? 'opacity-100' : 'opacity-55 hover:opacity-100'
                    }`}
                    aria-current={active ? 'true' : undefined}
                    onClick={() => scrollToSection(item.id)}
                  >
                    {item.label}
                    <span
                      className={`absolute inset-x-0 -bottom-0.5 h-px origin-left bg-white transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        active ? 'scale-x-100' : 'scale-x-0'
                      }`}
                    />
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="flex items-center gap-3">
            <a
              href="#enquire"
              className="hidden border border-white/25 bg-white/8 px-4 py-2 font-sans text-[10px] font-medium tracking-[0.28em] text-white uppercase transition-all duration-300 hover:scale-[1.03] hover:bg-white/14 lg:inline-block"
            >
              {SITE.cta}
            </a>
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center text-white lg:hidden"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <HiOutlineX size={22} /> : <HiOutlineMenuAlt4 size={22} />}
            </button>
          </div>
        </nav>
      </header>

      <div
        className={`fixed inset-0 z-40 bg-ink/95 transition-opacity duration-500 lg:hidden ${
          menuOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden={!menuOpen}
      >
        <nav
          className="flex h-full flex-col items-center justify-center gap-8"
          aria-label="Mobile"
        >
          {NAV_ITEMS.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className="font-serif text-3xl font-light tracking-wide text-white transition-opacity hover:opacity-70"
              style={{
                transitionDelay: menuOpen ? `${i * 40}ms` : '0ms',
                transform: menuOpen ? 'translateY(0)' : 'translateY(12px)',
                opacity: menuOpen ? 1 : 0,
                transition: 'opacity 0.45s ease, transform 0.45s ease',
              }}
              onClick={() => {
                setMenuOpen(false)
                scrollToSection(item.id)
              }}
            >
              {item.label}
            </button>
          ))}
          <a
            href="#enquire"
            className="mt-4 border border-white/30 px-6 py-3 font-sans text-[11px] tracking-[0.3em] uppercase"
            onClick={() => setMenuOpen(false)}
          >
            {SITE.cta}
          </a>
        </nav>
      </div>
    </>
  )
}
