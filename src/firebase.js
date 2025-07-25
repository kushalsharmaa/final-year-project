import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBbxeZPNwAqH-yQgMv9mafLGazRnjLd5oo",
  authDomain: "ai-language-app-b94dd.firebaseapp.com",
  projectId: "ai-language-app-b94dd",
  storageBucket: "ai-language-app-b94dd.appspot.com",
  messagingSenderId: "713123006386",
  appId: "1:713123006386:web:7514ec33239b547619c6ab"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
