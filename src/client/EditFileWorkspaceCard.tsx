import { useEffect, useState, type CSSProperties } from 'react'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

export interface WorkspaceView {
  workspaceId: string
  path: string
  title: string
  sessionIds: string[]
}

export interface SessionView {
  sessionId: string
  title?: string
  cwd?: string
  workspaceId: string | null
  live: boolean
}

/** How the host re-bound the projection cache after the move. */
export type ProjectionRebind = 'bound' | 'folded' | 'retagged' | 'unavailable' | 'failed'

export interface MoveReport {
  projection: ProjectionRebind
}

export interface EditFileWorkspaceCardState {
  status: 'loading' | 'ready' | 'unavailable'
  workspaces: WorkspaceView[]
  sessions: SessionView[]
  notice?: { kind: 'ok' | 'error'; text: string }
  move?: MoveReport
}

/** Whether the caller still needs a full page reload to show the new grouping. */
export type MoveOutcome = 'refreshed' | 'reload'

export interface EditFileWorkspaceCardFace {
  hooks: {
    editFileWorkspaceCard: SnapshotStore<EditFileWorkspaceCardState>
  }
  refresh(): Promise<void>
  move(sessionId: string, workspaceId: string | null): Promise<MoveOutcome>
}

const API = {
  describe: '/api/dsh-edit-file-workspace/describe',
  move: '/api/dsh-edit-file-workspace/move',
} as const

interface DescribeBody {
  ok?: boolean
  value?: { workspaces: WorkspaceView[]; sessions: SessionView[]; move?: MoveReport }
  error?: string
}

/** Minimal view of the client context: only the Session list service is used. */
export interface ClientHost {
  get?(name: string): unknown
}

export class EditFileWorkspaceCardController {
  private readonly store = createSnapshotStore<EditFileWorkspaceCardState>({ status: 'loading', workspaces: [], sessions: [] })

  constructor(private readonly host?: ClientHost) {
    void this.refresh()
  }

  async refresh(): Promise<void> {
    try {
      const response = await fetch(API.describe, { method: 'POST' })
      const body = await response.json() as DescribeBody
      if (body.ok !== true || body.value === undefined) throw new Error(body.error ?? 'describe failed')
      this.store.set({
        status: 'ready',
        workspaces: body.value.workspaces,
        sessions: body.value.sessions,
        notice: this.store.getSnapshot().notice,
      })
    } catch {
      this.store.set({ status: 'unavailable', workspaces: [], sessions: [] })
    }
  }

  /**
   * Ask the DSH Session list to re-pull its baseline so the sidebar shows the
   * new grouping (and the re-bound title/time) without a page reload.
   */
  private async refreshSessionList(): Promise<boolean> {
    const sessions = this.host?.get?.('sessions') as { refresh?: () => Promise<unknown> } | undefined
    if (typeof sessions?.refresh !== 'function') return false
    try {
      await sessions.refresh()
      return true
    } catch {
      return false
    }
  }

  async move(sessionId: string, workspaceId: string | null): Promise<MoveOutcome> {
    try {
      const response = await fetch(API.move, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, workspaceId }),
      })
      const body = await response.json() as DescribeBody
      if (body.ok !== true || body.value === undefined) throw new Error(body.error ?? 'move failed')
      this.store.set({
        status: 'ready',
        workspaces: body.value.workspaces,
        sessions: body.value.sessions,
        notice: { kind: 'ok', text: 'ok' },
        move: body.value.move,
      })
      return await this.refreshSessionList() ? 'refreshed' : 'reload'
    } catch (error) {
      this.store.update((draft) => {
        draft.notice = { kind: 'error', text: error instanceof Error ? error.message : String(error) }
      })
      await this.refresh().catch(() => {})
      return 'refreshed'
    }
  }

  inject(): EditFileWorkspaceCardFace {
    return {
      hooks: { editFileWorkspaceCard: this.store },
      refresh: async () => { await this.refresh() },
      move: async (sessionId, workspaceId) => this.move(sessionId, workspaceId),
    }
  }

  dispose(): void {}
}

export type EditFileWorkspaceCardProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'dsh-edit-file-workspace'>
  & InjectFace<EditFileWorkspaceCardFace>

const cardStyle: CSSProperties = {
  listStyle: 'none',
  border: '1px solid var(--dsw-alias-border-l2)',
  background: 'var(--dsw-alias-bg-layer-3)',
  borderRadius: 12,
  color: 'var(--dsw-alias-label-primary)',
}

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  padding: '14px 16px',
}

const titleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--dsw-alias-label-primary)',
  fontSize: 15,
  fontWeight: 600,
  lineHeight: 1.4,
}

const descriptionStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--dsw-alias-label-tertiary)',
  fontSize: 13,
  lineHeight: 1.5,
}

const bodyStyle: CSSProperties = {
  borderTop: '1px solid var(--dsw-alias-border-l2)',
  margin: '0 16px',
  padding: '8px 0 12px',
}

const toolbarStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  padding: '10px 0',
}

const inputStyle: CSSProperties = {
  border: '1px solid var(--dsw-alias-border-l2)',
  background: 'var(--dsw-alias-bg-layer-3)',
  color: 'var(--dsw-alias-label-primary)',
  borderRadius: 8,
  padding: '0 12px',
  height: 34,
  fontSize: 13,
  lineHeight: 1.5,
  width: '100%',
  boxSizing: 'border-box',
  font: 'inherit',
}

