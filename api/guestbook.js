import {
  ensureBlobConfigured,
  readEntries,
  writeEntries
} from './_guestbook_blob.js';

const MAX_ENTRIES = 200;

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
      const { name, message } = req.body || {};
      const safeName = (name || '').toString().trim().slice(0, 24);
      const safeMessage = (message || '').toString().trim().slice(0, 180);

      if (!safeName || !safeMessage) {
        return res.status(400).json({ error: 'Name and message are required.' });
      }

      const entry = {
        name: safeName,
        message: safeMessage,
        createdAt: new Date().toISOString()
      };

      const entries = await readEntries();
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
