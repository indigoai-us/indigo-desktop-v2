/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  globalShortcut,
  Menu,
  Tray,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload
    )
    .catch(console.log);
};

const RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '../../assets');

const getAssetPath = (...paths: string[]): string => {
  return path.join(RESOURCES_PATH, ...paths);
};

const selectAppIcon = (): string => {
  switch (process.platform) {
    case 'win32':
      return getAssetPath('indigo.ico');
    case 'darwin':
      return getAssetPath('indigo.icns');
    default:
      return getAssetPath('indigo.png');
  }
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  mainWindow = new BrowserWindow({
    show: false,
    width: 600,
    height: 500,
    alwaysOnTop: true,
    darkTheme: true,
    titleBarStyle: 'hiddenInset',
    // can be used to hide stoplight toolbar
    frame: true,
    icon: selectAppIcon(),
    backgroundColor: '#282c34',
    webPreferences: {
      // TODO: UPDATE ONCE OUT OF DEVELOPMENT
      webSecurity: false,
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true);

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

// TODO: NICK's CODE

let tray = null;
app.whenReady().then(() => {
  createWindow();

  tray = new Tray(getAssetPath('icon_small.png'));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Indigo (Alt + I)',
      type: 'normal',
      click: () => createWindow(),
    },
    { label: 'Quit Indigo', type: 'normal', click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);
});

ipcMain.on('close-window', () => {
  mainWindow.close();
});

// open app with Alt+I
app.on('ready', () => {
  globalShortcut.register('Alt+I', createWindow);
});

// do not quit when all windows are closed
// and continue running on background to listen
// for shortcuts
app.on('window-all-closed', (e) => {
  e.preventDefault();
  e.returnValue = false;
});
// TODO: END NICK's CODE

// app
//   .whenReady()
//   .then(() => {
//     createWindow();
// app.on('activate', () => {
//   // On macOS it's common to re-create a window in the app when the
//   // dock icon is clicked and there are no other windows open.
//   if (mainWindow === null) createWindow();
// });
// })
// .catch(console.log);
