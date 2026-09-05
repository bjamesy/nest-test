import type { InitiateUploadPlan, UploadPartInput } from '@prep-proj/shared';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3010';

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthResult {
  accessToken: string;
  user: AuthUser;
}

export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'failed';

export interface Upload {
  _id: string;
  userId: string;
  key: string;
  filename: string;
  size: number;
  mimeType: string;
  status: UploadStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export type InitiateUploadResult = InitiateUploadPlan<Upload>;

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface Job {
  _id: string;
  uploadId: string;
  userId: string;
  status: JobStatus;
  stage?: string;
  progress: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      if (body.message) {
        message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      }
    } catch {
      // response had no JSON body; fall back to statusText
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export function signUp(email: string, password: string): Promise<AuthResult> {
  return apiFetch<AuthResult>('/auth/sign-up', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function signIn(email: string, password: string): Promise<AuthResult> {
  return apiFetch<AuthResult>('/auth/sign-in', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function me(token: string): Promise<AuthUser> {
  return apiFetch<AuthUser>('/auth/me', {}, token);
}

export function initiateUpload(
  token: string,
  dto: { filename: string; size: number; mimeType: string },
): Promise<InitiateUploadResult> {
  return apiFetch<InitiateUploadResult>(
    '/uploads/initiate',
    { method: 'POST', body: JSON.stringify(dto) },
    token,
  );
}

export function completeUpload(
  token: string,
  uploadId: string,
  parts?: UploadPartInput[],
): Promise<Upload> {
  return apiFetch<Upload>(
    `/uploads/${uploadId}/complete`,
    { method: 'POST', body: JSON.stringify(parts ? { parts } : {}) },
    token,
  );
}

export function listUploads(token: string): Promise<Upload[]> {
  return apiFetch<Upload[]>('/uploads', {}, token);
}

export function createJob(token: string, uploadId: string): Promise<Job> {
  return apiFetch<Job>('/jobs', { method: 'POST', body: JSON.stringify({ uploadId }) }, token);
}

export function listJobs(token: string): Promise<Job[]> {
  return apiFetch<Job[]>('/jobs', {}, token);
}

/**
 * PUTs a blob directly to a presigned storage URL, reporting upload progress
 * via the given callback (called with bytes loaded, not a percentage, so
 * callers can aggregate progress across multiple parts). Resolves with the
 * response's ETag header — required to complete a multipart upload, ignored
 * for a single-PUT upload. Uses XMLHttpRequest instead of fetch because fetch
 * has no upload-progress event.
 */
export function putWithProgress(
  signedUrl: string,
  blob: Blob,
  contentType: string,
  onProgress: (bytesLoaded: number) => void,
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('Content-Type', contentType || 'application/octet-stream');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.getResponseHeader('ETag'));
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));

    xhr.send(blob);
  });
}
