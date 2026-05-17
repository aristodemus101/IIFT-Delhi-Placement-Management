import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Production Firebase Config
const productionConfig = {
  apiKey: "AIzaSyDeO8mQsjs0C2fzlNkC4QZ2GYZUFBL4Oic",
  authDomain: "placement-management-6133f.firebaseapp.com",
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

// Select environment based on NODE_ENV
const firebaseConfig = process.env.NODE_ENV === 'production' ? productionConfig : stagingConfig;

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'production' : 'staging';