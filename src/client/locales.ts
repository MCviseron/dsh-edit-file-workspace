export const zh = {
  'settings.title': '会话工作区附属',
  'settings.description': '将历史会话重新归属到某个工作区，或移出所有工作区（未分组）',
  'settings.filterPlaceholder': '按标题、会话 ID 或路径筛选',
  'settings.refresh': '刷新',
  'settings.currentWorkspace': '当前',
  'settings.targetWorkspace': '目标工作区',
  'settings.ungrouped': '未分组',
  'settings.liveSession': '使用中，不可移动',
  'settings.noSessions': '没有可显示的会话',
  'settings.unavailable': '插件服务不可用，请确认 Host 插件已安装并重启 DSH',
  'settings.moveFailed': '移动失败',
  'settings.moved': '已移动',
  'settings.projectionRetagged': '标题与时间已随之迁移',
  'settings.projectionStale': '标题与时间缓存未能重建，打开该会话一次即可恢复',
} as const

export const en = {
  'settings.title': 'Session Workspace Affiliation',
  'settings.description': 'Reassign a historical session to a workspace, or remove it from all workspaces.',
  'settings.filterPlaceholder': 'Filter by title, session ID or path',
  'settings.refresh': 'Refresh',
  'settings.currentWorkspace': 'Current',
  'settings.targetWorkspace': 'Target workspace',
  'settings.ungrouped': 'Ungrouped',
  'settings.liveSession': 'In use, cannot move',
  'settings.noSessions': 'No sessions to show',
  'settings.unavailable': 'Plugin service unavailable. Confirm the host plugin is installed and restart DSH.',
  'settings.moveFailed': 'Move failed',
  'settings.moved': 'Moved',
  'settings.projectionRetagged': 'title and time moved with it',
  'settings.projectionStale': 'title/time cache could not be rebuilt; open the session once to restore it',
} as const

export type EditFileWorkspaceKey = keyof typeof zh
