type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogEntry = {
  level: LogLevel
  message: string
  requestId?: string
  module?: string
  timestamp: string
  [key: string]: unknown
}

type LogContext = {
  requestId?: string
  module?: string
}

interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void
  info(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  error(message: string, meta?: Record<string, unknown>): void
}

function createLogger(context?: LogContext): Logger {
  function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(context?.requestId ? { requestId: context.requestId } : {}),
      ...(context?.module ? { module: context.module } : {}),
      ...(meta ?? {}),
    }

    const serialized = JSON.stringify(entry)

    switch (level) {
      case 'debug':
      case 'info':
        console.log(serialized)
        break
      case 'warn':
        console.warn(serialized)
        break
      case 'error':
        console.error(serialized)
        break
    }
  }

  return {
    debug: (message, meta) => log('debug', message, meta),
    info: (message, meta) => log('info', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    error: (message, meta) => log('error', message, meta),
  }
}

// Default module-level logger (no requestId)
const logger = createLogger()

export { createLogger, logger }
export type { LogLevel, LogEntry, LogContext, Logger }
