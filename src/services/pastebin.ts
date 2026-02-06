// Pastebin Service - Upload text and get shareable links

import { logger } from '../utils/logger';

export interface PasteResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload text to a pastebin service and return the URL
 * Tries multiple services in order until one succeeds
 */
export async function uploadToPastebin(
  content: string,
  title?: string,
  expiryDays: number = 7
): Promise<PasteResult> {
  const errors: string[] = [];

  // Try paste.rs first (reliable, simple API)
  try {
    const pasteRsResult = await uploadToPasteRs(content);
    if (pasteRsResult.success) {
      logger.info('Pastebin upload succeeded via paste.rs');
      return pasteRsResult;
    }
    errors.push(`paste.rs: ${pasteRsResult.error}`);
  } catch (e) {
    errors.push(`paste.rs: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Try dpaste.org
  try {
    const dpasteResult = await uploadToDpaste(content, title, expiryDays);
    if (dpasteResult.success) {
      logger.info('Pastebin upload succeeded via dpaste.org');
      return dpasteResult;
    }
    errors.push(`dpaste.org: ${dpasteResult.error}`);
  } catch (e) {
    errors.push(`dpaste.org: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Try 0x0.st as fallback
  try {
    const fallbackResult = await uploadTo0x0(content);
    if (fallbackResult.success) {
      logger.info('Pastebin upload succeeded via 0x0.st');
      return fallbackResult;
    }
    errors.push(`0x0.st: ${fallbackResult.error}`);
  } catch (e) {
    errors.push(`0x0.st: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Try hastebin as last resort
  try {
    const hastebinResult = await uploadToHastebin(content);
    if (hastebinResult.success) {
      logger.info('Pastebin upload succeeded via hastebin');
      return hastebinResult;
    }
    errors.push(`hastebin: ${hastebinResult.error}`);
  } catch (e) {
    errors.push(`hastebin: ${e instanceof Error ? e.message : String(e)}`);
  }

  logger.error('All paste services failed', new Error(errors.join('; ')));
  return {
    success: false,
    error: `All paste services failed: ${errors.join('; ')}`,
  };
}

/**
 * Upload to paste.rs (simple, reliable)
 */
async function uploadToPasteRs(content: string): Promise<PasteResult> {
  try {
    const response = await fetch('https://paste.rs/', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
      body: content,
    });

    if (!response.ok) {
      throw new Error(`paste.rs returned ${response.status}`);
    }

    const url = (await response.text()).trim();
    
    if (url && url.startsWith('https://paste.rs/')) {
      return {
        success: true,
        url: url,
      };
    }

    throw new Error('Invalid response from paste.rs');
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn(`paste.rs upload failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Upload to hastebin
 */
async function uploadToHastebin(content: string): Promise<PasteResult> {
  try {
    const response = await fetch('https://hastebin.com/documents', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
      body: content,
    });

    if (!response.ok) {
      throw new Error(`hastebin returned ${response.status}`);
    }

    const data = await response.json() as { key?: string };
    
    if (data.key) {
      return {
        success: true,
        url: `https://hastebin.com/${data.key}`,
      };
    }

    throw new Error('Invalid response from hastebin');
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn(`hastebin upload failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Upload to dpaste.org
 */
async function uploadToDpaste(
  content: string,
  title?: string,
  expiryDays: number = 7
): Promise<PasteResult> {
  try {
    const formData = new FormData();
    formData.append('content', content);
    if (title) {
      formData.append('title', title);
    }
    // Expiry in days (max 365)
    formData.append('expiry_days', Math.min(expiryDays, 365).toString());

    const response = await fetch('https://dpaste.org/api/', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`dpaste.org returned ${response.status}`);
    }

    // dpaste.org returns the URL as plain text
    const url = (await response.text()).trim();
    
    if (url && url.startsWith('https://dpaste.org/')) {
      // Append /raw for raw text view
      return {
        success: true,
        url: url,
      };
    }

    throw new Error('Invalid response from dpaste.org');
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn(`dpaste.org upload failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Upload to 0x0.st as fallback (simple file hosting)
 */
async function uploadTo0x0(content: string): Promise<PasteResult> {
  try {
    const formData = new FormData();
    const blob = new Blob([content], { type: 'text/plain' });
    formData.append('file', blob, 'mediainfo.txt');
    // Set expiry to 7 days
    formData.append('expires', '168'); // hours

    const response = await fetch('https://0x0.st', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`0x0.st returned ${response.status}`);
    }

    const url = (await response.text()).trim();
    
    if (url && url.startsWith('https://0x0.st/')) {
      return {
        success: true,
        url: url,
      };
    }

    throw new Error('Invalid response from 0x0.st');
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.warn(`0x0.st upload failed: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}
