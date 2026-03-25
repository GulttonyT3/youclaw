import type { ManagedSkill, Skill } from '@/api/client'
import type { useI18n } from '@/i18n'

function getSkillRegistryMeta(skill: Skill | ManagedSkill) {
  return 'registryMeta' in skill ? skill.registryMeta : undefined
}

export function getExternalSkillSourceLabel(skill: Skill | ManagedSkill, t: ReturnType<typeof useI18n>['t']) {
  const registryMeta = getSkillRegistryMeta(skill)

  if (skill.externalSource === 'marketplace') {
    if (registryMeta?.source === 'clawhub') return t.settings.registrySourceClawhub
    if (registryMeta?.source === 'tencent') return t.settings.registrySourceTencent
    return t.skills.sourceMarketplace
  }

  if (skill.externalSource === 'imported') {
    const importProvider = registryMeta && 'provider' in registryMeta ? registryMeta.provider : null
    const importSource = registryMeta?.source === 'raw-url' || registryMeta?.source === 'github'
      ? registryMeta.source
      : null

    if (importProvider === 'raw-url' || importSource === 'raw-url') {
      return t.skills.sourceRawUrlImport
    }
    if (importProvider === 'github' || importSource === 'github') {
      return t.skills.sourceGitHubImport
    }
    return t.skills.sourceImported
  }

  if (skill.externalSource === 'manual') return t.skills.sourceManual
  return t.skills.user
}

export function getSkillSourceBadges(skill: Skill | ManagedSkill, t: ReturnType<typeof useI18n>['t']) {
  const labels: string[] = []

  if (skill.catalogGroup === 'user') {
    labels.push(t.skills.groupUser)
    if (skill.userSkillKind === 'external') {
      labels.push(t.skills.groupExternal)
      labels.push(getExternalSkillSourceLabel(skill, t))
    } else if (skill.userSkillKind === 'custom') {
      labels.push(t.skills.groupCustom)
    }
    return labels
  }

  labels.push(t.skills.groupBuiltin)
  if (skill.source === 'workspace') {
    labels.push(t.skills.workspace)
  }

  return labels
}
