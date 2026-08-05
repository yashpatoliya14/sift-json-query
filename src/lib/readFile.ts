/**
 * Streaming file reader.
 *
 * `file.text()` buffers the whole file before resolving and gives no progress.
 * Streaming through TextDecoderStream lets us report progress while the bytes
 * arrive and keeps every chunk off the main thread until it is appended.
 */

/** V8 caps a single string near 512M chars; beyond that JSON.parse can't run. */
export const MAX_TEXT_BYTES = 480 * 1024 * 1024;

/** Files under this read fine in one shot — streaming just adds overhead. */
const STREAM_THRESHOLD = 4 * 1024 * 1024;

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export async function readFileText(
  file: File,
  onProgress?: (fraction: number, bytesRead: number) => void,
): Promise<string> {
  if (file.size <= STREAM_THRESHOLD || typeof file.stream !== "function") {
    const text = await file.text();
    onProgress?.(1, file.size);
    return text;
  }

  const reader = file.stream().pipeThrough(new TextDecoderStream()).getReader();
  const chunks: string[] = [];
  let read = 0;
  let lastPaint = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    // byte length ≈ char length for JSON; good enough for a progress bar
    read += value.length;
    const now = performance.now();
    if (now - lastPaint > 60) {
      lastPaint = now;
      onProgress?.(Math.min(0.99, read / Math.max(1, file.size)), read);
      // let the progress bar paint between chunks
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }

  onProgress?.(1, read);
  // One join instead of incremental concatenation: avoids O(n²) rope churn.
  return chunks.join("");
}
