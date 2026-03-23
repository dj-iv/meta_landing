/**
 * Vercel Serverless Function — /api/submit
 *
 * Acts as a secure proxy between the landing page and Make.com.
 * - Keeps the webhook URL and API key off the client (not visible in page source)
 * - Eliminates CORS issues (server-to-server call)
 *
 * Environment variables to set in Vercel dashboard:
 *   MAKE_WEBHOOK_URL   — your Make.com webhook URL
 *   MAKE_WEBHOOK_KEY   — the API key you set in the Make.com webhook (optional)
 */

export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  const webhookKey = process.env.MAKE_WEBHOOK_KEY;

  if (!webhookUrl) {
    console.error('[submit] MAKE_WEBHOOK_URL env var is not set');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  // Basic server-side validation
  const { email, message } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const payload = {
    email:       email.trim(),
    message:     message.trim(),
    source:      'UCtel Meta Landing Page',
    submittedAt: new Date().toISOString(),
  };

  const headers = { 'Content-Type': 'application/json' };
  if (webhookKey) headers['x-make-apikey'] = webhookKey;

  try {
    const upstream = await fetch(webhookUrl, {
      method:  'POST',
      headers,
      body:    JSON.stringify(payload),
    });

    if (!upstream.ok) {
      console.error(`[submit] Make.com responded with ${upstream.status}`);
      return res.status(502).json({ error: `Upstream error: ${upstream.status}` });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[submit] Fetch to Make.com failed:', err);
    return res.status(500).json({ error: 'Submission failed' });
  }
}
