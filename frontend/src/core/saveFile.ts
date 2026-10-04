import { isDemo } from './demo'

interface DownloadsCapability {
  save(request: { filename: string; data: string | Blob }): Promise<{ status: string }>
}

interface ClaudeHost {
  use(name: 'downloads'): Promise<DownloadsCapability | null>
}

/**
 * Saves a generated file on the user's disk. Inside the hosted demo the page
 * cannot start downloads itself, so it asks the host to offer the file.
 */
export async function saveFile(filename: string, data: Blob | string, type = 'application/octet-stream'): Promise<void> {
  const host = (window as unknown as { claude?: ClaudeHost }).claude
  if (isDemo && host?.use) {
    const downloads = await host.use('downloads')
    if (downloads) {
      try {
        await downloads.save({ filename, data })
      } catch (error) {
        if ((error as { code?: string }).code !== 'declined') throw new Error('Nie udało się zapisać pliku.')
      }
      return
    }
  }

  const blob = typeof data === 'string' ? new Blob([data], { type }) : data
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
