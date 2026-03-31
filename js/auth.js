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

    const msg = document.getElementById("message")
    const email = document.getElementById("email")
    const password = document.getElementById("password")

    msg.style.display = "block"

    // reset input styles
    email.classList.remove("input-error")
    password.classList.remove("input-error")

    let icon = ""

    if(type === "error"){
        msg.style.background = "#ffe5e5"
        msg.style.color = "#d8000c"
        icon = '<i class="fa fa-times-circle"></i> '

    }else if(type === "success"){
        msg.style.background = "#e6ffed"
        msg.style.color = "#2e7d32"
        icon = '<i class="fa fa-check-circle"></i> '

    }else if(type === "warning"){
        msg.style.background = "#fff4e5"
        msg.style.color = "#ff9800"
        icon = '<i class="fa fa-exclamation-triangle"></i> '
    }

    msg.innerHTML = icon + text
}

// ===========================
// LOGIN
// ===========================

function login(){

let emailInput = document.getElementById("email")
let passwordInput = document.getElementById("password")

let email = emailInput.value.trim()
let password = passwordInput.value.trim()

// reset error styles
emailInput.classList.remove("input-error")
passwordInput.classList.remove("input-error")

// validation
if(email === "" || password === ""){
    showMessage("Please enter email and password", "warning")

    if(email === "") emailInput.classList.add("input-error")
    if(password === "") passwordInput.classList.add("input-error")

    return
}

setLoading(true)

auth.signInWithEmailAndPassword(email,password)

.then((userCredential)=>{

let uid = userCredential.user.uid

db.collection("users").doc(uid).get()

.then((doc)=>{

if(!doc.exists){
    showMessage("User record not found", "error")
    setLoading(false)
    return
}

let data = doc.data()

// check approval
if(data.status !== "approved"){
   showMessage("Your account is pending admin approval", "warning")
    auth.signOut()
    setLoading(false)
    return
}

// success
showMessage("Login successful! Redirecting...", "success")

setTimeout(()=>{

if(data.role === "admin"){
    window.location="admin-dashboard.html"
}else{
    window.location="employee-dashboard.html"
}

},1200)

})

})

.catch((error)=>{

setLoading(false)

let msg = ""

switch(error.code){

case "auth/user-not-found":
    msg = "No account found with this email"
    break

case "auth/wrong-password":
    msg = "? Incorrect password"
    break

case "auth/invalid-email":
    msg = "? Invalid email format"
    break

case "auth/too-many-requests":
    msg = "Too many attempts. Try again later"
    break

default:
    msg = "? Login failed. Check credentials"
}

showMessage(msg, "error")

})

}

function togglePassword(){

    const password = document.getElementById("password")
    const icon = document.getElementById("toggleIcon").querySelector("i")

    if(password.type === "password"){
        password.type = "text"
        icon.classList.remove("fa-eye")
        icon.classList.add("fa-eye-slash")
    }else{
        password.type = "password"
        icon.classList.remove("fa-eye-slash")
        icon.classList.add("fa-eye")
    }
}

function setLoading(state){

    const btn = document.getElementById("loginBtn")
    const text = document.getElementById("btnText")
    const loader = document.getElementById("loader")

    if(state){
        btn.classList.add("loading")
        text.style.display = "none"
        loader.style.display = "inline"
    }else{
        btn.classList.remove("loading")
        text.style.display = "inline"
        loader.style.display = "none"
    }
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
