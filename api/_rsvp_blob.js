import { list, put } from '@vercel/blob';

const RSVP_PATH = 'rsvp.json';
const ENTRY_CACHE_TTL_MS = 5000;

let entriesCache = null;
let entriesCacheAt = 0;

function getBlobOptions() {
  const options = {};
  if (process.env.BLOB_STORE_ID) {
    options.storeId = process.env.BLOB_STORE_ID;
  }
  return options;
}

export function ensureBlobConfigured() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is missing. Please connect Vercel Blob.');
  }
}

function withBlobErrorHint(error) {
  const message = (error && error.message ? error.message : '').toLowerCase();
  if (message.includes('store does not exist')) {
    throw new Error('Blob store not found. Reconnect Blob storage and rotate BLOB_READ_WRITE_TOKEN, then redeploy.');
  }
  if (message.includes('public access') && message.includes('private store')) {
    throw new Error('Blob store is private. RSVP API must write with private access mode.');
  }
  throw error;
}

function setEntriesCache(entries) {
  entriesCache = Array.isArray(entries) ? entries.slice() : [];
  entriesCacheAt = Date.now();
}

function getEntriesCache() {
  if (!Array.isArray(entriesCache)) return null;
  if (Date.now() - entriesCacheAt > ENTRY_CACHE_TTL_MS) return null;
  return entriesCache.slice();
}

async function getRsvpBlob() {
  const blobOptions = getBlobOptions();
  let response;
  try {
    response = await list({
      prefix: RSVP_PATH,
      limit: 100,
      ...blobOptions
    });
  } catch (error) {
    withBlobErrorHint(error);
  }

  const candidates = (response.blobs || [])
    .filter((blob) => blob.pathname === RSVP_PATH)
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

  return candidates[0] || null;
}

export async function readEntries({ forceFresh = false } = {}) {
  if (!forceFresh) {
    const cached = getEntriesCache();
    if (cached) return cached;
  }

  const blob = await getRsvpBlob();
  if (!blob) {
    setEntriesCache([]);
    return [];
  }

  const sourceUrl = blob.downloadUrl || blob.url;
  const response = await fetch(sourceUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Unable to read rsvp blob: ${response.status}`);
  }

  const text = await response.text();
  let parsed = [];
  try {
    parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) parsed = [];
  } catch {
    parsed = [];
  }
  setEntriesCache(parsed);
  return parsed;
}

export async function writeEntries(entries) {
  const text = JSON.stringify(entries, null, 2);
  const blobOptions = getBlobOptions();

  try {
    await put(RSVP_PATH, text, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json; charset=utf-8',
      cacheControlMaxAge: 0,
      ...blobOptions
    });
    setEntriesCache(entries);
  } catch (error) {
    const message = (error && error.message ? error.message : '').toLowerCase();
    if (message.includes('private store')) {
      try {
        await put(RSVP_PATH, text, {
          access: 'private',
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: 'application/json; charset=utf-8',
          cacheControlMaxAge: 0,
          ...blobOptions
        });
        setEntriesCache(entries);
        return;
      } catch (retryError) {
        withBlobErrorHint(retryError);
      }
    }
    withBlobErrorHint(error);
  }
}