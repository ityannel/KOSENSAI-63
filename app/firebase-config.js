// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.x.x/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.x.x/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCpFQ5nFnW6O0Ful2pAD3nGM-N-qxhS-04",
  authDomain: "enishi-7f43f.firebaseapp.com",
  projectId: "enishi-7f43f",
  storageBucket: "enishi-7f43f.firebasestorage.app",
  messagingSenderId: "799252125591",
  appId: "1:799252125591:web:2ff3274c2d7e1fef8bd6d2",
  measurementId: "G-K42WT34N8K"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
