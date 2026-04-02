
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
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

async function login(){

let emailInput = document.getElementById("email")
let passwordInput = document.getElementById("password")

let email = emailInput.value.trim()
let password = passwordInput.value.trim()

// reset errors
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
document.getElementById("loginBtn").disabled = true

try{

// 🔥 IMPORTANT: persistence
await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)

// 🔥 login
const userCredential = await auth.signInWithEmailAndPassword(email,password)
const uid = userCredential.user.uid

// 🔥 get user data
const doc = await db.collection("users").doc(uid).get()

if(!doc.exists){
    showMessage("User record not found", "error")
    await auth.signOut()
    return
}

const data = doc.data()

// 🔥 check approval
if(data.status !== "approved"){
    showMessage("Your account is pending admin approval", "warning")
    await auth.signOut()
    return
}

// ✅ SUCCESS
showMessage("Login successful! Redirecting...", "success")

setTimeout(()=>{

if(data.role === "admin"){
    window.location = "admin-dashboard.html"
}else{
    window.location = "employee-dashboard.html"
}

},1000)

}catch(error){

let msg = ""

switch(error.code){

case "auth/user-not-found":
    msg = "No account found with this email"
    break

case "auth/wrong-password":
    msg = "Incorrect password"
    break

case "auth/invalid-email":
    msg = "Invalid email format"
    break

case "auth/too-many-requests":
    msg = "Too many attempts. Try again later"
    break

default:
    msg = "Login failed. Check credentials"
}

showMessage(msg, "error")

}finally{

// ✅ always reset UI
setLoading(false)
document.getElementById("loginBtn").disabled = false

}

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

/* 🔔 REQUEST PERMISSION */
async function requestNotificationPermission(){
  try{
    const permission = await Notification.requestPermission();
    if(permission === "granted"){
      console.log("Notification permission granted");
    }else{
      console.log("Notification permission denied");
    }
  }catch(error){
    console.log(error);
  }
}

/* 🔑 GET FCM TOKEN */
async function getFCMToken(){
  try{
    const messaging = firebase.messaging();

    const token = await messaging.getToken({
      vapidKey: "BKwYqOH5rF6WSKTmiMCdp2TrKhQZ8GFGgT2Oc0H5xXJaK1K8U8RJn5RIuBC-mjf2QtzXPHjCDXExAUN9ZP4Jw0I"
    });

    console.log("FCM Token:", token);
    return token;

  }catch(error){
    console.log("Token error:", error);
  }
}

/* 💾 SAVE ADMIN TOKEN */
async function saveAdminToken(user){
  const token = await getFCMToken();

  if(token){
    await db.collection("admin_tokens").doc(user.uid).set({
      token: token
    });

    console.log("Admin token saved");
  }
}
