import { firebaseConfig } from './config.js';
import { emptyState } from './domain.js';
export const cloud = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.authDomain);
export const localPreview = !cloud && ['localhost', '127.0.0.1', '[::1]'].includes(globalThis.location?.hostname);
const key = 'compra-de-casa-v1';
let auth, db, sdk, ref, unsubscribe, authentication, ready = false;
export async function prepareLogin() {
  if (!cloud) return;
  const [app, authSdk, firestore] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js')
  ]);
  const instance = app.getApps()[0] || app.initializeApp(firebaseConfig);
  authentication = authSdk;
  auth = authentication.getAuth(instance);
  await authentication.setPersistence(auth, authentication.browserSessionPersistence);
  db = firestore.getFirestore(instance); sdk = firestore;
  ready = true;
}
export async function login(onChange, onError) {
  if (!cloud) {
    if (!localPreview) throw new Error('Configure o Firebase para habilitar o acesso com Google.');
    let state;
    try { state = JSON.parse(localStorage.getItem(key)) || emptyState(); } catch { throw new Error('Não foi possível ler os dados locais. Preserve os dados para recuperação.'); }
    onChange(state); return;
  }
  if (!ready) throw new Error('O login ainda está carregando. Aguarde e tente novamente.');
  const provider = new authentication.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  // Initialization is complete before the click, preserving the popup user gesture.
  await authentication.signInWithPopup(auth, provider);
  ref = sdk.doc(db, 'households', 'casa');
  unsubscribe?.();
  let authorized = false;
  try {
    await new Promise((resolve, reject) => {
      unsubscribe = sdk.onSnapshot(ref, { includeMetadataChanges: true }, snapshot => {
        // Cached data must not unlock the app before server authorization.
        if (snapshot.metadata.fromCache) return;
        onChange(snapshot.exists() ? snapshot.data() : emptyState());
        authorized = true; resolve();
      }, e => { if (authorized) onError(e); reject(e); });
    });
  } catch (e) { await logout(); throw e; }
}
export async function save(state, expectedRevision) {
  if (!cloud && !localPreview) throw new Error('Configure o Firebase antes de salvar.');
  if (new TextEncoder().encode(JSON.stringify(state)).length > 900000) throw new Error('O histórico atingiu o limite desta versão. Baixe um backup; será necessário ampliar o armazenamento antes de adicionar mais dados.');
  if (!cloud) {
    const current = JSON.parse(localStorage.getItem(key));
    if (current && current.revision !== expectedRevision) throw new Error('A lista mudou em outra aba. Recarregue a página antes de continuar.');
    localStorage.setItem(key, JSON.stringify(state)); return;
  }
  await sdk.runTransaction(db, async tx => {
    const snapshot = await tx.get(ref);
    if ((snapshot.data()?.revision || 0) !== expectedRevision) throw new Error('Outra pessoa atualizou a lista. Confira os dados atualizados e tente novamente.');
    tx.set(ref, state);
  });
}

export async function logout() {
  unsubscribe?.(); unsubscribe = undefined;
  if (auth) await authentication.signOut(auth);
}
