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


function showMessage(text, type){
    const msg = document.getElementById("message");

    msg.style.display = "block";
    msg.innerText = text;

    if(type === "error"){
        msg.style.background = "#ffe5e5";
        msg.style.color = "#d8000c";
    } else {
        msg.style.background = "#e6ffed";
        msg.style.color = "#2e7d32";
    }
}

// ===========================
// LOGIN
// ===========================

function login(){

let email = document.getElementById("email").value.trim()
let password = document.getElementById("password").value.trim()

// validation
if(email === "" || password === ""){
    showMessage("?? Please enter email and password", "error")
    return
}

auth.signInWithEmailAndPassword(email,password)

.then((userCredential)=>{

let uid = userCredential.user.uid

db.collection("users").doc(uid).get()

.then((doc)=>{

if(!doc.exists){
    showMessage("? User record not found", "error")
    return
}

let data = doc.data()

// check approval
if(data.status !== "approved"){
    showMessage("? Your account is pending admin approval", "error")
    auth.signOut()
    return
}

// success message
showMessage("? Login successful! Redirecting...", "success")

setTimeout(()=>{

if(data.role === "admin"){
    window.location="admin-dashboard.html"
}else{
    window.location="employee-dashboard.html"
}

},1500)

})

})

.catch((error)=>{

let msg = ""

switch(error.code){

case "auth/user-not-found":
    msg = "? No account found with this email"
    break

case "auth/wrong-password":
    msg = "? Incorrect password"
    break

case "auth/invalid-email":
    msg = "? Invalid email format"
    break

case "auth/too-many-requests":
    msg = "? Too many attempts. Try again later"
    break

default:
    msg = "? Login failed. Check credentials"
}

showMessage(msg, "error")

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
