import { list, put } from '@vercel/blob';

const GUESTBOOK_PATH = 'guestbook.txt';

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function ensureBlobConfigured() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is missing. Please connect Vercel Blob.');
  }
}

function parseGuestbookTxt(text) {
  if (!text || typeof text !== 'string') return [];

  const entries = [];
  const chunks = text.split(/\n\s*\n/);

  chunks.forEach((chunk) => {
    const lines = chunk.split('\n').map(line => line.trim()).filter(Boolean);
    if (!lines.length || lines[0].startsWith('#')) return;

    const headerMatch = lines[0].match(/^\d+\.\s+(.+?)\s*\((\d{4}[\/-]\d{2}[\/-]\d{2})\)$/);
    if (!headerMatch) return;

    const [, name, dateStr] = headerMatch;
    const message = lines.slice(1).join('\n').trim();
    if (!message) return;

    const normalizedDate = dateStr.replace(/\//g, '-');
    entries.push({
      name,
      message,
      createdAt: `${normalizedDate}T00:00:00`
    });
  });

  return entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function buildGuestbookTxt(entries) {
  const lines = ['# Wedding Guestbook', '# Li Bo & Kuo YaHsien', ''];

  entries.forEach((entry, index) => {
    lines.push(`${index + 1}. ${entry.name} (${formatDate(entry.createdAt)})`);
    lines.push(entry.message);
    lines.push('');
  });

  return lines.join('\n').trim() + '\n';
}

async function getGuestbookBlob() {
  const response = await list({
    prefix: GUESTBOOK_PATH,
    limit: 100
  });

  const candidates = (response.blobs || [])
    .filter((blob) => blob.pathname === GUESTBOOK_PATH)
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

  return candidates[0] || null;
}

export async function readEntries() {
  const blob = await getGuestbookBlob();
  if (!blob) return [];

  const response = await fetch(blob.url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Unable to read guestbook blob: ${response.status}`);
  }

  const text = await response.text();
  return parseGuestbookTxt(text);
}

export async function writeEntries(entries) {
  const text = buildGuestbookTxt(entries);

  await put(GUESTBOOK_PATH, text, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'text/plain; charset=utf-8',
    cacheControlMaxAge: 0
  });
}
