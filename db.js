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
      resolve(this); // 'this' contains changes and lastID
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

  // Seed default operator admin/operators if empty
  const operatorCount = await get(`SELECT COUNT(*) as count FROM operators`);
  if (operatorCount.count === 0) {
    // We hash the password: default password is '12345'
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
}

// Generate the next queue number for a given direction, resetting daily
async function getNextQueueNumber(directionCode) {
  // Find the last queue entry for this direction created today (local time)
  // SQLite datetime is stored in UTC by default, but we can compare dates using date() function
  const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
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
  addOperator: async (username, password, room) => {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    return run(
      `INSERT INTO operators (username, password, room) VALUES (?, ?, ?)`,
      [username, hash, room]
    );
  },
  updateOperator: async (id, username, password, room) => {
    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      return run(
        `UPDATE operators SET username = ?, password = ?, room = ? WHERE id = ?`,
        [username, hash, room, id]
      );
    } else {
      return run(
        `UPDATE operators SET username = ?, room = ? WHERE id = ?`,
        [username, room, id]
      );
    }
  },
  deleteOperator: (id) => run(`DELETE FROM operators WHERE id = ?`, [id]),

  // Queue Operations
  createTicket: async (directionCode) => {
    const direction = await get(`SELECT name, room FROM directions WHERE code = ?`, [directionCode]);
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
      status: 'waiting'
    };
  },

  getWaitingQueue: () => all(
    `SELECT q.*, d.name as direction_name 
     FROM queues q
     JOIN directions d ON q.direction_code = d.code
     WHERE q.status = 'waiting' 
     ORDER BY q.id ASC`
  ),

  callNextTicket: async (operatorId, room) => {
    // Get the oldest waiting ticket for directions matching this room, or generally any oldest waiting ticket
    // Let's first check if there are waiting tickets assigned to this operator's room
    let ticket = await get(
      `SELECT q.*, d.name as direction_name 
       FROM queues q
       JOIN directions d ON q.direction_code = d.code
       WHERE q.status = 'waiting' AND q.room = ?
       ORDER BY q.id ASC LIMIT 1`,
      [room]
    );

    // Fallback: If no tickets for this room, check for any waiting ticket (multi-room handling if needed)
    // Actually, usually operators only call students for directions assigned to their room, as per TZ.
    // So let's stick to room matching.
    
    if (!ticket) return null;

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
    // Returns the ticket info to trigger announcement again
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

  // Monitor status (called and waiting)
  getMonitorState: async () => {
    // Get active called tickets
    const called = await all(
      `SELECT q.*, d.name as direction_name
       FROM queues q
       JOIN directions d ON q.direction_code = d.code
       WHERE q.status = 'called'
       ORDER BY q.called_at DESC LIMIT 6`
    );

    called.forEach(c => {
      c.ticket_code = `${c.direction_code}${c.number}`;
    });

    // Get length of waiting queues grouped by direction
    const waitingCounts = await all(
      `SELECT direction_code, COUNT(*) as count 
       FROM queues 
       WHERE status = 'waiting' 
       GROUP BY direction_code`
    );

    return { called, waitingCounts };
  },

  // Daily Statistics
  getDailyStats: async (room) => {
    const todayStr = new Date().toISOString().split('T')[0];

    // Total tickets processed today
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

    // Average waiting time for called/completed tickets today (called_at - created_at)
    // SQLite strftime('%s', called_at) - strftime('%s', created_at) gives difference in seconds
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
