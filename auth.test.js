import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

let sequence = 0;
async function fixture({ configured = true, hostname = 'example.vercel.app', denied = false, cached = false, popupError } = {}) {
  const calls = { paths: [], logout: 0, stopped: 0 };
  const forbidden = Object.assign(new Error('denied'), { code: 'permission-denied' });
  const snapshot = fromCache => ({ metadata: { fromCache }, exists: () => true, data: () => ({ products: [], lists: [], revision: 4 }) });
  const mock = {
    app: { getApps: () => [{}] },
    auth: {
      getAuth: () => ({}), setPersistence: async () => {}, browserSessionPersistence: 'session',
      GoogleAuthProvider: class { setCustomParameters(p) { calls.parameters = p; } },
      signInWithPopup: async () => { if (popupError) throw popupError; return { user: { uid: 'different-google-user' } }; },
      signOut: async () => { calls.logout++; }
    },
    firestore: {
      getFirestore: () => ({}), doc: (_db, ...path) => { calls.paths.push(path); return path; },
      onSnapshot: (_ref, options, success, error) => {
        calls.options = options;
        calls.approve = () => success(snapshot(false));
        calls.revoke = () => error(forbidden);
        queueMicrotask(() => denied ? error(forbidden) : success(snapshot(cached)));
        return () => { calls.stopped++; };
      }
    }
  };
  const name = `__authTest${sequence++}`;
  globalThis[name] = mock;
  let source = await readFile(new URL('./storage.js', import.meta.url), 'utf8');
  source = source.replace("import { firebaseConfig } from './config.js';", `const firebaseConfig = ${JSON.stringify(configured ? { apiKey: 'test', projectId: 'test', authDomain: 'test' } : {})};`)
    .replace("import { emptyState } from './domain.js';", 'const emptyState = () => ({products:[],lists:[],revision:0});')
    .replace('globalThis.location?.hostname', JSON.stringify(hostname));
  for (const [file, field] of [['app', 'app'], ['auth', 'auth'], ['firestore', 'firestore']]) {
    source = source.replace(`import('https://www.gstatic.com/firebasejs/12.2.1/firebase-${file}.js')`, `Promise.resolve(globalThis.${name}.${field})`);
  }
  const storage = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  return { storage, calls, cleanup: () => { delete globalThis[name]; } };
}

test('public site without Firebase fails closed', async () => {
  const f = await fixture({ configured: false });
  try { assert.equal(f.storage.localPreview, false); await assert.rejects(f.storage.login(() => assert.fail('must not read local data')), /Configure o Firebase/); await assert.rejects(f.storage.save({}, 0), /Configure o Firebase/); } finally { f.cleanup(); }
});
test('Google login shares the household and waits for server authorization', async () => {
  const f = await fixture({ cached: true });
  try {
    await f.storage.prepareLogin(); let data;
    const login = f.storage.login(s => { data = s; }, () => {});
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(data, undefined, 'cached data cannot unlock the app');
    f.calls.approve(); await login;
    assert.equal(data.revision, 4);
    assert.deepEqual(f.calls.paths, [['households', 'casa']]);
    assert.deepEqual(f.calls.parameters, { prompt: 'select_account' });
    assert.equal(f.calls.options.includeMetadataChanges, true);
  } finally { f.cleanup(); }
});
test('denied account is signed out and receives no household data', async () => {
  const f = await fixture({ denied: true });
  try { await f.storage.prepareLogin(); await assert.rejects(f.storage.login(() => assert.fail('must not expose data'), () => {}), { code: 'permission-denied' }); assert.equal(f.calls.logout, 1); assert.equal(f.calls.stopped, 1); } finally { f.cleanup(); }
});
test('revocation is reported to the UI after login', async () => {
  const f = await fixture();
  try { await f.storage.prepareLogin(); let error; await f.storage.login(() => {}, e => { error = e; }); f.calls.revoke(); assert.equal(error.code, 'permission-denied'); } finally { f.cleanup(); }
});
test('cancelled popup does not subscribe to household data', async () => {
  const error = Object.assign(new Error('cancelled'), { code: 'auth/popup-closed-by-user' });
  const f = await fixture({ popupError: error });
  try { await f.storage.prepareLogin(); await assert.rejects(f.storage.login(() => {}, () => {}), { code: error.code }); assert.deepEqual(f.calls.paths, []); } finally { f.cleanup(); }
});
