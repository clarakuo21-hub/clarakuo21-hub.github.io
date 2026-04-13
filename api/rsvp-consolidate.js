import {
  ensureBlobConfigured,
  consolidateEntries
} from './_rsvp_blob.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.end();
  }

  // Only allow GET or POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  // Protect with a simple secret when called manually (optional).
  // Vercel Cron calls include a header that bypasses this check.
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const secret = process.env.CRON_SECRET;
  const authHeader = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');

  if (!isVercelCron && secret && authHeader !== secret) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  try {
    ensureBlobConfigured();

    const result = await consolidateEntries();

    return res.status(200).json({
      ok: true,
      consolidatedAt: result.consolidatedAt,
      summary: result.summary
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Server error.',
      hint: 'Check BLOB_READ_WRITE_TOKEN.'
    });
  }
}