import { list, put } from '@vercel/blob';

const GUESTBOOK_PATH = 'guestbook.txt';

function getBlobOptions() {
  const options = {};

  // Optional: force operations to a specific connected Blob store.
  if (process.env.BLOB_STORE_ID) {
    options.storeId = process.env.BLOB_STORE_ID;
  }

  return options;
}

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

function withBlobErrorHint(error) {
  const message = (error && error.message ? error.message : '').toLowerCase();

  if (message.includes('store does not exist')) {
    throw new Error(
      'Blob store not found. Reconnect Blob storage in this Vercel project and rotate BLOB_READ_WRITE_TOKEN, then redeploy.'
    );
  }

  if (message.includes('public access') && message.includes('private store')) {
    throw new Error('Blob store is private. Guestbook API must write with private access mode.');
  }

  throw error;
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
  const blobOptions = getBlobOptions();
  let response;
  try {
    response = await list({
      prefix: GUESTBOOK_PATH,
      limit: 100,
      ...blobOptions
    });
  } catch (error) {
    withBlobErrorHint(error);
  }

  const candidates = (response.blobs || [])
    .filter((blob) => blob.pathname === GUESTBOOK_PATH)
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

  return candidates[0] || null;
}

export async function readEntries() {
  const blob = await getGuestbookBlob();
  if (!blob) return [];

  const sourceUrl = blob.downloadUrl || blob.url;
  const response = await fetch(sourceUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Unable to read guestbook blob: ${response.status}`);
  }

  const text = await response.text();
  return parseGuestbookTxt(text);
}

export async function writeEntries(entries) {
  const text = buildGuestbookTxt(entries);
  const blobOptions = getBlobOptions();

  try {
    await put(GUESTBOOK_PATH, text, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'text/plain; charset=utf-8',
      cacheControlMaxAge: 0,
      ...blobOptions
    });
  } catch (error) {
    const message = (error && error.message ? error.message : '').toLowerCase();

    // Some stores are configured as private-only; retry with private access.
    if (message.includes('private store')) {
      try {
        await put(GUESTBOOK_PATH, text, {
          access: 'private',
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: 'text/plain; charset=utf-8',
          cacheControlMaxAge: 0,
          ...blobOptions
        });
        return;
      } catch (retryError) {
        withBlobErrorHint(retryError);
      }
    }

    withBlobErrorHint(error);
  }
}
