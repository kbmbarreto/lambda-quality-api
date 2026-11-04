export interface Attachment {
  id: string;
  workspaceId: string;
  storageKey: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  checksum: string;
  uploadedBy: string;
  createdAt: Date;
  deletedAt: Date | null;
}
export interface Upload {
  originalName: string;
  contentType: string;
  bytes: Uint8Array;
}
