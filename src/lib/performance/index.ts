import { perf as devPerf } from './dev'
import { perf as noopPerf } from './noop'
import type { PerfAPI } from './types'

export type * from './types'

/** Dev-only instrumentation API — resolves to no-ops in production builds. */
export const perf: PerfAPI = import.meta.env.DEV ? devPerf : noopPerf
