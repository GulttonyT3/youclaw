import type { en } from './en'

// 将所有字面量字符串宽化为 string，保留结构
type DeepStringify<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>
}

export type Translations = DeepStringify<typeof en>
