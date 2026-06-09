const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'queue.db');
const db = new sqlite3.Database(dbPath);

// Helper functions for Promise-based DB queries
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

// Initialize the database tables
async function initDatabase() {
  // Create Directions table
  await run(`
    CREATE TABLE IF NOT EXISTS directions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      room INTEGER NOT NULL
    )
  `);

  // Create Operators table
  await run(`
    CREATE TABLE IF NOT EXISTS operators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      room INTEGER NOT NULL
    )
  `);

  // Create Operator-Directions mapping table (Many-to-Many)
  await run(`
    CREATE TABLE IF NOT EXISTS operator_directions (
      operator_id INTEGER,
      direction_id INTEGER,
      PRIMARY KEY (operator_id, direction_id),
      FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE CASCADE,
      FOREIGN KEY (direction_id) REFERENCES directions(id) ON DELETE CASCADE
    )
  `);

  // Create Queues table
  await run(`
    CREATE TABLE IF NOT EXISTS queues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      direction_code TEXT NOT NULL,
      number INTEGER NOT NULL,
      status TEXT NOT NULL, -- 'waiting', 'called', 'completed', 'skipped'
      room INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      called_at DATETIME,
      completed_at DATETIME,
      operator_id INTEGER,
      FOREIGN KEY(operator_id) REFERENCES operators(id)
    )
  `);

  // Create Settings table (Key-Value)
  await run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Seed default directions if empty
  const directionCount = await get(`SELECT COUNT(*) as count FROM directions`);
  if (directionCount.count === 0) {
    const defaultDirections = [
      { name: 'Iqtisodiyot', code: 'A', room: 2 },
      { name: 'Huquq', code: 'B', room: 1 },
      { name: 'Pedagogika', code: 'C', room: 3 },
      { name: 'Axborot texnologiyalari', code: 'D', room: 4 },
      { name: 'Tibbiyot', code: 'E', room: 5 },
      { name: 'Tarix', code: 'F', room: 6 }
    ];
    for (const d of defaultDirections) {
      await run(
        `INSERT INTO directions (name, code, room) VALUES (?, ?, ?)`,
        [d.name, d.code, d.room]
      );
    }
    console.log('Seeded default directions.');
  }

  // Seed default operators if empty
  const operatorCount = await get(`SELECT COUNT(*) as count FROM operators`);
  if (operatorCount.count === 0) {
    const salt = await bcrypt.genSalt(10);
    const defaultPasswordHash = await bcrypt.hash('12345', salt);

    const defaultOperators = [
      { username: 'operator1', password: defaultPasswordHash, room: 1 },
      { username: 'operator2', password: defaultPasswordHash, room: 2 },
      { username: 'operator3', password: defaultPasswordHash, room: 3 },
      { username: 'operator4', password: defaultPasswordHash, room: 4 }
    ];

    for (const op of defaultOperators) {
      await run(
        `INSERT INTO operators (username, password, room) VALUES (?, ?, ?)`,
        [op.username, op.password, op.room]
      );
    }
    console.log('Seeded default operators.');
  }

  // Seed default operator-direction mapping if empty
  const mappingCount = await get(`SELECT COUNT(*) as count FROM operator_directions`);
  if (mappingCount.count === 0) {
    const ops = await all(`SELECT id, username FROM operators`);
    const dirs = await all(`SELECT id, code FROM directions`);

    const opMap = {
      'operator1': 'B', // Huquq
      'operator2': 'A', // Iqtisodiyot
      'operator3': 'C', // Pedagogika
      'operator4': 'D'  // Axborot texnologiyalari
    };

    for (const op of ops) {
      const targetCode = opMap[op.username];
      const targetDir = dirs.find(d => d.code === targetCode);
      if (targetDir) {
        await run(
          `INSERT OR IGNORE INTO operator_directions (operator_id, direction_id) VALUES (?, ?)`,
          [op.id, targetDir.id]
        );
      }
    }
    console.log('Seeded default operator-direction mapping.');
  }

  // Seed default settings if empty
  const settingsCount = await get(`SELECT COUNT(*) as count FROM settings`);
  if (settingsCount.count === 0) {
    const defaultSettings = [
      { key: 'org_name', value: 'RANCH UNIVERSITY' },
      { key: 'logo_main', value: 'RANCH' },
      { key: 'logo_sub', value: 'University' },
      { key: 'brand_color', value: '#e60000' },
      { key: 'kiosk_title', value: 'Elektron Navbat Kioski' },
      { key: 'monitor_title', value: 'Tizim Monitori' }
    ];
    for (const s of defaultSettings) {
      await run(`INSERT INTO settings (key, value) VALUES (?, ?)`, [s.key, s.value]);
    }
    console.log('Seeded default branding settings.');
  }
}

