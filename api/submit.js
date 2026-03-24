/**
 * Vercel Serverless Function — /api/submit
 *
 * Creates a lead directly in Monday.com.
 * - Keeps the Monday API token off the client
 * - Eliminates CORS issues with a server-to-server call
 *
 * Environment variables to set in Vercel dashboard:
 *   MONDAY_API_TOKEN   — your Monday API token
 *   MONDAY_BOARD_ID    — target board ID for new leads
 */

export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const mondayApiToken = process.env.MONDAY_API_TOKEN;
  const mondayBoardId = process.env.MONDAY_BOARD_ID;

  if (!mondayApiToken || !mondayBoardId) {
    console.error('[submit] Monday env vars are not set');
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
    pageUrl:     'https://offices.uctel.co.uk/',
  };

  const itemName = `Meta Lead - ${payload.email}`;
  const columnValues = JSON.stringify({
    email: {
      email: payload.email,
      text: payload.email,
    },
    long_text: {
      text: payload.message,
    },
    text20: payload.source,
    text1: payload.pageUrl,
  });

  const mondayBody = {
    query: `mutation CreateLead($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
      create_item(board_id: $boardId, item_name: $itemName, column_values: $columnValues) {
        id
      }
    }`,
    variables: {
      boardId: mondayBoardId,
      itemName,
      columnValues,
    },
  };

  try {
    const upstream = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        Authorization: mondayApiToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mondayBody),
    });

    const result = await upstream.json();

    if (!upstream.ok || result.errors?.length) {
      console.error('[submit] Monday.com error:', result.errors || result);
      return res.status(502).json({ error: 'Upstream error' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[submit] Fetch to Monday.com failed:', err);
    return res.status(500).json({ error: 'Submission failed' });
  }
}
