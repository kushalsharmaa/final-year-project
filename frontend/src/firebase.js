// frontend/src/firebase.js
// Firebase v9+ modular SDK
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBbxeZPNwAqH-yQgMv9mafLGazRnjLd5oo",
  authDomain: "ai-language-app-b94dd.firebaseapp.com",
  projectId: "ai-language-app-b94dd",
  storageBucket: "ai-language-app-b94dd.appspot.com",
  messagingSenderId: "713123006386",
  appId: "1:713123006386:web:7514ec33239b547619c6ab"
};

// Init
const app = initializeApp(firebaseConfig);

// Auth
const auth = getAuth(app);

// Firestore
const db = getFirestore(app);

// expose for console debugging in dev only
if (typeof window !== "undefined" && (
  (import.meta && import.meta.env && import.meta.env.DEV) ||
  process.env.NODE_ENV !== "production"
)) {
  window.auth = auth;
  // optional but handy
  // window.db = db;
}


// Named exports
export { app, auth, db };

// (Optional) default export
export default app;
