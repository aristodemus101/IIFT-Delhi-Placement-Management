import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDeO8mQsjs0C2fzlNkC4QZ2GYZUFBL4Oic",
  authDomain: "placement-management-6133f.firebaseapp.com",
  projectId: "placement-management-6133f",
  storageBucket: "placement-management-6133f.firebasestorage.app",
  messagingSenderId: "123326226580",
  appId: "1:123326226580:web:66f55b2451bd4d52db9481",
  measurementId: "G-X7GEBWP384"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);