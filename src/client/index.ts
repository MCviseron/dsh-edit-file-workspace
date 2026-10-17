import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { EditFileWorkspaceCard, EditFileWorkspaceCardController, type ClientHost } from './EditFileWorkspaceCard.tsx'
import { en, zh } from './locales.ts'

const NS = 'dsh-edit-file-workspace'

export const inject = ['slots', 'locale']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'edit-file-workspace: dictionaries')
  const t = ctx.locale.bind(NS)

  const controller = new EditFileWorkspaceCardController(ctx as unknown as ClientHost)

  ctx.slots.inject('settings.section', () => {
    const unregister = ctx.slots.register({
      name: 'settings.section',
      id: 'dsh-edit-file-workspace',
      order: 100,
      label: () => t('settings.title'),
      locale: NS,
      inject: () => controller.inject(),
    }, EditFileWorkspaceCard)

    return () => {
      controller.dispose()
      unregister()
    }
  })
}
