// Static imports so Bun bundler embeds JSON files into the compiled binary.
// Using readFileSync + new URL would resolve to /$bunfs/ paths that don't exist at runtime.
import aiIntelligenceRaw from './ai-intelligence.json'
import developerToolsRaw from './developer-tools.json'
import productivityRaw from './productivity.json'
import dataAnalysisRaw from './data-analysis.json'
import contentCreationRaw from './content-creation.json'
import securityComplianceRaw from './security-compliance.json'
import communicationCollaborationRaw from './communication-collaboration.json'

export const recommendationSourceFileOrder = [
  'ai-intelligence',
  'developer-tools',
  'productivity',
  'data-analysis',
  'content-creation',
  'security-compliance',
  'communication-collaboration',
] as const

export type RecommendationSourceCategory = typeof recommendationSourceFileOrder[number]

export interface RecommendationSourceEntry {
  category: RecommendationSourceCategory
  description?: string
  description_zh?: string
  downloads?: number
  homepage?: string
  installs?: number
  name?: string
  ownerName?: string
  score?: number
  slug: string
  stars?: number
  updated_at?: number
  version?: string
}

type RecommendationSourceEntryInput = Partial<RecommendationSourceEntry> & Record<string, unknown>

export type RecommendationSourceShardMap = Record<RecommendationSourceCategory, RecommendationSourceEntry[]>

const shardData: Record<RecommendationSourceCategory, RecommendationSourceEntryInput[]> = {
  'ai-intelligence': aiIntelligenceRaw as RecommendationSourceEntryInput[],
  'developer-tools': developerToolsRaw as RecommendationSourceEntryInput[],
  'productivity': productivityRaw as RecommendationSourceEntryInput[],
  'data-analysis': dataAnalysisRaw as RecommendationSourceEntryInput[],
  'content-creation': contentCreationRaw as RecommendationSourceEntryInput[],
  'security-compliance': securityComplianceRaw as RecommendationSourceEntryInput[],
  'communication-collaboration': communicationCollaborationRaw as RecommendationSourceEntryInput[],
}

function loadRecommendationSourceShard(category: RecommendationSourceCategory): RecommendationSourceEntry[] {
  const raw = shardData[category]

  if (!Array.isArray(raw)) {
    throw new Error(`Recommendation source shard "${category}" must contain an array`)
  }

  return raw.map((entry, index) => normalizeRecommendationSourceEntry(category, entry, index))
}

function normalizeRecommendationSourceEntry(
  category: RecommendationSourceCategory,
  entry: RecommendationSourceEntryInput,
  index: number,
): RecommendationSourceEntry {
  const slug = typeof entry.slug === 'string' ? entry.slug.trim() : ''
  const entryCategory = typeof entry.category === 'string' ? entry.category.trim() : ''

  if (!slug) {
    throw new Error(`Recommendation source shard "${category}" has an invalid entry at index ${index}`)
  }

  if (entryCategory !== category) {
    throw new Error(`Recommendation source shard "${category}" contains "${slug}" with mismatched category "${entryCategory}"`)
  }

  return {
    category,
    description: typeof entry.description === 'string' ? entry.description : undefined,
    description_zh: typeof entry.description_zh === 'string' ? entry.description_zh : undefined,
    downloads: typeof entry.downloads === 'number' ? entry.downloads : undefined,
    homepage: typeof entry.homepage === 'string' ? entry.homepage : undefined,
    installs: typeof entry.installs === 'number' ? entry.installs : undefined,
    name: typeof entry.name === 'string' ? entry.name : undefined,
    ownerName: typeof entry.ownerName === 'string' ? entry.ownerName : undefined,
    score: typeof entry.score === 'number' ? entry.score : undefined,
    slug,
    stars: typeof entry.stars === 'number' ? entry.stars : undefined,
    updated_at: typeof entry.updated_at === 'number' ? entry.updated_at : undefined,
    version: typeof entry.version === 'string' ? entry.version : undefined,
  }
}

export const recommendationSourceShards = Object.fromEntries(
  recommendationSourceFileOrder.map((category) => [category, loadRecommendationSourceShard(category)]),
) as RecommendationSourceShardMap

export const recommendationSourceEntries = recommendationSourceFileOrder.flatMap((category) => recommendationSourceShards[category])

export const recommendationSourceIndex = new Map<string, RecommendationSourceEntry>(
  recommendationSourceEntries.map((entry) => [entry.slug, entry]),
)
