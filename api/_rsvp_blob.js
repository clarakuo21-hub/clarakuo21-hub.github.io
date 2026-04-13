import { get, list, put } from '@vercel/blob';

const LEGACY_RSVP_PATH = 'rsvp.json';
const RSVP_ENTRY_PREFIX = 'rsvp-entries/';
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

function isPrivateStoreAccessError(error) {
  const message = (error && error.message ? error.message : '').toLowerCase();
  return message.includes('public access') && message.includes('private store');
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeEntry(entry) {
  if (!isObject(entry)) return null;

  const id = entry.id == null ? '' : String(entry.id).trim();
  const name = entry.name == null ? '' : String(entry.name).trim();
  const createdAt = entry.createdAt == null ? '' : String(entry.createdAt).trim();
  const parsedGuestCount = Number.parseInt(entry.guestCount, 10);
  const attending = entry.attending === true || entry.attending === 'yes';

  if (!id || !name || !createdAt) return null;

  return {
    id,
    name,
    attending,
    guestCount: Number.isFinite(parsedGuestCount) ? parsedGuestCount : 0,
    createdAt
  };
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

async function listRsvpEntryBlobs() {
  const blobOptions = getBlobOptions();
  const blobs = [];
  let cursor;
  let hasMore = true;

  while (hasMore) {
    let response;
    try {
      response = await list({
        prefix: RSVP_ENTRY_PREFIX,
        limit: 1000,
        cursor,
        ...blobOptions
      });
    } catch (error) {
      withBlobErrorHint(error);
    }

    blobs.push(...(response?.blobs || []));
    cursor = response?.cursor;
    hasMore = Boolean(response?.hasMore);
  }

  return blobs;
}

async function getBlobText(pathname) {
  const blobOptions = getBlobOptions();

  try {
    const result = await get(pathname, {
      access: 'public',
      ...blobOptions
    });

    if (!result || !result.stream) return null;
    return await new Response(result.stream).text();
  } catch (error) {
    if (!isPrivateStoreAccessError(error)) {
      withBlobErrorHint(error);
    }
  }

  try {
    const result = await get(pathname, {
      access: 'private',
      ...blobOptions
    });

    if (!result || !result.stream) return null;
    return await new Response(result.stream).text();
  } catch (error) {
    const message = (error && error.message ? error.message : '').toLowerCase();
    if (message.includes('not found')) {
      return null;
    }
    withBlobErrorHint(error);
  }

  return null;
}

async function readLegacyEntries() {
  const text = await getBlobText(LEGACY_RSVP_PATH);
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeEntry).filter(Boolean);
  } catch {
    return [];
  }
}

async function readEntryBlob(pathname) {
  const text = await getBlobText(pathname);
  if (!text) return null;

  try {
    return normalizeEntry(JSON.parse(text));
  } catch {
    return null;
  }
}

function mergeEntries(entries) {
  const byId = new Map();

  entries.forEach((entry) => {
    if (!entry || !entry.id) return;

    const existing = byId.get(entry.id);
    if (!existing) {
      byId.set(entry.id, entry);
      return;
    }

    if (new Date(entry.createdAt) > new Date(existing.createdAt)) {
      byId.set(entry.id, entry);
    }
  });

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

export async function readEntries({ forceFresh = false } = {}) {
  if (!forceFresh) {
    const cached = getEntriesCache();
    if (cached) return cached;
  }

  const [legacyEntries, entryBlobs] = await Promise.all([
    readLegacyEntries(),
    listRsvpEntryBlobs()
  ]);

  const blobEntries = await Promise.all(
    entryBlobs.map((blob) => readEntryBlob(blob.pathname))
  );

  const entries = mergeEntries([...blobEntries, ...legacyEntries]);
  setEntriesCache(entries);
  return entries;
}

export async function writeEntry(entry) {
  const normalizedEntry = normalizeEntry(entry);
  if (!normalizedEntry) {
    throw new Error('Invalid RSVP entry.');
  }

  const pathname = `${RSVP_ENTRY_PREFIX}${normalizedEntry.createdAt}-${normalizedEntry.id}.json`;
  const text = JSON.stringify(normalizedEntry, null, 2);
  const blobOptions = getBlobOptions();

  try {
    await put(pathname, text, {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json; charset=utf-8',
      ...blobOptions
    });
    entriesCache = null;
    entriesCacheAt = 0;
  } catch (error) {
    const message = (error && error.message ? error.message : '').toLowerCase();
    if (message.includes('private store')) {
      try {
        await put(pathname, text, {
          access: 'private',
          addRandomSuffix: false,
          contentType: 'application/json; charset=utf-8',
          ...blobOptions
        });
        entriesCache = null;
        entriesCacheAt = 0;
        return;
      } catch (retryError) {
        withBlobErrorHint(retryError);
      }
    }
    withBlobErrorHint(error);
  }
}