import { getLogger } from '../logger/index.ts'
import { listTasksForAgent, applyTaskAction, TaskServiceError } from '../task/index.ts'
import type { TaskActionInput, TaskActionResult, TaskListFilters, TaskStatus, TaskWriteAction } from '../task/index.ts'

export interface TaskToolContext {
  agentId: string
  chatId: string
}

export interface TaskMcpOptions {
  service?: {
    listTasksForAgent(agentId: string, filters?: TaskListFilters): Promise<unknown[]> | unknown[]
    applyTaskAction(input: TaskActionInput): Promise<TaskActionResult> | TaskActionResult
  }
}

type ListTasksArgs = {
  chat_id?: string
  name?: string
  status?: TaskStatus
  limit?: number
}

type UpdateTaskArgs = {
  action: TaskWriteAction
  name: string
  chat_id?: string
  prompt?: string
  description?: string
  schedule_type?: 'cron' | 'interval' | 'once'
  schedule_value?: string
  timezone?: string | null
  delivery_mode?: 'none' | 'push'
  delivery_target?: string | null
}

type TaskToolResult = {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

type RegisteredTaskTool = {
  handler: (args: Record<string, unknown>) => Promise<TaskToolResult>
}

export type TaskMcpServer = {
  instance: {
    _registeredTools: Record<string, RegisteredTaskTool>
  }
}

function ensureCreateInput(args: Pick<UpdateTaskArgs, 'prompt' | 'schedule_type' | 'schedule_value'>): string | null {
  if (!args.prompt) return 'create action requires prompt'
  if (!args.schedule_type) return 'create action requires schedule_type'
  if (!args.schedule_value) return 'create action requires schedule_value'
  return null
}

function ensureUpdateInput(args: Pick<UpdateTaskArgs, 'prompt' | 'description' | 'schedule_type' | 'schedule_value' | 'timezone' | 'delivery_mode' | 'delivery_target'>): string | null {
  if (
    args.prompt === undefined &&
    args.description === undefined &&
    args.schedule_type === undefined &&
    args.schedule_value === undefined &&
    args.timezone === undefined &&
    args.delivery_mode === undefined &&
    args.delivery_target === undefined
  ) {
    return 'update action requires at least one mutable field (prompt/schedule/timezone/delivery)'
  }
  return null
}

function textResult(text: string, isError = false): TaskToolResult {
  return {
    content: [{ type: 'text', text }],
    ...(isError ? { isError: true } : {}),
  }
}

export function createTaskMcpServer(context: TaskToolContext, options?: TaskMcpOptions): TaskMcpServer {
  const service = options?.service ?? { listTasksForAgent, applyTaskAction }

  const registeredTools: Record<string, RegisteredTaskTool> = {
    list_tasks: {
      handler: async (rawArgs: Record<string, unknown>) => {
        const logger = getLogger()
        const args = rawArgs as ListTasksArgs

        try {
          const tasks = await service.listTasksForAgent(context.agentId, {
            chatId: args.chat_id,
            name: args.name,
            status: args.status,
            limit: args.limit,
          })
          return textResult(JSON.stringify({ tasks }, null, 2))
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          const statusCode = err instanceof TaskServiceError ? err.statusCode : undefined
          logger.error({ error: msg, statusCode, agentId: context.agentId, chatId: context.chatId, category: 'task' }, 'list_tasks failed')
          return textResult(`Failed to list tasks: ${msg}`, true)
        }
      },
    },
    update_task: {
      handler: async (rawArgs: Record<string, unknown>) => {
        const logger = getLogger()
        const args = rawArgs as UpdateTaskArgs

        try {
          if (args.action === 'create') {
            const error = ensureCreateInput(args)
            if (error) return textResult(error, true)
          }
          if (args.action === 'update') {
            const error = ensureUpdateInput(args)
            if (error) return textResult(error, true)
          }

          const result = await service.applyTaskAction({
            agentId: context.agentId,
            chatId: args.chat_id ?? context.chatId,
            action: args.action,
            name: args.name,
            prompt: args.prompt,
            description: args.description,
            scheduleType: args.schedule_type,
            scheduleValue: args.schedule_value,
            timezone: args.timezone,
            deliveryMode: args.delivery_mode,
            deliveryTarget: args.delivery_target,
          })

          return textResult(JSON.stringify({ action: args.action, result }, null, 2))
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          const statusCode = err instanceof TaskServiceError ? err.statusCode : undefined
          logger.error(
            { error: msg, statusCode, action: args.action, taskName: args.name, agentId: context.agentId, chatId: context.chatId, category: 'task' },
            'update_task failed',
          )
          return textResult(`Failed to update task: ${msg}`, true)
        }
      },
    },
  }

  return {
    instance: {
      _registeredTools: registeredTools,
    },
  }
}
