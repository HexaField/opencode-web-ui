// Helper to unwrap SDK response
export function unwrap<T>(res: { data?: T; error?: unknown } | T): T {
  if (res && typeof res === 'object') {
    if ('error' in res && res.error) {
      throw new Error(JSON.stringify(res.error, null, 2))
    }
    if ('data' in res) {
      const obj = res as { data: T }
      return obj.data
    }
  }
  return res as T
}
