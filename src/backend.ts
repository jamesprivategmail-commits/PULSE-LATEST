type AnyRecord = Record<string, any>;
type Ref = { __kind?: 'collection' | 'doc' | 'query'; path?: string[]; collection?: Ref; constraints?: any[]; [key: string]: any };
const API = '/api';
const listeners = new Set<(user: PulseUser | null) => void>();
export interface PulseUser { uid: string; email?: string | null; displayName?: string | null; photoURL?: string | null; isAnonymous?: boolean; [key: string]: any; }
class PulseAuth { currentUser: PulseUser | null = null; }
export const auth = new PulseAuth();
export const googleProvider = {};
async function request(path: string, init?: RequestInit) { const response = await fetch(`${API}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }, ...init }); const payload = await response.json().catch(() => ({})); if (!response.ok) throw Object.assign(new Error(payload.error || 'Request failed'), { code: payload.code || 'backend/error', status: response.status }); return payload; }
function emit() { listeners.forEach(fn => fn(auth.currentUser)); }
async function refreshUser() { try { const result = await request('/auth/me'); auth.currentUser = result.user || null; } catch { auth.currentUser = null; } emit(); }
if (typeof window !== 'undefined') void refreshUser();
export function onAuthStateChanged(_auth: PulseAuth, callback: (user: PulseUser | null) => void) { listeners.add(callback); callback(auth.currentUser); if (auth.currentUser === null) void refreshUser(); return () => listeners.delete(callback); }
export async function createUserWithEmailAndPassword(_auth: PulseAuth, email: string, password: string) { const result = await request('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) }); auth.currentUser = result.user; emit(); return { user: result.user }; }
export async function signInWithEmailAndPassword(_auth: PulseAuth, email: string, password: string) { const result = await request('/auth/signin', { method: 'POST', body: JSON.stringify({ email, password }) }); auth.currentUser = result.user; emit(); return { user: result.user }; }
export async function signInAnonymously(_auth: PulseAuth) { const result = await request('/auth/anonymous', { method: 'POST' }); auth.currentUser = result.user; emit(); return { user: result.user }; }
export async function signInDemo(_auth: PulseAuth) { const result = await request('/auth/demo', { method: 'POST' }); auth.currentUser = result.user; emit(); return { user: result.user }; }
export async function signOut(_auth: PulseAuth) { await request('/auth/signout', { method: 'POST' }); auth.currentUser = null; emit(); }
export async function signInWithPopup(..._args: any[]): Promise<{ user: PulseUser }> { throw new Error('Google sign-in is not enabled on the new Pulse backend yet. Use email/password.'); }
export async function sendEmailVerification(user: PulseUser, _settings?: any) { return request('/auth/verify/request', { method: 'POST', body: JSON.stringify({ uid: user.uid }) }); }
export async function sendPasswordResetEmail(..._args: any[]) { throw new Error('Password reset email service is not configured yet.'); }
export async function verifyPasswordResetCode(..._args: any[]): Promise<string> { throw new Error('Password reset email service is not configured yet.'); }
export async function confirmPasswordReset(..._args: any[]) { throw new Error('Password reset email service is not configured yet.'); }
export async function applyActionCode(_auth: PulseAuth, token: string) { const result = await request('/auth/verify', { method: 'POST', body: JSON.stringify({ token }) }); if (result.user) { auth.currentUser = result.user; emit(); } return result; }
export async function checkActionCode() { return {}; }
export async function updateProfile(user: PulseUser, updates: { displayName?: string | null; photoURL?: string | null }) { const result = await request('/auth/profile', { method: 'PATCH', body: JSON.stringify(updates) }); Object.assign(user, result.user); auth.currentUser = user; emit(); }
export async function reload(user: PulseUser) { await refreshUser(); Object.assign(user, auth.currentUser || {}); }
export function collection(_db: any, ...path: string[]): Ref { return { __kind: 'collection', path }; }
export function doc(parent: Ref | AnyRecord, ...parts: string[]): Ref { return { __kind: 'doc', path: [...(parent?.path || []), ...parts] }; }
export function where(field: string, op: string, value: any) { return { type: 'where', field, op, value }; }
export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') { return { type: 'orderBy', field, direction }; }
export function limit(count: number) { return { type: 'limit', count }; }
export function query(ref: Ref, ...constraints: any[]): Ref { return { __kind: 'query', collection: ref.__kind === 'query' ? ref.collection : ref, constraints: [...(ref.constraints || []), ...constraints] }; }
export function serverTimestamp() { return { __op: 'serverTimestamp' }; }
export const Timestamp = { fromMillis: (millis: number) => millis };
export function increment(value: number) { return { __op: 'increment', value }; }
export function arrayUnion(...values: any[]) { return { __op: 'arrayUnion', values }; }
export function arrayRemove(...values: any[]) { return { __op: 'arrayRemove', values }; }
export const db = { __pulseBackend: true };
function refPayload(ref: Ref) { return { path: ref.path || ref.collection?.path, constraints: ref.constraints || [] }; }
export async function getDoc(ref: Ref) { return request('/db/doc', { method: 'POST', body: JSON.stringify(refPayload(ref)) }); }
export async function getDocs(ref: Ref) { const result = await request('/db/query', { method: 'POST', body: JSON.stringify(refPayload(ref)) }); const docs = (result.docs || []).map((item: any) => ({ ...item, exists: () => item.exists !== false, data: () => item.data })); return { ...result, docs, forEach: (fn: (doc: any) => void) => docs.forEach(fn) }; }
export async function setDoc(ref: Ref, data: AnyRecord, options?: { merge?: boolean }) { await request('/db/doc', { method: 'PUT', body: JSON.stringify({ ...refPayload(ref), data, mode: options?.merge ? 'update' : 'set' }) }); }
export async function updateDoc(ref: Ref, data: AnyRecord) { await request('/db/doc', { method: 'PUT', body: JSON.stringify({ ...refPayload(ref), data, mode: 'update' }) }); }
export async function deleteDoc(ref: Ref) { await request('/db/doc', { method: 'DELETE', body: JSON.stringify(refPayload(ref)) }); }
export async function addDoc(ref: Ref, data: AnyRecord) { const result = await request('/db/doc', { method: 'POST', body: JSON.stringify({ ...refPayload(ref), data }) }); return doc(ref, result.id); }
export function onSnapshot(ref: Ref, callback: (snap: any) => void, _onError?: (error: any) => void) { let stopped = false; const run = async () => { if (stopped) return; try { callback(ref.__kind === 'doc' ? await getDoc(ref) : await getDocs(ref)); } catch (error) { _onError?.(error); } }; void run(); const timer = window.setInterval(run, 3000); return () => { stopped = true; window.clearInterval(timer); }; }
export function writeBatch(_db: any) { const ops: Promise<any>[] = []; return { set: (r: Ref, d: AnyRecord, o?: any) => ops.push(setDoc(r, d, o)), update: (r: Ref, d: AnyRecord) => ops.push(updateDoc(r, d)), delete: (r: Ref) => ops.push(deleteDoc(r)), commit: async () => { await Promise.all(ops); } }; }
export async function runTransaction(_db: any, fn: (tx: any) => Promise<any>) { const tx = { get: getDoc, set: setDoc, update: updateDoc, delete: deleteDoc }; return fn(tx); }
export type FirebaseUser = PulseUser;
