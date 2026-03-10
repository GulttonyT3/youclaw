import pino from 'pino'
import { getEnv } from '../config/index.ts'

let _logger: pino.Logger | null = null

export function initLogger(): pino.Logger {
  if (_logger) return _logger

  const env = getEnv()
  _logger = pino({
    level: env.LOG_LEVEL,
    transport: {
      target: 'pino/file',
      options: { destination: 1 }, // stdout
    },
  })

  return _logger
}

export function getLogger(): pino.Logger {
  if (!_logger) throw new Error('Logger 未初始化')
  return _logger
}
