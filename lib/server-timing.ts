export class ServerTiming {
  private last = performance.now()
  private readonly entries: Array<{ name: string; duration: number }> = []

  mark(name: string) {
    const current = performance.now()
    this.entries.push({
      name: name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40),
      duration: Math.max(0, current - this.last)
    })
    this.last = current
  }

  header() {
    return this.entries
      .map((entry) => `${entry.name};dur=${entry.duration.toFixed(1)}`)
      .join(", ")
  }

  headers() {
    const value = this.header()
    return value ? { "Server-Timing": value } : undefined
  }
}