const buttonStyle: CSSProperties = {
  appearance: 'none',
  font: 'inherit',
  cursor: 'pointer',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 8,
  padding: '6px 16px',
  fontSize: 13,
  lineHeight: 1.5,
  background: 'transparent',
  color: 'var(--dsw-alias-label-secondary)',
}

const rowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) 220px',
  gap: 10,
  alignItems: 'center',
  padding: '8px 0',
  borderTop: '1px solid var(--dsw-alias-border-l1)',
}

const cellTitleStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.4,
  color: 'var(--dsw-alias-label-primary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const cellMutedStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.4,
  color: 'var(--dsw-alias-label-tertiary)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const selectStyle: CSSProperties = {
  border: '1px solid var(--dsw-alias-border-l2)',
  background: 'var(--dsw-alias-bg-layer-3)',
  color: 'var(--dsw-alias-label-primary)',
  borderRadius: 8,
  height: 34,
  padding: '0 8px',
  fontSize: 13,
  font: 'inherit',
}

const noticeStyle: CSSProperties = {
  margin: '8px 0 0',
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-state-success-primary)',
}

export function EditFileWorkspaceCard(props: EditFileWorkspaceCardProps) {
  const { t } = props
  const state = props.useEditFileWorkspaceCard(snapshot => snapshot)
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    void props.refresh()
  }, [])

  if (state.status === 'loading') return null
  if (state.status === 'unavailable') {
    return (
      <div style={cardStyle}>
        <header style={headerStyle}>
          <div>
            <h3 style={titleStyle}>{t('settings.title')}</h3>
            <p style={descriptionStyle}>{t('settings.unavailable')}</p>
          </div>
        </header>
      </div>
    )
  }

  const needle = filter.trim().toLowerCase()
  const sessions = state.sessions.filter((session) => {
    if (needle === '') return true
    const title = session.title ?? ''
    const id = session.sessionId ?? ''
    const cwd = session.cwd ?? ''
    return title.toLowerCase().includes(needle) || id.toLowerCase().includes(needle) || cwd.toLowerCase().includes(needle)
  })

  const projection = state.move?.projection
  const noticeText = state.notice?.kind === 'ok'
    ? t('settings.moved') + (projection === undefined || projection === 'bound' || projection === 'folded'
      ? ''
      : ' · ' + (projection === 'retagged' ? t('settings.projectionRetagged') : t('settings.projectionStale')))
    : state.notice?.kind === 'error'
      ? t('settings.moveFailed') + ': ' + state.notice.text
      : undefined
  const noticeColor = state.notice?.kind === 'error' || (state.notice?.kind === 'ok' && projection !== undefined && projection !== 'bound' && projection !== 'folded')
    ? 'var(--dsw-alias-label-error)'
    : 'var(--dsw-alias-state-success-primary)'

  return (
    <div style={cardStyle}>
      <header style={headerStyle}>
        <div>
          <h3 style={titleStyle}>{t('settings.title')}</h3>
          <p style={descriptionStyle}>{t('settings.description')}</p>
        </div>
      </header>

      <div style={bodyStyle}>
        <div style={toolbarStyle}>
          <input
            value={filter}
            placeholder={t('settings.filterPlaceholder')}
            onChange={(event) => { setFilter(event.target.value) }}
            style={inputStyle}
          />
          <button type="button" style={buttonStyle} onClick={() => { void props.refresh() }}>
            {t('settings.refresh')}
          </button>
        </div>

        {sessions.length === 0
          ? <p style={cellMutedStyle}>{t('settings.noSessions')}</p>
          : sessions.map((session) => {
            const current = state.workspaces.find((workspace) => workspace.workspaceId === session.workspaceId)
            const value = session.workspaceId ?? ''
            const disabled = session.live || busy === session.sessionId
            return (
              <div key={session.sessionId} style={rowStyle}>
                <div>
                  <div style={cellTitleStyle}>{session.title ?? session.sessionId}</div>
                  <div style={cellMutedStyle}>{session.cwd ?? ''}</div>
                </div>
                <div style={cellMutedStyle}>{current !== undefined ? current.title + ' — ' + current.path : t('settings.ungrouped')}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <select
                    value={value}
                    disabled={disabled}
                    style={selectStyle}
                    onChange={(event) => {
                      const next = event.target.value === '' ? null : event.target.value
                      setBusy(session.sessionId)
                      setLocalError(null)
                      void Promise.resolve()
                        .then(() => props.move(session.sessionId, next))
                        .then((outcome) => {
                          setBusy(null)
                          if (outcome === 'reload') window.location.reload()
                        })
                        .catch((error) => {
                          setBusy(null)
                          setLocalError(error instanceof Error ? error.message : String(error))
                        })
                    }}
                  >
                    <option value="">{t('settings.ungrouped')}</option>
                    {state.workspaces.map((workspace) => (
                      <option key={workspace.workspaceId} value={workspace.workspaceId}>
                        {workspace.title} — {workspace.path}
                      </option>
                    ))}
                  </select>
                  {session.live ? <span style={cellMutedStyle}>{t('settings.liveSession')}</span> : null}
                </div>
              </div>
            )
          })}

        {localError !== null
          ? <p style={{ ...noticeStyle, color: 'var(--dsw-alias-label-error)' }} role="status">{t('settings.moveFailed') + ': ' + localError}</p>
          : null}

        {noticeText !== undefined
          ? <p style={{ ...noticeStyle, color: noticeColor }} role="status">{noticeText}</p>
          : null}
      </div>
    </div>
  )
}
