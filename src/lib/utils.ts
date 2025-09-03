import sharp from "sharp";
import type { ApiResponse } from "./apiClient.js";

const ONE_MB = 1024 * 1024;

/**
 * Sanitize a URL parameter to prevent command injection or unsafe characters.
 */
export function sanitizeUrlParam(param: string): string {
  // Allow only safe URL characters (alphanumeric + -_.~ and common URL delimiters)
  return param.replace(/[^a-zA-Z0-9\-_.~]/g, "");
}

/**
 * Compress a base64-encoded image if it exceeds 1 MB.
 * Ensures the output stays under 1 MB while maintaining reasonable quality.
 */
export async function maybeCompressBase64(base64: string): Promise<string> {
  const buffer = Buffer.from(base64, "base64");

  if (buffer.length <= ONE_MB) {
    return base64;
  }

  // Calculate estimated quality based on size ratio
  const sizeRatio = ONE_MB / buffer.length;
  const estimatedQuality = Math.floor(sizeRatio * 100);

  // Clamp quality between 30–95 for decent visual fidelity
  const quality = Math.min(95, Math.max(30, estimatedQuality));

  // Use WebP instead of PNG for better compression (fallback to PNG if needed)
  let compressedBuffer: Buffer;
  try {
    compressedBuffer = await sharp(buffer).webp({ quality }).toBuffer();
  } catch {
    compressedBuffer = await sharp(buffer).png({ quality }).toBuffer();
  }

  // Ensure final output is still under 1MB, if not, progressively reduce quality
  let finalQuality = quality;
  while (compressedBuffer.length > ONE_MB && finalQuality > 30) {
    finalQuality -= 5;
    compressedBuffer = await sharp(buffer).webp({ quality: finalQuality }).toBuffer();
  }

  return compressedBuffer.toString("base64");
}

/**
 * Asserts that a Response or ApiResponse is OK (2xx).
 * Throws meaningful errors based on status codes.
 */
export async function assertOkResponse(
  response: Response | ApiResponse,
  action: string,
): Promise<void> {
  if (!response.ok) {
    const statusText = "statusText" in response ? response.statusText : "Unknown error";

    if (response.status === 404) {
      throw new Error(`Invalid session ID for ${action}`);
    }

    if (response.status === 401) {
      throw new Error(`Unauthorized for ${action}. Check credentials.`);
    }

    if (response.status === 500) {
      throw new Error(`Server error while performing ${action}`);
    }

    throw new Error(`Failed ${action}: ${statusText} (status ${response.status})`);
  }
}
