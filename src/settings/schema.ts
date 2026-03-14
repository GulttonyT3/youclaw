import { z } from 'zod/v4'

export const CustomModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.enum(['anthropic', 'openai', 'gemini', 'custom']).default('anthropic'),
  apiKey: z.string(),
  baseUrl: z.string().default(''),
  modelId: z.string(),
})

export const SettingsSchema = z.object({
  activeModel: z.object({
    provider: z.enum(['builtin', 'custom']),
    id: z.string().optional(),
  }).default({ provider: 'builtin' }),
  customModels: z.array(CustomModelSchema).default([]),
})

export type Settings = z.infer<typeof SettingsSchema>
export type CustomModel = z.infer<typeof CustomModelSchema>
