import { lazy, Suspense } from 'react'
import { ExperienceProvider } from '@/context/ExperienceContext'
import { Loader } from '@/components/ui/Loader'
import { Navbar } from '@/components/layout/Navbar'
import { VideoStage } from '@/components/layout/VideoStage'
import { IntroOverlay } from '@/sections/IntroOverlay'
import { ChapterOverlay } from '@/sections/ChapterOverlay'
import { ScrollTrack } from '@/sections/ScrollTrack'
import { PerfProfiler } from '@/lib/performance/PerfProfiler'

const ClosingSection = lazy(() =>
  import('@/sections/ClosingSection').then((m) => ({ default: m.ClosingSection })),
)

const DevPerfOverlay = import.meta.env.DEV
  ? lazy(() =>
      import('@/lib/performance/PerfOverlay').then((m) => ({
        default: m.DevPerfOverlay,
      })),
    )
  : null

function AppContent() {
  return (
    <ExperienceProvider>
      <Loader />
      <Navbar />
      <VideoStage />
      <IntroOverlay />
      <ChapterOverlay />

      <main>
        <ScrollTrack />
        <Suspense fallback={null}>
          <ClosingSection />
        </Suspense>
      </main>
    </ExperienceProvider>
  )
}

export default function App() {
  return (
    <PerfProfiler id="App">
      <AppContent />
      {import.meta.env.DEV && DevPerfOverlay && (
        <Suspense fallback={null}>
          <DevPerfOverlay />
        </Suspense>
      )}
    </PerfProfiler>
  )
}
