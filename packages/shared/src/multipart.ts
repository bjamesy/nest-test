// Parts smaller than this aren't valid mid-stream parts for S3-compatible
// multipart uploads (R2/S3 require >= 5 MiB except the final part).
export const MULTIPART_CHUNK_SIZE = 8 * 1024 * 1024; // 8 MiB

export interface UploadPartInput {
  partNumber: number;
  etag: string;
}

export interface PresignedPart {
  partNumber: number;
  signedUrl: string;
}

export interface SingleUploadPlan<TUpload = unknown> {
  upload: TUpload;
  strategy: 'single';
  signedUrl: string;
  expiresIn: number;
}

export interface MultipartUploadPlan<TUpload = unknown> {
  upload: TUpload;
  strategy: 'multipart';
  multipartUploadId: string;
  chunkSize: number;
  parts: PresignedPart[];
  expiresIn: number;
}

export type InitiateUploadPlan<TUpload = unknown> =
  | SingleUploadPlan<TUpload>
  | MultipartUploadPlan<TUpload>;
