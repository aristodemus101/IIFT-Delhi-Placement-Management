import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";

// Production Firebase Config
const productionConfig = {
  apiKey: "AIzaSyDeO8mQsjs0C2fzlNkC4QZ2GYZUFBL4Oic",
  authDomain: "iiftd-pc.web.app",
  projectId: "placement-management-6133f",
  storageBucket: "placement-management-6133f.firebasestorage.app",
  messagingSenderId: "123326226580",
  appId: "1:123326226580:web:66f55b2451bd4d52db9481",
  measurementId: "G-X7GEBWP384"
};

// Staging Firebase Config
const stagingConfig = {
  apiKey: "AIzaSyBjGg7BjeH7AxA5btvyoX5c-6QIyLkfAro",
  authDomain: "placement-mgmt-staging.firebaseapp.com",
  projectId: "placement-mgmt-staging",
  storageBucket: "placement-mgmt-staging.firebasestorage.app",
  messagingSenderId: "285193500177",
  appId: "1:285193500177:web:d260979defffde9369e3b0",
};

const currentHostname = typeof window !== 'undefined' ? window.location.hostname : ''
const isStagingHost =
  currentHostname === 'localhost' ||
  currentHostname === '127.0.0.1' ||
  currentHostname.includes('placement-mgmt-staging')

const firebaseConfig = isStagingHost ? stagingConfig : productionConfig;

const app = initializeApp(firebaseConfig);
// Persistence priority: indexedDB (best for PWA/iOS) → localStorage → in-memory.
// Firebase tries each in order and uses the first available one.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence],
})
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);
const functions = getFunctions(app, 'asia-south1');
export const callPushFilteredToSheet = httpsCallable(functions, 'pushFilteredToSheet');
export const ENVIRONMENT = isStagingHost ? 'staging' : 'production';