const { 
  app, 
  BrowserWindow, 
  ipcMain, 
  globalShortcut, 
  Tray, 
  Menu, 
  nativeImage,
  Notification,
  shell
} = require("electron");
const path = require("path");
const { fork } = require("child_process");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");

const isDev = !app.isPackaged;

let serverProcess = null;
let mainWindow = null;
let tray = null;

// Auto updater logging
autoUpdater.logger = require("electron-log");
autoUpdater.logger.transports.file.level = "info";

function startBackend() {
  let serverPath;
  if (isDev) {
    serverPath = path.join(__dirname, "..", "backend", "server.js");
  } else {
    serverPath = path.join(process.resourcesPath, "backend", "server.js");
  }

  if (!fs.existsSync(serverPath)) {
    console.log("Backend server.js not found, skipping backend start.");
    return;
  }

  try {
    serverProcess = fork(serverPath, [], {
      stdio: "inherit",
      env: { ...process.env },
    });
    serverProcess.on("error", (err) => {
      console.error("Backend start error:", err.message);
    });
    serverProcess.on("exit", (code) => {
      console.log("Backend exited with code:", code);
      serverProcess = null;
    });
  } catch (err) {
    console.error("Backend fork error:", err.message);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    
    // Frameless - no title bar
    frame: false,
    titleBarStyle: "hidden",
    
    // Preload script
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      webSecurity: true,
    },
    
    show: false, // Don't show until ready
    icon: path.join(__dirname, "..", "public", "icon.png"),
    
    // Smooth visuals
    backgroundColor: "#1a1b1e",
  });

  // Load URL or file
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173").catch(() => {
      console.error("Vite dev server not running. Run 'npm run dev' first.");
    });
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    const distPath = path.join(__dirname, "..", "dist", "index.html");
    mainWindow.loadFile(distPath).catch((err) => {
      console.error("Failed to load dist/index.html:", err);
    });
  }

  // Show when ready with fade effect
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.setOpacity(0);
    let opacity = 0;
    const fadeIn = setInterval(() => {
      opacity += 0.15;
      mainWindow.setOpacity(opacity);
      if (opacity >= 1) clearInterval(fadeIn);
    }, 25);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

// System Tray
function createTray() {
  const iconPath = path.join(__dirname, "..", "public", "tray-icon.png");
  
  // Create icon (fallback to default if not exists)
  let icon;
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } else {
    icon = nativeImage.createEmpty();
  }
  
  tray = new Tray(icon);
  tray.setToolTip("Descall");
  
  const contextMenu = Menu.buildFromTemplate([
    { label: "Aç / Göster", click: () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      } else {
        createWindow();
      }
    }},
    { label: "Tam Ekran", click: () => {
      if (mainWindow) {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
      }
    }},
    { type: "separator" },
    { label: "Güncellemeleri Kontrol Et", click: () => {
      autoUpdater.checkForUpdatesAndNotify();
    }},
    { type: "separator" },
    { label: "Çıkış", click: () => {
      if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
      }
      app.quit();
    }}
  ]);
  
  tray.setContextMenu(contextMenu);
  
  tray.on("click", () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    } else {
      createWindow();
    }
  });
  
  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });
}

// Window control IPC handlers
ipcMain.handle("window-minimize", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle("window-maximize", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle("window-close", () => {
  if (mainWindow) mainWindow.hide(); // Hide to tray instead of close
});

ipcMain.handle("window-fullscreen", () => {
  if (mainWindow) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  }
});

ipcMain.handle("window-is-maximized", () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

ipcMain.handle("window-is-fullscreen", () => {
  return mainWindow ? mainWindow.isFullScreen() : false;
});

ipcMain.handle("app-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  app.quit();
});

ipcMain.handle("app-version", () => {
  return app.getVersion();
});

// Notification handler
ipcMain.handle("show-notification", (event, title, body, icon) => {
  if (Notification.isSupported()) {
    new Notification({
      title,
      body,
      icon: icon || path.join(__dirname, "..", "public", "icon.png"),
      silent: false,
    }).show();
  }
});

// Auto updater events
autoUpdater.on("checking-for-update", () => {
  console.log("Checking for update...");
  if (mainWindow) {
    mainWindow.webContents.send("update-message", "Güncellemeler kontrol ediliyor...");
  }
});

autoUpdater.on("update-available", (info) => {
  console.log("Update available:", info);
  if (mainWindow) {
    mainWindow.webContents.send("update-available", info);
  }
});

autoUpdater.on("update-not-available", (info) => {
  console.log("Update not available:", info);
  if (mainWindow) {
    mainWindow.webContents.send("update-message", "En son sürümü kullanıyorsunuz.");
  }
});

autoUpdater.on("error", (err) => {
  console.error("Update error:", err);
  if (mainWindow) {
    mainWindow.webContents.send("update-error", err.message);
  }
});

autoUpdater.on("download-progress", (progressObj) => {
  let logMessage = `Download speed: ${progressObj.bytesPerSecond}`;
  logMessage += ` - Downloaded ${progressObj.percent}%`;
  logMessage += ` (${progressObj.transferred}/${progressObj.total})`;
  console.log(logMessage);
  if (mainWindow) {
    mainWindow.webContents.send("update-progress", progressObj);
  }
});

autoUpdater.on("update-downloaded", (info) => {
  console.log("Update downloaded:", info);
  if (mainWindow) {
    mainWindow.webContents.send("update-downloaded", info);
  }
  
  // Show notification
  if (Notification.isSupported()) {
    new Notification({
      title: "Descall - Güncelleme Hazır",
      body: "Yeni sürüm indirildi. Uygulamayı yeniden başlatmak için tıklayın.",
    }).onclick = () => {
      autoUpdater.quitAndInstall();
    };
  }
});

// App ready
app.whenReady().then(() => {
  if (!isDev) {
    startBackend();
  }
  createWindow();
  createTray();
  
  // Global shortcuts
  globalShortcut.register("F11", () => {
    if (mainWindow) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });
  
  globalShortcut.register("Escape", () => {
    if (mainWindow && mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    }
  });
  
  globalShortcut.register("CommandOrControl+Shift+D", () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });
  
  // Check for updates after 3 seconds
  if (!isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify();
    }, 3000);
  }
  
  // Auto start at login
  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: false,
    path: app.getPath("exe"),
  });
});

// Window management
app.on("window-all-closed", () => {
  // Don't quit on macOS when all windows are closed
  if (process.platform !== "darwin") {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
    app.quit();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Protocol handler (descall://)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("descall", process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient("descall");
}

app.on("open-url", (event, url) => {
  console.log("Protocol URL opened:", url);
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send("protocol-url", url);
  }
});