// Generate the next queue number for a given direction, resetting daily
async function getNextQueueNumber(directionCode) {
  const todayStr = new Date().toISOString().split('T')[0];
  const lastTicket = await get(
    `SELECT number FROM queues 
     WHERE direction_code = ? AND date(created_at, 'localtime') = date(?)
     ORDER BY id DESC LIMIT 1`,
    [directionCode, todayStr]
  );
  return lastTicket ? lastTicket.number + 1 : 1;
}

module.exports = {
  initDatabase,
  run,
  get,
  all,
  getNextQueueNumber,
  
  // Directions Operations
  getDirections: () => all(`SELECT * FROM directions ORDER BY name ASC`),
  addDirection: (name, code, room) => run(
    `INSERT INTO directions (name, code, room) VALUES (?, ?, ?)`,
    [name, code.toUpperCase(), room]
  ),
  updateDirection: (id, name, code, room) => run(
    `UPDATE directions SET name = ?, code = ?, room = ? WHERE id = ?`,
    [name, code.toUpperCase(), room, id]
  ),
  deleteDirection: (id) => run(`DELETE FROM directions WHERE id = ?`, [id]),

  // Operators Operations
  getOperators: () => all(`SELECT id, username, room FROM operators ORDER BY username ASC`),
  
  addOperator: async (username, password, room, directionIds = []) => {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const result = await run(
      `INSERT INTO operators (username, password, room) VALUES (?, ?, ?)`,
      [username, hash, room]
    );
    const operatorId = result.lastID;
    
    // Insert direction mappings
    if (directionIds && directionIds.length > 0) {
      for (const dirId of directionIds) {
        await run(
          `INSERT INTO operator_directions (operator_id, direction_id) VALUES (?, ?)`,
          [operatorId, dirId]
        );
      }
    }
    return result;
  },

  updateOperator: async (id, username, password, room, directionIds = []) => {
    // Update basic operator info
    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      await run(
        `UPDATE operators SET username = ?, password = ?, room = ? WHERE id = ?`,
        [username, hash, room, id]
      );
    } else {
      await run(
        `UPDATE operators SET username = ?, room = ? WHERE id = ?`,
        [username, room, id]
      );
    }

    // Update direction mappings: delete old ones first
    await run(`DELETE FROM operator_directions WHERE operator_id = ?`, [id]);
    if (directionIds && directionIds.length > 0) {
      for (const dirId of directionIds) {
        await run(
          `INSERT INTO operator_directions (operator_id, direction_id) VALUES (?, ?)`,
          [id, dirId]
        );
      }
    }
  },

  deleteOperator: async (id) => {
    await run(`DELETE FROM operator_directions WHERE operator_id = ?`, [id]);
    return run(`DELETE FROM operators WHERE id = ?`, [id]);
  },

  getOperatorDirections: (operatorId) => all(
    `SELECT direction_id FROM operator_directions WHERE operator_id = ?`,
    [operatorId]
  ),

  // Settings Operations
  getSettings: async () => {
    const rows = await all(`SELECT * FROM settings`);
    const settingsObj = {};
    rows.forEach(r => {
      settingsObj[r.key] = r.value;
    });
    return settingsObj;
  },

  updateSettings: async (settingsObj) => {
    for (const key in settingsObj) {
      await run(
        `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
        [key, String(settingsObj[key])]
      );
    }
    return true;
  },

  // Queue Operations
  createTicket: async (directionCode) => {
    const direction = await get(`SELECT id, name, room FROM directions WHERE code = ?`, [directionCode]);
    if (!direction) throw new Error('Yo\'nalish topilmadi');

    const nextNum = await getNextQueueNumber(directionCode);
    
    // Insert into queues table
    const result = await run(
      `INSERT INTO queues (direction_code, number, status, room) VALUES (?, ?, 'waiting', ?)`,
      [directionCode, nextNum, direction.room]
    );

    return {
      id: result.lastID,
      direction_code: directionCode,
      direction_name: direction.name,
      number: nextNum,
      ticket_code: `${directionCode}${nextNum}`,
      room: direction.room,
      status: 'waiting',
      created_at: new Date().toISOString()
    };
  },

  // Get waiting queue. Restructured: returns ALL waiting tickets.
  getWaitingQueue: () => all(
    `SELECT q.*, d.name as direction_name 
     FROM queues q
     JOIN directions d ON q.direction_code = d.code
     WHERE q.status = 'waiting' 
     ORDER BY q.id ASC`
  ),

  // RESTURCTURED CALL NEXT TICKET:
  // Operator calls the oldest ticket from the list of directions they serve.
  callNextTicket: async (operatorId, room) => {
    // 1. Get the direction codes assigned to this operator
    const assignedDirs = await all(
      `SELECT d.code FROM operator_directions od
       JOIN directions d ON od.direction_id = d.id
       WHERE od.operator_id = ?`,
      [operatorId]
    );

    if (assignedDirs.length === 0) return null; // No directions mapped to this operator

    // Create an SQL placeholders string: (?, ?, ?)
    const placeholders = assignedDirs.map(() => '?').join(',');
    const codes = assignedDirs.map(d => d.code);

    // 2. Query the oldest waiting ticket from the assigned direction codes
    const ticket = await get(
      `SELECT q.*, d.name as direction_name 
       FROM queues q
       JOIN directions d ON q.direction_code = d.code
       WHERE q.status = 'waiting' AND q.direction_code IN (${placeholders})
       ORDER BY q.id ASC LIMIT 1`,
      codes
    );

    if (!ticket) return null;

    // 3. Update status to 'called', bind operator and room
    const now = new Date().toISOString();
    await run(
      `UPDATE queues SET status = 'called', called_at = ?, operator_id = ?, room = ? WHERE id = ?`,
      [now, operatorId, room, ticket.id]
    );

    ticket.status = 'called';
    ticket.called_at = now;
    ticket.operator_id = operatorId;
    ticket.room = room;
    ticket.ticket_code = `${ticket.direction_code}${ticket.number}`;
    return ticket;
  },

  recallTicket: async (ticketId) => {
    const ticket = await get(
      `SELECT q.*, d.name as direction_name 
       FROM queues q
       JOIN directions d ON q.direction_code = d.code
       WHERE q.id = ?`,
      [ticketId]
    );
    if (ticket) {
      ticket.ticket_code = `${ticket.direction_code}${ticket.number}`;
    }
    return ticket;
  },

  completeTicket: (ticketId) => {
    const now = new Date().toISOString();
    return run(
      `UPDATE queues SET status = 'completed', completed_at = ? WHERE id = ?`,
      [now, ticketId]
    );
  },

  skipTicket: (ticketId) => {
    return run(
      `UPDATE queues SET status = 'skipped' WHERE id = ?`,
      [ticketId]
    );
  },

  // Monitor status (Restructured: called and waiting list)
  getMonitorState: async () => {
    // Get active called tickets (showing multiple counters, up to 10 active serving items)
    const called = await all(
      `SELECT q.*, d.name as direction_name
       FROM queues q
       JOIN directions d ON q.direction_code = d.code
       WHERE q.status = 'called'
       ORDER BY q.called_at DESC LIMIT 10`
    );

    called.forEach(c => {
      c.ticket_code = `${c.direction_code}${c.number}`;
    });

    // Get complete waiting list
    const waitingList = await all(
      `SELECT q.*, d.name as direction_name
       FROM queues q
       JOIN directions d ON q.direction_code = d.code
       WHERE q.status = 'waiting'
       ORDER BY q.id ASC`
    );

    waitingList.forEach(w => {
      w.ticket_code = `${w.direction_code}${w.number}`;
    });

    return { called, waitingList };
  },

  // Daily Statistics
  getDailyStats: async (room) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const queryParams = [todayStr];
    let roomFilter = "";
    if (room) {
      roomFilter = " AND room = ? ";
      queryParams.push(room);
    }

    const totalServed = await get(
      `SELECT COUNT(*) as count FROM queues 
       WHERE status = 'completed' AND date(created_at, 'localtime') = date(?) ${roomFilter}`,
      queryParams
    );

    const totalSkipped = await get(
      `SELECT COUNT(*) as count FROM queues 
       WHERE status = 'skipped' AND date(created_at, 'localtime') = date(?) ${roomFilter}`,
      queryParams
    );

    const totalWaiting = await get(
      `SELECT COUNT(*) as count FROM queues 
       WHERE status = 'waiting' AND date(created_at, 'localtime') = date(?) ${roomFilter}`,
      queryParams
    );

    const avgWait = await get(
      `SELECT AVG(strftime('%s', called_at) - strftime('%s', created_at)) as avg_time 
       FROM queues 
       WHERE (status = 'called' OR status = 'completed') 
       AND called_at IS NOT NULL 
       AND date(created_at, 'localtime') = date(?) ${roomFilter}`,
      queryParams
    );

    const avgSeconds = avgWait ? Math.round(avgWait.avg_time || 0) : 0;
    const avgMinutes = Math.round(avgSeconds / 60);

    return {
      served: totalServed.count,
      skipped: totalSkipped.count,
      waiting: totalWaiting.count,
      avgWaitSeconds: avgSeconds,
      avgWaitMinutes: avgMinutes
    };
  },

  // Full Queue History for Admin
  getQueueHistory: () => all(
    `SELECT q.*, d.name as direction_name, o.username as operator_username
     FROM queues q
     JOIN directions d ON q.direction_code = d.code
     LEFT JOIN operators o ON q.operator_id = o.id
     ORDER BY q.id DESC`
  )
};
