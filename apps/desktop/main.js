const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { spawn, fork } = require('child_process');
const http = require('http');
const fs = require('fs');

let mainWindow;
let serverProcess;

const isDev = !app.isPackaged;

// Paths
const getServerPath = () => {
  if (isDev) {
    return path.join(__dirname, '..', 'server');
  }
  return path.join(process.resourcesPath, 'server');
};

const getWebPath = () => {
  if (isDev) {
    return path.join(__dirname, '..', 'web', 'out');
  }
  return path.join(process.resourcesPath, 'web');
};

const getDatabasePath = () => {
  if (isDev) {
    return path.join(__dirname, '..', '..', 'data', 'pharmastream.db');
  }
  // In production, store in user data directory
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'pharmastream.db');
  
  // Copy default database if it doesn't exist
  if (!fs.existsSync(dbPath)) {
    const defaultDb = path.join(process.resourcesPath, 'data', 'pharmastream.db');
    if (fs.existsSync(defaultDb)) {
      fs.copyFileSync(defaultDb, dbPath);
    }
  }
  
  return dbPath;
};

// Wait for server to be ready
function waitForServer(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkServer = () => {
      const req = http.request({ host: 'localhost', port, path: '/api/settings', method: 'GET' }, (res) => {
        resolve();
      });
      
      req.on('error', () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error('Server startup timeout'));
        } else {
          setTimeout(checkServer, 500);
        }
      });
      
      req.end();
    };
    
    checkServer();
  });
}

async function startServer() {
  const serverPath = getServerPath();
  const dbPath = getDatabasePath();
  
  console.log('Server path:', serverPath);
  console.log('Database path:', dbPath);
  
  const env = {
    ...process.env,
    PORT: '3001',
    DATABASE_URL: `file:${dbPath}`,
    NODE_ENV: isDev ? 'development' : 'production'
  };

  if (isDev) {
    // Development: use ts-node
    serverProcess = spawn('npx', ['ts-node', 'src/index.ts'], {
      cwd: serverPath,
      env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } else {
    // Production: use compiled JS
    const nodeExecutable = process.execPath;
    serverProcess = spawn(nodeExecutable, [path.join(serverPath, 'dist', 'index.js')], {
      cwd: serverPath,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  }

  serverProcess.stdout.on('data', (data) => {
    console.log(`[Server] ${data.toString().trim()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Server Error] ${data.toString().trim()}`);
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to start server:', err);
  });

  serverProcess.on('exit', (code) => {
    console.log(`Server exited with code ${code}`);
  });

  // Wait for server to be ready
  await waitForServer(3001);
  console.log('Server is ready!');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: 'PharmaStream ERP',
    icon: path.join(__dirname, 'icons', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  });

  // Remove menu bar
  Menu.setApplicationMenu(null);

  if (isDev) {
    // Development: load from Next.js dev server
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // Production: load static files
    const webPath = getWebPath();
    mainWindow.loadFile(path.join(webPath, 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(async () => {
  try {
    console.log('Starting PharmaStream...');
    console.log('Development mode:', isDev);
    
    await startServer();
    createWindow();
    
  } catch (error) {
    console.error('Failed to start:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
