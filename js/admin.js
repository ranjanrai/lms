let leaveCount = {}
let userMap = {}

// ===============================
// CHECK ADMIN LOGIN (SECURE)
// ===============================

auth.onAuthStateChanged(async function(user){

if(!user){
    window.location.href="login.html"
    return
}

const doc = await db.collection("users").doc(user.uid).get()

if(!doc.exists){
    await auth.signOut()
    window.location.href="login.html"
    return
}

const data = doc.data()

// 🚫 BLOCK NON-ADMIN
if(data.role !== "admin"){
    alert("Access denied")
    await auth.signOut()
    window.location.href="login.html"
    return
}

// 🚫 BLOCK DELETED ADMIN
if(data.status === "deleted"){
    alert("Your account has been removed")
    await auth.signOut()
    window.location.href="login.html"
    return
}

// 🚫 BLOCK REJECTED ADMIN
if(data.status === "rejected"){
    alert("Your account was rejected")
    await auth.signOut()
    window.location.href="login.html"
    return
}

// 🚫 BLOCK PENDING ADMIN (extra safety)
if(data.status === "pending"){
    alert("Waiting for approval")
    await auth.signOut()
    window.location.href="login.html"
    return
}

// ✅ ALLOW ACCESS
autoResetLeaveCycle()
loadStats()
loadEmployees()
loadLeaveRequests()
loadLeaveBalance()
loadNotifications(user)

})



// ===============================
// AUTO RESET LEAVE CYCLE
// ===============================

async function autoResetLeaveCycle(){

  const settingsRef = db.collection("leave_settings").doc("cycle")
  const docSnap = await settingsRef.get()

  if(!docSnap.exists) return

  let data = docSnap.data()

  let startMonth = parseInt(data.startMonth)
  let lastResetYear = data.lastResetYear || 0
  let lastResetMonth = data.lastResetMonth || 0

  let today = new Date()
  let currentMonth = today.getMonth() + 1
  let currentYear = today.getFullYear()

  // ✅ TRIGGERS
  let runYearly = currentMonth === startMonth && lastResetYear !== currentYear
  let runMonthly = lastResetMonth !== currentMonth

  if(!runYearly && !runMonthly){
    return
  }

  // 🔥 GET DATA
  const leaveTypesSnapshot = await db.collection("leave_types").get()

  const usersSnapshot = await db.collection("users")
    .where("role","==","employee")
    .where("status","==","approved")
    .get()

  // ===============================
  // PROCESS USERS
  // ===============================
  for(const userDoc of usersSnapshot.docs){

    let userData = userDoc.data()

    // ✅ Prevent duplicate yearly run ONLY
    if(userData.lastCarryForward){
      let last = new Date(userData.lastCarryForward.toDate())

      if(runYearly && last.getFullYear() === currentYear){
        continue
      }
    }

    let oldBalance = userData.leave_balance || {}
    let newBalance = {}
    let carryData = {}

    // ===============================
    // PROCESS LEAVE TYPES
    // ===============================
    leaveTypesSnapshot.forEach(doc => {

      let d = doc.data()
      let name = d.name
      let max = parseInt(d.max_days) || 0

      let old = oldBalance[name] || 0
      let maxCarry = parseInt(d.settings?.carryForwardMax) || 0

      let carry = 0
      let finalBalance = 0

      // ===============================
      // CARRY FORWARD LOGIC
      // ===============================
      if(d.settings?.carryForward){

        carry = maxCarry > 0 ? Math.min(old, maxCarry) : old

        // 🟢 MONTHLY
        if(d.settings.carryType === "monthly" && runMonthly){

          let monthlyAdd = max / 12
          finalBalance = Math.floor(old + monthlyAdd)

        }

        // 🔵 YEARLY
        else if(d.settings.carryType !== "monthly" && runYearly){

          finalBalance = max + carry

        }

        // ⏸ NO CHANGE
        else{
          finalBalance = old
        }

      } else {
        // ❌ NO CARRY FORWARD
        finalBalance = max
      }

      // ✅ STORE REAL CARRY
      carryData[name] = carry

      // ✅ SAVE FINAL BALANCE
      newBalance[name] = finalBalance

    })

    // ===============================
    // UPDATE USER
    // ===============================
    await db.collection("users").doc(userDoc.id).update({
      leave_balance: newBalance,
      carry_forward: carryData,
      lastCarryForward: firebase.firestore.FieldValue.serverTimestamp()
    })

    // ===============================
    // NOTIFICATION
    // ===============================
    await db.collection("notifications").add({
      userId: userDoc.id,
      role: "employee",
      type: "carry_forward",
      message: "📅 Your leave balance has been updated with carry forward",
      read: false,
      hidden: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })

  }

  // ===============================
  // SAVE SYSTEM STATE
  // ===============================
  await settingsRef.update({
    lastResetYear: runYearly ? currentYear : lastResetYear,
    lastResetMonth: currentMonth
  })

  console.log("✅ Carry forward system executed")
}

