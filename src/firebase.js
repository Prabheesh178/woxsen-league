import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
// --- YOUR WOXSEN CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyAKow_3XUJ6hC9AGGx3DyhTDCyxQDokTdQ",
  authDomain: "woxsen-sports-portal.firebaseapp.com",
  databaseURL: "https://woxsen-sports-portal-default-rtdb.firebaseio.com",
  projectId: "woxsen-sports-portal",
  storageBucket: "woxsen-sports-portal.firebasestorage.app",
  messagingSenderId: "867177677124",
  appId: "1:867177677124:web:9539cca832d52144389711",
  measurementId: "G-2EZ6NSE4E6"
};// 1. Initialize Firebase
const app = initializeApp(firebaseConfig);

// 2. Initialize Analytics (Optional)
const analytics = getAnalytics(app);

// 3. Initialize & Export Database
export const db = getFirestore(app);
