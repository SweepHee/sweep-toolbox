const { app, BrowserWindow, ipcMain, shell, Menu, dialog, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
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

// ── Notes (file-based) ────────────────────────────────────────────────────────

const noteWindows = new Map();   // noteId → BrowserWindow
const TAB_THICK = 32;

function applyTabConstraints(win, tabLen) {
  win.setResizable(true);
  win.setMaximumSize(32000, 32000);
  win.setMinimumSize(1, 1);
  win.setSize(tabLen, TAB_THICK);
  win.setMinimumSize(60, TAB_THICK);
  win.setMaximumSize(32000, TAB_THICK);
  win.setResizable(false);
}

function getNotesPath() {
  return path.join(app.getPath('userData'), 'notes.json');
}

function loadNotes() {
  try { return JSON.parse(fs.readFileSync(getNotesPath(), 'utf8')); }
  catch { return []; }
}

function saveNotes(notes) {
  fs.writeFileSync(getNotesPath(), JSON.stringify(notes, null, 2), 'utf8');
}

// Update a single note by id; optionally notify main window
function patchNote(noteId, patch, notify = true) {
  const notes = loadNotes();
  const idx = notes.findIndex(n => n.id === noteId);
  if (idx === -1) return null;
  notes[idx] = { ...notes[idx], ...patch, updatedAt: Date.now() };
  saveNotes(notes);
  if (notify) mainWindow?.webContents.send('notes-updated');
  return notes[idx];
}

function createNoteWindow(note) {
  // If window already exists, just show it
  const existing = noteWindows.get(note.id);
  if (existing && !existing.isDestroyed()) {
    if (note.visible !== false) { existing.show(); existing.focus(); }
    return existing;
  }

  const tabLen = note.tabLen ?? 240;

  const win = new BrowserWindow({
    x: note.x ?? 100,
    y: note.y ?? 100,
    width:    note.collapsed ? tabLen : (note.width  ?? 280),
    height:   note.collapsed ? TAB_THICK : (note.height ?? 300),
    minWidth: note.collapsed ? 60 : 180,
    minHeight: note.collapsed ? TAB_THICK : 80,
    frame: false,
    skipTaskbar: true,
    resizable: !note.collapsed,
    maximizable: false,
    hasShadow: true,
    transparent: true,
    backgroundColor: '#00000000',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (note.collapsed) {
    win.setMaximumSize(32000, TAB_THICK);
  }

  win.setOpacity(note.opacity ?? 1);
  win.setAlwaysOnTop(note.alwaysOnTop ?? false);

  if (isDev) {
    win.loadURL(`http://localhost:5173/note.html?id=${note.id}`);
  } else {
    win.loadFile(path.join(__dirname, '../dist/note.html'), { query: { id: note.id } });
  }

  win.once('ready-to-show', () => {
    if (note.visible !== false) win.show();
  });

  // Intercept close (e.g., Alt+F4) → hide instead of destroy
  win.on('close', e => {
    e.preventDefault();
    win.hide();
    patchNote(note.id, { visible: false });
  });


  // Windows Aero Snap 차단 (WebkitAppRegion:drag → HTCAPTION → Snap 발동)
  win.on('will-resize', (event, newBounds) => {
    const wa = screen.getPrimaryDisplay().workArea;
    const notes = loadNotes();
    const n = notes.find(n => n.id === note.id);
    if (n?.collapsed) {
      // 접힌 탭: 높이 항상 TAB_THICK 고정
      if (newBounds.height !== TAB_THICK) event.preventDefault();
    } else {
      // 펼친 상태: 화면 60% 이상으로 바꾸려는 시도(Windows Snap) 차단
      if (newBounds.width > wa.width * 0.6 || newBounds.height > wa.height * 0.6) {
        event.preventDefault();
      }
    }
  });

  win.on('moved', () => {
    const [x, y] = win.getPosition();
    patchNote(note.id, { x, y }, false);
  });

  win.on('resized', () => {
    const notes = loadNotes();
    const n = notes.find(n => n.id === note.id);
    if (!n) return;
    const [width, height] = win.getSize();
    const wa = screen.getPrimaryDisplay().workArea;
    if (n.collapsed) {
      patchNote(note.id, { tabLen: width }, false);
    } else {
      if (width > wa.width * 0.6 || height > wa.height * 0.6) {
        win.setSize((n.width ?? 280), (n.height ?? 300));
        return;
      }
      patchNote(note.id, { width, height }, false);
    }
  });

  // Don't remove from map on 'closed' since we prevent close; but handle if destroyed
  win.on('closed', () => noteWindows.delete(note.id));

  noteWindows.set(note.id, win);
  return win;
}

function restoreNoteWindows() {
  const notes = loadNotes();
  for (const note of notes) {
    createNoteWindow(note);
  }
}

// ── Main window ───────────────────────────────────────────────────────────────

let mainWindow;
let pythonProcess;
const pendingRequests = new Map();
let requestIdCounter = 0;

// ── Python process ────────────────────────────────────────────────────────────

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

// ── History watcher ───────────────────────────────────────────────────────────

function startHistoryWatcher() {
  const histPath = getHistoryPath();
  fs.watchFile(histPath, { interval: 500 }, (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs) {
      mainWindow?.webContents.send('history-updated');
    }
  });
}

// ── Main window creation ──────────────────────────────────────────────────────

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

  // When main window closes, destroy all note windows so window-all-closed fires
  mainWindow.on('closed', () => {
    for (const [, win] of noteWindows) {
      if (!win.isDestroyed()) win.destroy();
    }
    noteWindows.clear();
    mainWindow = null;
  });
}

// ── 데스크탑 우클릭 메뉴 레지스트리 ─────────────────────────────────────────

const REG_KEY = 'HKCU\\SOFTWARE\\Classes\\DesktopBackground\\Shell\\CreateMemo';

function getDesktopMenuCommand() {
  const exe = process.execPath;
  return isDev ? `"${exe}" "${app.getAppPath()}" --create-note` : `"${exe}" --create-note`;
}

function registerDesktopMenu() {
  spawnSync('reg', ['add', REG_KEY, '/ve', '/d', '메모장 만들기', '/f'], { windowsHide: true });
  spawnSync('reg', ['add', REG_KEY, '/v', 'Icon', '/d', `${process.execPath},0`, '/f'], { windowsHide: true });
  spawnSync('reg', ['add', `${REG_KEY}\\command`, '/ve', '/d', getDesktopMenuCommand(), '/f'], { windowsHide: true });
}

function unregisterDesktopMenu() {
  spawnSync('reg', ['delete', REG_KEY, '/f'], { windowsHide: true });
}


// ── CLI 인수 파싱 ─────────────────────────────────────────────────────────────

function parseCliArgs(argv) {
  const args = argv.slice(isDev ? 2 : 1);
  if (args.includes('--create-note')) return { action: 'create-note' };
  const filePath = args[args.indexOf('--convert') + 1];
  const toFormat = args[args.indexOf('--to') + 1];
  if (filePath && toFormat) return { action: 'convert', filePath, toFormat };
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

// ── App lifecycle ─────────────────────────────────────────────────────────────

// Squirrel 인스톨러 이벤트 처리 (패키징 배포 시)
if (process.platform === 'win32') {
  const sq = process.argv[1];
  if (sq === '--squirrel-install' || sq === '--squirrel-updated') {
    registerDesktopMenu();
    app.quit();
  } else if (sq === '--squirrel-uninstall') {
    unregisterDesktopMenu();
    app.quit();
  } else if (sq === '--squirrel-obsolete') {
    app.quit();
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (argv.includes('--create-note')) {
      createNewNote(screen.getCursorScreenPoint());
    } else if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(async () => {
  startPythonProcess();
  await new Promise(r => setTimeout(r, 500));

  const cliArgs = parseCliArgs(process.argv);
  if (cliArgs?.action === 'convert') {
    await runCliConversion(cliArgs.filePath, cliArgs.toFormat);
  } else {
    createWindow();
    startHistoryWatcher();
    restoreNoteWindows();
    registerDesktopMenu();
    if (cliArgs?.action === 'create-note') createNewNote(screen.getCursorScreenPoint());
    app.on('activate', () => {
      if (!mainWindow) createWindow();
    });
  }
});

app.on('window-all-closed', () => {
  if (pythonProcess) { pythonProcess.kill(); pythonProcess = null; }
  if (process.platform !== 'darwin') app.quit();
});

// ── Converter IPC handlers ────────────────────────────────────────────────────

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

ipcMain.handle('get-auto-launch', () => app.getLoginItemSettings().openAtLogin);
ipcMain.handle('set-auto-launch', (_event, enabled) => {
  app.setLoginItemSettings({ openAtLogin: enabled });
  return { ok: true };
});


// ── Note context menu ─────────────────────────────────────────────────────────


ipcMain.handle('show-note-context-menu', (event, state) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const send = action => event.sender.send('note-context-menu-action', action);

  const menu = Menu.buildFromTemplate([
    { label: '굵게',   type: 'checkbox', checked: !!state.bold,      click: () => send('bold') },
    { label: '기울임', type: 'checkbox', checked: !!state.italic,    click: () => send('italic') },
    { label: '밑줄',   type: 'checkbox', checked: !!state.underline, click: () => send('underline') },
    { type: 'separator' },
    { label: '작은 글자',   click: () => send('fontSize-small') },
    { label: '보통 글자',   click: () => send('fontSize-normal') },
    { label: '큰 글자',     click: () => send('fontSize-large') },
    { label: '매우 큰 글자', click: () => send('fontSize-xlarge') },
    { type: 'separator' },
    { label: '본문',         type: 'checkbox', checked: !!state.paragraph, click: () => send('paragraph') },
    { label: '큰 제목 H1',   type: 'checkbox', checked: !!state.heading1,  click: () => send('heading1') },
    { label: '작은 제목 H2', type: 'checkbox', checked: !!state.heading2,  click: () => send('heading2') },
    { type: 'separator' },
    { label: '목록',     type: 'checkbox', checked: !!state.bulletList,  click: () => send('bulletList') },
    { label: '번호 목록', type: 'checkbox', checked: !!state.orderedList, click: () => send('orderedList') },
    { label: '체크박스', type: 'checkbox', checked: !!state.taskList,    click: () => send('taskList') },
    { type: 'separator' },
    { label: '글자색…',   click: () => send('color') },
    { label: '이미지 삽입', click: () => send('insertImage') },
  ]);

  menu.popup({ window: win });
});

// ── Note IPC handlers ─────────────────────────────────────────────────────────

ipcMain.handle('note-get-all', () => loadNotes());

ipcMain.handle('note-get-data', (_event, noteId) => {
  return loadNotes().find(n => n.id === noteId) ?? null;
});

function createNewNote(pos = null) {
  const notes = loadNotes();
  const offset = (notes.length % 12) * 28;
  const note = {
    id: crypto.randomUUID(),
    title: '새 메모',
    content: '',
    color: '#fef9c3',
    x: pos ? pos.x : 80 + offset,
    y: pos ? pos.y : 80 + offset,
    width: 280,
    height: 300,
    collapsed: false,
    edge: null,
    tabLen: 240,
    opacity: 1,
    alwaysOnTop: false,
    locked: false,
    visible: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  notes.unshift(note);
  saveNotes(notes);
  createNoteWindow(note);
  mainWindow?.webContents.send('notes-updated');
  return note;
}

ipcMain.handle('note-create', () => createNewNote());

ipcMain.handle('note-delete', (_event, noteId) => {
  const win = noteWindows.get(noteId);
  if (win && !win.isDestroyed()) win.destroy();
  noteWindows.delete(noteId);
  saveNotes(loadNotes().filter(n => n.id !== noteId));
  mainWindow?.webContents.send('notes-updated');
  return { ok: true };
});

ipcMain.handle('note-update', (_event, noteId, patch) => {
  // High-frequency (content, position) — don't notify main window
  const notes = loadNotes();
  const idx = notes.findIndex(n => n.id === noteId);
  if (idx === -1) return null;
  notes[idx] = { ...notes[idx], ...patch, updatedAt: Date.now() };
  saveNotes(notes);
  return notes[idx];
});

ipcMain.handle('note-show', (_event, noteId) => {
  patchNote(noteId, { visible: true });
  const notes = loadNotes();
  const note = notes.find(n => n.id === noteId);
  if (!note) return { ok: false };
  const win = noteWindows.get(noteId);
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
  } else {
    createNoteWindow({ ...note, visible: true });
  }
  return { ok: true };
});

ipcMain.handle('note-hide', (_event, noteId) => {
  patchNote(noteId, { visible: false });
  const win = noteWindows.get(noteId);
  if (win && !win.isDestroyed()) win.hide();
  return { ok: true };
});

ipcMain.handle('note-set-collapsed', (_event, noteId, collapsed) => {
  patchNote(noteId, { collapsed, edge: null }, false);
  const win = noteWindows.get(noteId);
  if (!win || win.isDestroyed()) return { ok: false };
  const notes = loadNotes();
  const note = notes.find(n => n.id === noteId);
  const tabLen = note?.tabLen ?? 240;
  const wa = screen.getPrimaryDisplay().workArea;

  if (collapsed) {
    applyTabConstraints(win, tabLen);
  } else {
    win.setResizable(true);
    win.setMaximumSize(32000, 32000);
    win.setMinimumSize(180, 80);
    const noteW = note?.width ?? 280;
    const noteH = note?.height ?? 300;
    win.setSize(noteW, noteH);
    const [cx, cy] = win.getPosition();
    const nx = Math.max(wa.x, Math.min(cx, wa.x + wa.width  - noteW));
    const ny = Math.max(wa.y, Math.min(cy, wa.y + wa.height - noteH));
    win.setPosition(nx, ny);
    patchNote(noteId, { x: nx, y: ny }, false);
  }
  return { ok: true };
});

ipcMain.handle('note-focus', (_event, noteId) => {
  const win = noteWindows.get(noteId);
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
    return { ok: true };
  }
  return { ok: false };
});

ipcMain.handle('note-arrange', (_event, type) => {
  const wa = screen.getPrimaryDisplay().workArea;
  const notes = loadNotes();
  const NOTE_W = 280;
  const NOTE_H = 300;
  const PAD = 20;
  const GAP = 16;

  const [layout, corner = 'tl'] = type.split('-');
  const isRight  = corner === 'tr' || corner === 'br';
  const isBottom = corner === 'bl' || corner === 'br';

  if (layout === 'cascade') {
    notes.forEach((note, i) => {
      const off = (i % 12) * 28;
      const x = isRight
        ? wa.x + wa.width  - NOTE_W - PAD - off
        : wa.x + PAD + off;
      const y = isBottom
        ? wa.y + wa.height - NOTE_H - PAD - off
        : wa.y + PAD + off;
      const win = noteWindows.get(note.id);
      if (win && !win.isDestroyed()) win.setPosition(x, y);
      patchNote(note.id, { x, y }, false);
    });
  } else if (layout === 'grid') {
    const cols = Math.max(1, Math.floor((wa.width - PAD * 2 + GAP) / (NOTE_W + GAP)));
    notes.forEach((note, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = isRight
        ? wa.x + wa.width  - NOTE_W - PAD - col * (NOTE_W + GAP)
        : wa.x + PAD + col * (NOTE_W + GAP);
      const y = isBottom
        ? wa.y + wa.height - NOTE_H - PAD - row * (NOTE_H + GAP)
        : wa.y + PAD + row * (NOTE_H + GAP);
      const win = noteWindows.get(note.id);
      if (win && !win.isDestroyed()) win.setPosition(x, y);
      patchNote(note.id, { x, y }, false);
    });
  }

  mainWindow?.webContents.send('notes-updated');
  return { ok: true };
});

ipcMain.handle('note-collapse-all', () => {
  const notes = loadNotes();
  notes.forEach(note => {
    patchNote(note.id, { collapsed: true, edge: null }, false);
    const win = noteWindows.get(note.id);
    if (!win || win.isDestroyed()) return;
    applyTabConstraints(win, note.tabLen ?? 240);
    win.webContents.send('note-updated', { collapsed: true, edge: null });
  });
  mainWindow?.webContents.send('notes-updated');
  return { ok: true };
});

ipcMain.handle('note-expand-all', () => {
  const notes = loadNotes();
  const wa = screen.getPrimaryDisplay().workArea;
  notes.forEach(note => {
    patchNote(note.id, { collapsed: false, edge: null }, false);
    const win = noteWindows.get(note.id);
    if (!win || win.isDestroyed()) return;
    win.setResizable(true);
    win.setMaximumSize(32000, 32000);
    win.setMinimumSize(180, 80);
    const noteW = note.width ?? 280;
    const noteH = note.height ?? 300;
    win.setSize(noteW, noteH);
    const [cx, cy] = win.getPosition();
    const nx = Math.max(wa.x, Math.min(cx, wa.x + wa.width - noteW));
    const ny = Math.max(wa.y, Math.min(cy, wa.y + wa.height - noteH));
    win.setPosition(nx, ny);
    patchNote(note.id, { x: nx, y: ny }, false);
    win.webContents.send('note-updated', { collapsed: false, edge: null });
  });
  mainWindow?.webContents.send('notes-updated');
  return { ok: true };
});

ipcMain.handle('note-reset-size', () => {
  const DEFAULT_W = 280, DEFAULT_H = 300;
  const notes = loadNotes();
  notes.forEach(note => {
    patchNote(note.id, { width: DEFAULT_W, height: DEFAULT_H }, false);
    const win = noteWindows.get(note.id);
    if (win && !win.isDestroyed()) win.setSize(DEFAULT_W, DEFAULT_H);
  });
  mainWindow?.webContents.send('notes-updated');
  return { ok: true };
});

ipcMain.handle('note-set-always-on-top', (_event, noteId, value) => {
  const win = noteWindows.get(noteId);
  if (win && !win.isDestroyed()) win.setAlwaysOnTop(value);
  patchNote(noteId, { alwaysOnTop: value }, false);
  return { ok: true };
});

ipcMain.handle('note-set-opacity', (_event, noteId, value) => {
  const win = noteWindows.get(noteId);
  if (win && !win.isDestroyed()) win.setOpacity(value);
  patchNote(noteId, { opacity: value }, false);
  return { ok: true };
});

ipcMain.handle('note-pick-image', async (event) => {
  // Find which note window called this
  let parentWin = mainWindow;
  for (const [, win] of noteWindows) {
    if (!win.isDestroyed() && win.webContents.id === event.sender.id) {
      parentWin = win;
      break;
    }
  }
  const result = await dialog.showOpenDialog(parentWin, {
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const buffer = fs.readFileSync(result.filePaths[0]);
  const ext = path.extname(result.filePaths[0]).slice(1).toLowerCase();
  const mime = (ext === 'jpg' || ext === 'jpeg') ? 'image/jpeg' : `image/${ext}`;
  return { dataUrl: `data:${mime};base64,${buffer.toString('base64')}` };
});
