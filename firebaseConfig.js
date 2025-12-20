import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// Shared Firebase initialization
const firebaseConfig = {
  apiKey: "AIzaSyBv5UXssrTxrLulAs4VvRPTrZpf7_oPpzw",
  authDomain: "bnablockamaintenance.firebaseapp.com",
  databaseURL: "https://bnablockamaintenance-default-rtdb.firebaseio.com",
  projectId: "bnablockamaintenance",
  storageBucket: "bnablockamaintenance.firebasestorage.app",
  messagingSenderId: "528569667236",
  appId: "1:528569667236:web:dd450093c855b20cb8e031",
  measurementId: "G-SWVQHW3QVY"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
