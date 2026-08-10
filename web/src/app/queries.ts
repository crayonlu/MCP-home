import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type {
  ApiKeyRecord,
  AuthorizeResult,
  CapabilitySnapshot,
  CredentialRecord,
  CredentialTestResult,
  Diagnostics,
  EventRecord,
  EventLevel,
  MarketEntry,
  Overview,
  ServerLogEntry,
  ServerRecord,
  ServerWithRuntime,
} from '../api/types'

export function useOverview() {
  return useQuery({ queryKey: ['overview'], queryFn: () => api.get<Overview>('/api/v1/overview') })
}

export function useServers() {
  return useQuery({
    queryKey: ['servers'],
    queryFn: () => api.get<ServerWithRuntime[]>('/api/v1/servers'),
    refetchInterval: 8000,
  })
}

export function useServer(id: string) {
  return useQuery({
    queryKey: ['servers', id],
    queryFn: () => api.get<ServerWithRuntime>(`/api/v1/servers/${id}`),
    enabled: Boolean(id),
    refetchInterval: 8000,
  })
}

export function useCredentials() {
  return useQuery({
    queryKey: ['credentials'],
    queryFn: () => api.get<CredentialRecord[]>('/api/v1/credentials'),
    refetchInterval: 8000,
  })
}

export function useCredential(id: string) {
  return useQuery({
    queryKey: ['credentials', id],
    queryFn: () => api.get<CredentialRecord>(`/api/v1/credentials/${id}`),
    enabled: Boolean(id),
  })
}

export function useAccessKeys() {
  return useQuery({
    queryKey: ['access-keys'],
    queryFn: () => api.get<ApiKeyRecord[]>('/api/v1/access-keys'),
  })
}

export function useControlKeys() {
  return useQuery({
    queryKey: ['control-keys'],
    queryFn: () => api.get<ApiKeyRecord[]>('/api/v1/control-keys'),
  })
}

export function useDiagnostics() {
  return useQuery({
    queryKey: ['diagnostics'],
    queryFn: () => api.get<Diagnostics>('/api/v1/diagnostics'),
    refetchInterval: 10000,
  })
}

export function useEvents(limit = 100, level?: EventLevel) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (level) params.set('level', level)
  return useQuery({
    queryKey: ['events', limit, level],
    queryFn: () => api.get<EventRecord[]>(`/api/v1/events?${params}`),
    refetchInterval: 8000,
  })
}

export function useServerCapabilities(id: string) {
  return useQuery({
    queryKey: ['servers', id, 'capabilities'],
    queryFn: () => api.get<CapabilitySnapshot>(`/api/v1/servers/${id}/capabilities`),
    enabled: Boolean(id),
  })
}

export function useServerLogs(id: string) {
  return useQuery({
    queryKey: ['servers', id, 'logs'],
    queryFn: () => api.get<ServerLogEntry[]>(`/api/v1/servers/${id}/logs`),
    enabled: Boolean(id),
    refetchInterval: 8000,
  })
}

export function useCreateServer() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: unknown) => api.post<ServerRecord>('/api/v1/servers', input),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['servers'] })
      client.invalidateQueries({ queryKey: ['overview'] })
    },
  })
}

export function useUpdateServer() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: unknown }) =>
      api.patch<ServerRecord>(`/api/v1/servers/${id}`, input),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['servers'] })
      client.invalidateQueries({ queryKey: ['overview'] })
    },
  })
}

export function useDeleteServer() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string }) => api.delete(`/api/v1/servers/${id}`),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['servers'] })
      client.invalidateQueries({ queryKey: ['overview'] })
    },
  })
}

export function useServerAction() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'enable' | 'disable' | 'refresh' | 'restart' }) =>
      api.post(`/api/v1/servers/${id}/${action}`),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['servers'] })
    },
  })
}

export function useCreateCredential() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: unknown) => api.post<CredentialRecord>('/api/v1/credentials', input),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['credentials'] })
      client.invalidateQueries({ queryKey: ['overview'] })
    },
  })
}

export function useUpdateCredential() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: unknown }) =>
      api.patch<CredentialRecord>(`/api/v1/credentials/${id}`, input),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['credentials'] })
    },
  })
}

export function useDeleteCredential() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string }) => api.delete(`/api/v1/credentials/${id}`),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['credentials'] })
      client.invalidateQueries({ queryKey: ['overview'] })
    },
  })
}

export function useTestCredential() {
  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      api.post<CredentialTestResult>(`/api/v1/credentials/${id}/test`),
  })
}

export function useAuthorizeCredential() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
      api.post<AuthorizeResult>(`/api/v1/credentials/${id}/authorize`, { force: force ?? false }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['credentials'] })
    },
  })
}

export function useRevokeCredential() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/credentials/${id}/revoke`),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['credentials'] })
    },
  })
}

export function useCreateAccessKey() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.post<ApiKeyRecord & { secret?: string }>('/api/v1/access-keys', { name }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['access-keys'] })
    },
  })
}

export function useRevokeAccessKey() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string }) => api.delete(`/api/v1/access-keys/${id}`),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['access-keys'] })
    },
  })
}

export function useCreateControlKey() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.post<ApiKeyRecord & { secret?: string }>('/api/v1/control-keys', { name }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['control-keys'] })
    },
  })
}

export function useRevokeControlKey() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string }) => api.delete(`/api/v1/control-keys/${id}`),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['control-keys'] })
    },
  })
}

export function useMarket() {
  return useQuery({
    queryKey: ['market'],
    queryFn: () => api.get<MarketEntry[]>('/api/v1/market'),
  })
}

export function useMarketInstall() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, string> }) =>
      api.post(`/api/v1/market/${id}/install`, { values }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['market'] })
      client.invalidateQueries({ queryKey: ['servers'] })
      client.invalidateQueries({ queryKey: ['overview'] })
    },
  })
}

export function useMarketUninstall() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string }) => api.post(`/api/v1/market/${id}/uninstall`),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['market'] })
      client.invalidateQueries({ queryKey: ['servers'] })
      client.invalidateQueries({ queryKey: ['overview'] })
    },
  })
}
