// Google Drive API Types

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  driveId?: string;
  parents?: string[];
  webViewLink?: string;
  webContentLink?: string;
}

export interface DriveSearchResponse {
  files: DriveFile[];
  nextPageToken?: string;
}

export interface DriveError {
  error: {
    code: number;
    message: string;
    errors: Array<{
      message: string;
      domain: string;
      reason: string;
    }>;
  };
}

export interface CopyResult {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: string;
  error?: {
    code: number;
    message: string;
  };
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface FileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  owners?: Array<{ displayName: string; emailAddress: string }>;
  shared?: boolean;
  webViewLink?: string;
  parents?: string[];
}
