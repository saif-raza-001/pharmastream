const { app, BrowserWindow, Menu, dialog, globalShortcut } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow;

const isDev = !app.isPackaged;

const getWebPath = () => {
  if (isDev) {
    return path.join(__dirname, '..', 'web', 'out');
  }
  return path.join(process.resourcesPath, 'web');
};

const getDatabasePath = () => {
  if (isDev) {
    return path.join(__dirname, '..', '..', 'packages', 'data', 'pharmastream.db');
  }
  
  const userDataPath = app.getPath('userData');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  
  const dbPath = path.join(userDataPath, 'pharmastream.db');
  
  // Copy default database on first run if it doesn't exist
  if (!fs.existsSync(dbPath)) {
    const defaultDbPath = path.join(process.resourcesPath, 'data', 'pharmastream.db');
    if (fs.existsSync(defaultDbPath)) {
      console.log('Copying default database...');
      fs.copyFileSync(defaultDbPath, dbPath);
    }
  }
  
  return dbPath;
};

function waitForServer(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkServer = () => {
      const req = http.request({ host: 'localhost', port, path: '/api/health', method: 'GET', timeout: 2000 }, (res) => {
        resolve();
      });
      
      req.on('error', () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error('Server startup timeout'));
        } else {
          setTimeout(checkServer, 500);
        }
      });
      
      req.on('timeout', () => {
        req.destroy();
        setTimeout(checkServer, 500);
      });
      
      req.end();
    };
    
    setTimeout(checkServer, 1000);
  });
}

async function startServer() {
  const dbPath = getDatabasePath();
  const webPath = getWebPath();
  const PORT = 3001;
  
  process.env.PORT = String(PORT);
  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.NODE_ENV = isDev ? 'development' : 'production';
  process.env.WEB_PATH = webPath;
  
  console.log('=== PharmaStream Server Startup ===');
  console.log('Database path:', dbPath);
  console.log('Web path:', webPath);
  console.log('Database exists:', fs.existsSync(dbPath));
  console.log('Web exists:', fs.existsSync(webPath));
  
  if (isDev) {
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
    const serverDistPath = path.join(process.resourcesPath, 'server', 'dist', 'index.js');
    const nodeModulesPath = path.join(process.resourcesPath, 'server', 'node_modules');
    
    console.log('Server path:', serverDistPath);
    console.log('Server exists:', fs.existsSync(serverDistPath));
    
    if (!fs.existsSync(serverDistPath)) {
      throw new Error(`Server not found: ${serverDistPath}`);
    }
    
    process.env.NODE_PATH = nodeModulesPath;
    require('module').Module._initPaths();
    
    console.log('Loading server module...');
    const serverModule = require(serverDistPath);
    
    if (typeof serverModule.startServer === 'function') {
      console.log('Calling startServer()...');
      await serverModule.startServer(PORT);
    } else if (serverModule.default && typeof serverModule.default.listen === 'function') {
      await new Promise((resolve) => {
        serverModule.default.listen(PORT, () => {
          console.log(`Express app listening on port ${PORT}`);
          resolve();
        });
      });
    } else {
      throw new Error('Server module does not export startServer()');
    }
  }
  
  console.log('Waiting for server health check...');
  await waitForServer(PORT);
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
      preload: path.join(__dirname, 'preload.js'),
      devTools: true
    },
    show: false
  });

  Menu.setApplicationMenu(null);

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL('http://localhost:3001');
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    console.log('=== Starting PharmaStream ===');
    console.log('App packaged:', app.isPackaged);
    console.log('Resources path:', process.resourcesPath);
    console.log('User data path:', app.getPath('userData'));
    
    await startServer();
    createWindow();
    
  } catch (error) {
    console.error('Startup failed:', error);
    
    dialog.showErrorBox('Startup Error', 
      `Error: ${error.message}\n\nResources: ${process.resourcesPath}\nDatabase: ${getDatabasePath()}`
    );
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
