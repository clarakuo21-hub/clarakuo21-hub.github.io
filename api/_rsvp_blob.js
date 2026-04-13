import { list, put } from '@vercel/blob';

const LEGACY_RSVP_PATH = 'rsvp.json';
const RSVP_ENTRY_PREFIX = 'rsvp-entries/';
const RSVP_ALL_PATH = 'rsvp-all.json';
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

function clearEntriesCache() {
  entriesCache = null;
  entriesCacheAt = 0;
}

function getEntriesCache() {
  if (!Array.isArray(entriesCache)) return null;
  if (Date.now() - entriesCacheAt > ENTRY_CACHE_TTL_MS) return null;
  return entriesCache.slice();
}

async function listAllBlobs(prefix) {
  const blobOptions = getBlobOptions();
  const blobs = [];
  let cursor;
  let hasMore = true;

  while (hasMore) {
    let response;
    try {
      response = await list({
        prefix,
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

async function findLatestBlobByPathname(pathname) {
  const blobs = await listAllBlobs(pathname);
  const matches = blobs
    .filter((blob) => blob.pathname === pathname)
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

  return matches[0] || null;
}

async function readBlobText(blob) {
  if (!blob) return null;

  const sourceUrl = blob.downloadUrl || blob.url;
  const response = await fetch(sourceUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Unable to read rsvp blob: ${response.status}`);
  }

  return await response.text();
}

async function readLegacyEntries() {
  const legacyBlob = await findLatestBlobByPathname(LEGACY_RSVP_PATH);
  if (!legacyBlob) return [];

  const text = await readBlobText(legacyBlob);
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeEntry).filter(Boolean);
  } catch {
    return [];
  }
}

async function readEntryBlob(blob) {
  const text = await readBlobText(blob);
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
    if (!existing || new Date(entry.createdAt) > new Date(existing.createdAt)) {
      byId.set(entry.id, entry);
    }
  });

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

function makeEntryPathname(entry) {
  const safeTimestamp = entry.createdAt.replace(/[^0-9]/g, '');
  return `${RSVP_ENTRY_PREFIX}${safeTimestamp}-${entry.id}.json`;
}

export async function readEntries({ forceFresh = false } = {}) {
  if (!forceFresh) {
    const cached = getEntriesCache();
    if (cached) return cached;
  }

  const [legacyEntries, entryBlobs] = await Promise.all([
    readLegacyEntries(),
    listAllBlobs(RSVP_ENTRY_PREFIX)
  ]);

  const blobEntries = await Promise.all(entryBlobs.map((blob) => readEntryBlob(blob)));
  const entries = mergeEntries([...legacyEntries, ...blobEntries]);
  setEntriesCache(entries);
  return entries;
}

export async function writeEntry(entry) {
  const normalizedEntry = normalizeEntry(entry);
  if (!normalizedEntry) {
    throw new Error('Invalid RSVP entry.');
  }

  const pathname = makeEntryPathname(normalizedEntry);
  const text = JSON.stringify(normalizedEntry, null, 2);
  const blobOptions = getBlobOptions();

  try {
    await put(pathname, text, {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json; charset=utf-8',
      ...blobOptions
    });
    clearEntriesCache();
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
        clearEntriesCache();
        return;
      } catch (retryError) {
        withBlobErrorHint(retryError);
      }
    }
    withBlobErrorHint(error);
  }
}

export async function consolidateEntries() {
  const entries = await readEntries({ forceFresh: true });

  const totalRsvps = entries.length;
  const attending = entries.filter((e) => e.attending);
  const notAttending = entries.filter((e) => !e.attending);
  const totalGuests = attending.reduce((sum, e) => sum + e.guestCount, 0);

  const payload = {
    consolidatedAt: new Date().toISOString(),
    summary: {
      totalRsvps,
      attendingCount: attending.length,
      notAttendingCount: notAttending.length,
      totalGuests
    },
    entries
  };

  const text = JSON.stringify(payload, null, 2);
  const blobOptions = getBlobOptions();

  try {
    await put(RSVP_ALL_PATH, text, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json; charset=utf-8',
      cacheControlMaxAge: 60,
      ...blobOptions
    });
  } catch (error) {
    const message = (error && error.message ? error.message : '').toLowerCase();
    if (message.includes('private store')) {
      await put(RSVP_ALL_PATH, text, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json; charset=utf-8',
        cacheControlMaxAge: 60,
        ...blobOptions
      });
      return payload;
    }
    withBlobErrorHint(error);
  }

  return payload;
}