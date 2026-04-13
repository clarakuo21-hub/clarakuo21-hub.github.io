import { randomUUID } from 'node:crypto';

import {
  ensureBlobConfigured,
  readEntries,
  writeEntries
} from './_rsvp_blob.js';

const MAX_ENTRIES = 500;

function getTaiwanTimestamp() {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(new Date());
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}+08:00`;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.end();
  }

  try {
    ensureBlobConfigured();

    if (req.method === 'GET') {
      const entries = await readEntries();
      return res.status(200).json({ entries });
    }

    if (req.method === 'POST') {
      const { name, attending, guestCount } = req.body || {};
      const safeName = (name || '').toString().trim().slice(0, 24);
      const safeAttending = attending === true || attending === 'yes';
      const safeGuestCount = safeAttending
        ? Math.max(1, Math.min(20, parseInt(guestCount, 10) || 1))
        : 0;

      if (!safeName) {
        return res.status(400).json({ error: 'Name is required.' });
      }

      const entry = {
        id: randomUUID(),
        name: safeName,
        attending: safeAttending,
        guestCount: safeGuestCount,
        createdAt: getTaiwanTimestamp()
      };

      // Force a fresh read before overwrite so concurrent serverless instances
      // do not write back a stale cached copy and drop earlier submissions.
      const entries = await readEntries({ forceFresh: true });
      entries.unshift(entry);

      await writeEntries(entries.slice(0, MAX_ENTRIES));
      return res.status(201).json({ entry });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Server error.',
      hint: 'Check BLOB_READ_WRITE_TOKEN and ensure Blob storage is connected to this Vercel project.'
    });
  }
}