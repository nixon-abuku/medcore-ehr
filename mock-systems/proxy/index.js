/**
 * MedCore Mock Systems Proxy Service
 * Provides a unified API for the frontend to monitor all mock systems
 * and interact with Mirth Connect REST API
 */
const express = require('express');
const cors    = require('cors');
const http    = require('http');
const https   = require('https');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const app  = express();
const PORT = process.env.PORT || 3008;
app.use(cors()); app.use(express.json());

const MIRTH_HOST  = process.env.MIRTH_HOST || 'mirth-connect';
const MIRTH_HTTPS = process.env.MIRTH_HTTPS_PORT || 8443;
const MIRTH_AUTH  = 'Basic ' + Buffer.from('admin:admin').toString('base64');

// ── Proxy to mock system HTTP status endpoints ────────────────
app.get('/status/:port', async (req, res) => {
  try {
    const port = parseInt(req.params.port);
    const hosts = { 7001:'mock-lab', 7002:'mock-pharmacy', 7003:'mock-radiology' };
    const host = hosts[port] || 'localhost';

    await new Promise((resolve, reject) => {
      const r = http.get(`http://${host}:${port}/`, (resp) => {
        let data = '';
        resp.on('data', chunk => data += chunk);
        resp.on('end', () => {
          try { resolve(res.json(JSON.parse(data))); } catch { resolve(res.json({ status:'ok' })); }
        });
      });
      r.on('error', () => reject(new Error('offline')));
      r.setTimeout(3000, () => { r.destroy(); reject(new Error('timeout')); });
    });
  } catch { res.status(503).json({ status:'offline' }); }
});

// ── Mirth REST API proxy ──────────────────────────────────────
function mirthRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: MIRTH_HOST,
      port: MIRTH_HTTPS,
      path: `/api${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': MIRTH_AUTH,
        'X-Requested-With': 'XMLHttpRequest',
      },
      rejectUnauthorized: false,
    };
    if (bodyStr) options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const req = https.request(options, (r) => {
      let data = '';
      r.on('data', c => data += c);
      r.on('end', () => {
        try { resolve({ status: r.statusCode, body: data ? JSON.parse(data) : null }); }
        catch { resolve({ status: r.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// GET /mirth/channels — list channels with stats
app.get('/mirth/channels', async (req, res) => {
  try {
    // Get channel list
    const chRes = await mirthRequest('GET', '/channels?includeCodeTemplates=false');
    if (chRes.status !== 200) return res.json({ channels: [] });

    const channelList = Array.isArray(chRes.body) ? chRes.body : [chRes.body].filter(Boolean);

    // Get channel stats
    const statsRes = await mirthRequest('GET', '/channels/statistics');
    const statsList = Array.isArray(statsRes.body) ? statsRes.body : [];

    const channels = channelList.map(ch => {
      const stats = statsList.find(s => s.channelId === ch.id) || {};
      return {
        id: ch.id,
        name: ch.name,
        description: ch.description,
        state: ch.currentState || 'UNKNOWN',
        received: stats.received || 0,
        filtered: stats.filtered || 0,
        sent: stats.sent || 0,
        error: stats.error || 0,
      };
    });

    res.json({ channels });
  } catch(e) { res.json({ channels: [], error: e.message }); }
});

// POST /mirth/setup — run channel setup script
app.post('/mirth/setup', async (req, res) => {
  try {
    const { exec } = require('child_process');
    exec('node /app/setup-channels.js', {
      env: { ...process.env, MIRTH_HOST, MIRTH_HTTPS_PORT: MIRTH_HTTPS }
    }, (error, stdout, stderr) => {
      if (error) {
        res.json({ success: false, message: error.message, output: stderr });
      } else {
        res.json({ success: true, message: 'Channels configured successfully!', output: stdout });
      }
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// GET /mirth/channel/:id/messages — get messages for a channel
app.get('/mirth/channel/:id/messages', async (req, res) => {
  try {
    const r = await mirthRequest('GET', `/channels/${req.params.id}/messages?limit=20&offset=0`);
    res.json(r.body || { messages: [] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /mirth/channel/:id/start
app.post('/mirth/channel/:id/start', async (req, res) => {
  try {
    const r = await mirthRequest('POST', `/channels/${req.params.id}/_start`);
    res.json({ success: r.status === 200 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// POST /mirth/channel/:id/stop
app.post('/mirth/channel/:id/stop', async (req, res) => {
  try {
    const r = await mirthRequest('POST', `/channels/${req.params.id}/_stop`);
    res.json({ success: r.status === 200 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/health', (req, res) => res.json({ status:'ok', service:'medcore-mock-proxy', version:'1.0.0' }));

app.listen(PORT, () => console.log(`
  ╔══════════════════════════════════════╗
  ║   MedCore Mock Systems Proxy         ║
  ║   Port: ${PORT}                          ║
  ║   Bridges frontend ↔ Mirth REST API  ║
  ╚══════════════════════════════════════╝`));
