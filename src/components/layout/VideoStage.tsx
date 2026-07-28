import { useEffect, useRef } from 'react'
import { SITE } from '@/lib/constants'
import { useExperience, useFilmSync } from '@/context/ExperienceContext'
import { resetVideoDrive } from '@/lib/filmClock'
import { perf } from '@/lib/performance'
import { windowOpacity } from '@/lib/motion'
import { HiOutlineVolumeOff, HiOutlineVolumeUp } from 'react-icons/hi'

/**
 * Hero film registers with the film clock.
 * Scroll sets intent; the clock soft-plays the decoder (no per-frame seeks).
 */
export function VideoStage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<HTMLDivElement>(null)
  const {
    isLoaded,
    isMuted,
    setMuted,
    reducedMotion,
    registerFilmVideo,
  } = useExperience()

  useEffect(() => {
    const video = videoRef.current
    registerFilmVideo(video)
    perf.setVideoElement(video)
    return () => {
      registerFilmVideo(null)
      perf.setVideoElement(null)
      resetVideoDrive()
    }
  }, [registerFilmVideo])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !isLoaded) return
    video.muted = true

    const onMeta = () => {
      registerFilmVideo(video)
    }
    if (video.readyState >= 1) onMeta()
    else video.addEventListener('loadedmetadata', onMeta, { once: true })

    if (reducedMotion) {
      void video.play().catch(() => {
        /* autoplay policies */
      })
    } else {
      video.pause()
    }

    return () => {
      video.removeEventListener('loadedmetadata', onMeta)
    }
  }, [isLoaded, reducedMotion, registerFilmVideo])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = isMuted
  }, [isMuted])

  useFilmSync(
    perf.wrapFilmHandler('video-controls', (state) => {
    const controls = controlsRef.current
    if (!controls || !isLoaded || reducedMotion) return

    const show = windowOpacity(state.scrollProgress, -0.01, 0, 0.018, 0.042)
    controls.style.opacity = String(show)
    controls.style.pointerEvents = show > 0.5 ? 'auto' : 'none'
    controls.style.visibility = show > 0.02 ? 'visible' : 'hidden'
    }),
    isLoaded,
  )

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-ink"
      aria-hidden
    >
      <video
        ref={videoRef}
        className="video-stage-film absolute inset-0 h-full w-full object-cover"
        src={SITE.videoSrc}
        poster={SITE.posterSrc}
        playsInline
        muted={isMuted}
        preload="metadata"
        loop={false}
        disablePictureInPicture
        onLoadedMetadata={() => {
          perf.mark('video')
          perf.setVideoElement(videoRef.current)
        }}
      />
      {/* Separate compositor layer from the film */}
      <div className="video-stage-grade absolute inset-0 bg-gradient-to-b from-ink/40 via-transparent to-ink/55" />

      {isLoaded && !reducedMotion && (
        <div
          ref={controlsRef}
          className="pointer-events-auto absolute top-[42%] left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-5"
          style={{ opacity: 1, visibility: 'visible' }}
        >
          <button
            type="button"
            aria-label={isMuted ? 'Unmute film' : 'Mute film'}
            className="flex size-11 items-center justify-center rounded-full bg-black/55 text-white transition-transform duration-300 hover:scale-105"
            onClick={() => setMuted(!isMuted)}
          >
            {isMuted ? (
              <HiOutlineVolumeOff size={18} />
            ) : (
              <HiOutlineVolumeUp size={18} />
            )}
          </button>
          <p className="font-sans text-[10px] tracking-[0.4em] text-white/60 uppercase">
            Scroll to explore
          </p>
        </div>
      )}
    </div>
  )
}
