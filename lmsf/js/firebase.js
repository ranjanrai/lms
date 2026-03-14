const firebaseConfig = {
  apiKey: "AIzaSyBHN9LnC4zNBVQo87MfaWIKgMMgcNuNwmg",
  authDomain: "leave-management-system-f5264.firebaseapp.com",
  projectId: "leave-management-system-f5264",
  storageBucket: "leave-management-system-f5264.firebasestorage.app",
  messagingSenderId: "800601561283",
  appId: "1:800601561283:web:c3371c815ec5b19b8dea76",
  measurementId: "G-7GSV72ZF3Y"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Services
const auth = firebase.auth();
const db = firebase.firestore();