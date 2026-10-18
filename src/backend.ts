import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged as fbOnAuthStateChanged,
  createUserWithEmailAndPassword as fbCreateUserWithEmailAndPassword,
  signInWithEmailAndPassword as fbSignInWithEmailAndPassword,
  signInAnonymously as fbSignInAnonymously,
  signInWithPopup as fbSignInWithPopup,
  signOut as fbSignOut,
  updateProfile as fbUpdateProfile,
  reload as fbReload,
  sendEmailVerification as fbSendEmailVerification,
  sendPasswordResetEmail as fbSendPasswordResetEmail,
  verifyPasswordResetCode as fbVerifyPasswordResetCode,
  confirmPasswordReset as fbConfirmPasswordReset,
  applyActionCode as fbApplyActionCode,
  checkActionCode as fbCheckActionCode,
  User as FirebaseNativeUser
} from 'firebase/auth';
import {
  getFirestore,
  collection as fbCollection,
  doc as fbDoc,
  setDoc as fbSetDoc,
  getDoc as fbGetDoc,
  getDocs as fbGetDocs,
  addDoc as fbAddDoc,
  updateDoc as fbUpdateDoc,
  deleteDoc as fbDeleteDoc,
  query as fbQuery,
  where as fbWhere,
  orderBy as fbOrderBy,
  limit as fbLimit,
  onSnapshot as fbOnSnapshot,
  serverTimestamp as fbServerTimestamp,
  Timestamp as fbTimestamp,
  increment as fbIncrement,
  writeBatch as fbWriteBatch,
  runTransaction as fbRunTransaction,
  arrayUnion as fbArrayUnion,
  arrayRemove as fbArrayRemove,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with configured Database ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export type PulseUser = FirebaseNativeUser;
export type FirebaseUser = FirebaseNativeUser;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Operation Notice:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Auth wrappers
export const onAuthStateChanged = fbOnAuthStateChanged;
export const createUserWithEmailAndPassword = fbCreateUserWithEmailAndPassword;
export const signInWithEmailAndPassword = fbSignInWithEmailAndPassword;
export const signInAnonymously = fbSignInAnonymously;
export const signInWithPopup = fbSignInWithPopup;
export const signOut = fbSignOut;
export const updateProfile = fbUpdateProfile;
export const reload = fbReload;
export const sendEmailVerification = fbSendEmailVerification;
export const sendPasswordResetEmail = fbSendPasswordResetEmail;
export const verifyPasswordResetCode = fbVerifyPasswordResetCode;
export const confirmPasswordReset = fbConfirmPasswordReset;
export const applyActionCode = fbApplyActionCode;
export const checkActionCode = fbCheckActionCode;

// Firestore wrappers & exports
export const collection = fbCollection;
export const doc = fbDoc;
export const setDoc = fbSetDoc;
export const getDoc = fbGetDoc;
export const getDocs = fbGetDocs;
export const addDoc = fbAddDoc;
export const updateDoc = fbUpdateDoc;
export const deleteDoc = fbDeleteDoc;
export const query = fbQuery;
export const where = fbWhere;
export const orderBy = fbOrderBy;
export const limit = fbLimit;
export const onSnapshot = fbOnSnapshot;
export const serverTimestamp = fbServerTimestamp;
export const Timestamp = fbTimestamp;
export const increment = fbIncrement;
export const writeBatch = fbWriteBatch;
export const runTransaction = fbRunTransaction;
export const arrayUnion = fbArrayUnion;
export const arrayRemove = fbArrayRemove;

// Boot validation test
async function testConnection() {
  try {
    await getDocFromServer(fbDoc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase connection check: Client currently offline or initial handshake pending.');
    }
  }
}
if (typeof window !== 'undefined') {
  void testConnection();
}
