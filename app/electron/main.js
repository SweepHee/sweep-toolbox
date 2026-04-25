const { app, BrowserWindow, ipcMain, shell, Menu, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

const isDev = process.env.NODE_ENV === 'development' ||
  fs.existsSync(path.join(__dirname, '..', '..', 'python', '.venv'));

// ── Settings ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  video: { crf: 23, vsync: 'vfr', audioBitrate: '192k' },
  image: { jpegQuality: 95, pdfDpi: 150 },
};

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf8');
    const saved = JSON.parse(raw);
    return {
      video: { ...DEFAULT_SETTINGS.video, ...saved.video },
      image: { ...DEFAULT_SETTINGS.image, ...saved.image },
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function settingsToOptions(s) {
  return {
    jpegQuality: s.image.jpegQuality,
    dpi:         s.image.pdfDpi,
    crf:         s.video.crf,
    vsync:       s.video.vsync,
    audioBitrate: s.video.audioBitrate,
  };
}

// ── History (file-based) ──────────────────────────────────────────────────────

function getHistoryPath() {
  return path.join(app.getPath('userData'), 'history.json');
}

function loadHistory() {
  try {
    return JSON.parse(fs.readFileSync(getHistoryPath(), 'utf8'));
  } catch {
    return [];
  }
}

function appendHistory(entry) {
  const history = [entry, ...loadHistory()].slice(0, 200);
  fs.writeFileSync(getHistoryPath(), JSON.stringify(history), 'utf8');
}

let mainWindow;
let pythonProcess;
const pendingRequests = new Map();
let requestIdCounter = 0;

// ── Python process ──────────────────────────────────────────────────────────

function startPythonProcess() {
  const pythonDir = isDev
    ? path.join(__dirname, '..', '..', 'python')
    : path.join(process.resourcesPath, 'python', 'converter');

  const isWin = process.platform === 'win32';

  const pythonExecutable = isDev
    ? path.join(pythonDir, '.venv', isWin ? 'Scripts/python.exe' : 'bin/python')
    : path.join(pythonDir, isWin ? 'converter.exe' : 'converter');

  const args = isDev ? [path.join(pythonDir, 'main.py')] : [];

  pythonProcess = spawn(pythonExecutable, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: pythonDir,
    windowsHide: true,
  });

  // Line-delimited JSON IPC
  const rl = readline.createInterface({ input: pythonProcess.stdout });
  rl.on('line', (line) => {
    try {
      const msg = JSON.parse(line);
      const { id, ...rest } = msg;
      const resolve = pendingRequests.get(id);
      if (resolve) {
        pendingRequests.delete(id);
        resolve(rest);
      }
    } catch (e) {
      console.error('[python stdout parse error]', e.message);
    }
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error('[python stderr]', data.toString());
  });

  pythonProcess.on('exit', (code) => {
    console.warn('[python] process exited with code', code);
  });
}

function sendToPython(payload) {
  return new Promise((resolve, reject) => {
    const id = ++requestIdCounter;
    pendingRequests.set(id, resolve);

    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error('Python IPC timeout'));
    }, 120_000);

    pendingRequests.set(id, (result) => {
      clearTimeout(timer);
      resolve(result);
    });

    pythonProcess.stdin.write(JSON.stringify({ id, ...payload }) + '\n');
  });
}

// ── Window ──────────────────────────────────────────────────────────────────

function startHistoryWatcher() {
  const histPath = getHistoryPath();
  fs.watchFile(histPath, { interval: 500 }, (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs) {
      mainWindow?.webContents.send('history-updated');
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    frame: false,
    backgroundColor: '#0f0f0f',
    show: false,
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  Menu.setApplicationMenu(null);
}

// ── CLI 인수 파싱 (우클릭 메뉴에서 실행 시) ──────────────────────────────────
// 형식: converter.exe --convert "파일경로" --to jpg

function parseCliArgs(argv) {
  const args = argv.slice(isDev ? 2 : 1); // dev: node electron . / prod: converter.exe
  const filePath = args[args.indexOf('--convert') + 1];
  const toFormat = args[args.indexOf('--to') + 1];
  if (filePath && toFormat) return { filePath, toFormat };
  return null;
}

async function runCliConversion(filePath, toFormat) {
  try {
    const options = settingsToOptions(loadSettings());
    const result = await sendToPython({ action: 'convert', filePath, targetFormat: toFormat, options });
    if (result.ok) {
      const outputPath = result.data.outputPath;
      appendHistory({
        id: crypto.randomUUID(),
        inputName: path.basename(filePath),
        inputPath: filePath,
        outputPath,
        outputName: path.basename(outputPath),
        targetFormat: toFormat,
        timestamp: Date.now(),
      });
      dialog.showMessageBox({ type: 'info', title: '변환 완료', message: `저장됨:\n${outputPath}` });
    } else {
      dialog.showErrorBox('변환 실패', result.error);
    }
  } catch (e) {
    dialog.showErrorBox('변환 실패', e.message);
  } finally {
    app.quit();
  }
}

// ── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  startPythonProcess();

  // Python 프로세스가 준비될 때까지 잠깐 대기
  await new Promise(r => setTimeout(r, 500));

  const cliArgs = parseCliArgs(process.argv);
  if (cliArgs) {
    // 우클릭 메뉴 실행: 창 없이 변환 후 종료
    await runCliConversion(cliArgs.filePath, cliArgs.toFormat);
  } else {
    // 일반 실행: 앱 창 열기
    createWindow();
    startHistoryWatcher();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  }
});

app.on('window-all-closed', () => {
  if (pythonProcess) pythonProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('convert-file', async (_event, request) => {
  const baseOptions = settingsToOptions(loadSettings());
  const options = { ...baseOptions, ...request.options };
  return sendToPython({ action: 'convert', ...request, options });
});

ipcMain.handle('get-settings', () => loadSettings());

ipcMain.handle('save-settings', (_event, settings) => {
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf8');
  return { ok: true };
});

ipcMain.handle('get-supported-formats', async () => {
  return sendToPython({ action: 'get_formats' });
});

ipcMain.handle('load-history', () => loadHistory());

ipcMain.handle('append-history', (_event, entry) => {
  appendHistory(entry);
  return { ok: true };
});

ipcMain.handle('clear-history', () => {
  fs.writeFileSync(getHistoryPath(), '[]', 'utf8');
  return { ok: true };
});

// Window controls
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());

ipcMain.handle('open-path', async (_event, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('save-as', async (_event, { sourcePath, defaultName }) => {
  const ext = defaultName.split('.').pop();
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: path.join(app.getPath('downloads'), defaultName),
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }, { name: 'All Files', extensions: ['*'] }],
  });
  if (result.canceled || !result.filePath) return { ok: false };
  fs.copyFileSync(sourcePath, result.filePath);
  return { ok: true, filePath: result.filePath };
});
