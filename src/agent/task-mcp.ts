import { Type } from '@mariozechner/pi-ai'
import type { ToolDefinition } from '@mariozechner/pi-coding-agent'
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

const ListTasksParams = Type.Object({
  chat_id: Type.Optional(Type.String({ description: 'Optional chat id to filter tasks for a specific conversation' })),
  name: Type.Optional(Type.String({ description: 'Optional exact task name filter' })),
  status: Type.Optional(Type.String({ description: 'Optional status filter: active, paused, or completed' })),
  limit: Type.Optional(Type.Number({ description: 'Optional maximum number of tasks to return' })),
})

const UpdateTaskParams = Type.Object({
  action: Type.String({ description: 'Task action: create, update, pause, resume, or delete' }),
  name: Type.String({ description: 'Task name used to identify the scheduled task in the current chat' }),
  chat_id: Type.Optional(Type.String({ description: 'Optional chat id. Defaults to the current chat.' })),
  prompt: Type.Optional(Type.String({ description: 'Prompt to execute when the task runs' })),
  description: Type.Optional(Type.String({ description: 'Optional task description' })),
  schedule_type: Type.Optional(Type.String({ description: 'Schedule type: cron, interval, or once' })),
  schedule_value: Type.Optional(Type.String({ description: 'Cron expression, interval milliseconds, or future ISO timestamp' })),
  timezone: Type.Optional(Type.String({ description: 'Optional IANA timezone for cron schedules' })),
  delivery_mode: Type.Optional(Type.String({ description: 'Optional delivery mode: none or push' })),
  delivery_target: Type.Optional(Type.String({ description: 'Optional push delivery target' })),
})

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

function createJsonTaskTool<T extends Record<string, unknown>>(
  name: 'list_tasks' | 'update_task',
  description: string,
  parameters: ToolDefinition['parameters'],
  handler: (args: T) => Promise<TaskToolResult>,
): ToolDefinition {
  return {
    name: `mcp__task__${name}`,
    label: `mcp__task__${name}`,
    description,
    parameters,
    async execute(_toolCallId, args: T) {
      const result = await handler(args)
      if (result.isError) {
        throw new Error(result.content[0]?.text || `Task tool ${name} failed`)
      }
      return {
        content: result.content,
        details: {},
      }
    },
  }
}

export function createTaskTools(context: TaskToolContext, options?: TaskMcpOptions): ToolDefinition[] {
  const server = createTaskMcpServer(context, options)
  const listTasksHandler = server.instance._registeredTools.list_tasks!.handler
  const updateTaskHandler = server.instance._registeredTools.update_task!.handler
  return [
    createJsonTaskTool(
      'list_tasks',
      'List scheduled tasks for the current agent. Always call this before creating, updating, pausing, resuming, or deleting a task.',
      ListTasksParams,
      (args) => listTasksHandler(args),
    ),
    createJsonTaskTool(
      'update_task',
      'Create, update, pause, resume, or delete a scheduled task for the current agent.',
      UpdateTaskParams,
      (args) => updateTaskHandler(args),
    ),
  ]
}
