// ===============================
// CHECK ADMIN LOGIN
// ===============================

auth.onAuthStateChanged(async function(user){

if(!user){
window.location.href="login.html"
return
}

const doc = await db.collection("users").doc(user.uid).get()

if(!doc.exists || doc.data().role !== "admin"){
alert("Access denied")
window.location.href="login.html"
return
}

// Run system functions
// COMMON
autoResetLeaveCycle()
loadNotifications()

// PAGE-WISE SAFE CALLS
if(document.getElementById("leaveRequests")){
    loadLeaveRequests()
}

if(document.getElementById("employeeTable")){
    loadEmployees()
}

if(document.getElementById("totalEmployees")){
    loadStats()
}

if(document.getElementById("leaveHeader")){
    Balance()
}

})



// ===============================
// AUTO RESET LEAVE CYCLE
// ===============================

async function autoResetLeaveCycle(){

const settingsRef = db.collection("leave_settings").doc("cycle")
const doc = await settingsRef.get()

if(!doc.exists) return

let data = doc.data()

let startMonth = parseInt(data.startMonth)
let lastResetYear = data.lastResetYear || 0

let today = new Date()
let currentMonth = today.getMonth()+1
let currentYear = today.getFullYear()

if(currentMonth === startMonth && lastResetYear !== currentYear){

const users = await db.collection("users")
.where("role","==","employee")
.get()

for(const user of users.docs){

await db.collection("users").doc(user.id).update({

leave_balance:{
"Casual Leave":10,
"Sick Leave":10,
"Earned Leave":10
}

})

}

await settingsRef.update({
lastResetYear: currentYear
})

alert("All employee leaves reset for new cycle")

}

}



// ===============================
// DASHBOARD STATISTICS
// ===============================

function loadStats(){

db.collection("users")
.where("role","==","employee")
.get()
.then(snapshot=>{
document.getElementById("totalEmployees").innerText = snapshot.size
})

db.collection("leaves")
.get()
.then(snapshot=>{
document.getElementById("totalLeaves").innerText = snapshot.size
})

db.collection("leaves")
.where("status","==","pending")
.get()
.then(snapshot=>{
document.getElementById("pendingLeaves").innerText = snapshot.size
})

}



// ===============================
// LOAD EMPLOYEES
// ===============================

function loadEmployees(){

const employeeTable = document.getElementById("employeeTable")

db.collection("users")
.where("role","==","employee")
.onSnapshot(snapshot=>{

employeeTable.innerHTML=""

snapshot.forEach(doc=>{

let data = doc.data()

let row = `
<tr>

<td>${data.name}</td>
<td>${data.email}</td>
<td>${data.status}</td>

<td>
<button onclick="approveEmployee('${doc.id}')">Approve</button>
<button onclick="rejectEmployee('${doc.id}')">Reject</button>
<button onclick="resetLeave('${doc.id}')">Reset Leave</button>
</td>

</tr>
`

employeeTable.innerHTML += row

})

})

}



// ===============================
// APPROVE EMPLOYEE
// ===============================

function approveEmployee(uid){

db.collection("users").doc(uid).update({
status:"approved"
})
.then(()=>{
alert("Employee approved")
})

}



// ===============================
// REJECT EMPLOYEE
// ===============================

function rejectEmployee(uid){

db.collection("users").doc(uid).update({
status:"rejected"
})
.then(()=>{
alert("Employee rejected")
})

}



// ===============================
// RESET LEAVE BALANCE
// ===============================

function resetLeave(uid){

if(confirm("Reset leave balance for this employee?")){

db.collection("users").doc(uid).update({

leave_balance:{
"Casual Leave":10,
"Sick Leave":10,
"Earned Leave":10
}

})
.then(()=>{
alert("Leave balance reset successfully")
})

}

}



// ===============================
// LOAD LEAVE REQUESTS
// ===============================

function loadLeaveRequests(){

const leaveTable = document.getElementById("leaveRequests")

db.collection("leaves")
.orderBy("createdAt","desc")
.onSnapshot(snapshot=>{

leaveTable.innerHTML=""

snapshot.forEach(doc=>{

let data = doc.data()

let action=""

// STATUS BUTTONS
if(data.status==="pending"){

action = `
<button class="btn approve" onclick="approveLeave('${doc.id}')">Approve</button>
<button class="btn reject" onclick="rejectLeave('${doc.id}')">Reject</button>
<button class="btn delete" onclick="deleteLeave('${doc.id}')">Delete</button>
`

}else{

action = `<button class="btn delete" onclick="deleteLeave('${doc.id}')">Delete</button>`

}

// ROW (MATCH YOUR UI TABLE)
let row = `
<tr>

<td>${data.name || ""}</td>
<td>${data.email || ""}</td>
<td>${data.leaveType || ""}</td>
<td>${data.startDate || ""}</td>
<td>${data.endDate || ""}</td>
<td>${data.reason || ""}</td>
<td class="status ${data.status}">${data.status}</td>
<td>${action}</td>

</tr>
`

leaveTable.innerHTML += row

})

})

}