// ===============================
// DASHBOARD STATISTICS
// ===============================

function loadStats(){

const totalEmployees = document.getElementById("totalEmployees")
const totalLeaves = document.getElementById("totalLeaves")
const pendingLeaves = document.getElementById("pendingLeaves")

// ❗ If elements not found → stop function
if(!totalEmployees || !totalLeaves || !pendingLeaves) return

db.collection("users")
.where("role","==","employee")
.get()
.then(snapshot=>{
    totalEmployees.innerText = snapshot.size
})

db.collection("leaves")
.get()
.then(snapshot=>{
    totalLeaves.innerText = snapshot.size
})

db.collection("leaves")
.where("status","==","pending")
.get()
.then(snapshot=>{
    pendingLeaves.innerText = snapshot.size
})

}



// ===============================
// LOAD EMPLOYEES
// ===============================

function loadEmployees(){

const employeeTable = document.getElementById("employeeTable")
if(!employeeTable) return

db.collection("users")
.where("role","==","employee")
.onSnapshot(snapshot=>{

employeeTable.innerHTML=""

snapshot.forEach(doc=>{

let data = doc.data()

// ✅ ALWAYS USE THIS
let status = data.status || "pending"

let action = ""
let statusBadge = ""

// 🎨 STATUS
if(status === "approved"){
    statusBadge = `<span style="color:green;font-weight:bold;">Approved</span>`
}
else if(status === "pending"){
    statusBadge = `<span style="color:orange;font-weight:bold;">Pending</span>`
}
else if(status === "deleted"){
    statusBadge = `<span style="color:red;font-weight:bold;">Deleted</span>`
}
else{
    return
}

// 🟡 Pending → approve buttons
if(status === "pending"){
    action = `
        <button onclick="approveEmployee('${doc.id}')">Approve</button>
        <button onclick="rejectEmployee('${doc.id}')">Reject</button>
    `
}

// 🟢 Approved → controls
else if(status === "approved"){
    action = `
<div style="display:flex;align-items:center;gap:12px;">
    <button onclick="resetLeave('${doc.id}')">🔄</button>

    <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:12px;">Probation</span>

        <label class="switch">
            <input type="checkbox"
                ${data.probation === true ? "checked" : ""}
                onchange="setProbation('${doc.id}', this.checked)">
            <span class="slider"></span>
        </label>
    </div>

    <button onclick="deleteEmployee('${doc.id}')">🗑</button>
</div>
`
}

// 🔴 Deleted → restore
else if(status === "deleted"){
    action = `
        <button onclick="restoreEmployee('${doc.id}')">♻ Restore</button>
        <button onclick="permanentDeleteEmployee('${doc.id}')">❌ Delete</button>
    `
}

// ✅ FIXED STATUS TEXT
let extraStatus = ""

if(status === "approved"){
    extraStatus = data.probation
        ? "<span style='color:orange;'>🟡 Probation</span>"
        : "<span style='color:green;'>🟢 Confirmed</span>"
}

// ✅ ROW
let row = `
<tr>
<td>${data.name}</td>
<td>${data.email}</td>
<td>
  ${statusBadge}
  <br>
  ${extraStatus}
</td>
<td>${action}</td>
</tr>
`

employeeTable.innerHTML += row

})

})
}

