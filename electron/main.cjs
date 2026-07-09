const { app, BrowserWindow } = require('electron');
const path = require('path');

// Fix GPU sandbox crash on Windows without fully disabling canvas rendering
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('no-sandbox');

const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Ghost Riders',
    backgroundColor: '#0b0706',
    show: false,
    center: true,
    autoHideMenuBar: true,
    alwaysOnTop: true,          // force to front on launch
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
    win.setAlwaysOnTop(false);  // release after shown
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
