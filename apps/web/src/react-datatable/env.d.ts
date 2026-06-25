interface ImportMeta {
  readonly env: {
    readonly DEV?: boolean
    readonly MODE?: string
    readonly [key: string]: string | boolean | undefined
  }
}
