const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// ─── Konfiguratsiyani o'qish ────────────────────────────────────────────────
function getConfig() {
  try {
    const configPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {}
  return { serverUrl: 'http://localhost:3000' };
}

// ─── Qo'shimcha argument orqali rolni aniqlash ──────────────────────────────
function getRole() {
  const args = process.argv.slice(2);
  if (args.includes('--kiosk'))    return 'kiosk';
  if (args.includes('--monitor'))  return 'monitor';
  if (args.includes('--operator')) return 'operator';
  if (args.includes('--admin'))    return 'admin';
  return 'launcher'; // Default: tanlash oynasi
}

// ─── Lokal backend serverini ishga tushirish ────────────────────────────────
let serverProcess = null;

function startLocalServer() {
  return new Promise((resolve) => {
    const serverScript = path.join(__dirname, 'server.js');
    if (!fs.existsSync(serverScript)) {
      resolve(false);
      return;
    }

    serverProcess = spawn('node', [serverScript], {
      cwd: __dirname,
      detached: false,
      stdio: 'ignore'
    });

    serverProcess.on('error', (err) => {
      console.error('Server ishga tushmadi:', err.message);
      resolve(false);
    });

    // Serverning tayyor bo'lishini kutamiz
    let attempts = 0;
    const checkServer = () => {
      const http = require('http');
      const req = http.get('http://localhost:3000/api/directions', (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          retry();
        }
      });
      req.on('error', retry);
      req.end();
    };
    const retry = () => {
      attempts++;
      if (attempts < 20) {
        setTimeout(checkServer, 500);
      } else {
        resolve(false);
      }
    };
    setTimeout(checkServer, 800);
  });
}

// ─── Oyna yaratish ──────────────────────────────────────────────────────────
let mainWindow = null;

async function createWindow() {
  const config = getConfig();
  const role = getRole();
  const isLocal = config.serverUrl.includes('localhost') || config.serverUrl.includes('127.0.0.1');

  // Lokal server kerakmi? Ishga tushuramiz
  if (isLocal) {
    await startLocalServer();
  }

  const serverUrl = config.serverUrl.replace(/\/$/, '');

  // Rol bo'yicha URL va oyna sozlamalarini belgilaymiz
  const roleConfig = {
    kiosk: {
      url: `${serverUrl}/kiosk.html`,
      title: 'Mijoz Infokioski - Elektron Navbat',
      fullscreen: true,
      kiosk: true,
      frame: false,
      width: 1920,
      height: 1080,
    },
    monitor: {
      url: `${serverUrl}/monitor.html`,
      title: 'Kutish Zali Monitori - Elektron Navbat',
      fullscreen: true,
      kiosk: false,
      frame: false,
      width: 1920,
      height: 1080,
    },
    operator: {
      url: `${serverUrl}/operator.html`,
      title: 'Operator Paneli - Elektron Navbat',
      fullscreen: false,
      kiosk: false,
      frame: true,
      width: 1280,
      height: 800,
    },
    admin: {
      url: `${serverUrl}/admin.html`,
      title: 'Admin Panel - Elektron Navbat',
      fullscreen: false,
      kiosk: false,
      frame: true,
      width: 1440,
      height: 900,
    },
    launcher: {
      url: `file://${path.join(__dirname, 'public', 'launcher.html')}`,
      title: 'Elektron Navbat - Asosiy Menyu',
      fullscreen: false,
      kiosk: false,
      frame: false,
      width: 900,
      height: 620,
    },
  };

  const cfg = roleConfig[role] || roleConfig.launcher;

  mainWindow = new BrowserWindow({
    width: cfg.width,
    height: cfg.height,
    title: cfg.title,
    fullscreen: cfg.fullscreen,
    kiosk: cfg.kiosk,
    frame: cfg.frame,
    resizable: role === 'operator' || role === 'admin',
    center: true,
    backgroundColor: '#020617',
    icon: path.join(__dirname, 'public', 'favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // Kiosk rejimida zamonaviy web API-larini to'liq yoqamiz
      webSecurity: true,
      allowRunningInsecureContent: false,
    }
  });

  // Manzil paneli va menyu panelini olib tashlaymiz
  mainWindow.setMenuBarVisibility(false);

  // Sahifani yuklaymiz
  if (role === 'launcher') {
    mainWindow.loadFile(path.join(__dirname, 'public', 'launcher.html'));
  } else {
    mainWindow.loadURL(cfg.url);
  }

  // Oyna ochilayotganida chiroyli animatsiya
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // ─── F11 => to'liq ekran almashtirish (operator va admin uchun) ──────────
  if (role === 'operator' || role === 'admin') {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F11' && input.type === 'keyDown') {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
      }
    });
  }

  // ─── Kiosk uchun ESC va F4 ni bloklash ──────────────────────────────────
  if (role === 'kiosk') {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'Escape' || (input.alt && input.key === 'F4')) {
        event.preventDefault();
      }
    });
  }
}

