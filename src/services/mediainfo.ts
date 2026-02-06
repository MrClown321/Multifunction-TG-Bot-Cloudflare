/**
 * MediaInfo Factory for Cloudflare Workers
 * Creates and manages MediaInfo WASM instances
 */

// @ts-ignore - Import vendored/patched mediainfo.js bundle
import mediaInfoFactory from '../lib/mediainfo-bundle.js';

// @ts-ignore - Import collocated WASM module for bundling by Cloudflare
import wasmModule from '../lib/MediaInfoModule.wasm';

export interface MediaInfoTrack {
  '@type': string;
  Format?: string;
  FileSize?: number | string;
  Duration?: number | string;
  OverallBitRate?: number | string;
  FrameRate?: number | string;
  Width?: number | string;
  Height?: number | string;
  BitDepth?: number | string;
  ChromaSubsampling?: string;
  ColorSpace?: string;
  Channels?: number | string;
  SamplingRate?: number | string;
  BitRate?: number | string;
  Codec?: string;
  CodecID?: string;
  Language?: string;
  Title?: string;
  [key: string]: unknown;
}

export interface MediaInfoResult {
  media?: {
    '@ref'?: string;
    track: MediaInfoTrack[];
  };
  [key: string]: unknown;
}

export interface MediaInfoInstance {
  analyzeData: (
    size: number | (() => number | Promise<number>),
    readChunk: (chunkSize: number, offset: number) => Uint8Array | Promise<Uint8Array>
  ) => Promise<MediaInfoResult | string>;
  inform: () => string;
  close: () => void;
  reset: () => void;
  options: {
    format: string;
    chunkSize: number;
    coverData: boolean;
    full: boolean;
  };
}

/**
 * Creates a configured instance of MediaInfo.
 * Uses the vendored bundle which is patched for Cloudflare Workers.
 * Imports WASM as a module to be bundled by Cloudflare (avoiding runtime compilation).
 */