// ===============================
// APPROVE EMPLOYEE
// ===============================
async function approveEmployee(uid) {

    // 🔒 Confirm action
    if (!confirm("Approve employee and set probation?")) return;

    try {

        // 🔍 1. Get user data
        const userRef = db.collection("users").doc(uid);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            alert("❌ User not found");
            return;
        }

        const userData = userSnap.data();

        // 🚫 Prevent duplicate approval
        if (userData.status === "approved") {
            alert("⚠ Employee already approved");
            return;
        }

        // 🔥 2. Get leave types
        const leaveTypesSnapshot = await db.collection("leave_types").get();

        if (leaveTypesSnapshot.empty) {
            alert("❌ No leave types found. Please create leave types first.");
            return;
        }

        // 📊 3. Build leave balance
        let leaveBalance = {};

        leaveTypesSnapshot.forEach(doc => {
            const leave = doc.data();

            leaveBalance[leave.name] = parseInt(leave.max_days) || 0;
        });

        // 🔄 4. Update employee
        await userRef.update({
            status: "approved",
            probation: true,
            leave_balance: leaveBalance,
            approvedAt: firebase.firestore.FieldValue.serverTimestamp() // ⭐ added
        });

        // 🔔 5. Send notification
        await db.collection("notifications").add({
            userId: uid,
            role: "employee",
            type: "account_approved",
            message: "🎉 Your account has been approved. You can now apply for leave.",
            read: false,
            hidden: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // ✅ Success
        alert("✅ Employee approved successfully");

    } catch (error) {
        console.error("Approve Error:", error);
        alert("❌ Failed to approve employee");
    }
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

async function resetLeave(uid){

if(confirm("Reset leave balance for this employee?")){

  const leaveTypesSnapshot = await db.collection("leave_types").get()

  let newBalance = {}

  leaveTypesSnapshot.forEach(doc=>{
    let d = doc.data()
    newBalance[d.name] = parseInt(d.max_days) || 0
  })

  await db.collection("users").doc(uid).update({
    leave_balance: newBalance
  })

  alert("Leave balance reset successfully")
}
}

function deleteEmployee(uid){

if(confirm("Remove this employee?")){

db.collection("users").doc(uid).update({
    status:"deleted"
})
.then(()=>{
    alert("Employee removed")
})

}
}

function restoreEmployee(uid){

if(confirm("Restore this employee?")){

db.collection("users").doc(uid).update({
    status: "approved"
})
.then(()=>{
    alert("Employee restored successfully")
})

}
}
function permanentDeleteEmployee(uid){

if(confirm("⚠ Permanently delete this employee? This cannot be undone!")){

    db.collection("users").doc(uid).delete()
    .then(()=>{
        alert("✅ Employee permanently deleted")
    })
    .catch(error=>{
        console.error(error)
        alert("❌ Error deleting employee")
    })

}
}
function searchEmployee(){

let input = document.getElementById("searchEmployee").value.toLowerCase()
let rows = document.querySelectorAll("#employeeTable tr")

rows.forEach(row=>{

let name = row.children[0].innerText.toLowerCase()
let email = row.children[1].innerText.toLowerCase()

if(name.includes(input) || email.includes(input)){
    row.style.display = ""
}else{
    row.style.display = "none"
}

})

}

// ===============================
// LOAD LEAVE REQUESTS
// ===============================

function loadLeaveRequests(){

const leaveTable = document.getElementById("leaveRequests")
if(!leaveTable) return   // ✅ IMPORTANT FIX
const totalElement = document.getElementById("totalLeaveRequests")
const insightBox = document.getElementById("aiInsight")

db.collection("leaves")
.orderBy("createdAt","desc")
.onSnapshot(snapshot=>{

leaveTable.innerHTML=""

let count = 0
let leaveCount = {}

snapshot.forEach(doc=>{

let data = doc.data()

// ✅ calculate days
let totalDays = 0
if(data.startDate && data.endDate){
    totalDays = calculateDays(data.startDate, data.endDate)
}

// 🤖 AI tracking
leaveCount[data.userId] = (leaveCount[data.userId] || 0) + 1
userMap[data.userId] = data.name

let action = ""
let aiSuggestion = ""

// 🤖 AI Suggestion
if(totalDays <= 2){
    aiSuggestion = `<span style="color:green;font-size:12px;">✅ Safe to approve</span>`
}
else if(totalDays >= 5){
    aiSuggestion = `<span style="color:red;font-size:12px;">⚠️ Needs review</span>`
}

// ACTION
if(data.status==="pending"){

action = `
<button onclick="approveLeave('${doc.id}')">Approve</button>
<button onclick="rejectLeave('${doc.id}')">Reject</button>
<button onclick="deleteLeave('${doc.id}')">Delete</button>
<br>${aiSuggestion}
`

}else{

action = `<button onclick="deleteLeave('${doc.id}')">Delete</button>`

}

// 🎨 STATUS
let statusBadge = ""
if(status === "approved"){
    statusBadge = `<span style="color:green;font-weight:bold;">Approved</span>`
}
else if(data.status === "pending"){
    statusBadge = `<span style="color:orange;font-weight:bold;">Pending</span>`
}
else if(data.status === "rejected"){
    statusBadge = `<span style="color:red;font-weight:bold;">Rejected</span>`
}
else{
    statusBadge = data.status
}

// ✅ MOBILE CARD FIX (IMPORTANT)
let row = `
<tr>
<td data-label="User">${data.name}</td>
<td data-label="Leave Type">${data.leaveType}</td>
<td data-label="Start Date">${data.startDate}</td>
<td data-label="End Date">${data.endDate}</td>
<td data-label="Total Days">${totalDays}</td>

<td data-label="Department">${data.department || "-"}</td>   <!-- ✅ NEW -->

<td data-label="Reason">${data.reason}</td>

<td data-label="Adjustment">${data.adjustment || "-"}</td>   <!-- ✅ NEW -->

<td data-label="Status">${statusBadge}</td>
<td data-label="Action">${action}</td>
</tr>
`

leaveTable.innerHTML += row

count++

})

// count
if(totalElement){
    totalElement.innerText = count
}

// 🤖 AI Insight
let maxUser = ""
let max = 0

for(let user in leaveCount){
    if(leaveCount[user] > max){
        max = leaveCount[user]
        maxUser = user
    }
}

if(insightBox && maxUser){
    insightBox.innerText =
"🤖 AI Insight: " + (userMap[maxUser] || "Unknown") +
" has highest leave requests (" + max + ")"
}

})
}
function calculateDays(start, end) {
    const startDate = new Date(start)
    const endDate = new Date(end)

    const diffTime = endDate - startDate
    const diffDays = diffTime / (1000 * 60 * 60 * 24)

    return diffDays + 1   // ✅ include both start & end
}



// ===============================
// APPROVE LEAVE
// ===============================

async function approveLeave(id){

const docSnap = await db.collection("leaves").doc(id).get()
let data = docSnap.data()

// ❌ prevent double approval
if(data.status !== "pending"){
  alert("Already processed")
  return
}


let uid = data.userId
let type = data.leaveType

let days = calculateDays(data.startDate, data.endDate)

// get user
const userDoc = await db.collection("users").doc(uid).get()
let user = userDoc.data()

// 🔥 get max allowed leave
const typeDoc = await db.collection("leave_types")
.where("name","==",type)
.get()

let maxAllowed = 0
typeDoc.forEach(doc=>{
  maxAllowed = parseInt(doc.data().max_days) || 0
})

// 🔥 calculate used days
const usedSnapshot = await db.collection("leaves")
.where("userId","==",uid)
.where("leaveType","==",type)
.where("status","==","approved")
.get()

let uniqueDates = new Set();

usedSnapshot.forEach(doc => {

    let d = doc.data();
    let current = new Date(d.startDate);
    let end = new Date(d.endDate);

    while (current <= end) {
        let dateStr = current.toISOString().split("T")[0];
        uniqueDates.add(dateStr);
        current.setDate(current.getDate() + 1);
    }
});

let usedDays = uniqueDates.size;

let remaining = maxAllowed - usedDays

// ❌ block if insufficient
if(remaining < days){
  alert("❌ Not enough leave balance")
  return
}

if(!data.startDate || !data.endDate){
  alert("Invalid leave data")
  return
}



// update leave
await db.collection("leaves").doc(id).update({
  status:"approved"
})

// notification
await db.collection("notifications").add({
  userId: uid,
  role: "employee",
  type: "leave_approved",
  message: `✅ ${data.leaveType} leave approved (${data.startDate} to ${data.endDate})`,
  read: false,
  hidden: false,
  createdAt: firebase.firestore.FieldValue.serverTimestamp()
})

}




// ===============================
// REJECT LEAVE
// ===============================

function rejectLeave(id){

db.collection("leaves").doc(id).get().then(doc=>{

let data = doc.data()

db.collection("leaves").doc(id).update({
status:"rejected"
})

// 🔔 notification
db.collection("notifications").add({
    userId: data.userId,
    role: "employee", // ✅ ADD
    type: "leave_rejected", // ✅ ADD
    message: "❌ Your leave has been rejected",
    read: false,
    hidden: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
})

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
const cards = document.getElementById("leaveBalanceCards")

if(!header || !table) return

header.innerHTML = `<th>Employee</th><th>Email</th>`
table.innerHTML = ""
if(cards) cards.innerHTML = ""

// ===============================
// 1. GET LEAVE TYPES
// ===============================
const leaveTypesSnapshot = await db.collection("leave_types").get()

let leaveTypes = []

leaveTypesSnapshot.forEach(doc=>{
    const data = doc.data()

    const leave = {
    name: data.name,
    max: parseInt(data.max_days) || 0,
    settings: data.settings || {}   // 🔥 ADD THIS
}

    leaveTypes.push(leave)

    header.innerHTML += `<th>${leave.name}</th>`
})

// ===============================
// 2. GET USERS
// ===============================
const usersSnapshot = await db.collection("users")
.where("role","==","employee")
.get()

// ===============================
// 3. PROCESS EACH USER
// ===============================
for(const userDoc of usersSnapshot.docs){

const user = userDoc.data()
const uid = userDoc.id
let carryData = user.carry_forward || {}   // 🔥 NEW

// Desktop row
let row = `
<tr>
<td data-label="Employee">${user.name}</td>
<td data-label="Email">${user.email}</td>
`

// Mobile card
let cardHTML = `
<div class="leave-card">
<h3>${user.name}</h3>
<p>${user.email}</p>
`

// ===============================
// 4. PROCESS EACH LEAVE TYPE
// ===============================
for(const leave of leaveTypes){

// 🔥 Fetch approved leaves
const leavesSnapshot = await db.collection("leaves")
.where("userId","==",uid)
.where("leaveType","==",leave.name)
.where("status","==","approved")
.get()

let uniqueDates = new Set();

leavesSnapshot.forEach(doc => {

    let d = doc.data();
    let current = new Date(d.startDate);
    let end = new Date(d.endDate);

    while (current <= end) {
        let dateStr = current.toISOString().split("T")[0];
        uniqueDates.add(dateStr);
        current.setDate(current.getDate() + 1);
    }
});

let used = uniqueDates.size;

// ===============================
// CALCULATIONS
// ===============================
const max = leave.max

let settings = leave.settings || {}
let isCarryEnabled = settings.carryForward === true

// ✅ ONLY IF ENABLED
let carry = isCarryEnabled ? (carryData[leave.name] || 0) : 0

let totalWithCarry = isCarryEnabled ? (max + carry) : max
let remaining = totalWithCarry - used



if(remaining < 0) remaining = 0

let percent = max > 0 ? (used / max) * 100 : 0
if(percent > 100) percent = 100

// ===============================
// STATUS + COLOR
// ===============================
let color = "green"
let statusText = "✅ Available"

if(remaining === 0){
    color = "red"
    statusText = "❌ No leave left"
}
else if(percent > 70){
    color = "red"
    statusText = "⚠ Low balance"
}
else if(percent > 40){
    color = "orange"
}

// ===============================
// DESKTOP TABLE CELL
// ===============================
row += `
<td data-label="${leave.name}">
<b>${totalWithCarry}</b> / ${remaining}
<br>
${
    isCarryEnabled
    ? `<small style="color:green;">
            📦 +${carry} carried
       </small>`
    : `<small style="color:#999;">—</small>`
}
</td>
`

// ===============================
// MOBILE CARD BLOCK
// ===============================
cardHTML += `
<div class="leave-item">

<div class="leave-top">
<span>${leave.name}</span>
<span>${totalWithCarry}/${remaining}</span>
${
    isCarryEnabled
    ? `<div style="font-size:12px;color:green;">
            📦 +${carry} carried
       </div>`
    : `<div style="font-size:12px;color:#999;">
            —
       </div>`
}
</div>

<div class="leave-remain">
Remaining: ${remaining} (${statusText})
</div>

<div class="progress">
<div class="progress-bar ${color}" style="width:${percent}%"></div>
</div>

</div>
`

}

// close row & card
row += `</tr>`
cardHTML += `</div>`

// append
table.innerHTML += row
if(cards) cards.innerHTML += cardHTML

}

}

function getIcon(name){
  if(name.includes("Casual")) return "🟡"
  if(name.includes("Sick")) return "🤒"
  if(name.includes("Earned")) return "💰"
  if(name.includes("Maternity")) return "👶"
  if(name.includes("Paternity")) return "👨‍👧"
  return "📄"
}


// ===============================
// LOAD NOTIFICATIONS
// ===============================

let shownNotifications = new Set() // prevent repeat toast

function loadNotifications(user){

const container = document.getElementById("notificationList")
const countElement = document.getElementById("notifCount")

if(!container || !countElement) return

db.collection("notifications")
.where("userId","==",user.uid)
.orderBy("createdAt","desc")
.onSnapshot(snapshot=>{

container.innerHTML = ""

let unreadCount = 0

snapshot.forEach(doc=>{

let data = doc.data()

if(data.hidden) return

if(!data.read) unreadCount++

let time = ""
if(data.createdAt?.toDate){
    time = data.createdAt.toDate().toLocaleString()
}

let div = document.createElement("div")
div.className = "notification " + (data.read ? "" : "unread")

div.innerHTML = `
🔔 ${data.message}
<div>${time}</div>
<button onclick="markNotificationRead('${doc.id}')">✔</button>
<button onclick="deleteNotification('${doc.id}')">🗑</button>
`

container.appendChild(div)

})

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

if(panel && bell && !panel.contains(e.target) && !bell.contains(e.target)){
    panel.style.display = "none"
}
})

function showToast(message){

let toast = document.createElement("div")
toast.className = "toast"
toast.innerText = message

document.body.appendChild(toast)

setTimeout(()=>{
    toast.remove()
},3000)

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
function setProbation(uid, value){

    db.collection("users").doc(uid).update({
        probation: value
    })
    .then(()=>{
        console.log("Probation updated:", value)
    })

}
function exportLeaveRequests(){

  let table = document.getElementById("leaveRequests");

  let data = [];

  // ✅ Exact headers (match your table)
  data.push([
    "User",
    "Leave Type",
    "Start Date",
    "End Date",
    "Total Days",
    "Department",
    "Reason",
    "Adjustment",
    "Status"
  ]);

  table.querySelectorAll("tr").forEach(tr => {

    let row = [];
    let cells = tr.querySelectorAll("td");

    cells.forEach((td, index) => {
      // ❌ skip last column (Action buttons)
      if(index !== cells.length - 1){
        row.push(td.innerText.replace(/\n/g," ").trim());
      }
    });

    if(row.length > 0){
      data.push(row);
    }

  });

  let ws = XLSX.utils.aoa_to_sheet(data);
  let wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, "Leave Requests");

  XLSX.writeFile(wb, "Leave_Requests.xlsx");
}
function exportLeaveBalance(){

  let headerRow = document.getElementById("leaveHeader");
  let table = document.getElementById("leaveBalanceTable");

  let data = [];

  // ✅ Dynamic headers (VERY IMPORTANT for your system)
  let headers = [];
  headerRow.querySelectorAll("th").forEach(th => {
    headers.push(th.innerText.trim());
  });

  data.push(headers);

  // ✅ Rows
  table.querySelectorAll("tr").forEach(tr => {

    let row = [];

    tr.querySelectorAll("td").forEach(td => {

      let text = td.innerText
        .replace(/\n/g," ")
        .replace("Remain:", "")
        .trim();

      row.push(text);
    });

    if(row.length > 0){
      data.push(row);
    }

  });

  let ws = XLSX.utils.aoa_to_sheet(data);
  let wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, ws, "Leave Balance");

  XLSX.writeFile(wb, "Leave_Balance.xlsx");
}
