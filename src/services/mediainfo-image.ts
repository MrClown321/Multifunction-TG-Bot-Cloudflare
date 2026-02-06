/**
 * MediaInfo Image Generator
 * Generates a visual image representation of media info
 */

import type { MediaInfoResult } from './mediainfo';

// Language code to flag emoji mapping
const LANG_FLAGS: Record<string, string> = {
  en: '🇺🇸', eng: '🇺🇸', english: '🇺🇸',
  es: '🇪🇸', spa: '🇪🇸', spanish: '🇪🇸',
  fr: '🇫🇷', fre: '🇫🇷', fra: '🇫🇷', french: '🇫🇷',
  de: '🇩🇪', ger: '🇩🇪', deu: '🇩🇪', german: '🇩🇪',
  it: '🇮🇹', ita: '🇮🇹', italian: '🇮🇹',
  pt: '🇵🇹', por: '🇵🇹', portuguese: '🇵🇹',
  ru: '🇷🇺', rus: '🇷🇺', russian: '🇷🇺',
  ja: '🇯🇵', jpn: '🇯🇵', japanese: '🇯🇵',
  ko: '🇰🇷', kor: '🇰🇷', korean: '🇰🇷',
  zh: '🇨🇳', chi: '🇨🇳', zho: '🇨🇳', chinese: '🇨🇳',
  ar: '🇸🇦', ara: '🇸🇦', arabic: '🇸🇦',
  hi: '🇮🇳', hin: '🇮🇳', hindi: '🇮🇳',
  nl: '🇳🇱', dut: '🇳🇱', nld: '🇳🇱', dutch: '🇳🇱',
  pl: '🇵🇱', pol: '🇵🇱', polish: '🇵🇱',
  tr: '🇹🇷', tur: '🇹🇷', turkish: '🇹🇷',
  th: '🇹🇭', tha: '🇹🇭', thai: '🇹🇭',
  vi: '🇻🇳', vie: '🇻🇳', vietnamese: '🇻🇳',
  sv: '🇸🇪', swe: '🇸🇪', swedish: '🇸🇪',
  da: '🇩🇰', dan: '🇩🇰', danish: '🇩🇰',
  no: '🇳🇴', nor: '🇳🇴', norwegian: '🇳🇴',
  fi: '🇫🇮', fin: '🇫🇮', finnish: '🇫🇮',
  el: '🇬🇷', gre: '🇬🇷', ell: '🇬🇷', greek: '🇬🇷',
  he: '🇮🇱', heb: '🇮🇱', hebrew: '🇮🇱',
  cs: '🇨🇿', cze: '🇨🇿', ces: '🇨🇿', czech: '🇨🇿',
  hu: '🇭🇺', hun: '🇭🇺', hungarian: '🇭🇺',
  ro: '🇷🇴', rum: '🇷🇴', ron: '🇷🇴', romanian: '🇷🇴',
  bg: '🇧🇬', bul: '🇧🇬', bulgarian: '🇧🇬',
  uk: '🇺🇦', ukr: '🇺🇦', ukrainian: '🇺🇦',
  sk: '🇸🇰', slo: '🇸🇰', slk: '🇸🇰', slovak: '🇸🇰',
  sl: '🇸🇮', slv: '🇸🇮', slovenian: '🇸🇮',
  hr: '🇭🇷', hrv: '🇭🇷', croatian: '🇭🇷',
  sr: '🇷🇸', srp: '🇷🇸', serbian: '🇷🇸',
  id: '🇮🇩', ind: '🇮🇩', indonesian: '🇮🇩',
  ms: '🇲🇾', may: '🇲🇾', msa: '🇲🇾', malay: '🇲🇾',
  et: '🇪🇪', est: '🇪🇪', estonian: '🇪🇪',
  lv: '🇱🇻', lav: '🇱🇻', latvian: '🇱🇻',
  lt: '🇱🇹', lit: '🇱🇹', lithuanian: '🇱🇹',
};

