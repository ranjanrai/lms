// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBHN9LnC4zNBVQo87MfaWIKgMMgcNuNwmg",
  authDomain: "leave-management-system-f5264.firebaseapp.com",
  projectId: "leave-management-system-f5264",
  storageBucket: "leave-management-system-f5264.firebasestorage.app",
  messagingSenderId: "800601561283",
  appId: "1:800601561283:web:c3371c815ec5b19b8dea76",
  measurementId: "G-7GSV72ZF3Y"
};

// ? Initialize Firebase
firebase.initializeApp(firebaseConfig);

// ? Services
const auth = firebase.auth();
const db = firebase.firestore();

/* =========================================================
   ?? AUTH HELPER FUNCTIONS
========================================================= */

// Get current logged-in user
function getCurrentUser() {
    return auth.currentUser;
}

// Logout user
function logoutUser() {
    auth.signOut()
    .then(() => {
        window.location.href = "login.html";
    })
    .catch(error => {
        console.error("Logout Error:", error.message);
    });
}

// Check login status (redirect if not logged in)
function checkAuth() {
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = "login.html";
        }
    });
}


/* =========================================================
   ?? ADMIN HELPER FUNCTIONS
========================================================= */

// Get admin details from Firestore
async function getAdminData() {
    const snapshot = await db.collection("users")
        .where("role", "==", "admin")
        .get();

    let adminData = null;

    snapshot.forEach(doc => {
        adminData = doc.data();
    });

    return adminData;
}


/* =========================================================
   ?? EMAIL HELPER (for notification use)
   (Use with EmailJS or backend)
========================================================= */

async function getAdminEmails() {
    const snapshot = await db.collection("users")
        .where("role", "==", "admin")
        .get();

    let emails = [];

    snapshot.forEach(doc => {
        emails.push(doc.data().email);
    });

    return emails;
}


/* =========================================================
   ?? IMPORTANT NOTES
========================================================= */

/*
? Removed:
- Hardcoded admin email & password
- Auto admin creation (security risk)

? Now:
- Admin should be created manually once
- System is secure for production use

?? If no admin exists:
1. Register normally
2. Manually set role = "admin" in Firestore

Example Firestore document:

{
  name: "System Admin",
  email: "admin@gmail.com",
  role: "admin",
  status: "approved"
}
*/
