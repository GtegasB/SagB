import { initializeApp } from 'firebase/app';
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    User
} from 'firebase/auth';
import {
    getFirestore,
    collection,
    getDocs,
    setDoc,
    doc,
    addDoc,
    enableIndexedDbPersistence,
    initializeFirestore,
    CACHE_SIZE_UNLIMITED
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: process.env.API_KEY || "AIzaSyCUREZsmpAdyFPJQ51fnBBXFq7CbSFlBYI",
    authDomain: "sagb-grupob-v1.firebaseapp.com",
    projectId: "sagb-grupob-v1",
    storageBucket: "sagb-grupob-v1.firebasestorage.app",
    messagingSenderId: "1098332631364",
    appId: "1:1098332631364:web:e21093b44e3e621a932711"
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with settings
export const db = initializeFirestore(app, {
    cacheSizeBytes: CACHE_SIZE_UNLIMITED
});

export const auth = getAuth(app);
export const storage = getStorage(app);

// ENABLE OFFLINE PERSISTENCE
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn('Firestore Persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
        console.warn('Firestore Persistence not supported by browser');
    }
});

// Helper exports to keep imports clean in components
export {
    collection,
    getDocs,
    setDoc,
    doc,
    addDoc,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged
};
export type { User };
