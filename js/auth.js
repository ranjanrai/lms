// ===========================
// USER REGISTER
// ===========================

function register(){

let name = document.getElementById("name").value
let email = document.getElementById("email").value
let password = document.getElementById("password").value

auth.createUserWithEmailAndPassword(email,password)

.then((userCredential)=>{

let user = userCredential.user

// Save user in Firestore
db.collection("users").doc(user.uid).set({

name:name,
email:email,
role:"employee",
status:"pending",
createdAt:new Date()

})

.then(()=>{

alert("Registration successful. Wait for admin approval.")

window.location="login.html"

})

})

.catch((error)=>{

alert(error.message)

})

}



// ===========================
// LOGIN
// ===========================

function login(){

let email=document.getElementById("email").value
let password=document.getElementById("password").value

auth.signInWithEmailAndPassword(email,password)

.then((userCredential)=>{

let uid = userCredential.user.uid

db.collection("users").doc(uid).get()

.then((doc)=>{

if(!doc.exists){

alert("User not found")
return

}

let data = doc.data()

// check approval
if(data.status !== "approved"){

alert("Account not approved by admin yet")
auth.signOut()
return

}

// redirect by role
if(data.role === "admin"){

window.location="admin-dashboard.html"

}else{

window.location="employee-dashboard.html"

}

})

})

.catch((error)=>{

alert(error.message)

})

}



// ===========================
// LOGOUT
// ===========================

function logout(){

auth.signOut()

.then(()=>{

window.location="login.html"

})

}



// ===========================
// SESSION CHECK
// ===========================

auth.onAuthStateChanged((user)=>{

if(user){

console.log("User logged in:",user.email)

}else{

console.log("No user logged in")

}

})