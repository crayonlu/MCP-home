const KEY_STORAGE = 'mch.controlKey'

export class ApiError extends Error {
  status: number
  code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export function getStoredKey(): string | null {
  return localStorage.getItem(KEY_STORAGE)
}

export function storeKey(key: string, remember: boolean) {
  if (remember) localStorage.setItem(KEY_STORAGE, key)
  else sessionStorage.setItem(KEY_STORAGE, key)
}

export function clearKey() {
  localStorage.removeItem(KEY_STORAGE)
  sessionStorage.removeItem(KEY_STORAGE)
}

function readKey(): string | null {
  return localStorage.getItem(KEY_STORAGE) ?? sessionStorage.getItem(KEY_STORAGE)
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const key = readKey()
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (key) headers['Authorization'] = `Bearer ${key}`

  const response = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 401) {
    clearKey()
    window.dispatchEvent(new Event('mch:unauthorized'))
    throw new ApiError(401, 'Unauthorized')
  }

  const text = await response.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'message' in data
        ? String((data as { message: unknown }).message)
        : `Request failed (${response.status})`
    const code =
      typeof data === 'object' && data !== null && 'code' in data
        ? String((data as { code: unknown }).code)
        : undefined
    throw new ApiError(response.status, message, code)
  }

  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}