export const createMediaInfo = async (): Promise<MediaInfoInstance> => {
  return new Promise((resolve, reject) => {
    mediaInfoFactory(
      {
        format: 'object',
        full: true,
        wasmModule: wasmModule,
      },
      (mediainfo: MediaInfoInstance) => {
        resolve(mediainfo);
      },
      (err: unknown) => {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    );
  });
};

export interface AnalysisDiagnostics {
  wasmLoadTimeMs: number;
  analysisTimeMs: number;
  bufferSize: number;
  filename: string;
}

export interface MediaInfoAnalysis {
  result: MediaInfoResult;
  text: string;
  diagnostics: AnalysisDiagnostics;
}

/**
 * Analyze a media buffer and return formatted results
 */
export async function analyzeMediaBuffer(
  fileBuffer: Uint8Array,
  fileSize: number,
  filename: string
): Promise<MediaInfoAnalysis> {
  const tStart = performance.now();
  const diagnostics: AnalysisDiagnostics = {
    wasmLoadTimeMs: 0,
    analysisTimeMs: 0,
    bufferSize: fileBuffer.byteLength,
    filename,
  };

  const tFactory = performance.now();
  const mediaInfo = await createMediaInfo();
  diagnostics.wasmLoadTimeMs = Math.round(performance.now() - tFactory);

  // Set options for analysis
  mediaInfo.options.chunkSize = 5 * 1024 * 1024; // 5MB chunks
  mediaInfo.options.coverData = false;
  mediaInfo.options.full = true;

  const readChunk = (chunkSize: number, offset: number): Uint8Array => {
    if (offset >= fileBuffer.byteLength) {
      return new Uint8Array(0);
    }
    const end = Math.min(offset + chunkSize, fileBuffer.byteLength);
    return fileBuffer.subarray(offset, end);
  };

  try {
    const tAnalysis = performance.now();
    
    // First get JSON/object result
    mediaInfo.options.format = 'object';
    const result = await mediaInfo.analyzeData(
      () => fileSize,
      readChunk
    ) as MediaInfoResult;

    // Reset and get text output
    mediaInfo.reset();
    mediaInfo.options.format = 'text';
    await mediaInfo.analyzeData(() => fileSize, readChunk);
    const text = mediaInfo.inform();

    diagnostics.analysisTimeMs = Math.round(performance.now() - tAnalysis);

    return {
      result,
      text,
      diagnostics,
    };
  } finally {
    mediaInfo.close();
  }
}

/**
 * Format MediaInfo result as human-readable text for Telegram
 */
export function formatMediaInfoForTelegram(
  result: MediaInfoResult,
  text: string,
  diagnostics: AnalysisDiagnostics
): string {
  const lines: string[] = [];
  
  lines.push('--- MediaInfo Analysis ---\n');
  
  if (!result.media?.track) {
    lines.push('No media tracks detected in this file.');
    return lines.join('\n');
  }

  for (const track of result.media.track) {
    const trackType = track['@type'] || 'Unknown';
    lines.push(`[${trackType}]`);

    switch (trackType) {
      case 'General':
        if (track.Format) lines.push(`Format: ${track.Format}`);
        if (track.FileSize) lines.push(`Size: ${formatFileSize(Number(track.FileSize))}`);
        if (track.Duration) lines.push(`Duration: ${formatDuration(Number(track.Duration))}`);
        if (track.OverallBitRate) lines.push(`Overall Bitrate: ${formatBitrate(Number(track.OverallBitRate))}`);
        break;

      case 'Video':
        if (track.Format) lines.push(`Codec: ${track.Format}`);
        if (track.CodecID) lines.push(`Codec ID: ${track.CodecID}`);
        if (track.Width && track.Height) lines.push(`Resolution: ${track.Width}x${track.Height}`);
        if (track.FrameRate) lines.push(`Frame Rate: ${track.FrameRate} fps`);
        if (track.BitRate) lines.push(`Bitrate: ${formatBitrate(Number(track.BitRate))}`);
        if (track.BitDepth) lines.push(`Bit Depth: ${track.BitDepth}-bit`);
        if (track.ChromaSubsampling) lines.push(`Chroma: ${track.ChromaSubsampling}`);
        if (track.ColorSpace) lines.push(`Color Space: ${track.ColorSpace}`);
        break;

      case 'Audio':
        if (track.Format) lines.push(`Codec: ${track.Format}`);
        if (track.Channels) lines.push(`Channels: ${track.Channels}`);
        if (track.SamplingRate) lines.push(`Sample Rate: ${formatSampleRate(Number(track.SamplingRate))}`);
        if (track.BitRate) lines.push(`Bitrate: ${formatBitrate(Number(track.BitRate))}`);
        if (track.BitDepth) lines.push(`Bit Depth: ${track.BitDepth}-bit`);
        if (track.Language) lines.push(`Language: ${track.Language}`);
        if (track.Title) lines.push(`Title: ${track.Title}`);
        break;

      case 'Text':
        if (track.Format) lines.push(`Format: ${track.Format}`);
        if (track.Language) lines.push(`Language: ${track.Language}`);
        if (track.Title) lines.push(`Title: ${track.Title}`);
        break;

      default:
        // Include basic info for other track types
        if (track.Format) lines.push(`Format: ${track.Format}`);
        if (track.Language) lines.push(`Language: ${track.Language}`);
        break;
    }

    lines.push(''); // Empty line between tracks
  }

  lines.push('---');
  lines.push(`Analysis completed in ${diagnostics.wasmLoadTimeMs + diagnostics.analysisTimeMs}ms`);
  lines.push(`(WASM load: ${diagnostics.wasmLoadTimeMs}ms, Analysis: ${diagnostics.analysisTimeMs}ms)`);

  return lines.join('\n');
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function formatBitrate(bps: number): string {
  if (bps >= 1000000) {
    return `${(bps / 1000000).toFixed(2)} Mbps`;
  } else if (bps >= 1000) {
    return `${(bps / 1000).toFixed(1)} Kbps`;
  }
  return `${bps} bps`;
}

function formatSampleRate(hz: number): string {
  if (hz >= 1000) {
    return `${(hz / 1000).toFixed(1)} kHz`;
  }
  return `${hz} Hz`;
}
