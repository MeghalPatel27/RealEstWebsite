import type { PerfLogger } from './types'

const LOG_CHANNELS = new Set([
  'seek',
  'long-task',
  'gc',
  'frame-drop',
  'decode',
])

type LogLevel = 'debug' | 'info' | 'warn'

function shouldLog(level: LogLevel, channel: string): boolean {
  if (level === 'warn') return true
  if (LOG_CHANNELS.has(channel)) return true
  return false
}

export function createLogger(): PerfLogger {
  return {
    debug(channel, message, data) {
      if (!shouldLog('debug', channel)) return
      if (data) console.debug(`[perf:${channel}] ${message}`, data)
      else console.debug(`[perf:${channel}] ${message}`)
    },
    info(channel, message, data) {
      if (!shouldLog('info', channel)) return
      if (data) console.info(`[perf:${channel}] ${message}`, data)
      else console.info(`[perf:${channel}] ${message}`)
    },
    warn(channel, message, data) {
      if (data) console.warn(`[perf:${channel}] ${message}`, data)
      else console.warn(`[perf:${channel}] ${message}`)
    },
  }
}
