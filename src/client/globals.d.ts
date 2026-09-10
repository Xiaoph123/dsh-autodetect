declare global {
  interface Window {
    __ModuleLoader__: {
      load(value: unknown): void
    }
  }
}

export {}
