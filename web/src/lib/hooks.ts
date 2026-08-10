import { useCallback, useEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import { api, errorMessage } from '@/lib/api';

export interface Resource<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Fetch + optional polling wrapper around the typed `api()` client.
 * Pass `null` for path to pause fetching (e.g. when a sheet is closed).
 */
export function useResource<T>(
  path: string | null,
  schema: z.ZodType<T>,
  options?: { pollMs?: number; skipInitial?: boolean },
): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(options?.skipInitial !== true);
  const [tick, setTick] = useState(0);
  const schemaRef = useRef(schema);
  schemaRef.current = schema;

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (path === null) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    api(path, schemaRef.current)
      .then((d) => {
        if (alive) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (alive) setError(errorMessage(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [path, tick]);

  useEffect(() => {
    if (path === null || !options?.pollMs) return;
    const id = window.setInterval(() => setTick((t) => t + 1), options.pollMs);
    return () => window.clearInterval(id);
  }, [path, options?.pollMs]);

  return { data, error, loading, reload };
}

export type Route = 'overview' | 'servers' | 'credentials' | 'keys' | 'logs';

const ROUTES: Route[] = ['overview', 'servers', 'credentials', 'keys', 'logs'];

function readHash(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '');
  return (ROUTES as string[]).includes(raw) ? (raw as Route) : 'overview';
}

export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(readHash);
  useEffect(() => {
    const on = () => setRoute(readHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = useCallback((r: Route) => {
    window.location.hash = `/${r}`;
  }, []);
  return [route, go];
}
