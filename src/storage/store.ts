import type {
  ApiKeyKind,
  ApiKeyRecord,
  CapabilitySnapshot,
  CreateCredentialInput,
  CreateServerInput,
  CredentialPayload,
  CredentialRecord,
  EventRecord,
  RuntimeState,
  ServerRecord,
  UpdateCredentialInput,
  UpdateServerInput,
} from '../domain/models.js';

export interface CreateKeyInput {
  kind: ApiKeyKind;
  name: string;
  prefix: string;
  digest: string;
}

export interface StoredApiKey extends ApiKeyRecord {
  digest: string;
}

export interface Store {
  close(): void;
  transaction<T>(operation: () => T): T;
  listServers(): ServerRecord[];
  getServer(id: string): ServerRecord | null;
  getServerBySlug(slug: string): ServerRecord | null;
  createServer(input: CreateServerInput): ServerRecord;
  updateServer(id: string, input: UpdateServerInput): ServerRecord;
  deleteServer(id: string): void;
  listCredentials(): CredentialRecord[];
  getCredential(id: string): CredentialRecord | null;
  getCredentialPayload(id: string): CredentialPayload | null;
  createCredential(input: CreateCredentialInput): CredentialRecord;
  updateCredential(id: string, input: UpdateCredentialInput): CredentialRecord;
  deleteCredential(id: string): void;
  listApiKeys(kind: ApiKeyKind): ApiKeyRecord[];
  createApiKey(input: CreateKeyInput): ApiKeyRecord;
  getApiKey(id: string, kind: ApiKeyKind): ApiKeyRecord | null;
  getApiKeyByDigest(kind: ApiKeyKind, digest: string): StoredApiKey | null;
  revokeApiKey(id: string, kind: ApiKeyKind): void;
  touchApiKey(id: string): void;
  getSnapshot(serverId: string): CapabilitySnapshot | null;
  saveSnapshot(snapshot: CapabilitySnapshot): CapabilitySnapshot;
  deleteSnapshot(serverId: string): void;
  getRuntimeState(serverId: string): RuntimeState | null;
  saveRuntimeState(state: RuntimeState): RuntimeState;
  appendEvent(event: Omit<EventRecord, 'id' | 'createdAt'>): EventRecord;
  listEvents(options?: { serverId?: string; limit?: number }): EventRecord[];
}
