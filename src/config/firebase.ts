import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAqghjU76zBmDZBJsXhVXDLA2G5OZsETVM",
  authDomain: "demoa-c585c.firebaseapp.com",
  projectId: "demoa-c585c",
  storageBucket: "demoa-c585c.firebasestorage.app",
  messagingSenderId: "668678630709",
  appId: "1:668678630709:web:3fb9ba78fd50882bafb07c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
