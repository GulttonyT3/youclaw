import { Type } from '@mariozechner/pi-ai'
import type { ToolDefinition } from '@mariozechner/pi-coding-agent'
import type { AgentToolResult } from '@mariozechner/pi-agent-core'
import type { SkillsLoader } from '../../skills/loader.ts'
import { getLogger } from '../../logger/index.ts'

const SkillParams = Type.Object({
  skill: Type.String({ description: 'The skill name to invoke' }),
  args: Type.Optional(Type.String({ description: 'Optional arguments for the skill' })),
})

/**
 * Create the Skill tool as a pi-coding-agent ToolDefinition.
 * This tool allows the agent to invoke YouClaw skills by name.
 */
export function createSkillTool(skillsLoader: SkillsLoader): ToolDefinition {
  return {
    name: 'Skill',
    label: 'Skill',
    description: 'Invoke a YouClaw skill by name. Skills provide specialized capabilities and domain knowledge.',
    parameters: SkillParams,
    async execute(
      _toolCallId: string,
      params: { skill: string; args?: string },
      _signal?: AbortSignal,
    ): Promise<AgentToolResult<unknown>> {
      const logger = getLogger()
      const { skill: skillName, args } = params

      logger.info({ skillName, args }, 'Skill tool invoked')

      try {
        const allSkills = skillsLoader.loadAllSkills()
        const skill = allSkills.find((s) => s.name === skillName)

        if (!skill) {
          return {
            content: [{ type: 'text', text: `Skill "${skillName}" not found. Available skills: ${allSkills.map((s) => s.name).join(', ')}` }],
            details: { error: 'skill_not_found' },
          }
        }

        // Return the skill content as the tool result
        let resultText = skill.content
        if (args) {
          resultText = `${resultText}\n\nArguments: ${args}`
        }

        return {
          content: [{ type: 'text', text: resultText }],
          details: { skillName, args },
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        logger.error({ skillName, error: errorMsg }, 'Skill tool execution failed')
        return {
          content: [{ type: 'text', text: `Failed to invoke skill "${skillName}": ${errorMsg}` }],
          details: { error: errorMsg },
        }
      }
    },
  }
}
