import type { FileRef, UploadRequest } from '@ct/shared';
import { get, post } from './api';

export const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/heic,application/pdf';
const MAX_BYTES = 15 * 1024 * 1024;

/**
 * Uploads a file straight to our private S3 bucket using a signed form from
 * the API, and returns a reference to save on a commission or expense.
 */
export async function uploadFile(file: File, purpose: UploadRequest['purpose']): Promise<FileRef> {
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is larger than 15 MB`);
  const contentType = file.type || 'application/octet-stream';
  const { key, url, fields } = await post<{ key: string; url: string; fields: Record<string, string> }>('/uploads', {
    fileName: file.name,
    contentType,
    size: file.size,
    purpose,
  });
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));
  form.append('file', file); // must be last
  const res = await fetch(url, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return { key, name: file.name, contentType, size: file.size };
}

/**
 * Opens a private file in a new tab. The tab is opened synchronously (inside
 * the click) so popup blockers allow it, then pointed at the signed URL.
 */
export async function openFile(key: string) {
  const tab = window.open('', '_blank');
  if (tab) tab.opener = null;
  try {
    const { url } = await get<{ url: string }>(`/uploads/url?key=${encodeURIComponent(key)}`);
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (err) {
    tab?.close();
    throw err;
  }
}
