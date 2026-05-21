export interface WebDavFavoriteSyncResult {
  remoteRoot: string;
  remoteCreated: boolean;
  uploadedOperations: number;
  downloadedOperations: number;
  mergedFavorites: number;
  totalOperations: number;
  snapshotUpdated: boolean;
  compactedOperations: number;
}

export interface WebDavSkinSyncResult {
  remoteRoot: string;
  remoteCreated: boolean;
  uploadedFiles: number;
  downloadedFiles: number;
  localFiles: number;
  remoteFiles: number;
  archiveUpdated: boolean;
  restored: boolean;
}

export interface WebDavSyncResult {
  favorites?: WebDavFavoriteSyncResult;
  skins?: WebDavSkinSyncResult;
}
