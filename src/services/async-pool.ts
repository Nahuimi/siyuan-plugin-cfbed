export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (!items.length)
    return

  const size = Math.max(1, concurrency)
  let currentIndex = 0

  async function runner() {
    while (currentIndex < items.length) {
      const index = currentIndex++
      await worker(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => runner()))
}
