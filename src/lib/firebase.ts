import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBkieBAwbbRe6iDAs-kqD28L8D7qkfJD6k",
  authDomain: "crepree.firebaseapp.com",
  projectId: "crepree",
  storageBucket: "crepree.firebasestorage.app",
  messagingSenderId: "136152032204",
  appId: "1:136152032204:web:e28ccbfd225f44953a3369",
  measurementId: "G-NLY4XJ8C4V"
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
export const auth = getAuth(app);
export const storage = getStorage(app);
