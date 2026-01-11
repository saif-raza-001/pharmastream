const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow;
let serverError = null;

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
  const dbDir = userDataPath;
  
  // Ensure directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  return path.join(dbDir, 'pharmastream.db');
};

function waitForServer(port, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkServer = () => {
      if (serverError) {
        reject(new Error(`Server crashed: ${serverError}`));
        return;
      }
      
      const req = http.request({ host: 'localhost', port, path: '/api/health', method: 'GET', timeout: 2000 }, (res) => {
        resolve();
      });
      
      req.on('error', () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error('Server startup timeout - server did not respond within 60 seconds'));
        } else {
          setTimeout(checkServer, 1000);
        }
      });
      
      req.on('timeout', () => {
        req.destroy();
        if (Date.now() - startTime > timeout) {
          reject(new Error('Server startup timeout'));
        } else {
          setTimeout(checkServer, 1000);
        }
      });
      
      req.end();
    };
    
    // Wait a bit before first check
    setTimeout(checkServer, 2000);
  });
}

async function startServer() {
  const dbPath = getDatabasePath();
  
  // Set environment variables
  process.env.PORT = '3001';
  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.NODE_ENV = isDev ? 'development' : 'production';
  
  console.log('=== PharmaStream Server Startup ===');
  console.log('Database path:', dbPath);
  console.log('Database exists:', fs.existsSync(dbPath));
  console.log('NODE_ENV:', process.env.NODE_ENV);
  
  try {
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
        serverError = err.message;
      });
      
      serverProcess.on('exit', (code) => {
        if (code !== 0) {
          serverError = `Server exited with code ${code}`;
        }
      });
    } else {
      const serverPath = path.join(process.resourcesPath, 'server', 'dist', 'index.js');
      console.log('Loading server from:', serverPath);
      console.log('Server file exists:', fs.existsSync(serverPath));
      
      // Check if node_modules exist
      const nodeModulesPath = path.join(process.resourcesPath, 'server', 'node_modules');
      console.log('Node modules path:', nodeModulesPath);
      console.log('Node modules exists:', fs.existsSync(nodeModulesPath));
      
      if (fs.existsSync(nodeModulesPath)) {
        const prismaPath = path.join(nodeModulesPath, '@prisma', 'client');
        const dotPrismaPath = path.join(nodeModulesPath, '.prisma', 'client');
        console.log('@prisma/client exists:', fs.existsSync(prismaPath));
        console.log('.prisma/client exists:', fs.existsSync(dotPrismaPath));
        
        if (fs.existsSync(dotPrismaPath)) {
          const files = fs.readdirSync(dotPrismaPath);
          console.log('.prisma/client contents:', files.slice(0, 10));
        }
      }
      
      if (!fs.existsSync(serverPath)) {
        throw new Error(`Server file not found: ${serverPath}`);
      }
      
      // Wrap require in try-catch to get better error messages
      try {
        require(serverPath);
        console.log('Server module loaded successfully');
      } catch (requireError) {
        console.error('Failed to require server:', requireError);
        throw new Error(`Failed to load server: ${requireError.message}`);
      }
    }
    
    console.log('Waiting for server to be ready...');
    await waitForServer(3001);
    console.log('Server is ready!');
    
  } catch (error) {
    console.error('Server startup failed:', error);
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

  Menu.setApplicationMenu(null);

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
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
    
    const details = [
      `Error: ${error.message}`,
      '',
      `Resources: ${process.resourcesPath}`,
      `UserData: ${app.getPath('userData')}`,
      `Database: ${getDatabasePath()}`,
    ].join('\n');
    
    dialog.showErrorBox('Startup Error', details);
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
