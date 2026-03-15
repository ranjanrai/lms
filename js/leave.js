// ===========================
// LOAD LEAVE TYPES
// ===========================

document.addEventListener("DOMContentLoaded", function(){

const leaveTypeSelect = document.getElementById("leaveType")

db.collection("leave_types").onSnapshot((snapshot)=>{

leaveTypeSelect.innerHTML = '<option value="">Select Leave</option>'

snapshot.forEach((doc)=>{

let data = doc.data()

let option = document.createElement("option")

option.value = data.name
option.textContent = data.name

leaveTypeSelect.appendChild(option)

})

})

})

// ===========================
// APPLY LEAVE
// ===========================

async function applyLeave(){

let leaveType = document.getElementById("leaveType").value
let startDate = document.getElementById("startDate").value
let endDate = document.getElementById("endDate").value
let reason = document.getElementById("reason").value

if(!leaveType || !startDate || !endDate || !reason){
alert("Please fill all fields")
return
}

let user = auth.currentUser

if(!user){
alert("User not logged in")
return
}

try{

// GET LEAVE TYPE LIMIT
let leaveTypeSnapshot = await db.collection("leave_types")
.where("name","==",leaveType)
.get()

if(leaveTypeSnapshot.empty){
alert("Leave type not found")
return
}

let maxDays = 0

leaveTypeSnapshot.forEach(doc=>{
maxDays = Number(doc.data().max_days)
})


// COUNT APPROVED LEAVES
let leavesSnapshot = await db.collection("leaves")
.where("userId","==",user.uid)
.where("leaveType","==",leaveType)
.where("status","==","approved")
.get()

let usedDays = 0

leavesSnapshot.forEach(doc => {

let leave = doc.data()

let start = new Date(leave.startDate)
let end = new Date(leave.endDate)

let diff = (end - start) / (1000 * 60 * 60 * 24) + 1

usedDays += diff

})


// CHECK LIMIT
let start = new Date(startDate)
let end = new Date(endDate)

let requestedDays = (end - start) / (1000 * 60 * 60 * 24) + 1

if((usedDays + requestedDays) > maxDays){

alert("Leave limit exceeded. Remaining leave: " + (maxDays - usedDays))
return

}


// GET USER DATA
let userDoc = await db.collection("users").doc(user.uid).get()

if(!userDoc.exists){
alert("User record not found")
return
}

let userData = userDoc.data()


// SAVE LEAVE REQUEST
await db.collection("leaves").add({

userId:user.uid,
name:userData.name,
email:userData.email,
leaveType:leaveType,
startDate:startDate,
endDate:endDate,
reason:reason,
status:"pending",
createdAt: firebase.firestore.FieldValue.serverTimestamp()

})

alert("Leave request submitted")

document.getElementById("leaveForm").reset()

}catch(error){

console.error(error)
alert(error.message)

}

}


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