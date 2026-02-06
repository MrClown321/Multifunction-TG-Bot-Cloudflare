// Google Drive API Client

import type {
  DriveFile,
  DriveSearchResponse,
  CopyResult,
  TokenResponse,
  FileMetadata,
} from '../types/google-drive';
import { logger } from '../utils/logger';
import { sleep } from '../utils/helpers';

export class GoogleDriveClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly refreshToken: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(clientId: string, clientSecret: string, refreshToken: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.refreshToken = refreshToken;
  }

  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5 minute buffer)
    if (this.accessToken && Date.now() < this.tokenExpiry - 300000) {
      return this.accessToken;
    }

    const formData = new URLSearchParams();
    formData.append('client_id', this.clientId);
    formData.append('client_secret', this.clientSecret);
    formData.append('refresh_token', this.refreshToken);
    formData.append('grant_type', 'refresh_token');

    const response = await fetch('https://www.googleapis.com/oauth2/v4/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });

    const data = (await response.json()) as TokenResponse;

    if (!data.access_token) {
      throw new Error('Failed to obtain access token');
    }

    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;

    return this.accessToken;
  }

  async search(
    keyword: string,
    pageToken?: string,
    pageSize: number = 10
  ): Promise<DriveSearchResponse> {
    const accessToken = await this.getAccessToken();

    const params = new URLSearchParams({
      corpora: 'allDrives',
      includeItemsFromAllDrives: 'true',
      supportsAllDrives: 'true',
      pageSize: pageSize.toString(),
      fields: 'nextPageToken, files(id, driveId, name, mimeType, size, modifiedTime)',
      orderBy: 'folder, name, modifiedTime desc',
      q: `trashed=false AND mimeType != 'application/vnd.google-apps.shortcut' AND mimeType != 'application/vnd.google-apps.document' AND mimeType != 'application/vnd.google-apps.spreadsheet' AND mimeType != 'application/vnd.google-apps.form' AND mimeType != 'application/vnd.google-apps.site' AND name != '.password' AND (name contains '${keyword.replace(/'/g, "\\'")}')`,
    });

    if (pageToken) {
      params.append('pageToken', pageToken);
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    return (await response.json()) as DriveSearchResponse;
  }

  async copyFile(
    fileId: string,
    destinationFolderId: string,
    resourceKey?: string
  ): Promise<CopyResult> {
    const accessToken = await this.getAccessToken();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    if (resourceKey) {
      headers['X-Goog-Drive-Resource-Keys'] = `${fileId}/${resourceKey}`;
    }

    const url = `https://www.googleapis.com/drive/v3/files/${fileId}/copy?fields=id,name,mimeType,size&supportsAllDrives=true`;
    const body = JSON.stringify({ parents: [destinationFolderId] });

    // Retry logic with exponential backoff
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body,
        });

        const result = (await response.json()) as CopyResult;

        if (response.ok) {
          return result;
        }

        if (result.error) {
          lastError = new Error(result.error.message);
          logger.warn(`Copy attempt ${attempt + 1} failed: ${result.error.message}`);
        }
      } catch (err) {
        lastError = err as Error;
        logger.warn(`Copy attempt ${attempt + 1} error: ${lastError.message}`);
      }

      await sleep(100 * Math.pow(2, attempt));
    }

    return { error: { code: 500, message: lastError?.message || 'Copy failed after retries' } };
  }

  async getFileMetadata(fileId: string): Promise<FileMetadata | null> {
    const accessToken = await this.getAccessToken();

    const fields = 'id,name,mimeType,size,createdTime,modifiedTime,owners,shared,webViewLink,parents';
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=${fields}&supportsAllDrives=true`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as FileMetadata;
  }

  async listFiles(
    folderId: string,
    pageToken?: string,
    pageSize: number = 20
  ): Promise<DriveSearchResponse> {
    const accessToken = await this.getAccessToken();

    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      pageSize: pageSize.toString(),
      fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime)',
      orderBy: 'folder, name',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });

    if (pageToken) {
      params.append('pageToken', pageToken);
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    return (await response.json()) as DriveSearchResponse;
  }

  async deleteFile(fileId: string): Promise<boolean> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    return response.ok;
  }

  async renameFile(fileId: string, newName: string): Promise<FileMetadata | null> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType&supportsAllDrives=true`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newName }),
      }
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as FileMetadata;
  }

  async createFolder(name: string, parentId: string): Promise<FileMetadata | null> {
    const accessToken = await this.getAccessToken();

    const response = await fetch(
      'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType&supportsAllDrives=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId],
        }),
      }
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as FileMetadata;
  }

  /**
   * Download file content from Google Drive
   * Uses alt=media parameter to get file binary content
   * @param fileId - The ID of the file to download
   * @param maxBytes - Maximum bytes to download (for large files, only fetch initial chunk)
   * @returns Buffer containing file content, or null on error
   */
  async downloadFileContent(
    fileId: string,
    maxBytes: number = 10 * 1024 * 1024 // Default 10MB max
  ): Promise<{ buffer: Uint8Array; fileSize: number } | null> {
    const accessToken = await this.getAccessToken();

    // First get file metadata to know the size
    const metadata = await this.getFileMetadata(fileId);
    if (!metadata) {
      return null;
    }

    const fileSize = parseInt(metadata.size || '0', 10);
    if (fileSize === 0) {
      return null;
    }

    // Use Range header if file is larger than maxBytes
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };

    if (fileSize > maxBytes) {
      headers['Range'] = `bytes=0-${maxBytes - 1}`;
    }

    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok && response.status !== 206) {
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      return {
        buffer: new Uint8Array(arrayBuffer),
        fileSize,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Error downloading file content:', error);
      return null;
    }
  }
}