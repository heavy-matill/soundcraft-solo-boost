// Proper way to import Electron for main process
const DEBUG = false;
const { app, BrowserWindow, screen, globalShortcut, ipcMain, Notification } = require('electron');
const ElectronStore = require('electron-store');
ElectronStore.initRenderer();
const path = require('path');
app.setAppUserModelId(process.execPath) // for Notification to work (also add node_modules\electron\dist\electron.exe to start menu)

function createWindow() {
  const height = 300;
  // Create the browser window.
  const win = new BrowserWindow({
    x: 0,
    y: (screen.getPrimaryDisplay().workAreaSize.height - height) / 2, // Position at center left
    width: 200,
    height: height,
    alwaysOnTop: true,
    frame: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  if (DEBUG) {
    // Open DevTools for debugging (remove in production)
    win.webContents.openDevTools();
  }
  // Disable Application Menu
  win.setMenu(null);

  // Load index.html
  win.loadFile('index.html');

}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {

  createWindow();

  ipcMain.on('show-boost-notification', (event, payload) => {
    const isActive = Boolean(payload?.isActive);
    const icon = path.join(__dirname, isActive ? 'power-button-icon-green.png' : 'power-button-icon-red.png');

    new Notification({
      title: '3dB Boost',
      body: isActive ? '3dB Boost Activated' : '3dB Boost Deactivated',
      silent: true,
      icon
    }).show();
  });

  // Register global shortcut for Ctrl+Shift+B to toggle 3dB boost
  const ret = globalShortcut.register('CommandOrControl+Shift+B', () => {
    // Send message to all webContents to toggle 3dB boost
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.send('toggle-3db-boost');
      }
    });
  });

  if (!ret) {
    console.error('Global shortcut registration failed');
  }
});

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

// Unregister all shortcuts when the app is quitting
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});