// firebase-config.js
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInAnonymously, signInWithPopup } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getDatabase, ref, onValue, set, push, onDisconnect } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
    apiKey: "AIzaSyANa6zWkGrYQ7O7M6XT2oYbArsZIcs36M8",
    authDomain: "trip-a9341.firebaseapp.com",
    databaseURL: "https://trip-a9341-default-rtdb.firebaseio.com",
    projectId: "trip-a9341",
    storageBucket: "trip-a9341.firebasestorage.app",
    messagingSenderId: "379336201132",
    appId: "1:379336201132:web:34b0b863c3462c12aba009",
    measurementId: "G-PJQ32ZXJ0B"
};

// Inicialización
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const functions = getFunctions(app);
const analytics = getAnalytics(app);

// Habilitar persistencia offline
enableIndexedDbPersistence(db).catch(console.error);

export { app, auth, db, rtdb, functions, analytics };