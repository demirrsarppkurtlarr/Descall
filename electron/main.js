const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let serverProcess;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800
  });

  win.loadFile(path.join(__dirname, "../dist/index.html"));
}

app.whenReady().then(() => {
  // 🔥 Backend başlat
  serverProcess = spawn("node", ["src/server.js"], {
    stdio: "inherit"
  });

  createWindow();
});

// uygulama kapanınca backend de kapanır
app.on("will-quit", () => {
  if (serverProcess) serverProcess.kill();
});
