const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res, filePath) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// WebSocket Broadcast helper
function broadcast(data) {
  const message = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// WS Connection handler
wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket.');
  
  // Send current state to newly connected client (especially for Monitor)
  db.getMonitorState()
    .then((state) => {
      ws.send(JSON.stringify({ type: 'INITIAL_STATE', state }));
    })
    .catch((err) => console.error('Error getting initial state: ', err));

  ws.on('close', () => {
    console.log('Client disconnected from WebSocket.');
  });
});

// API Routes

// --- Authentication ---
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username va parolni kiriting' });
  }

  try {
    const operator = await db.get(`SELECT * FROM operators WHERE username = ?`, [username]);
    if (!operator) {
      return res.status(401).json({ error: 'Foydalanuvchi nomi yoki parol noto\'g\'ri' });
    }

    const isMatch = await bcrypt.compare(password, operator.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Foydalanuvchi nomi yoki parol noto\'g\'ri' });
    }

    res.json({
      success: true,
      operator: {
        id: operator.id,
        username: operator.username,
        room: operator.room
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Tizim xatosi' });
  }
});

// --- Directions (Kiosk & Admin) ---
app.get('/api/directions', async (req, res) => {
  try {
    const list = await db.getDirections();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Queue / Tickets Operations ---
// Create ticket (Kiosk)
app.post('/api/tickets', async (req, res) => {
  const { direction_id } = req.body;
  if (!direction_id) {
    return res.status(400).json({ error: 'Yo\'nalish ID sini yuboring' });
  }

  try {
    const ticket = await db.createTicket(parseInt(direction_id));
    
    // Broadcast ticket creation event
    broadcast({ type: 'TICKET_CREATED', ticket });
    
    res.status(201).json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get waiting queue. Supports filtering by operator's assigned directions
app.get('/api/operator/queue', async (req, res) => {
  const { operator_id } = req.query;
  try {
    const list = await db.getWaitingQueue();

    if (operator_id) {
      const opId = parseInt(operator_id);
      // Fetch operator mapped direction IDs
      const assignedDirs = await db.all(
        `SELECT direction_id FROM operator_directions WHERE operator_id = ?`,
        [opId]
      );
      
      const ids = assignedDirs.map(d => d.direction_id);
      // Filter list to only show tickets matching assigned direction IDs
      const filteredList = list.filter(item => ids.includes(item.direction_id));
      return res.json(filteredList);
    }

    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Call next ticket for an operator
app.post('/api/operator/call', async (req, res) => {
  const { operator_id, room } = req.body;
  if (!operator_id || !room) {
    return res.status(400).json({ error: 'Operator ID va xona raqamini yuboring' });
  }

  try {
    const ticket = await db.callNextTicket(parseInt(operator_id), parseInt(room));
    if (!ticket) {
      return res.json({ success: false, message: 'Navbatda talabalar yo\'q' });
    }

    // Broadcast ticket called event
    broadcast({ type: 'TICKET_CALLED', ticket });
    
    // Broadcast queue changed
    broadcast({ type: 'QUEUE_CHANGED' });

    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Recall current ticket (plays voice again)
app.post('/api/operator/recall', async (req, res) => {
  const { ticket_id } = req.body;
  if (!ticket_id) {
    return res.status(400).json({ error: 'Bilet ID raqamini yuboring' });
  }

  try {
    const ticket = await db.recallTicket(ticket_id);
    if (!ticket) {
      return res.status(404).json({ error: 'Bilet topilmadi' });
    }

    // Broadcast ticket called event again to trigger sound and visual on monitor
    broadcast({ type: 'TICKET_CALLED', ticket });
    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Complete ticket
app.post('/api/operator/complete', async (req, res) => {
  const { ticket_id } = req.body;
  try {
    await db.completeTicket(ticket_id);
    broadcast({ type: 'QUEUE_CHANGED' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Skip ticket
app.post('/api/operator/skip', async (req, res) => {
  const { ticket_id } = req.body;
  try {
    await db.skipTicket(ticket_id);
    broadcast({ type: 'QUEUE_CHANGED' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get daily statistics
app.get('/api/operator/stats', async (req, res) => {
  const { room } = req.query;
  try {
    const stats = await db.getDailyStats(room ? parseInt(room) : null);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Admin Panel Operations ---
// Manage Directions
app.post('/api/admin/directions', async (req, res) => {
  const { name, code, room } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Yo\'nalish nomini yuboring' });
  }
  try {
    const finalCode = code && code.trim() !== '' ? code : await db.getNextAvailableDirectionCode();
    const finalRoom = room ? parseInt(room) : 1;
    await db.addDirection(name, finalCode, finalRoom);
    broadcast({ type: 'QUEUE_CHANGED' });
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/directions/:id', async (req, res) => {
  const { name, code, room } = req.body;
  const { id } = req.params;
  if (!name) {
    return res.status(400).json({ error: 'Yo\'nalish nomini yuboring' });
  }
  try {
    const finalCode = code && code.trim() !== '' ? code : await db.getNextAvailableDirectionCode();
    const finalRoom = room ? parseInt(room) : 1;
    await db.updateDirection(id, name, finalCode, finalRoom);
    broadcast({ type: 'QUEUE_CHANGED' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/directions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.deleteDirection(id);
    broadcast({ type: 'QUEUE_CHANGED' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manage Operators
app.get('/api/admin/operators', async (req, res) => {
  try {
    const list = await db.getOperators();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch operator mapped direction IDs
app.get('/api/admin/operators/:id/directions', async (req, res) => {
  try {
    const list = await db.getOperatorDirections(parseInt(req.params.id));
    res.json(list.map(item => item.direction_id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/operators', async (req, res) => {
  const { username, password, room, directionIds } = req.body;
  if (!username || !password || !room) {
    return res.status(400).json({ error: 'Barcha maydonlarni to\'ldiring' });
  }
  try {
    await db.addOperator(username, password, room, directionIds || []);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/operators/:id', async (req, res) => {
  const { username, password, room, directionIds } = req.body;
  const { id } = req.params;
  try {
    await db.updateOperator(id, username, password, room, directionIds || []);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/operators/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.deleteOperator(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get History
app.get('/api/admin/history', async (req, res) => {
  try {
    const list = await db.getQueueHistory();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- File Upload API ---
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.post('/api/upload', (req, res) => {
  const { fileName, fileData } = req.body;
  if (!fileName || !fileData) {
    return res.status(400).json({ error: 'Fayl nomi va ma\'lumotlari yuborilmadi' });
  }
  try {
    const base64Data = fileData.replace(/^data:image\/[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    
    const ext = path.extname(fileName) || '.png';
    const uniqueName = `logo_${Date.now()}${ext}`;
    const savePath = path.join(uploadsDir, uniqueName);
    
    fs.writeFileSync(savePath, buffer);
    res.json({ success: true, url: `/uploads/${uniqueName}` });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: 'Faylni saqlashda xatolik yuz berdi' });
  }
});

// --- Settings APIs ---
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await db.getSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    await db.updateSettings(req.body);
    broadcast({ type: 'QUEUE_CHANGED' }); // Trigger style reload on client terminals
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get Monitor State directly
app.get('/api/monitor/state', async (req, res) => {
  try {
    const state = await db.getMonitorState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start DB and HTTP Server
db.initDatabase()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
  });
