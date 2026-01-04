import { inject } from 'vitest'

// @ts-expect-error - inject is typed as never by default in some versions or configs
const url = inject('opencodeUrl') as string | undefined
if (url && typeof url === 'string') {
  process.env.OPENCODE_SERVER_URL = url
}