function getLanguageFlag(lang?: string): string {
  if (!lang) return '🏳️';
  const normalized = lang.toLowerCase().trim();
  return LANG_FLAGS[normalized] || '🏳️';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours} h ${minutes} min`;
  }
  return `${minutes} min ${seconds} sec`;
}

function formatBitrate(bps: number): string {
  if (bps >= 1000000) {
    return `${(bps / 1000000).toFixed(1)} Mb/s`;
  } else if (bps >= 1000) {
    return `${Math.round(bps / 1000)} kb/s`;
  }
  return `${bps} b/s`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface ParsedMediaInfo {
  filename: string;
  general: {
    container: string;
    size: string;
    runtime: string;
    bitrate: string;
  };
  video: {
    codec: string;
    resolution: string;
    aspectRatio: string;
    frameRate: string;
    frameCount: string;
    bitrate: string;
    bitDepth: string;
  } | null;
  audio: Array<{
    index: number;
    language: string;
    flag: string;
    codec: string;
    channels: string;
    bitrate: string;
    title?: string;
    isDefault?: boolean;
  }>;
  subtitles: Array<{
    index: number;
    format: string;
    language: string;
    flag: string;
    title?: string;
  }>;
}

/**
 * Parse MediaInfo result into structured data
 */
export function parseMediaInfo(result: MediaInfoResult, filename: string): ParsedMediaInfo {
  const parsed: ParsedMediaInfo = {
    filename,
    general: {
      container: 'Unknown',
      size: 'Unknown',
      runtime: 'Unknown',
      bitrate: 'Unknown',
    },
    video: null,
    audio: [],
    subtitles: [],
  };

  if (!result.media?.track) {
    return parsed;
  }

  let audioIndex = 0;
  let subtitleIndex = 0;

  for (const track of result.media.track) {
    const trackType = track['@type'];

    switch (trackType) {
      case 'General':
        parsed.general.container = String(track.Format || 'Unknown');
        if (track.FileSize) {
          parsed.general.size = formatFileSize(Number(track.FileSize));
        }
        if (track.Duration) {
          parsed.general.runtime = formatDuration(Number(track.Duration));
        }
        if (track.OverallBitRate) {
          parsed.general.bitrate = formatBitrate(Number(track.OverallBitRate));
        }
        break;

      case 'Video':
        const width = track.Width ? Number(track.Width) : 0;
        const height = track.Height ? Number(track.Height) : 0;
        
        // Calculate aspect ratio
        let aspectRatio = 'Unknown';
        if (width && height) {
          const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
          const divisor = gcd(width, height);
          const ratioW = width / divisor;
          const ratioH = height / divisor;
          // Simplify common ratios
          if ((ratioW === 16 && ratioH === 9) || (ratioW === 64 && ratioH === 36)) {
            aspectRatio = '16:9';
          } else if ((ratioW === 4 && ratioH === 3) || (ratioW === 16 && ratioH === 12)) {
            aspectRatio = '4:3';
          } else if (ratioW === 21 && ratioH === 9) {
            aspectRatio = '21:9';
          } else if (Math.abs(width / height - 2.35) < 0.1) {
            aspectRatio = '2.35:1';
          } else if (Math.abs(width / height - 2.39) < 0.1) {
            aspectRatio = '2.39:1';
          } else if (Math.abs(width / height - 1.85) < 0.1) {
            aspectRatio = '1.85:1';
          } else if (Math.abs(width / height - 1.78) < 0.1) {
            aspectRatio = '16:9';
          } else {
            aspectRatio = `${ratioW}:${ratioH}`;
          }
        }

        parsed.video = {
          codec: String(track.Format || track.Codec || 'Unknown'),
          resolution: width && height ? `${width}x${height}` : 'Unknown',
          aspectRatio,
          frameRate: track.FrameRate ? String(track.FrameRate) : 'Unknown',
          frameCount: track.FrameCount ? String(track.FrameCount) : 'Unknown',
          bitrate: track.BitRate ? formatBitrate(Number(track.BitRate)) : 'Unknown',
          bitDepth: track.BitDepth ? `${track.BitDepth} bits` : '8 bits',
        };
        break;

      case 'Audio':
        const lang = String(track.Language || 'und');
        const channels = track.Channels ? Number(track.Channels) : 2;
        const channelStr = channels === 1 ? '1ch' : 
                          channels === 2 ? '2ch' : 
                          channels === 6 ? '6ch' : 
                          channels === 8 ? '8ch' : `${channels}ch`;
        
        // Determine audio format with additional info
        let audioFormat = String(track.Format || 'Unknown');
        const formatProfile = track.Format_Profile as string | undefined;
        const commercialName = track.Format_Commercial_IfAny as string | undefined;
        
        // Add profile info for formats like TrueHD, DTS-HD
        if (formatProfile) {
          if (audioFormat === 'MLP FBA' || audioFormat.includes('TrueHD')) {
            audioFormat = 'MLP FBA';
            if (commercialName?.includes('Atmos')) {
              audioFormat += ' (Dolby Atmos)';
            }
          } else if (audioFormat === 'DTS' && formatProfile.includes('MA')) {
            audioFormat = 'DTS-HD MA';
          }
        }

        parsed.audio.push({
          index: audioIndex++,
          language: lang.charAt(0).toUpperCase() + lang.slice(1),
          flag: getLanguageFlag(lang),
          codec: audioFormat,
          channels: channelStr,
          bitrate: track.BitRate ? formatBitrate(Number(track.BitRate)) : 'Variable',
          title: track.Title ? String(track.Title) : undefined,
          isDefault: Boolean(track.Default === 'Yes' || track.Default === true),
        });
        break;

      case 'Text':
        const subLang = String(track.Language || 'und');
        const subFormat = String(track.Format || track.CodecID || 'Unknown');
        
        parsed.subtitles.push({
          index: subtitleIndex++,
          format: subFormat.toUpperCase().includes('UTF-8') ? 'UTF-8' : 
                  subFormat.toUpperCase().includes('ASS') ? 'ASS' :
                  subFormat.toUpperCase().includes('SRT') ? 'SRT' :
                  subFormat.toUpperCase().includes('PGS') ? 'PGS' :
                  subFormat.toUpperCase().includes('VOBSUB') ? 'VobSub' :
                  subFormat,
          language: subLang.charAt(0).toUpperCase() + subLang.slice(1),
          flag: getLanguageFlag(subLang),
          title: track.Title ? String(track.Title) : undefined,
        });
        break;
    }
  }

  return parsed;
}

/**
 * Generate HTML for the mediainfo visual
 */
export function generateMediaInfoHtml(parsed: ParsedMediaInfo): string {
  const audioHtml = parsed.audio.map((a, i) => {
    const defaultBadge = a.isDefault ? '<span class="badge">DEFAULT</span>' : '';
    const titleInfo = a.title ? `<br><span class="subtitle-info">(${escapeHtml(a.title)})</span>` : '';
    return `<div class="audio-track">#${i + 1}:${a.flag} ${a.language} ${a.channels} ${a.codec} @ ${a.bitrate} ${defaultBadge}${titleInfo}</div>`;
  }).join('\n');

  const subtitleHtml = parsed.subtitles.map((s, i) => {
    return `<span class="sub-item">#${i} ${s.format} ${s.language}</span>`;
  }).join(' ');

  const flagsHtml = [...new Set(parsed.subtitles.map(s => s.flag))].join(' ');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      color: #e0e0e0;
      padding: 20px;
      min-height: 100vh;
    }
    .container {
      max-width: 850px;
      margin: 0 auto;
      background: rgba(0, 0, 0, 0.4);
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
    .header {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .file-icon {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      flex-shrink: 0;
    }
    .file-info h1 {
      font-size: 14px;
      font-weight: 600;
      color: #fff;
      word-break: break-all;
      line-height: 1.4;
    }
    .file-info .year {
      font-size: 12px;
      color: #888;
      margin-top: 4px;
    }
    .sections {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }
    .section {
      background: rgba(255, 255, 255, 0.03);
      border-radius: 8px;
      padding: 16px;
    }
    .section-title {
      display: inline-block;
      background: linear-gradient(90deg, #00d4aa 0%, #00b894 100%);
      color: #000;
      font-weight: 700;
      font-size: 11px;
      padding: 4px 12px;
      border-radius: 4px;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .section-title.video { background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); }
    .section-title.audio { background: linear-gradient(90deg, #f093fb 0%, #f5576c 100%); }
    .section-title.text { background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%); }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 13px;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #888; }
    .info-value { color: #fff; font-weight: 500; }
    .full-width { grid-column: 1 / -1; }
    .audio-track {
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 6px;
      margin-bottom: 8px;
      font-size: 13px;
    }
    .audio-track:last-child { margin-bottom: 0; }
    .badge {
      background: #00d4aa;
      color: #000;
      font-size: 9px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 3px;
      margin-left: 8px;
    }
    .subtitle-info {
      color: #888;
      font-size: 11px;
      font-style: italic;
    }
    .sub-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .sub-item {
      background: rgba(255, 255, 255, 0.08);
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
    }
    .flags-row {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 20px;
      letter-spacing: 2px;
    }
    .footer {
      text-align: center;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 12px;
      color: #888;
    }
    .footer .heart { color: #e74c3c; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="file-icon">📁</div>
      <div class="file-info">
        <h1>${escapeHtml(parsed.filename)}</h1>
      </div>
    </div>
    
    <div class="sections">
      <div class="section">
        <div class="section-title">General</div>
        <div class="info-row">
          <span class="info-label">Container:</span>
          <span class="info-value">${escapeHtml(parsed.general.container)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Size:</span>
          <span class="info-value">${escapeHtml(parsed.general.size)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Runtime:</span>
          <span class="info-value">${escapeHtml(parsed.general.runtime)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Overall Bit Rate:</span>
          <span class="info-value">${escapeHtml(parsed.general.bitrate)}</span>
        </div>
      </div>
      
      ${parsed.video ? `
      <div class="section">
        <div class="section-title video">Video</div>
        <div class="info-row">
          <span class="info-label">Codec:</span>
          <span class="info-value">${escapeHtml(parsed.video.codec)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Resolution:</span>
          <span class="info-value">${escapeHtml(parsed.video.resolution)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Aspect Ratio:</span>
          <span class="info-value">${escapeHtml(parsed.video.aspectRatio)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Frame Rate:</span>
          <span class="info-value">${escapeHtml(parsed.video.frameRate)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Frame Count:</span>
          <span class="info-value">${escapeHtml(parsed.video.frameCount)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Bit Rate:</span>
          <span class="info-value">${escapeHtml(parsed.video.bitrate)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Bit Depth:</span>
          <span class="info-value">${escapeHtml(parsed.video.bitDepth)}</span>
        </div>
      </div>
      ` : ''}
      
      ${parsed.audio.length > 0 ? `
      <div class="section full-width">
        <div class="section-title audio">Audio</div>
        ${audioHtml}
      </div>
      ` : ''}
      
      ${parsed.subtitles.length > 0 ? `
      <div class="section full-width">
        <div class="section-title text">Text</div>
        <div class="sub-grid">
          ${subtitleHtml}
        </div>
        <div class="flags-row">${flagsHtml}</div>
      </div>
      ` : ''}
    </div>
    
    <div class="footer">
      Made with <span class="heart">❤️</span> by Zyfora
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate image URL using htmlcsstoimage.com API
 * Requires HCTI_USER_ID and HCTI_API_KEY environment variables
 */
export async function generateMediaInfoImage(
  html: string,
  apiUserId?: string,
  apiKey?: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!apiUserId || !apiKey) {
    return {
      success: false,
      error: 'Image generation API credentials not configured',
    };
  }

  try {
    const response = await fetch('https://hcti.io/v1/image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(`${apiUserId}:${apiKey}`),
      },
      body: JSON.stringify({
        html,
        css: '',
        google_fonts: 'JetBrains Mono',
        viewport_width: 900,
        viewport_height: 1200,
        device_scale: 2,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HCTI API returned ${response.status}: ${text}`);
    }

    const data = await response.json() as { url?: string };
    
    if (data.url) {
      return {
        success: true,
        url: data.url,
      };
    }

    throw new Error('Invalid response from HCTI API');
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Format mediainfo as a styled text message (fallback when image gen not available)
 */
export function formatMediaInfoStyledText(parsed: ParsedMediaInfo): string {
  const lines: string[] = [];
  
  lines.push(`📁 <b>${escapeHtml(parsed.filename)}</b>`);
  lines.push('');
  
  // General
  lines.push('━━━━━ <b>GENERAL</b> ━━━━━');
  lines.push(`<code>Container:</code>     ${parsed.general.container}`);
  lines.push(`<code>Size:</code>          ${parsed.general.size}`);
  lines.push(`<code>Runtime:</code>       ${parsed.general.runtime}`);
  lines.push(`<code>Bitrate:</code>       ${parsed.general.bitrate}`);
  lines.push('');
  
  // Video
  if (parsed.video) {
    lines.push('━━━━━ <b>VIDEO</b> ━━━━━');
    lines.push(`<code>Codec:</code>        ${parsed.video.codec}`);
    lines.push(`<code>Resolution:</code>   ${parsed.video.resolution}`);
    lines.push(`<code>Aspect Ratio:</code> ${parsed.video.aspectRatio}`);
    lines.push(`<code>Frame Rate:</code>   ${parsed.video.frameRate}`);
    lines.push(`<code>Bitrate:</code>      ${parsed.video.bitrate}`);
    lines.push(`<code>Bit Depth:</code>    ${parsed.video.bitDepth}`);
    lines.push('');
  }
  
  // Audio
  if (parsed.audio.length > 0) {
    lines.push('━━━━━ <b>AUDIO</b> ━━━━━');
    for (const a of parsed.audio) {
      const defaultBadge = a.isDefault ? ' [DEFAULT]' : '';
      lines.push(`#${a.index + 1}: ${a.flag} ${a.language} ${a.channels} ${a.codec} @ ${a.bitrate}${defaultBadge}`);
      if (a.title) {
        lines.push(`     <i>${escapeHtml(a.title)}</i>`);
      }
    }
    lines.push('');
  }
  
  // Subtitles
  if (parsed.subtitles.length > 0) {
    lines.push('━━━━━ <b>TEXT</b> ━━━━━');
    const subList = parsed.subtitles.map(s => `#${s.index} ${s.format} ${s.language}`);
    // Group subtitles into rows of 4
    for (let i = 0; i < subList.length; i += 4) {
      lines.push(subList.slice(i, i + 4).join('  '));
    }
    lines.push('');
    lines.push([...new Set(parsed.subtitles.map(s => s.flag))].join(' '));
  }
  
  lines.push('');
  lines.push('<i>Made with ❤️ by Zyfora</i>');
  
  return lines.join('\n');
}
