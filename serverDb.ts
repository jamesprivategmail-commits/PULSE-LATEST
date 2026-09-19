import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

type AnyRecord = Record<string, any>;
type Constraint = { type: 'where' | 'orderBy' | 'limit'; field?: string; op?: string; value?: any; direction?: 'asc' | 'desc'; count?: number };

const dataDir = path.join(process.cwd(), 'data');
const dbFile = path.join(dataDir, 'pulse-documents.json');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
let store: Record<string, AnyRecord> = {};
try { store = JSON.parse(fs.readFileSync(dbFile, 'utf8')); } catch { store = {}; }

function persist() {
  fs.writeFileSync(dbFile, JSON.stringify(store, null, 2));
}
function key(parts: string[]) { return parts.join('/'); }
function idFor(parts: string[]) { return parts[parts.length - 1]; }
function clone<T>(value: T): T { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function now() { return Date.now(); }
function applySpecial(value: any, current: any): any {
  if (value && value.__op === 'increment') return Number(current || 0) + Number(value.value || 0);
  if (value && value.__op === 'arrayUnion') return Array.from(new Set([...(Array.isArray(current) ? current : []), ...value.values]));
  if (value && value.__op === 'arrayRemove') return (Array.isArray(current) ? current : []).filter((x: any) => !value.values.some((v: any) => JSON.stringify(v) === JSON.stringify(x)));
  if (value && value.__op === 'serverTimestamp') return now();
  if (Array.isArray(value)) return value.map((v, i) => applySpecial(v, Array.isArray(current) ? current[i] : undefined));
  if (value && typeof value === 'object' && !('__op' in value)) {
    const out: AnyRecord = {};
    for (const [k, v] of Object.entries(value)) out[k] = applySpecial(v, current?.[k]);
    return out;
  }
  return value;
}
function merge(current: AnyRecord, patch: AnyRecord, replace = false) {
  const base = replace ? {} : { ...current };
  for (const [k, v] of Object.entries(patch || {})) base[k] = applySpecial(v, current?.[k]);
  return base;
}
function compareValue(value: any, op: string, expected: any) {
  if (op === '==') return value === expected;
  if (op === '!=') return value !== expected;
  if (op === '<') return value < expected;
  if (op === '<=') return value <= expected;
  if (op === '>') return value > expected;
  if (op === '>=') return value >= expected;
  if (op === 'array-contains') return Array.isArray(value) && value.includes(expected);
  if (op === 'in') return Array.isArray(expected) && expected.includes(value);
  return true;
}
function listCollection(collectionPath: string[], constraints: Constraint[] = []) {
  const prefix = key(collectionPath) + '/';
  const depth = collectionPath.length + 1;
  let rows = Object.entries(store)
    .filter(([k]) => k.startsWith(prefix) && k.split('/').length === depth)
    .map(([k, data]) => ({ id: idFor(k.split('/')), data: clone(data), path: k.split('/') }));
  for (const c of constraints.filter(x => x.type === 'where')) rows = rows.filter(r => compareValue(r.data?.[c.field!], c.op!, c.value));
  for (const c of constraints.filter(x => x.type === 'orderBy').reverse()) rows.sort((a, b) => {
    const av = a.data?.[c.field!], bv = b.data?.[c.field!];
    return (av === bv ? 0 : av > bv ? 1 : -1) * (c.direction === 'desc' ? -1 : 1);
  });
  const lim = constraints.find(x => x.type === 'limit');
  return lim ? rows.slice(0, lim.count) : rows;
}

export const db = { __pulseBackend: true };
export function collection(_db: any, ...parts: string[]) { return { __kind: 'collection', path: parts }; }
export function doc(parent: any, ...parts: string[]) {
  const base = parent?.path ? parent.path : [];
  return { __kind: 'doc', path: [...base, ...parts] };
}
export function query(ref: any, ...constraints: Constraint[]) { return { __kind: 'query', collection: ref.__kind === 'query' ? ref.collection : ref, constraints: ref.__kind === 'query' ? [...ref.constraints, ...constraints] : constraints }; }
export function where(field: string, op: string, value: any): Constraint { return { type: 'where', field, op, value }; }
export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): Constraint { return { type: 'orderBy', field, direction }; }
export function limit(count: number): Constraint { return { type: 'limit', count }; }
export function serverTimestamp() { return { __op: 'serverTimestamp' }; }
export function increment(value: number) { return { __op: 'increment', value }; }
export function arrayUnion(...values: any[]) { return { __op: 'arrayUnion', values }; }
export function arrayRemove(...values: any[]) { return { __op: 'arrayRemove', values }; }

export async function getDoc(ref: any) {
  const data = store[key(ref.path)];
  return { id: idFor(ref.path), exists: () => !!data, data: () => clone(data) };
}
export async function getDocs(ref: any) {
  const collectionRef = ref.__kind === 'query' ? ref.collection : ref;
  const rows = listCollection(collectionRef.path, ref.__kind === 'query' ? ref.constraints : []);
  const docs = rows.map(r => ({ id: r.id, ref: doc(db, ...r.path), exists: () => true, data: () => clone(r.data) }));
  return { docs, size: docs.length, empty: docs.length === 0, forEach: (fn: (d: any) => void) => docs.forEach(fn) };
}
export async function setDoc(ref: any, data: AnyRecord, options?: { merge?: boolean }) { store[key(ref.path)] = merge(store[key(ref.path)] || {}, data, !options?.merge); persist(); }
export async function updateDoc(ref: any, data: AnyRecord) { store[key(ref.path)] = merge(store[key(ref.path)] || {}, data); persist(); }
export async function deleteDoc(ref: any) { delete store[key(ref.path)]; persist(); }
export async function addDoc(ref: any, data: AnyRecord) { const id = crypto.randomUUID(); const target = doc(ref, id); await setDoc(target, data); return target; }
export function onSnapshot(ref: any, callback: (snap: any) => void) {
  let stopped = false;
  const emit = async () => { if (stopped) return; callback(ref.__kind === 'doc' ? await getDoc(ref) : await getDocs(ref)); };
  emit(); const timer = setInterval(emit, 3000); return () => { stopped = true; clearInterval(timer); };
}
export function writeBatch(_db: any) { const ops: (() => Promise<void>)[] = []; return { set: (r: any, d: any, o?: any) => ops.push(() => setDoc(r, d, o)), update: (r: any, d: any) => ops.push(() => updateDoc(r, d)), delete: (r: any) => ops.push(() => deleteDoc(r)), commit: async () => { for (const op of ops) await op(); } }; }
export async function runTransaction(_db: any, fn: (tx: any) => Promise<any>) { const tx = { get: getDoc, set: setDoc, update: updateDoc, delete: deleteDoc }; return fn(tx); }

export function listDocuments(pathParts: string[], constraints: Constraint[] = []) { return listCollection(pathParts, constraints); }
export function readDocument(pathParts: string[]) { return clone(store[key(pathParts)]); }
export function writeDocument(pathParts: string[], data: AnyRecord, mode: 'set' | 'update' | 'delete' = 'set') {
  const ref = doc(db, ...pathParts);
  if (mode === 'delete') return deleteDoc(ref);
  return mode === 'update' ? updateDoc(ref, data) : setDoc(ref, data);
}
export function clearDocuments() { store = {}; persist(); }
export function allUsers() { return listCollection(['users']); }
