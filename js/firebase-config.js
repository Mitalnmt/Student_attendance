/**
 * Firebase Configuration & Initialization
 * Sử dụng Firebase 12.x với Realtime Database và Auth
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-analytics.js";
import {
  getDatabase,
  ref,
  set,
  push,
  onValue,
  update,
  remove,
  get,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDUjVLaRgutIjoEh88lkgEDQDlOt3CjAzk",
  authDomain: "student-attendance-dab3f.firebaseapp.com",
  databaseURL: "https://student-attendance-dab3f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "student-attendance-dab3f",
  storageBucket: "student-attendance-dab3f.firebasestorage.app",
  messagingSenderId: "609882832191",
  appId: "1:609882832191:web:d168733a00c9d8f76ba78a",
  measurementId: "G-LJJ0K252R8",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);
const auth = getAuth(app);

// Re-export for use in other modules
export {
  app,
  analytics,
  db,
  auth,
  ref,
  set,
  push,
  onValue,
  update,
  remove,
  get,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
};
