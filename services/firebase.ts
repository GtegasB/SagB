import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, getDocs, setDoc, doc, addDoc } from 'firebase/firestore'; // Exporting helpers for convenience
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: "AIzaSyAKfMgwymzjtAG7VtT07n98ONwkykmNks0",
    authDomain: "sagb-grupob-v1.firebaseapp.com",
    projectId: "sagb-grupob-v1",
    storageBucket: "sagb-grupob-v1.appspot.com",
    messagingSenderId: "1098332631364",
    appId: "1:1098332631364:web:e3f5b7c8d9a0b1c2d3e4f5",
    measurementId: "G-XXXXXXXXXX"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Helper exports to keep imports clean in components
export { collection, getDocs, setDoc, doc, addDoc };
