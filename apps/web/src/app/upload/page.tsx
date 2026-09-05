'use client';

import { useCallback, useEffect, useState } from 'react';
import { RequireAuth } from '@/components/require-auth';
import { useAuth } from '@/context/auth-context';
import * as api from '@/lib/api';
import type { UploadPartInput } from '@prep-proj/shared';

type Phase = 'idle' | 'requesting' | 'uploading' | 'confirming' | 'done' | 'error';

function statusChipClass(status: api.UploadStatus): string {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    case 'uploading':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-neutral-100 text-neutral-700';
  }
}

function UploadPageContent() {
  const { token } = useAuth();
  const [uploads, setUploads] = useState<api.Upload[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [partInfo, setPartInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshUploads = useCallback(() => {
    if (!token) return;
    api.listUploads(token).then(setUploads).catch(() => {});
  }, [token]);

  useEffect(() => {
    refreshUploads();
  }, [refreshUploads]);

  async function handleUpload() {
    if (!file || !token) return;
    setError(null);
    setProgress(0);
    setPartInfo(null);

    try {
      setPhase('requesting');
      const plan = await api.initiateUpload(token, {
        filename: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
      });

      setPhase('uploading');

      if (plan.strategy === 'single') {
        await api.putWithProgress(plan.signedUrl, file, file.type, (loaded) =>
          setProgress(Math.round((loaded / file.size) * 100)),
        );

        setPhase('confirming');
        await api.completeUpload(token, plan.upload._id);
      } else {
        const collectedParts: UploadPartInput[] = [];
        let completedBytes = 0;

        for (const part of plan.parts) {
          setPartInfo(`part ${part.partNumber} of ${plan.parts.length}`);
          const start = (part.partNumber - 1) * plan.chunkSize;
          const end = Math.min(start + plan.chunkSize, file.size);
          const blob = file.slice(start, end);

          const etag = await api.putWithProgress(part.signedUrl, blob, file.type, (loaded) =>
            setProgress(Math.round(((completedBytes + loaded) / file.size) * 100)),
          );
          if (!etag) {
            throw new Error(
              'Missing ETag on part response — check the R2 bucket CORS policy exposes the ETag header',
            );
          }

          collectedParts.push({ partNumber: part.partNumber, etag });
          completedBytes += blob.size;
        }

        setPartInfo(null);
        setPhase('confirming');
        await api.completeUpload(token, plan.upload._id, collectedParts);
      }

      setPhase('done');
      setFile(null);
      refreshUploads();
    } catch (err) {
      setPhase('error');
      setPartInfo(null);
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  const busy = phase === 'requesting' || phase === 'uploading' || phase === 'confirming';

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10">
      <div>
        <h1 className="text-xl font-semibold">Upload a file</h1>
        <p className="mt-1 text-sm text-neutral-500">
          The file streams directly to object storage using signed URLs — it never passes
          through this app&apos;s server. Files larger than 8 MB are split into chunks and
          uploaded as separate parts.
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-6">
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={busy}
          className="text-sm"
        />

        {file && (
          <p className="text-sm text-neutral-600">
            {file.name} &middot; {(file.size / 1024).toFixed(1)} KB
          </p>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || busy}
          className="w-fit rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {phase === 'requesting' && 'Requesting signed URL…'}
          {phase === 'uploading' &&
            `Uploading… ${progress}%${partInfo ? ` (${partInfo})` : ''}`}
          {phase === 'confirming' && 'Confirming…'}
          {(phase === 'idle' || phase === 'done' || phase === 'error') && 'Upload'}
        </button>

        {phase === 'uploading' && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
            <div
              className="h-full bg-neutral-900 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {phase === 'done' && <p className="text-sm text-green-700">Upload complete.</p>}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-neutral-700">Your uploads</h2>
        {uploads.length === 0 ? (
          <p className="text-sm text-neutral-500">No uploads yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {uploads.map((u) => (
              <li
                key={u._id}
                className="flex items-center justify-between rounded-md border border-neutral-200 bg-white px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{u.filename}</p>
                  <p className="text-neutral-500">{(u.size / 1024).toFixed(1)} KB</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs ${statusChipClass(u.status)}`}>
                  {u.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function UploadPage() {
  return (
    <RequireAuth>
      <UploadPageContent />
    </RequireAuth>
  );
}
