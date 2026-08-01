// Proper way to import Electron for main process
const { app, BrowserWindow, screen } = require('electron');

function createWindow() {
  const height = 300;
  // Create the browser window.
  const win = new BrowserWindow({
    x: 0,
    y: (screen.getPrimaryDisplay().workAreaSize.height - height)/2, // Position at center left
    width: 200,
    height: height,
    alwaysOnTop: true,
    frame: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  // Disable Application Menu
  win.setMenu(null);

  // Load index.html
  win.loadFile('index.html');
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the dock when the icon is clicked
  // and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});