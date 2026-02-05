export interface ToolParameter {
  type: string
  properties?: Record<string, any>
  required?: string[]
  description?: string
  enum?: string[]
  items?: any
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, ToolParameter>
    required?: string[]
  }
}

export interface PackManifest {
  name: string
  version: string
  description: string
  permissions?: string[]
  tools?: string[] // List of tool names provided by this pack
}

export interface PackModule {
  [key: string]: Function
}

export interface LoadedPack {
  manifest: PackManifest
  tools: ToolDefinition[]
  implementation: PackModule
}
