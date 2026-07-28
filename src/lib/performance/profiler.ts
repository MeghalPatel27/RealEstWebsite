import type { MeasureName, PerfMark } from './types'

const activeMeasures = new Map<string, number>()

export function perfMark(name: PerfMark | string): void {
  try {
    performance.mark(`perf:${name}`)
  } catch {
    /* duplicate marks in tight loops */
  }
}

export function perfMeasure(
  name: MeasureName | string,
  startMark: string,
  endMark: string,
): void {
  try {
    performance.measure(`perf:${name}`, `perf:${startMark}`, `perf:${endMark}`)
  } catch {
    /* marks may be cleared */
  }
}

export function startMeasure(name: string): void {
  activeMeasures.set(name, performance.now())
  perfMark(`${name}:start`)
}

export function endMeasure(name: string): number {
  const start = activeMeasures.get(name)
  const duration = start !== undefined ? performance.now() - start : 0
  activeMeasures.delete(name)
  perfMark(`${name}:end`)
  perfMeasure(name, `${name}:start`, `${name}:end`)
  return duration
}

export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  startMeasure(name)
  try {
    return await fn()
  } finally {
    endMeasure(name)
  }
}

export function measureFrame(fn: () => void): void {
  startMeasure('raf')
  fn()
  endMeasure('raf')
}
