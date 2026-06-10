const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'queue.db');
const db = new sqlite3.Database(dbPath);
db.run("PRAGMA foreign_keys = OFF");


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
      code TEXT NOT NULL,
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
      direction_id INTEGER,
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
    {
        "id": 7,
        "name": "IQTISODIYOT",
        "code": "A",
        "room": 3
    },
    {
        "id": 8,
        "name": "BUXGALTERIYA HISOBI",
        "code": "B",
        "room": 3
    },
    {
        "id": 9,
        "name": "MENEJMENT",
        "code": "D",
        "room": 3
    },
    {
        "id": 10,
        "name": "MARKETING",
        "code": "E",
        "room": 3
    },
    {
        "id": 11,
        "name": "BANK ISHI",
        "code": "F",
        "room": 11
    },
    {
        "id": 12,
        "name": "FILOLOGIYA VA TILLARNI O'QITISH(RUS TILI)",
        "code": "G",
        "room": 7
    },
    {
        "id": 13,
        "name": "FILOLOGIYA VA TILLARNI O'QITISH(O'ZBEK TILI)",
        "code": "H",
        "room": 7
    },
    {
        "id": 14,
        "name": "FILOLOGIYA VA TILLARNI O'QITISH(INGGILIZ TILI)",
        "code": "I",
        "room": 7
    },
    {
        "id": 15,
        "name": "MAKTABGACHA TA'LIM (O'QUV YILI  MUDDATI 3 YIL)",
        "code": "J",
        "room": 7
    },
    {
        "id": 16,
        "name": "MATEMATIKA",
        "code": "K",
        "room": 7
    },
    {
        "id": 17,
        "name": "BOSHLANG'ICH TA'LIM",
        "code": "L",
        "room": 7
    },
    {
        "id": 18,
        "name": "SPORT FAOLIYATI (BOKS)",
        "code": "M",
        "room": 13
    },
    {
        "id": 19,
        "name": "SPORT FAOLIYATI (VALEYBOL)",
        "code": "N",
        "room": 13
    },
    {
        "id": 20,
        "name": "SPORT FAOLIYATI (YENGIL ATLETIKA)",
        "code": "O",
        "room": 13
    },
    {
        "id": 21,
        "name": "SPORT FAOLIYATI (FUTBOL)",
        "code": "P",
        "room": 13
    },
    {
        "id": 22,
        "name": "SPORT FAOLIYATI (ERKIN KURASH)",
        "code": "Q",
        "room": 13
    },
    {
        "id": 23,
        "name": "JISMONIY MADANIYAT(O'QUV YILI 3 YIL)",
        "code": "R",
        "room": 13
    },
    {
        "id": 24,
        "name": "KOMPYUTER INJINIRING (KOMPYUTER INJINIRING)",
        "code": "S",
        "room": 13
    },
    {
        "id": 25,
        "name": "KOMPYUTER INJINIRING (MULTIMEDIA TEXNOLOGIYALARI)",
        "code": "T",
        "room": 13
    },
    {
        "id": 26,
        "name": "KOMPYUTER INJINIRING (KOMPYUTER TIZIMLARI AXBOROT XAVFSIZLIGI)",
        "code": "U",
        "room": 13
    },
    {
        "id": 27,
        "name": "KOMPYUTER INJINIRING (MA'LUMOTLAR ILMI)",
        "code": "V",
        "room": 13
    },
    {
        "id": 28,
        "name": "KIBERXAVFSIZLIK INJINIRING",
        "code": "X",
        "room": 13
    },
    {
        "id": 29,
        "name": "TEXNOLOGIK MASHINALAR VA JIHOZLAR",
        "code": "Y",
        "room": 13
    },
    {
        "id": 30,
        "name": "ENERGETIKA MUHANDISLIGI (ELEKTR TA'MINOTI)",
        "code": "C",
        "room": 13
    },
    {
        "id": 31,
        "name": "TRANSPORT VOSITALARI MUHANDISLIGI (AVTAMOIL TRANSPORTI BO'YICHA)",
        "code": "W",
        "room": 13
    },
    {
        "id": 32,
        "name": "LOGISTIKA (TRANSPORT FAOLIYATI BO'YICHA)",
        "code": "Z",
        "room": 13
    },
    {
        "id": 33,
        "name": "SHAHAR QURULISHI VA LOYIHALASH",
        "code": "AA",
        "room": 13
    },
    {
        "id": 34,
        "name": "ARXITEKTURA",
        "code": "AB",
        "room": 13
    },
    {
        "id": 35,
        "name": "DAVOLASH ISHI (O'QUVMUDDATI 6 YIL)",
        "code": "AC",
        "room": 10
    },
    {
        "id": 36,
        "name": "STOMATOLOGIYA (O'QUV MUDDATI 5 YIL)",
        "code": "AD",
        "room": 10
    },
    {
        "id": 37,
        "name": "PEDIATERIYA ISHI (O'QUV MUDDATI 6 YIL)",
        "code": "AE",
        "room": 10
    }
];
    for (const d of defaultDirections) {
      await run(
        `INSERT INTO directions (id, name, code, room) VALUES (?, ?, ?, ?)`,
        [d.id, d.name, d.code, d.room]
      );
    }
    console.log('Seeded directions.');
  }

  // Seed default operators if empty
  const operatorCount = await get(`SELECT COUNT(*) as count FROM operators`);
  if (operatorCount.count === 0) {
    const defaultOperators = [
    {
        "id": 1,
        "username": "operator1",
        "password": "$2a$10$ibPL.b7H5v07QVDdz5eaS.IDg4cBLIxjiOPc7eDMu8i2e0v/2h07i",
        "room": 1
    },
    {
        "id": 2,
        "username": "operator2",
        "password": "$2a$10$ibPL.b7H5v07QVDdz5eaS.IDg4cBLIxjiOPc7eDMu8i2e0v/2h07i",
        "room": 2
    },
    {
        "id": 3,
        "username": "operator3",
        "password": "$2a$10$ibPL.b7H5v07QVDdz5eaS.IDg4cBLIxjiOPc7eDMu8i2e0v/2h07i",
        "room": 3
    },
    {
        "id": 4,
        "username": "operator4",
        "password": "$2a$10$ibPL.b7H5v07QVDdz5eaS.IDg4cBLIxjiOPc7eDMu8i2e0v/2h07i",
        "room": 4
    },
    {
        "id": 5,
        "username": "operator5",
        "password": "$2a$10$o/k.0NOdjXzynTcyejGyUe0aWwaXBz.mROlaElzZJBAQcQwn0NWLK",
        "room": 5
    },
    {
        "id": 6,
        "username": "operator6",
        "password": "$2a$10$m9VF4t2Hxg8jxZ0q2FuFIuicwTGr17r7GOpZjJxrJXCzI193GlpZC",
        "room": 6
    },
    {
        "id": 7,
        "username": "operator7",
        "password": "$2a$10$NioMYHkF71N.twZp62MWSO10ugFwjNwoCTzaJXIolQpVeVn5G4Yka",
        "room": 7
    },
    {
        "id": 8,
        "username": "operator8",
        "password": "$2a$10$kFf.K0LFTc1CyfamfDVCz.8nJrZCixVkz5YVN5uW/D3pmF34c3K5S",
        "room": 8
    },
    {
        "id": 9,
        "username": "operator9",
        "password": "$2a$10$k.ZOlxQZNJffVFyp5YjcneffQVxANEfxadKsp9.WwvfQN2Tu8XWTm",
        "room": 9
    },
    {
        "id": 10,
        "username": "operator10",
        "password": "$2a$10$d0vMXrtv9PXEmrQaHoZpBOK4ml/q0NtYmI3UPRHpwsSNM1oUlcz/y",
        "room": 10
    },
    {
        "id": 11,
        "username": "operator11",
        "password": "$2a$10$w15fFGAcrypo6H00DnjaIuBkiAb8S1dPQf2BYst3zLUJto8uUlG1G",
        "room": 11
    },
    {
        "id": 12,
        "username": "operator12",
        "password": "$2a$10$dLsUs5mVjCzVlEG6OFry5.bMZbSgDNuV5hLOjDaptWksi9CnuDWGy",
        "room": 12
    },
    {
        "id": 13,
        "username": "operator13",
        "password": "$2a$10$rGi6NcFdUvaS5oHtOgHwNuuQ0wFtCzg263h6TJKRGq1aVA/rIZIs.",
        "room": 13
    }
];
    for (const op of defaultOperators) {
      await run(
        `INSERT INTO operators (id, username, password, room) VALUES (?, ?, ?, ?)`,
        [op.id, op.username, op.password, op.room]
      );
    }
    console.log('Seeded operators.');
  }

  // Seed default operator-direction mapping if empty
  const mappingCount = await get(`SELECT COUNT(*) as count FROM operator_directions`);
  if (mappingCount.count === 0) {
    const defaultMappings = [
    {
        "operator_id": 1,
        "direction_id": 11
    },
    {
        "operator_id": 1,
        "direction_id": 8
    },
    {
        "operator_id": 1,
        "direction_id": 7
    },
    {
        "operator_id": 1,
        "direction_id": 10
    },
    {
        "operator_id": 1,
        "direction_id": 9
    },
    {
        "operator_id": 2,
        "direction_id": 11
    },
    {
        "operator_id": 2,
        "direction_id": 8
    },
    {
        "operator_id": 2,
        "direction_id": 7
    },
    {
        "operator_id": 2,
        "direction_id": 10
    },
    {
        "operator_id": 2,
        "direction_id": 9
    },
    {
        "operator_id": 3,
        "direction_id": 11
    },
    {
        "operator_id": 3,
        "direction_id": 8
    },
    {
        "operator_id": 3,
        "direction_id": 7
    },
    {
        "operator_id": 3,
        "direction_id": 10
    },
    {
        "operator_id": 3,
        "direction_id": 9
    },
    {
        "operator_id": 4,
        "direction_id": 17
    },
    {
        "operator_id": 4,
        "direction_id": 14
    },
    {
        "operator_id": 4,
        "direction_id": 13
    },
    {
        "operator_id": 4,
        "direction_id": 12
    },
    {
        "operator_id": 4,
        "direction_id": 15
    },
    {
        "operator_id": 4,
        "direction_id": 16
    },
    {
        "operator_id": 5,
        "direction_id": 17
    },
    {
        "operator_id": 5,
        "direction_id": 14
    },
    {
        "operator_id": 5,
        "direction_id": 13
    },
    {
        "operator_id": 5,
        "direction_id": 12
    },
    {
        "operator_id": 5,
        "direction_id": 15
    },
    {
        "operator_id": 5,
        "direction_id": 16
    },
    {
        "operator_id": 6,
        "direction_id": 17
    },
    {
        "operator_id": 6,
        "direction_id": 14
    },
    {
        "operator_id": 6,
        "direction_id": 13
    },
    {
        "operator_id": 6,
        "direction_id": 12
    },
    {
        "operator_id": 6,
        "direction_id": 15
    },
    {
        "operator_id": 6,
        "direction_id": 16
    },
    {
        "operator_id": 7,
        "direction_id": 17
    },
    {
        "operator_id": 7,
        "direction_id": 14
    },
    {
        "operator_id": 7,
        "direction_id": 13
    },
    {
        "operator_id": 7,
        "direction_id": 12
    },
    {
        "operator_id": 7,
        "direction_id": 15
    },
    {
        "operator_id": 7,
        "direction_id": 16
    },
    {
        "operator_id": 8,
        "direction_id": 35
    },
    {
        "operator_id": 8,
        "direction_id": 37
    },
    {
        "operator_id": 8,
        "direction_id": 36
    },
    {
        "operator_id": 9,
        "direction_id": 35
    },
    {
        "operator_id": 9,
        "direction_id": 37
    },
    {
        "operator_id": 9,
        "direction_id": 36
    },
    {
        "operator_id": 10,
        "direction_id": 35
    },
    {
        "operator_id": 10,
        "direction_id": 37
    },
    {
        "operator_id": 10,
        "direction_id": 36
    },
    {
        "operator_id": 11,
        "direction_id": 34
    },
    {
        "operator_id": 11,
        "direction_id": 30
    },
    {
        "operator_id": 11,
        "direction_id": 23
    },
    {
        "operator_id": 11,
        "direction_id": 28
    },
    {
        "operator_id": 11,
        "direction_id": 24
    },
    {
        "operator_id": 11,
        "direction_id": 26
    },
    {
        "operator_id": 11,
        "direction_id": 27
    },
    {
        "operator_id": 11,
        "direction_id": 25
    },
    {
        "operator_id": 11,
        "direction_id": 32
    },
    {
        "operator_id": 11,
        "direction_id": 33
    },
    {
        "operator_id": 11,
        "direction_id": 18
    },
    {
        "operator_id": 11,
        "direction_id": 22
    },
    {
        "operator_id": 11,
        "direction_id": 21
    },
    {
        "operator_id": 11,
        "direction_id": 19
    },
    {
        "operator_id": 11,
        "direction_id": 20
    },
    {
        "operator_id": 11,
        "direction_id": 29
    },
    {
        "operator_id": 11,
        "direction_id": 31
    },
    {
        "operator_id": 12,
        "direction_id": 34
    },
    {
        "operator_id": 12,
        "direction_id": 30
    },
    {
        "operator_id": 12,
        "direction_id": 23
    },
    {
        "operator_id": 12,
        "direction_id": 28
    },
    {
        "operator_id": 12,
        "direction_id": 24
    },
    {
        "operator_id": 12,
        "direction_id": 26
    },
    {
        "operator_id": 12,
        "direction_id": 27
    },
    {
        "operator_id": 12,
        "direction_id": 25
    },
    {
        "operator_id": 12,
        "direction_id": 32
    },
    {
        "operator_id": 12,
        "direction_id": 33
    },
    {
        "operator_id": 12,
        "direction_id": 18
    },
    {
        "operator_id": 12,
        "direction_id": 22
    },
    {
        "operator_id": 12,
        "direction_id": 21
    },
    {
        "operator_id": 12,
        "direction_id": 19
    },
    {
        "operator_id": 12,
        "direction_id": 20
    },
    {
        "operator_id": 12,
        "direction_id": 29
    },
    {
        "operator_id": 12,
        "direction_id": 31
    },
    {
        "operator_id": 13,
        "direction_id": 34
    },
    {
        "operator_id": 13,
        "direction_id": 30
    },
    {
        "operator_id": 13,
        "direction_id": 23
    },
    {
        "operator_id": 13,
        "direction_id": 28
    },
    {
        "operator_id": 13,
        "direction_id": 24
    },
    {
        "operator_id": 13,
        "direction_id": 26
    },
    {
        "operator_id": 13,
        "direction_id": 27
    },
    {
        "operator_id": 13,
        "direction_id": 25
    },
    {
        "operator_id": 13,
        "direction_id": 32
    },
    {
        "operator_id": 13,
        "direction_id": 33
    },
    {
        "operator_id": 13,
        "direction_id": 18
    },
    {
        "operator_id": 13,
        "direction_id": 22
    },
    {
        "operator_id": 13,
        "direction_id": 21
    },
    {
        "operator_id": 13,
        "direction_id": 19
    },
    {
        "operator_id": 13,
        "direction_id": 20
    },
    {
        "operator_id": 13,
        "direction_id": 29
    },
    {
        "operator_id": 13,
        "direction_id": 31
    }
];
    for (const m of defaultMappings) {
      await run(
        `INSERT OR IGNORE INTO operator_directions (operator_id, direction_id) VALUES (?, ?)`,
        [m.operator_id, m.direction_id]
      );
    }
    console.log('Seeded operator-direction mapping.');
  }

  // Seed default settings if empty
  const settingsCount = await get(`SELECT COUNT(*) as count FROM settings`);
  if (settingsCount.count === 0) {
    const defaultSettings = [
    {
        "key": "css_bg_secondary",
        "value": "#0f172a"
    },
    {
        "key": "css_text_secondary",
        "value": "#94a3b8"
    },
    {
        "key": "css_bg_color_2",
        "value": "#6a280b"
    },
    {
        "key": "css_bg_angle",
        "value": "285deg"
    },
    {
        "key": "css_glass_blur",
        "value": "35px"
    },
    {
        "key": "logo_position",
        "value": "logo-left"
    },
    {
        "key": "css_bg_primary",
        "value": "#ff0f0f"
    },
    {
        "key": "css_text_primary",
        "value": "#f8fafc"
    },
    {
        "key": "css_kiosk_btn_width",
        "value": "420px"
    },
    {
        "key": "org_name",
        "value": "RANCH UNIVERSITY"
    },
    {
        "key": "logo_main",
        "value": "RANCH"
    },
    {
        "key": "logo_sub",
        "value": "University"
    },
    {
        "key": "brand_color",
        "value": "#ed2c2c"
    },
    {
        "key": "theme",
        "value": "theme-royal-gold"
    },
    {
        "key": "admin_theme",
        "value": "minimalist-slate"
    },
    {
        "key": "kiosk_theme",
        "value": "modern-dark"
    },
    {
        "key": "monitor_theme",
        "value": "minimalist-slate"
    },
    {
        "key": "op_theme",
        "value": "light-mode"
    },
    {
        "key": "bg_img",
        "value": ""
    },
    {
        "key": "kiosk_title",
        "value": "Elektron Navbat"
    },
    {
        "key": "monitor_title",
        "value": "Tizim Monitori"
    },
    {
        "key": "custom_css",
        "value": ""
    },
    {
        "key": "css_kiosk_bg_primary",
        "value": "#020617"
    },
    {
        "key": "css_kiosk_bg_secondary",
        "value": "#0f172a"
    },
    {
        "key": "css_kiosk_text_primary",
        "value": "#f8fafc"
    },
    {
        "key": "css_kiosk_text_secondary",
        "value": "#94a3b8"
    },
    {
        "key": "css_monitor_bg_primary",
        "value": "#000000"
    },
    {
        "key": "css_monitor_text_primary",
        "value": "#ffffff"
    },
    {
        "key": "css_monitor_text_secondary",
        "value": "#ffffff"
    },
    {
        "key": "css_op_bg_primary",
        "value": "#0024c7"
    },
    {
        "key": "css_op_bg_secondary",
        "value": "#1d4dbf"
    },
    {
        "key": "css_op_text_primary",
        "value": "#2d73b9"
    },
    {
        "key": "css_op_text_secondary",
        "value": "#4177c3"
    },
    {
        "key": "css_admin_bg_primary",
        "value": "#020617"
    },
    {
        "key": "css_admin_bg_secondary",
        "value": "#0f172a"
    },
    {
        "key": "css_admin_text_primary",
        "value": "#f8fafc"
    },
    {
        "key": "css_admin_text_secondary",
        "value": "#94a3b8"
    },
    {
        "key": "css_radius_sm",
        "value": "8px"
    },
    {
        "key": "css_radius_md",
        "value": "16px"
    },
    {
        "key": "css_kiosk_columns",
        "value": "repeat(4, 1fr)"
    },
    {
        "key": "css_kiosk_btn_padding",
        "value": "1.2rem 2.0rem"
    },
    {
        "key": "logo_img",
        "value": "/uploads/RANCH_LOGO_CMYK_02-D_lsJGq0.svg"
    },
    {
        "key": "css_logo_pos",
        "value": "absolute"
    },
    {
        "key": "css_logo_top",
        "value": "1px"
    },
    {
        "key": "css_logo_left",
        "value": "1312px"
    }
];
    for (const s of defaultSettings) {
      await run(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`, [s.key, s.value]);
    }
    console.log('Seeded default branding settings.');
  }

  // Clean up orphaned operator-direction mappings
  await run(`DELETE FROM operator_directions WHERE direction_id NOT IN (SELECT id FROM directions)`);
  await run(`DELETE FROM operator_directions WHERE operator_id NOT IN (SELECT id FROM operators)`);

  // Fix operator_directions table foreign key reference if it points to directions_old
  const opDirsSchema = await get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='operator_directions'`);
  if (opDirsSchema && opDirsSchema.sql.includes('directions_old')) {
    console.log('Migrating operator_directions table to fix foreign key reference...');
    let rows = [];
    try {
      rows = await all(`SELECT * FROM operator_directions`);
    } catch (e) {
      console.log('Could not backup operator_directions:', e.message);
    }
    await run(`DROP TABLE operator_directions`);
    await run(`
      CREATE TABLE operator_directions (
        operator_id INTEGER,
        direction_id INTEGER,
        PRIMARY KEY (operator_id, direction_id),
        FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE CASCADE,
        FOREIGN KEY (direction_id) REFERENCES directions(id) ON DELETE CASCADE
      )
    `);
    for (const r of rows) {
      try {
        await run(`INSERT INTO operator_directions (operator_id, direction_id) VALUES (?, ?)`, [r.operator_id, r.direction_id]);
      } catch (e) {
        // ignore invalid rows
      }
    }
    console.log('operator_directions table migrated successfully.');
  }

  // Migration: Drop UNIQUE constraint on directions.code if it exists
  const schemaRow = await get(`SELECT sql FROM sqlite_master WHERE type='table' AND name='directions'`);
  if (schemaRow && schemaRow.sql.includes('UNIQUE')) {
    console.log('Migrating directions table to remove UNIQUE constraint...');
    await run(`ALTER TABLE directions RENAME TO directions_old`);
    await run(`
      CREATE TABLE directions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        room INTEGER NOT NULL
      )
    `);
    await run(`INSERT INTO directions (id, name, code, room) SELECT id, name, code, room FROM directions_old`);
    await run(`DROP TABLE directions_old`);
    console.log('directions table migrated successfully.');
  }

  // Migration: Add direction_id column to queues if it doesn't exist
  const queuesCols = await all(`PRAGMA table_info(queues)`);
  const hasDirectionId = queuesCols.some(col => col.name === 'direction_id');
  if (!hasDirectionId) {
    console.log('Adding direction_id column to queues table...');
    await run(`ALTER TABLE queues ADD COLUMN direction_id INTEGER`);
    await run(`
      UPDATE queues 
      SET direction_id = (
        SELECT id FROM directions 
        WHERE directions.code = queues.direction_code 
        LIMIT 1
      )
      WHERE direction_id IS NULL
    `);
    console.log('queues table migrated successfully.');
  }

  // Enable foreign keys now that the schema is clean
  await run(`PRAGMA foreign_keys = ON`);
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

// Generate the next available direction letter code sequentially
async function getNextAvailableDirectionCode() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const existingRows = await all(`SELECT code FROM directions`);
  const existingCodes = existingRows.map(r => r.code.toUpperCase());

  for (let i = 0; i < alphabet.length; i++) {
    const code = alphabet[i];
    if (!existingCodes.includes(code)) return code;
  }

  for (let i = 0; i < alphabet.length; i++) {
    for (let j = 0; j < alphabet.length; j++) {
      const code = alphabet[i] + alphabet[j];
      if (!existingCodes.includes(code)) return code;
    }
  }

  return "A";
}

module.exports = {
  initDatabase,
  run,
  get,
  all,
  getNextQueueNumber,
  
  getNextAvailableDirectionCode,

  // Directions Operations
  getDirections: () => all(`SELECT * FROM directions ORDER BY name ASC`),
  addDirection: (name, code, room) => run(
    `INSERT INTO directions (name, code, room) VALUES (?, ?, ?)`,
    [name, code.toUpperCase(), room]
  ),
  updateDirection: async (id, name, code, room) => {
    const newCode = code.toUpperCase();

    await run(
      `UPDATE directions SET name = ?, code = ?, room = ? WHERE id = ?`,
      [name, newCode, room, id]
    );

    // Update all queues mapped to this direction_id
    await run(
      `UPDATE queues SET direction_code = ? WHERE direction_id = ?`,
      [newCode, id]
    );

    // Update room for waiting queues
    await run(
      `UPDATE queues SET room = ? WHERE direction_id = ? AND status = 'waiting'`,
      [room, id]
    );
  },
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
        // Automatically sync direction's room with operator's room
        await run(
          `UPDATE directions SET room = ? WHERE id = ?`,
          [room, dirId]
        );
        // Sync active waiting tickets room
        await run(
          `UPDATE queues SET room = ? WHERE direction_id = ? AND status = 'waiting'`,
          [room, dirId]
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
        // Automatically sync direction's room with operator's room
        await run(
          `UPDATE directions SET room = ? WHERE id = ?`,
          [room, dirId]
        );
        // Sync active waiting tickets room
        await run(
          `UPDATE queues SET room = ? WHERE direction_id = ? AND status = 'waiting'`,
          [room, dirId]
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
  createTicket: async (directionId) => {
    const direction = await get(`SELECT id, name, code, room FROM directions WHERE id = ?`, [directionId]);
    if (!direction) throw new Error('Yo\'nalish topilmadi');

    const nextNum = await getNextQueueNumber(direction.code);
    
    // Insert into queues table
    const result = await run(
      `INSERT INTO queues (direction_id, direction_code, number, status, room) VALUES (?, ?, ?, 'waiting', ?)`,
      [directionId, direction.code, nextNum, direction.room]
    );

    return {
      id: result.lastID,
      direction_id: directionId,
      direction_code: direction.code,
      direction_name: direction.name,
      number: nextNum,
      ticket_code: `${direction.code}${nextNum}`,
      room: direction.room,
      status: 'waiting',
      created_at: new Date().toISOString()
    };
  },

  // Get waiting queue. Restructured: returns ALL waiting tickets.
  getWaitingQueue: () => all(
    `SELECT q.*, d.name as direction_name 
     FROM queues q
     JOIN directions d ON q.direction_id = d.id
     WHERE q.status = 'waiting' 
     ORDER BY q.id ASC`
  ),

  // RESTURCTURED CALL NEXT TICKET:
  // Operator calls the oldest ticket from the list of directions they serve.
  callNextTicket: async (operatorId, room) => {
    // 1. Get the direction IDs assigned to this operator
    const assignedDirs = await all(
      `SELECT direction_id FROM operator_directions WHERE operator_id = ?`,
      [operatorId]
    );

    if (assignedDirs.length === 0) return null; // No directions mapped to this operator

    // Create an SQL placeholders string: (?, ?, ?)
    const placeholders = assignedDirs.map(() => '?').join(',');
    const ids = assignedDirs.map(d => d.direction_id);

    // 2. Query the oldest waiting ticket from the assigned direction IDs
    const ticket = await get(
      `SELECT q.*, d.name as direction_name 
       FROM queues q
       JOIN directions d ON q.direction_id = d.id
       WHERE q.status = 'waiting' AND q.direction_id IN (${placeholders})
       ORDER BY q.id ASC LIMIT 1`,
      ids
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
       JOIN directions d ON q.direction_id = d.id
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
       JOIN directions d ON q.direction_id = d.id
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
       JOIN directions d ON q.direction_id = d.id
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
     LEFT JOIN directions d ON q.direction_id = d.id
     LEFT JOIN operators o ON q.operator_id = o.id
     ORDER BY q.id DESC`
  )
};
