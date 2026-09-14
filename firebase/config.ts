import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

// Your web app's Firebase configuration
// IMPORTANT: Replace these with your actual Firebase project credentials.
const firebaseConfig = {
  apiKey: "AIzaSyAqfeGkgQNSGOMg5r6s8P0arN6ex8zSqCs",
  authDomain: "finance-64bfd.firebaseapp.com",
  projectId: "finance-64bfd",
  storageBucket: "finance-64bfd.firebasestorage.app",
  messagingSenderId: "160004792342",
  appId: "1:160004792342:web:1c6ae64af42d538e00d537",
  measurementId: "G-XJV3P0PV8Q"
};

// Export a flag to check if the config is still using placeholder values
export const isFirebaseConfigured = firebaseConfig.projectId !== "YOUR_PROJECT_ID";

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Get Firebase Auth service
const auth = firebase.auth();

export { auth };
