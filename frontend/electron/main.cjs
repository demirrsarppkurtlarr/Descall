const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage, protocol } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');

// Logging
log.transports.file.level = 'info';
log.info('App starting...');

// Auto-updater logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// Paths
const isDev = process.env.NODE_ENV === 'development';
const isPackaged = app.isPackaged;

let mainWindow = null;
let splashWindow = null;

// Create splash window
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 500,
    height: 300,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadURL(`data:text/html,
    <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 0;
            width: 500px;
            height: 300px;
            background: linear-gradient(135deg, #6678ff 0%, #8b5cf6 100%);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: white;
            overflow: hidden;
            border-radius: 20px;
          }
          .logo {
            font-size: 48px;
            font-weight: bold;
            margin-bottom: 20px;
            text-shadow: 0 4px 20px rgba(0,0,0,0.3);
          }
          .loading {
            font-size: 16px;
            opacity: 0.9;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255,255,255,0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-top: 20px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .version {
            position: absolute;
            bottom: 20px;
            font-size: 12px;
            opacity: 0.7;
          }
        </style>
      </head>
      <body>
        <div class="logo">Descall</div>
        <div class="loading">Yükleniyor...</div>
        <div class="spinner"></div>
        <div class="version">v${app.getVersion()}</div>
      </body>
    </html>
  `);

  splashWindow.center();
}

// Create main window
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    show: false,
    titleBarStyle: 'default',
    icon: path.join(__dirname, '../public/favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: false,
      allowRunningInsecureContent: true
    }
  });

  // Set CSP headers to allow Supabase and API connections
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "connect-src 'self' https://descall-qzkg.onrender.com https://*.supabase.co https://*.supabase.in wss://*.supabase.co wss://descall-qzkg.onrender.com http://localhost:5173; " +
          "img-src 'self' https://*.supabase.co https://*.supabase.in data: blob:; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "font-src 'self'; " +
          "media-src 'self' blob:;"
        ]
      }
    });
  });

  // Load app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // For asar:false, files are in resources/app/dist/
    const indexPath = path.join(app.getAppPath(), 'dist', 'index.html');
    console.log('Loading from:', indexPath);
    
    if (require('fs').existsSync(indexPath)) {
      mainWindow.loadFile(indexPath).catch(err => {
        console.error('Failed to load:', err);
        dialog.showErrorBox('Loading Error', `Failed to load app: ${err.message}`);
      });
    } else {
      // Fallback: try alternative paths
      const altPaths = [
        path.join(__dirname, 'dist', 'index.html'),
        path.join(__dirname, '..', 'dist', 'index.html'),
        path.join(process.resourcesPath, 'dist', 'index.html')
      ];
      
      let found = false;
      for (const altPath of altPaths) {
        if (require('fs').existsSync(altPath)) {
          console.log('Found at alternative path:', altPath);
          mainWindow.loadFile(altPath);
          found = true;
          break;
        }
      }
      
      if (!found) {
        dialog.showErrorBox('Loading Error', `index.html not found at: ${indexPath}\nChecked alternatives:\n${altPaths.join('\n')}`);
      }
    }
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.focus();

    // Check for updates after window shows
    if (isPackaged) {
      autoUpdater.checkForUpdatesAndNotify();
    }
  });

  // Window events
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Security: Prevent navigation to external sites
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.includes('localhost') && !url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

// App events
app.whenReady().then(() => {
  createSplashWindow();
  
  // Small delay for splash effect
  setTimeout(() => {
    createMainWindow();
  }, 1500);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
  log.info('Checking for update...');
});

autoUpdater.on('update-available', (info) => {
  log.info('Update available:', info);
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Güncelleme Mevcut',
    message: 'Yeni bir sürüm mevcut. İndirip kurulacak.',
    buttons: ['Tamam']
  });
});

autoUpdater.on('update-not-available', (info) => {
  log.info('Update not available:', info);
});

autoUpdater.on('error', (err) => {
  log.error('Auto-updater error:', err);
});

autoUpdater.on('download-progress', (progressObj) => {
  let logMessage = `Download speed: ${progressObj.bytesPerSecond}`;
  logMessage += ` - Downloaded ${progressObj.percent}%`;
  logMessage += ` (${progressObj.transferred}/${progressObj.total})`;
  log.info(logMessage);
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded:', info);
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Güncelleme Hazır',
    message: 'Yeni sürüm indirildi. Yeniden başlatmak ister misiniz?',
    buttons: ['Şimdi Yeniden Başlat', 'Daha Sonra'],
    defaultId: 0
  }).then((returnValue) => {
    if (returnValue.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

// IPC handlers
ipcMain.handle('app-version', () => {
  return app.getVersion();
});

ipcMain.handle('check-for-updates', async () => {
  if (isPackaged) {
    await autoUpdater.checkForUpdates();
  }
  return { success: true };
});

ipcMain.handle('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('close-window', () => {
  if (mainWindow) mainWindow.close();
});

// Security: Handle downloads
ipcMain.on('download-file', async (event, { url, filename }) => {
  try {
    const { default: fetch } = await import('node-fetch');
    const response = await fetch(url);
    const buffer = await response.buffer();
    
    const downloadsPath = app.getPath('downloads');
    const filePath = path.join(downloadsPath, filename);
    
    fs.writeFileSync(filePath, buffer);
    
    shell.showItemInFolder(filePath);
    return { success: true, path: filePath };
  } catch (error) {
    log.error('Download error:', error);
    return { success: false, error: error.message };
  }
});

// Register custom protocol for sounds
app.on('ready', () => {
  protocol.registerFileProtocol('app', (request, callback) => {
    const url = request.url.substr(6); // Remove 'app://'
    const filePath = path.join(__dirname, '..', url);
    callback({ path: filePath });
  });
});

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

log.info('Electron main process initialized');
