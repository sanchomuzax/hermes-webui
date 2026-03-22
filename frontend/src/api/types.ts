export interface SessionSummary {
  id: string
  source: string
  model: string | null
  title: string | null
  started_at: number
  ended_at: number | null
  end_reason: string | null
  message_count: number
  tool_call_count: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  reasoning_tokens: number
  estimated_cost_usd: number | null
  actual_cost_usd: number | null
  billing_provider: string | null
  preview: string
  last_active: number | null
}

export interface SessionListResponse {
  sessions: SessionSummary[]
  total: number
  limit: number
  offset: number
}

export interface Message {
  id: number
  session_id: string
  role: string
  content: string | null
  tool_call_id: string | null
  tool_calls: unknown
  tool_name: string | null
  timestamp: number
  token_count: number | null
  finish_reason: string | null
}

export interface SessionStats {
  total_sessions: number
  total_messages: number
  total_estimated_cost_usd: number
  sessions_by_source: Record<string, number>
  sessions_by_model: Record<string, number>
}

export interface SearchResult {
  id: number
  session_id: string
  role: string
  snippet: string
  timestamp: number
  tool_name: string | null
  source: string
  model: string | null
  session_started: number
  context: Array<{ role: string; content: string }>
}

export interface GatewayStatus {
  running: boolean
  pid: number | null
  uptime_seconds: number | null
  platforms: Array<{
    name: string
    connected: boolean
    details: Record<string, unknown> | null
  }>
}

export interface ConfigResponse {
  config: Record<string, unknown>
}

export interface CronJob {
  id: string
  name: string
  schedule: string | Record<string, string>
  prompt: string
  enabled: boolean
  last_run: string | null
  next_run: string | null
  created_at: string | null
}

export interface SkillInfo {
  name: string
  dir_name: string
  path: string
  description: string
  tools: string[]
  docs: string[]
}

export interface SkillDetail {
  name: string
  dir_name: string
  source: string
  description: string
  meta: Record<string, unknown>
  docs: Record<string, string>
  py_files: Record<string, string>
}

export interface WSEvent {
  type: string
  data: Record<string, unknown>
  timestamp: number
}