// ─── IPC: Launcher oynasidan rol tanlash ────────────────────────────────────
ipcMain.on('open-role', (event, role) => {
  if (mainWindow) mainWindow.close();
  // Yangi oynani rol bilan ochish uchun o'zimizni restart qilamiz
  const { execPath } = process;
  const appPath = app.isPackaged
    ? path.join(path.dirname(execPath), 'resources', 'app')
    : __dirname;

  const electron = require('electron');
  const child = spawn(
    app.isPackaged ? execPath : electron,
    app.isPackaged ? [`--${role}`] : [appPath, `--${role}`],
    { detached: true, stdio: 'ignore', cwd: __dirname }
  );
  child.unref();
});

// ─── IPC: Yashirin chop etish (Silent Print) ────────────────────────────────
ipcMain.handle('silent-print', async (event) => {
  if (!mainWindow) return { success: false, error: 'Oyna topilmadi' };

  try {
    const printers = await mainWindow.webContents.getPrintersAsync();

    // Asosiy (default) printerni topamiz
    let targetPrinter = printers.find(p => p.isDefault);
    if (!targetPrinter && printers.length > 0) {
      // PDF printerlarni chiqarib tashlaymiz
      targetPrinter = printers.find(p =>
        !p.name.toLowerCase().includes('pdf') &&
        !p.name.toLowerCase().includes('xps') &&
        !p.name.toLowerCase().includes('onenote') &&
        !p.name.toLowerCase().includes('fax')
      ) || printers[0];
    }

    if (!targetPrinter) {
      return { success: false, error: 'Printer topilmadi. Iltimos, printer o\'rnatib, asosiy printer sifatida belgilang.' };
    }

    return new Promise((resolve) => {
      mainWindow.webContents.print(
        {
          silent: true,            // Chop etish oynasini ko'rsatma
          printBackground: true,   // Fon ranglarini ham chop et
          deviceName: targetPrinter.name,
          margins: { marginType: 'custom', top: 0, bottom: 0, left: 0, right: 0 },
          pageSize: { width: 80000, height: 200000 }, // 80mm kenglik (mikronlarda)
          scaleFactor: 100,
        },
        (success, errorType) => {
          if (success) {
            resolve({ success: true, printer: targetPrinter.name });
          } else {
            resolve({ success: false, error: errorType });
          }
        }
      );
    });
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── IPC: Printerlar ro'yxatini olish ──────────────────────────────────────
ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return [];
  try {
    const printers = await mainWindow.webContents.getPrintersAsync();
    return printers.map(p => ({ name: p.name, isDefault: p.isDefault }));
  } catch (e) {
    return [];
  }
});

// ─── IPC: Oynani yopish (launcher uchun) ───────────────────────────────────
ipcMain.on('quit-app', () => {
  app.quit();
});

// ─── App hodisalari ──────────────────────────────────────────────────────────
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
