import { errorMessage } from '../domain/errors.js';
import type { CredentialPayload, CredentialRecord, ServerRecord } from '../domain/models.js';
import type { Logger } from '../observability/logger.js';
import type { Store } from '../storage/store.js';
import type { UpstreamOAuthService } from './oauth-service.js';

/**
 * Seconds before `expiresAt` at which an OAuth credential becomes eligible
 * for automatic refresh, so a near-expiry token is renewed before it is
 * actually rejected by the upstream server.
 */
export const OAUTH_REFRESH_GRACE_SECONDS = 60;

export interface OAuthRefreshCandidate {
  credentialId: string;
  server: ServerRecord;
}

export interface OAuthRefreshSelectionInput {
  credentials: CredentialRecord[];
  payloads: ReadonlyMap<string, CredentialPayload>;
  servers: ServerRecord[];
  /** Epoch milliseconds to evaluate expiry against. */
  now: number;
  graceSeconds: number;
}

/**
 * Picks OAuth credentials that are due for a non-interactive refresh: attached
 * to exactly one enabled remote MCP server, carrying both an access token and
 * a refresh token, with an `expiresAt` at or before `now + graceSeconds`.
 * Credentials without a refresh token or without an `expiresAt` are never
 * schedulable and are excluded.
 */
export function selectDueOAuthCredentials(
  input: OAuthRefreshSelectionInput,
): OAuthRefreshCandidate[] {
  const deadline = input.now + input.graceSeconds * 1000;
  const attachments = attachmentIndex(input.servers);
  const due: OAuthRefreshCandidate[] = [];
  for (const credential of input.credentials) {
    const payload = input.payloads.get(credential.id);
    if (!payload || payload.type !== 'oauth') continue;
    if (!payload.accessToken || !payload.refreshToken) continue;
    if (payload.expiresAt === undefined) continue;
    if (Date.parse(payload.expiresAt) > deadline) continue;
    const server = soleEnabledRemoteServer(attachments, credential.id);
    if (!server) continue;
    due.push({ credentialId: credential.id, server });
  }
  return due;
}

/**
 * Picks OAuth credentials that are already expired but carry no refresh token,
 * attached to exactly one enabled remote MCP server. The sweep cannot refresh
 * these; they are reported as auto-refresh failures so the event log explains
 * why manual authorization is still required.
 */
export function selectExpiredUnrefreshableOAuthCredentials(
  input: OAuthRefreshSelectionInput,
): OAuthRefreshCandidate[] {
  const attachments = attachmentIndex(input.servers);
  const stalled: OAuthRefreshCandidate[] = [];
  for (const credential of input.credentials) {
    const payload = input.payloads.get(credential.id);
    if (!payload || payload.type !== 'oauth') continue;
    if (!payload.accessToken || payload.refreshToken !== undefined) continue;
    if (payload.expiresAt === undefined || Date.parse(payload.expiresAt) > input.now) continue;
    const server = soleEnabledRemoteServer(attachments, credential.id);
    if (!server) continue;
    stalled.push({ credentialId: credential.id, server });
  }
  return stalled;
}

function attachmentIndex(servers: ServerRecord[]): Map<string, ServerRecord[]> {
  const attachments = new Map<string, ServerRecord[]>();
  for (const server of servers) {
    if (server.credentialId === null) continue;
    const list = attachments.get(server.credentialId);
    if (list) list.push(server);
    else attachments.set(server.credentialId, [server]);
  }
  return attachments;
}

function soleEnabledRemoteServer(
  attachments: Map<string, ServerRecord[]>,
  credentialId: string,
): ServerRecord | null {
  const attached = attachments.get(credentialId);
  if (!attached || attached.length !== 1) return null;
  const server = attached[0]!;
  if (!server.enabled) return null;
  if (server.kind !== 'remote' || server.transport.type !== 'streamable-http') return null;
  return server;
}

export interface OAuthRefreshSweepResult {
  /** Credentials selected as due for refresh this sweep. */
  due: number;
  refreshed: number;
  failed: number;
  /** Credentials skipped because their payload changed mid-sweep. */
  skipped: number;
}

/**
 * Periodically sweeps stored OAuth credentials and refreshes expired or
 * expiring access tokens through the non-interactive refresh-token grant,
 * without any human action. Healthy credentials are left untouched; failures
 * are recorded as events and never retried in a tight loop.
 */
export class OAuthRefreshSweeper {
  readonly #store: Store;
  readonly #oauth: UpstreamOAuthService;
  readonly #logger: Logger;
  readonly #graceSeconds: number;
  #running: Promise<OAuthRefreshSweepResult> | null = null;
  #timer: NodeJS.Timeout | undefined;
  #startup: NodeJS.Timeout | undefined;
  #stopped = false;

  constructor(
    store: Store,
    oauth: UpstreamOAuthService,
    logger: Logger,
    graceSeconds = OAUTH_REFRESH_GRACE_SECONDS,
  ) {
    this.#store = store;
    this.#oauth = oauth;
    this.#logger = logger;
    this.#graceSeconds = graceSeconds;
  }

