import type { AuthProvider, OAuthClientProvider } from '@modelcontextprotocol/client';
import { AppError } from '../domain/errors.js';
import type { CredentialPayload, ServerRecord } from '../domain/models.js';
import type { Store } from '../storage/store.js';
import { StoredOAuthProvider } from './oauth-provider.js';

export interface ResolvedCredential {
  headers: Record<string, string>;
  env: Record<string, string>;
  authProvider?: AuthProvider | OAuthClientProvider;
}

export class CredentialResolver {
  readonly #store: Store;
  readonly #publicUrl: URL;
  readonly #urlClientId: boolean;

  constructor(store: Store, publicUrl: URL, urlClientId = true) {
    this.#store = store;
    this.#publicUrl = publicUrl;
    this.#urlClientId = urlClientId;
  }

  resolve(server: ServerRecord): ResolvedCredential {
    const credentialId = server.credentialId;
    if (credentialId === null) return { headers: {}, env: {} };
    const payload = this.#store.getCredentialPayload(credentialId);
    if (!payload) throw new AppError('credential_not_found', 'Server credential not found', 400);
    return this.#resolvePayload(server, payload, credentialId);
  }

  #resolvePayload(
    server: ServerRecord,
    payload: CredentialPayload,
    credentialId: string,
  ): ResolvedCredential {
    switch (payload.type) {
      case 'bearer':
        return {
          headers: {},
          env: {},
          authProvider: { token: async () => payload.token },
        };
      case 'api-key':
        return { headers: { [payload.headerName]: payload.value }, env: {} };
      case 'headers':
        return { headers: payload.headers, env: {} };
      case 'env':
        return { headers: {}, env: payload.variables };
      case 'oauth':
        if (server.transport.type !== 'streamable-http') {
          throw new AppError(
            'oauth_remote_only',
            'OAuth credentials require a remote MCP server',
            400,
          );
        }
        if (
          this.#store
            .listServers()
            .some(
              (candidate) => candidate.id !== server.id && candidate.credentialId === credentialId,
            )
        ) {
          throw new AppError(
            'oauth_credential_reused',
            'OAuth credentials cannot be shared between MCP servers',
            400,
          );
        }
        return {
          headers: {},
          env: {},
          authProvider: new StoredOAuthProvider(this.#store, credentialId, this.#publicUrl, {
            urlClientId: this.#urlClientId,
          }),
        };
    }
  }
}
