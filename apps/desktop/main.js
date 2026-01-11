const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow;

const isDev = !app.isPackaged;

// Get paths
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
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'pharmastream.db');
};

// Wait for server to be ready
function waitForServer(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkServer = () => {
      const req = http.request({ host: 'localhost', port, path: '/api/health', method: 'GET' }, (res) => {
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
  const dbPath = getDatabasePath();
  
  // Set environment variables BEFORE requiring the server
  process.env.PORT = '3001';
  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.NODE_ENV = isDev ? 'development' : 'production';
  
  console.log('Database path:', dbPath);
  console.log('Starting server...');
  
  try {
    if (isDev) {
      // Development: spawn ts-node as separate process
      const { spawn } = require('child_process');
      const serverPath = path.join(__dirname, '..', 'server');
      
      const serverProcess = spawn('npx', ['ts-node', 'src/index.ts'], {
        cwd: serverPath,
        env: process.env,
        shell: true,
        stdio: 'inherit'
      });
      
      serverProcess.on('error', (err) => {
        console.error('Server process error:', err);
      });
    } else {
      // Production: require the compiled server directly (runs in same process)
      const serverPath = path.join(process.resourcesPath, 'server', 'dist', 'index.js');
      console.log('Loading server from:', serverPath);
      
      if (!fs.existsSync(serverPath)) {
        throw new Error(`Server file not found: ${serverPath}`);
      }
      
      require(serverPath);
    }
    
    // Wait for server to be ready
    await waitForServer(3001);
    console.log('Server is ready!');
    
  } catch (error) {
    console.error('Failed to start server:', error);
    throw error;
  }
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
    const indexPath = path.join(webPath, 'index.html');
    
    console.log('Loading web from:', indexPath);
    
    if (!fs.existsSync(indexPath)) {
      dialog.showErrorBox('Error', `Web files not found: ${indexPath}`);
      app.quit();
      return;
    }
    
    mainWindow.loadFile(indexPath);
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
    console.log('Resources path:', process.resourcesPath);
    
    await startServer();
    createWindow();
    
  } catch (error) {
    console.error('Failed to start:', error);
    dialog.showErrorBox('Startup Error', error.message || 'Failed to start application');
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