  /** Starts the interval timer plus one sweep shortly after startup. */
  start(intervalSeconds: number): void {
    if (this.#timer) return;
    this.#timer = setInterval(() => void this.#tick(), intervalSeconds * 1_000);
    this.#timer.unref?.();
    this.#startup = setTimeout(() => void this.#tick(), 0);
    this.#startup.unref?.();
  }

  /** Stops the timers and waits for an in-flight sweep so shutdown is clean. */
  async stop(): Promise<void> {
    this.#stopped = true;
    if (this.#timer) clearInterval(this.#timer);
    if (this.#startup) clearTimeout(this.#startup);
    this.#timer = undefined;
    this.#startup = undefined;
    await this.#running;
  }

  /**
   * Runs one sweep immediately. Overlapping sweeps are deduped: a call while
   * a sweep is in flight awaits that same sweep instead of starting a second.
   */
  sweep(now = Date.now()): Promise<OAuthRefreshSweepResult> {
    if (this.#stopped) return Promise.resolve({ due: 0, refreshed: 0, failed: 0, skipped: 0 });
    if (this.#running) return this.#running;
    const operation = this.#sweepNow(now).finally(() => {
      this.#running = null;
    });
    this.#running = operation;
    return operation;
  }

  async #tick(): Promise<void> {
    try {
      await this.sweep();
    } catch (error) {
      this.#logger.warn('OAuth credential auto-refresh sweep failed', {
        error: errorMessage(error),
      });
    }
  }

  async #sweepNow(now: number): Promise<OAuthRefreshSweepResult> {
    const credentials = this.#store.listCredentials();
    const payloads = new Map<string, CredentialPayload>();
    for (const credential of credentials) {
      const payload = this.#store.getCredentialPayload(credential.id);
      if (payload) payloads.set(credential.id, payload);
    }
    const servers = this.#store.listServers();
    const selection: OAuthRefreshSelectionInput = {
      credentials,
      payloads,
      servers,
      now,
      graceSeconds: this.#graceSeconds,
    };
    const due = selectDueOAuthCredentials(selection);
    const stalled = selectExpiredUnrefreshableOAuthCredentials(selection);

    let refreshed = 0;
    let failed = 0;
    let skipped = 0;
    for (const candidate of stalled) {
      failed += 1;
      this.#store.appendEvent({
        level: 'warn',
        type: 'credential.auto_refresh_failed',
        serverId: candidate.server.id,
        message: `OAuth credential for ${candidate.server.slug} expired without a refresh token; manual authorization required`,
        detail: { credentialId: candidate.credentialId, reason: 'missing-refresh-token' },
      });
    }
    for (const candidate of due) {
      const selected = payloads.get(candidate.credentialId);
      const outcome = await this.#refreshCandidate(candidate, selected);
      if (outcome === 'refreshed') refreshed += 1;
      else if (outcome === 'failed') failed += 1;
      else skipped += 1;
    }
    return { due: due.length, refreshed, failed, skipped };
  }

  async #refreshCandidate(
    candidate: OAuthRefreshCandidate,
    selectedPayload: CredentialPayload | undefined,
  ): Promise<'refreshed' | 'failed' | 'skipped'> {
    const before = this.#store.getCredentialPayload(candidate.credentialId);
    if (
      before?.type !== 'oauth' ||
      (selectedPayload?.type === 'oauth' && before.accessToken !== selectedPayload.accessToken)
    ) {
      // A concurrent refresh (e.g. a 401-driven one) already replaced the
      // token since selection; do not refresh the same credential twice.
      return 'skipped';
    }
    try {
      const result = await this.#oauth.begin(candidate.credentialId, {});
      if (result.status === 'authorized') {
        this.#store.appendEvent({
          level: 'info',
          type: 'credential.auto_refreshed',
          serverId: candidate.server.id,
          message: `Auto-refreshed OAuth credential for ${candidate.server.slug}`,
          detail: { credentialId: candidate.credentialId },
        });
        return 'refreshed';
      }
      // begin() fell through to the interactive flow because the refresh grant
      // was rejected. Restore the pre-sweep payload so the credential keeps
      // its expired status; the manual authorize flow remains the fallback.
      if (before.type === 'oauth') {
        this.#store.updateCredential(candidate.credentialId, { payload: before });
      }
      this.#store.appendEvent({
        level: 'warn',
        type: 'credential.auto_refresh_failed',
        serverId: candidate.server.id,
        message: `Auto-refresh of OAuth credential for ${candidate.server.slug} failed; manual authorization required`,
        detail: { credentialId: candidate.credentialId, reason: 'refresh-rejected' },
      });
      return 'failed';
    } catch (error) {
      this.#store.appendEvent({
        level: 'warn',
        type: 'credential.auto_refresh_failed',
        serverId: candidate.server.id,
        message: `Auto-refresh of OAuth credential for ${candidate.server.slug} failed`,
        detail: { credentialId: candidate.credentialId, error: errorMessage(error) },
      });
      return 'failed';
    }
  }
}
