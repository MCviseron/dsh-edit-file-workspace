import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-session-persistence'
import type {} from '@deepseek-ai/dsh-workspace'
import { makeEditFileWorkspaceRoutes } from './routes.ts'

export const inject = ['webServer', 'workspaceRegistry', 'sessionPersistence', 'sessions']

export function apply(ctx: Context): void {
  ctx.effect(() => {
    const disposers = makeEditFileWorkspaceRoutes(ctx).map(route => ctx.webServer.register(route))
    return () => {
      for (const dispose of disposers) dispose()
    }
  }, 'dsh-edit-file-workspace: routes')
}
