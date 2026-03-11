import {
  ensureBlobConfigured,
  readEntries,
  buildGuestbookTxt
} from './_guestbook_blob.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    ensureBlobConfigured();
    const entries = await readEntries();
    const text = buildGuestbookTxt(entries);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="guestbook.txt"');
    return res.status(200).send(text);
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Server error.',
      hint: 'Check BLOB_READ_WRITE_TOKEN and ensure Blob storage is connected to this Vercel project.'
    });
  }
}
