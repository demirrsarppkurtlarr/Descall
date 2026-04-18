const { app, BrowserWindow } = require("electron");
const path = require("path");
const { fork } = require("child_process");
const fs = require("fs");

const isDev = !app.isPackaged;

let serverProcess = null;
let mainWindow = null;

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
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173").catch(() => {
      console.error("Vite dev server not running. Run 'npm run dev' first.");
    });
    mainWindow.webContents.openDevTools();
  } else {
    const distPath = path.join(__dirname, "..", "dist", "index.html");
    mainWindow.loadFile(distPath).catch((err) => {
      console.error("Failed to load dist/index.html:", err);
    });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  if (!isDev) {
    startBackend();
  }
  createWindow();
});

app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  app.quit();
});

app.on("will-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
