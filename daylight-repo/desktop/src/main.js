// Daylight desktop: main process.
// The Apify key never reaches the page. The page asks this process to call Apify (IPC),
// so the key is not visible in DevTools or the page source and there are no CORS issues.
const { app, BrowserWindow, ipcMain, safeStorage, shell, dialog, protocol, net, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const DEFAULT_ACTOR = 'daylightwins~my-actor';
// Placeholder for the paid plan. When a licence server exists, set its URL here (see docs/LICENSING.md).
const LICENSE_SERVER = '';

protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

// ---------------------------------------------------------------- settings
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function readRaw() {
    try {
        return JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
    } catch {
        return {};
    }
}
function writeRaw(obj) {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify(obj, null, 2), { mode: 0o600 });
}
function encrypt(text) {
    if (!text) return { v: '' };
    if (safeStorage.isEncryptionAvailable()) return { enc: safeStorage.encryptString(text).toString('base64') };
    return { plain: text }; // e.g. Linux without a keyring: stored in the user's profile only
}
function decrypt(box) {
    if (!box) return '';
    try {
        if (box.enc) return safeStorage.decryptString(Buffer.from(box.enc, 'base64'));
    } catch {
        return '';
    }
    return box.plain || '';
}
function getSecret(name) {
    return decrypt(readRaw()[name]);
}
function publicSettings() {
    const raw = readRaw();
    const key = decrypt(raw.apiKey);
    return {
        hasKey: !!key,
        keyHint: key ? key.slice(0, 10) + '…' + key.slice(-4) : '',
        actorId: raw.actorId || DEFAULT_ACTOR,
        hasLicense: !!decrypt(raw.licenseKey),
        licenseActive: false, // becomes true once a licence server confirms it
        theme: raw.theme || 'dark',
        lang: raw.lang || '',
        encrypted: safeStorage.isEncryptionAvailable(),
    };
}

// ---------------------------------------------------------------- Apify
function cleanActorId(id) {
    return String(id || DEFAULT_ACTOR).trim().replace('/', '~');
}
async function callActor(timeoutSec, body) {
    const key = getSecret('apiKey');
    if (!key) return { ok: false, status: 0, error: 'NO_KEY' };
    const actor = cleanActorId(readRaw().actorId);
    const url = `https://api.apify.com/v2/acts/${encodeURIComponent(actor).replace('%7E', '~')}/run-sync-get-dataset-items?timeout=${Number(timeoutSec) || 280}`;
    try {
        const r = await net.fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify(body || {}),
        });
        const text = await r.text();
        let data = null;
        try {
            data = JSON.parse(text);
        } catch {
            data = null;
        }
        return { ok: r.ok, status: r.status, data };
    } catch (e) {
        return { ok: false, status: 0, error: String(e.message || e) };
    }
}
async function testKey(key) {
    const k = String(key || '').trim() || getSecret('apiKey');
    if (!k) return { ok: false, error: 'NO_KEY' };
    try {
        const r = await net.fetch('https://api.apify.com/v2/users/me', { headers: { Authorization: `Bearer ${k}` } });
        if (!r.ok) return { ok: false, status: r.status };
        const d = await r.json();
        return { ok: true, username: d?.data?.username || '' };
    } catch (e) {
        return { ok: false, error: String(e.message || e) };
    }
}

// ---------------------------------------------------------------- window
let win;
function createWindow() {
    win = new BrowserWindow({
        width: 1120,
        height: 820,
        minWidth: 760,
        minHeight: 600,
        backgroundColor: '#140e24',
        title: 'Daylight',
        icon: path.join(__dirname, '..', 'build', 'icon.png'),
        autoHideMenuBar: true,
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });
    win.once('ready-to-show', () => win.show());
    // Links in reports open in the system browser, never inside the app
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//i.test(url)) shell.openExternal(url);
        return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (e, url) => {
        if (!url.startsWith('app://')) {
            e.preventDefault();
            if (/^https?:\/\//i.test(url)) shell.openExternal(url);
        }
    });
    win.loadURL('app://local/index.html');
}

function serveFile(relPath) {
    const root = path.join(__dirname, '..');
    let file;
    if (relPath.startsWith('pdfjs/')) file = path.join(root, 'node_modules', 'pdfjs-dist', 'legacy', 'build', relPath.slice(6));
    else file = path.join(root, 'renderer', relPath || 'index.html');
    const norm = path.normalize(file);
    if (!norm.startsWith(root)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(norm).toString());
}

app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    protocol.handle('app', (req) => {
        const u = new URL(req.url);
        return serveFile(decodeURIComponent(u.pathname.replace(/^\/+/, '')));
    });

    ipcMain.handle('settings:get', () => publicSettings());
    ipcMain.handle('settings:save', (_e, s) => {
        const raw = readRaw();
        if (typeof s.apiKey === 'string' && s.apiKey.trim()) raw.apiKey = encrypt(s.apiKey.trim());
        if (s.clearKey) delete raw.apiKey;
        if (typeof s.licenseKey === 'string' && s.licenseKey.trim()) raw.licenseKey = encrypt(s.licenseKey.trim());
        if (s.clearLicense) delete raw.licenseKey;
        if (typeof s.actorId === 'string') raw.actorId = cleanActorId(s.actorId);
        if (['dark', 'light', 'system'].includes(s.theme)) raw.theme = s.theme;
        if (['en', 'cs'].includes(s.lang)) raw.lang = s.lang;
        writeRaw(raw);
        return publicSettings();
    });
    ipcMain.handle('apify:test', (_e, key) => testKey(key));
    ipcMain.handle('apify:run', (_e, timeoutSec, body) => callActor(timeoutSec, body));
    ipcMain.handle('license:check', async () => {
        // Prepared for the paid plan: send the licence key to LICENSE_SERVER, get back an allowance.
        if (!LICENSE_SERVER) return { active: false, reason: 'NOT_AVAILABLE' };
        return { active: false, reason: 'NOT_IMPLEMENTED' };
    });
    ipcMain.handle('report:save', async (_e, { html, format, name }) => {
        const safe = String(name || 'report').replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'report';
        const ext = format === 'pdf' ? 'pdf' : 'html';
        const { canceled, filePath } = await dialog.showSaveDialog(win, {
            defaultPath: `Daylight - ${safe}.${ext}`,
            filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
        });
        if (canceled || !filePath) return { ok: false, canceled: true };
        if (ext === 'html') {
            fs.writeFileSync(filePath, html, 'utf8');
            return { ok: true, filePath };
        }
        const tmp = path.join(app.getPath('temp'), `daylight-${Date.now()}.html`);
        fs.writeFileSync(tmp, html, 'utf8');
        const pdfWin = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
        try {
            await pdfWin.loadFile(tmp);
            const pdf = await pdfWin.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { marginType: 'default' } });
            fs.writeFileSync(filePath, pdf);
            return { ok: true, filePath };
        } finally {
            pdfWin.destroy();
            fs.rmSync(tmp, { force: true });
        }
    });
    ipcMain.handle('open:external', (_e, url) => {
        if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    });

    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
