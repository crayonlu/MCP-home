export type ServerKind = 'remote' | 'home'
export type Transport =
  | { type: 'streamable-http'; url: string }
  | { type: 'stdio'; command: string; args?: string[] }

export interface ServerSettings {
  connectTimeoutMs: number
  requestTimeoutMs: number
  maxTotalTimeoutMs: number
  maxConcurrency: number
  restart: 'on-failure' | 'always' | 'never'
}

export interface ServerRecord {
  id: string
  slug: string
  name: string
  kind: ServerKind
  transport: Transport
  credentialId: string | null
  enabled: boolean
  settings: ServerSettings
  createdAt: string
  updatedAt: string
}

export type RuntimeStatus =
  | 'ready'
  | 'connecting'
  | 'disabled'
  | 'unknown'
  | 'unreachable'
  | 'auth-required'
  | 'error'
  | 'stopping'

export interface RuntimeState {
  status: RuntimeStatus
  lastError: string | null
  lastSuccessAt: string | null
  updatedAt: string
  protocolVersion?: string
  protocolEra?: string
  serverInfo?: { name?: string; version?: string }
}

export type ServerWithRuntime = ServerRecord & { runtime: RuntimeState | null }

export type CredentialType = 'bearer' | 'api-key' | 'headers' | 'env' | 'oauth'
export type CredentialStatus = 'ready' | 'pending' | 'expired' | 'invalid'

export interface CredentialRecord {
  id: string
  name: string
  type: CredentialType
  status: CredentialStatus
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ApiKeyRecord {
  id: string
  kind: 'control' | 'access'
  name: string
  prefix: string
  createdAt: string
}

export interface Overview {
  servers: {
    total: number
    enabled: number
    remote: number
    home: number
    ready: number
    unhealthy: number
  }
  credentials: number
  accessKeys: number
  controlKeys: number
  endpoints: {
    aggregate: string
    individual: Record<string, string>
  }
  ok: boolean
}

export interface DiagnosticServer {
  slug: string
  status: string
  hasSnapshot: boolean
  lastError?: string | null
}

export interface Diagnostics {
  ok: boolean
  servers: DiagnosticServer[]
}

export type EventLevel = 'info' | 'warn' | 'error'

export interface EventRecord {
  id: string
  level: EventLevel
  type: string
  message: string
  createdAt: string
  serverId?: string
  credentialId?: string
}

export interface ToolInfo {
  name: string
  description?: string
  inputSchema?: unknown
}

export interface PromptInfo {
  name: string
  description?: string
}

export interface ResourceInfo {
  uri: string
  name?: string
}

export interface CapabilitySnapshot {
  serverId: string
  version: number
  protocolVersion: string
  protocolEra: 'modern' | 'legacy'
  serverInfo: { name?: string; version?: string } | null
  capabilities: {
    tools?: { listChanged?: boolean }
    prompts?: { listChanged?: boolean }
    resources?: { listChanged?: boolean; subscribe?: boolean }
    completions?: unknown
    logging?: unknown
  }
  instructions: string | null
  tools: ToolInfo[]
  prompts: PromptInfo[]
  resources: ResourceInfo[]
  resourceTemplates: unknown[]
  updatedAt: string
}

export interface ServerLogEntry {
  timestamp: string
  level: string
  message: string
}

export interface AuthorizeResult {
  status: 'authorized' | 'authorization-required'
  authorizationUrl?: string
  callbackUrl?: string
  credential?: CredentialRecord
}

export interface CredentialTestResult {
  valid: boolean
  requiresAuthorization?: boolean
  verifiedAgainstUpstream?: boolean
  servers: { id: string; slug: string; ok: boolean; error?: string }[]
  error?: string
}
