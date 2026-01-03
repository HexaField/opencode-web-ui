import { z } from 'zod'
import { FolderBodyShape } from '../common/common.schema'

export const ConnectSchema = z.object({
  body: FolderBodyShape
})

export type ConnectRequest = z.infer<typeof ConnectSchema>
