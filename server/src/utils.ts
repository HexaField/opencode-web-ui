// Helper to unwrap SDK response
export function unwrap<T>(res: { data: T } | T): T {
  if (res && typeof res === 'object' && 'data' in res) {
    return (res as { data: T }).data
  }
  return res
}
