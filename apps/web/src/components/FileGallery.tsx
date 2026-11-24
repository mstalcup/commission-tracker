import { useRef, useState } from 'react';
import type { Commission, FileRef } from '@ct/shared';
import { useFileUrl, useUpdateCommission } from '../lib/queries';
import { ACCEPT, openFile, uploadFile } from '../lib/uploads';
import { Button, ErrorNote } from './ui';

/** Reference photos, sketches and PDFs attached to a commission. */
export function FileGallery({ commission }: { commission: Commission }) {
  const update = useUpdateCommission();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const files = commission.files ?? [];

  const save = (next: FileRef[]) => update.mutateAsync({ id: commission.commissionId, input: { files: next } });

  async function onPick(list: FileList | null) {
    if (!list?.length) return;
    setError(undefined);
    setUploading(true);
    try {
      const added: FileRef[] = [];
      for (const f of Array.from(list)) added.push(await uploadFile(f, 'commission'));
      await save([...files, ...added]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div>
      {files.length === 0 && <p className="mb-3 text-sm text-faint">No files yet. Add reference photos, sketches or a signed quote.</p>}
      {files.length > 0 && (
        <ul className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {files.map((f) => (
            <Thumb key={f.key} file={f} onRemove={() => save(files.filter((x) => x.key !== f.key))} />
          ))}
        </ul>
      )}
      <ErrorNote>{error}</ErrorNote>
      <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => onPick(e.target.files)} />
      <Button size="sm" busy={uploading} onClick={() => input.current?.click()}>
        {uploading ? 'Uploading…' : '+ Add files'}
      </Button>
    </div>
  );
}

function Thumb({ file, onRemove }: { file: FileRef; onRemove: () => void }) {
  const isImage = file.contentType.startsWith('image/') && file.contentType !== 'image/heic';
  const url = useFileUrl(isImage ? file.key : undefined);
  return (
    <li className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-bg">
      <button onClick={() => openFile(file.key)} className="h-full w-full" title={file.name}>
        {isImage && url.data ? (
          <img src={url.data} alt={file.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center text-xs text-muted">
            <span className="text-lg">{file.contentType === 'application/pdf' ? 'PDF' : 'FILE'}</span>
            <span className="line-clamp-2 break-all">{file.name}</span>
          </span>
        )}
      </button>
      <button
        onClick={onRemove}
        className="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-0.5 text-xs text-ink opacity-0 transition group-hover:opacity-100 focus:opacity-100"
        aria-label={`Remove ${file.name}`}
      >
        ✕
      </button>
    </li>
  );
}