// ===============================
// APPROVE LEAVE
// ===============================

async function approveLeave(id){

const doc = await db.collection("leaves").doc(id).get()

let data = doc.data()

let uid = data.userId
let type = data.leaveType

let field = `leave_balance.${type}`

await db.collection("users").doc(uid).update({
[field]: firebase.firestore.FieldValue.increment(-1)
})

await db.collection("leaves").doc(id).update({
status:"approved"
})

}



// ===============================
// REJECT LEAVE
// ===============================

function rejectLeave(id){

db.collection("leaves").doc(id).update({
status:"rejected"
})

}



// ===============================
// DELETE LEAVE
// ===============================

function deleteLeave(id){

if(confirm("Delete this leave request?")){

db.collection("leaves").doc(id).delete()

}

}



// ===============================
// LOAD LEAVE BALANCE TABLE
// ===============================

async function loadLeaveBalance(){

const header = document.getElementById("leaveHeader")
const table = document.getElementById("leaveBalanceTable")

header.innerHTML=`<th>Employee</th><th>Email</th>`

const leaveTypesSnapshot = await db.collection("leave_types").get()

let leaveTypes=[]

leaveTypesSnapshot.forEach(doc=>{
let data = doc.data()

leaveTypes.push({
name:data.name,
max:parseInt(data.max_days)
})

header.innerHTML += `<th>${data.name}</th>`
})

const usersSnapshot = await db.collection("users")
.where("role","==","employee")
.get()

table.innerHTML=""

for(const userDoc of usersSnapshot.docs){

let user = userDoc.data()
let uid = userDoc.id

let row=`<tr>
<td>${user.name}</td>
<td>${user.email}</td>
`

for(const leave of leaveTypes){

let leavesSnapshot = await db.collection("leaves")
.where("userId","==",uid)
.where("leaveType","==",leave.name)
.where("status","==","approved")
.get()

let used = leavesSnapshot.size

row += `<td>${used} / ${leave.max}</td>`

}

row += "</tr>"

table.innerHTML += row

}

}



// ===============================
// LOAD NOTIFICATIONS
// ===============================

function loadNotifications(){

const container = document.getElementById("notificationList")
const countElement = document.getElementById("notifCount")

if(!container) return

db.collection("notifications")
.orderBy("createdAt","desc")
.onSnapshot(snapshot=>{

container.innerHTML=""

let unreadCount = 0

snapshot.forEach(doc=>{

let data = doc.data()

// ✅ FIX: handle old data safely
let hidden = data.hidden || false
let read = data.read || false

if(hidden === true) return

if(!read) unreadCount++

// Time
let time=""
if(data.createdAt){
time = new Date(data.createdAt.seconds * 1000).toLocaleString()
}

// UI
let div=document.createElement("div")
div.className = "notification " + (read ? "" : "unread")

div.innerHTML=`
<strong>${data.message || "No message"}</strong>
<div class="notification-time">${time}</div>

<button onclick="markNotificationRead('${doc.id}')">✔</button>
<button onclick="deleteNotification('${doc.id}')">🗑</button>
`

container.appendChild(div)

})

// Update count
countElement.innerText = unreadCount

})

}
function toggleNotifPanel(){
const panel = document.getElementById("notifPanel")
panel.style.display = panel.style.display === "block" ? "none" : "block"
}

function markNotificationRead(id){
db.collection("notifications").doc(id).update({
read:true
})
}
window.addEventListener("click", function(e){
const panel = document.getElementById("notifPanel")
const bell = document.querySelector(".notif-bell")

if(!panel.contains(e.target) && !bell.contains(e.target)){
panel.style.display = "none"
}
})
function markNotificationRead(id){

db.collection("notifications").doc(id).update({
read:true
})

}

function hideNotification(id){

db.collection("notifications").doc(id).update({
hidden:true
})

}

function loadHiddenNotifications(){

const container = document.getElementById("hiddenNotifications")

if(!container) return

// TOGGLE
if(container.style.display === "block"){
container.style.display = "none"
return
}

container.style.display = "block"

db.collection("notifications")
.where("hidden","==",true)
.get()
.then(snapshot=>{

container.innerHTML=""

snapshot.forEach(doc=>{

let data = doc.data()

let time=""
if(data.createdAt){
time = new Date(data.createdAt.seconds * 1000).toLocaleString()
}

let div=document.createElement("div")
div.className="notification"

div.innerHTML=`
${data.message}
<div class="notification-time">${time}</div>
<button onclick="unhideNotification('${doc.id}')">Unhide</button>
<button onclick="deleteNotification('${doc.id}')">Delete</button>
`

container.appendChild(div)

})

})

}
function unhideNotification(id){

db.collection("notifications").doc(id).update({
hidden:false
})

}
// ===============================
// LOGOUT
// ===============================
function deleteNotification(id){

if(confirm("Delete this notification?")){

db.collection("notifications")
.doc(id)
.delete()
.catch(error=>{
console.log(error)
})

}

}

function logout(){

auth.signOut().then(()=>{
window.location.href="login.html"
})

}
