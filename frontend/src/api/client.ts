const API_BASE = '/api'

function getToken(): string {
  return sessionStorage.getItem('hermes_webui_token') || ''
}

export function setToken(token: string): void {
  sessionStorage.setItem('hermes_webui_token', token)
}

export function hasToken(): boolean {
  return !!sessionStorage.getItem('hermes_webui_token')
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Hermes-Token': token,
      ...options?.headers,
    },
  })

  if (!res.ok) {
    if (res.status === 401) {
      sessionStorage.removeItem('hermes_webui_token')
      throw new Error('Authentication required')
    }
    const body = await res.text()
    throw new Error(`API error ${res.status}: ${body}`)
  }

  return res.json()
}

export const api = {
  // Health
  health: () => request<{ status: string; version: string }>('/health'),

  // Sessions
  sessions: (params?: { source?: string; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams()
    if (params?.source) searchParams.set('source', params.source)
    if (params?.limit) searchParams.set('limit', String(params.limit))
    if (params?.offset) searchParams.set('offset', String(params.offset))
    const qs = searchParams.toString()
    return request<import('./types').SessionListResponse>(`/sessions${qs ? `?${qs}` : ''}`)
  },

  sessionStats: () => request<import('./types').SessionStats>('/sessions/stats'),

  session: (id: string) => request<Record<string, unknown>>(`/sessions/${id}`),

  sessionMessages: (id: string) => request<import('./types').Message[]>(`/sessions/${id}/messages`),

  sessionExport: (id: string) => request<Record<string, unknown>>(`/sessions/${id}/export`),

  setSessionTitle: (id: string, title: string) =>
    request(`/sessions/${id}/title`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),

  // Search
  searchMessages: (q: string, params?: { source?: string; limit?: number }) => {
    const searchParams = new URLSearchParams({ q })
    if (params?.source) searchParams.set('source', params.source)
    if (params?.limit) searchParams.set('limit', String(params.limit))
    return request<import('./types').SearchResult[]>(`/search/messages?${searchParams}`)
  },

  // Gateway
  gatewayStatus: () => request<import('./types').GatewayStatus>('/gateway/status'),

  // Config
  config: () => request<import('./types').ConfigResponse>('/config'),

  patchConfig: (path: string, value: unknown) =>
    request('/config', {
      method: 'PATCH',
      body: JSON.stringify({ path, value }),
    }),

  envVariables: () => request<{ variables: Array<{ key: string; value: string; is_sensitive: boolean }> }>('/config/env'),

  patchEnv: (key: string, value: string) =>
    request('/config/env', {
      method: 'PATCH',
      body: JSON.stringify({ key, value }),
    }),

  // Cron
  cronJobs: () => request<{ jobs: import('./types').CronJob[] }>('/cron/jobs'),

  createCronJob: (data: { name: string; schedule: string; prompt: string; enabled?: boolean }) =>
    request('/cron/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCronJob: (id: string, data: Partial<import('./types').CronJob>) =>
    request(`/cron/jobs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteCronJob: (id: string) =>
    request(`/cron/jobs/${id}`, { method: 'DELETE' }),

  cronJobOutput: (id: string) =>
    request<{ job_id: string; outputs: Array<Record<string, unknown>> }>(`/cron/jobs/${id}/output`),

  // Skills
  builtinSkills: () => request<{ skills: import('./types').SkillInfo[] }>('/skills/builtin'),
  customSkills: () => request<{ skills: import('./types').SkillInfo[] }>('/skills/custom'),
  skillDetail: (source: string, dirName: string) =>
    request<import('./types').SkillDetail>(`/skills/detail/${source}/${dirName}`),
}
