const { app, BrowserWindow, Menu, dialog } = require('electron');
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
    return path.join(__dirname, '..', '..', 'data', 'pharmastream.db');
  }
  const userDataPath = app.getPath('userData');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  return path.join(userDataPath, 'pharmastream.db');
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
  const PORT = 3001;
  
  // Set environment variables
  process.env.PORT = String(PORT);
  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.NODE_ENV = isDev ? 'development' : 'production';
  
  console.log('=== PharmaStream Server Startup ===');
  console.log('Database path:', dbPath);
  console.log('Database exists:', fs.existsSync(dbPath));
  
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
    console.log('node_modules path:', nodeModulesPath);
    console.log('node_modules exists:', fs.existsSync(nodeModulesPath));
    
    if (!fs.existsSync(serverDistPath)) {
      throw new Error(`Server not found: ${serverDistPath}`);
    }
    
    // Add server's node_modules to module resolution path
    process.env.NODE_PATH = nodeModulesPath;
    require('module').Module._initPaths();
    
    // Load the server module
    console.log('Loading server module...');
    const serverModule = require(serverDistPath);
    console.log('Server module loaded, exports:', Object.keys(serverModule));
    
    // Start the server - the exported startServer function or express app
    if (typeof serverModule.startServer === 'function') {
      console.log('Calling startServer()...');
      await serverModule.startServer(PORT);
      console.log('startServer() completed');
    } else if (serverModule.default && typeof serverModule.default.listen === 'function') {
      console.log('Starting express app directly...');
      await new Promise((resolve) => {
        serverModule.default.listen(PORT, () => {
          console.log(`Express app listening on port ${PORT}`);
          resolve();
        });
      });
    } else {
      throw new Error('Server module does not export startServer() or default express app');
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
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  });

  Menu.setApplicationMenu(null);

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    const webPath = getWebPath();
    const indexPath = path.join(webPath, 'index.html');
    
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
