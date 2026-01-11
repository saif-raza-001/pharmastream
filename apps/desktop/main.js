const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

const isDev = !app.isPackaged;

// Set database path before anything else
function setupDatabase() {
  let dbPath;
  
  if (isDev) {
    dbPath = path.join(__dirname, '..', '..', 'data', 'pharmastream.db');
  } else {
    const userDataPath = app.getPath('userData');
    dbPath = path.join(userDataPath, 'pharmastream.db');
  }
  
  // Ensure directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  // Set environment variable for Prisma
  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.PORT = '3001';
  
  console.log('Database path:', dbPath);
  return dbPath;
}

async function startServer() {
  try {
    let serverPath;
    
    if (isDev) {
      // Development: use ts-node (won't work, use npm run dev separately)
      console.log('Development mode: Please run server separately with npm run dev');
      return;
    } else {
      // Production: require the compiled server
      serverPath = path.join(process.resourcesPath, 'server', 'dist', 'index.js');
    }
    
    console.log('Loading server from:', serverPath);
    
    if (!fs.existsSync(serverPath)) {
      console.error('Server file not found:', serverPath);
      throw new Error('Server file not found');
    }
    
    // Require and start the server
    const server = require(serverPath);
    
    // If server exports startServer function, call it
    if (typeof server.startServer === 'function') {
      await server.startServer(3001);
    }
    
    console.log('Server started successfully!');
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
    const webPath = path.join(process.resourcesPath, 'web');
    const indexPath = path.join(webPath, 'index.html');
    
    console.log('Loading web from:', indexPath);
    
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      console.error('index.html not found at:', indexPath);
      mainWindow.loadURL(`data:text/html,<h1>Error: Web files not found</h1><p>${indexPath}</p>`);
    }
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Open DevTools in production for debugging (remove later)
  // mainWindow.webContents.openDevTools();
}

// App lifecycle
app.whenReady().then(async () => {
  try {
    console.log('Starting PharmaStream...');
    console.log('Development mode:', isDev);
    console.log('Resources path:', process.resourcesPath);
    
    setupDatabase();
    await startServer();
    createWindow();
    
  } catch (error) {
    console.error('Failed to start:', error);
    
    // Show error window
    const errorWindow = new BrowserWindow({
      width: 600,
      height: 400,
      title: 'PharmaStream - Error'
    });
    errorWindow.loadURL(`data:text/html,
      <html>
        <body style="font-family: Arial; padding: 20px;">
          <h1 style="color: red;">Failed to Start</h1>
          <pre>${error.message}\n\n${error.stack}</pre>
        </body>
      </html>
    `);
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
