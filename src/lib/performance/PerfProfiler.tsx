import {
  Profiler,
  type ProfilerOnRenderCallback,
  type ReactNode,
} from 'react'
import { perf } from '@/lib/performance'

const onRender: ProfilerOnRenderCallback = (
  id,
  phase,
  _actualDuration,
  _baseDuration,
  _startTime,
  _commitTime,
) => {
  perf.incrementReactRender(id, phase, _actualDuration)
  perf.measureRender(id, _actualDuration)
}

type PerfProfilerProps = {
  id: string
  children: ReactNode
}

/** Wraps children with React.Profiler in development only. */
export function PerfProfiler({ id, children }: PerfProfilerProps) {
  if (!import.meta.env.DEV) return children
  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  )
}
