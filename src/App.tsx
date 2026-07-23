import { lazy, Suspense } from 'react'
import { ExperienceProvider } from '@/context/ExperienceContext'
import { Loader } from '@/components/ui/Loader'
import { Cursor } from '@/components/ui/Cursor'
import { Navbar } from '@/components/layout/Navbar'
import { VideoStage } from '@/components/layout/VideoStage'
import { IntroOverlay } from '@/sections/IntroOverlay'
import { ChapterOverlay } from '@/sections/ChapterOverlay'
import { ScrollTrack } from '@/sections/ScrollTrack'

const ClosingSection = lazy(() =>
  import('@/sections/ClosingSection').then((m) => ({ default: m.ClosingSection })),
)

export default function App() {
  return (
    <ExperienceProvider>
      <Loader />
      <Cursor />
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
