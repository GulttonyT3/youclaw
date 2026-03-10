import { resolve } from 'node:path'
import { getEnv } from './env.ts'

// 项目根目录
export const ROOT_DIR = resolve(import.meta.dir, '../..')

export function getPaths() {
  const env = getEnv()
  const dataDir = resolve(ROOT_DIR, env.DATA_DIR)

  return {
    root: ROOT_DIR,
    data: dataDir,
    db: resolve(dataDir, 'zoerclaw.db'),
    agents: resolve(ROOT_DIR, 'agents'),
    skills: resolve(ROOT_DIR, 'skills'),
    prompts: resolve(ROOT_DIR, 'prompts'),
  }
}
