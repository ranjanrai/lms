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
// Create default admin automatically

async function createDefaultAdmin(){

const adminEmail = "admin@gmail.com";
const adminPassword = "admin123";

try{

// Check if admin exists in firestore
const snapshot = await db.collection("users")
.where("role","==","admin")
.get();

if(snapshot.empty){

// create authentication account
const userCredential = await auth.createUserWithEmailAndPassword(adminEmail,adminPassword);

const uid = userCredential.user.uid;

// store in firestore
await db.collection("users").doc(uid).set({

name:"System Admin",
email:adminEmail,
role:"admin",
status:"approved",
createdAt:new Date()

});

console.log("Default admin created");

}else{

console.log("Admin already exists");

}

}catch(error){

console.log(error.message);

}

}

createDefaultAdmin();