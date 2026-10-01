export interface TypedData {
  domain: Record<string, unknown>
  types: Record<string, ReadonlyArray<{ name: string; type: string }>>
  primaryType: string
  message: Record<string, string>
}
