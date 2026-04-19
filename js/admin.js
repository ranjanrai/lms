function calculateDays(start, end) {
    const startDate = new Date(start)
    const endDate = new Date(end)

    const diffTime = endDate - startDate
    const diffDays = diffTime / (1000 * 60 * 60 * 24)

    return diffDays + 1
}

let leaveCount = {}
let userMap = {}
let leaveRequestMap = new Map();

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
showCarryModeStatus()   // 🔥 ADD THIS
loadStats()
loadEmployees()
loadLeaveRequests()

// 🔥 IMPORTANT FIX
await loadUsersOnce()
loadLeaveBalance()

loadNotifications(user)

})



// ===============================
// AUTO RESET LEAVE CYCLE
// ===============================

async function autoResetLeaveCycle(){

  const settingsRef = db.collection("leave_settings").doc("cycle");
  const docSnap = await settingsRef.get();

  if(!docSnap.exists) return;

  const data = docSnap.data();

  const startMonth = parseInt(data.startMonth);
  const lastResetYear = data.lastResetYear || 0;
  const lastResetMonth = data.lastResetMonth || 0;

  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  const runYearly = currentMonth === startMonth && lastResetYear !== currentYear;
  const runMonthly = lastResetMonth !== currentMonth;

  if(!runYearly && !runMonthly) return;

  console.log("🤖 AUTO Carry Forward Running...");
console.log("🔄 Running new cycle reset...");

  const leaveTypesSnapshot = await db.collection("leave_types").get();

  const usersSnapshot = await db.collection("users")
    .where("role","==","employee")
    .where("status","==","approved")
    .get();

  // 🔥 CYCLE RANGE (IMPORTANT)
  const cycleStart = new Date(currentYear - 1, startMonth - 1, 1);
  const cycleEnd = new Date(currentYear, startMonth - 1, 0);

  for(const userDoc of usersSnapshot.docs){

    const uid = userDoc.id;
    let carryData = {};
    let newBalance = {};

    // 🔥 GET USER LEAVES
    const leaveSnapshot = await db.collection("leaves")
      .where("userId","==",uid)
      .where("status","==","approved")
      .get();

    let leaveMap = {};

    leaveSnapshot.forEach(doc=>{
      let d = doc.data();

      if(!leaveMap[d.leaveType]){
        leaveMap[d.leaveType] = [];
      }

      leaveMap[d.leaveType].push(d);
    });

    // ===============================
    // PROCESS EACH LEAVE TYPE
    // ===============================
    leaveTypesSnapshot.forEach(typeDoc => {

      const type = typeDoc.data();
      const name = type.name;
      const max = parseInt(type.max_days) || 0;
      const settings = type.settings || {};

      let carry = 0;
      let finalBalance = max;

      // ❌ skip if carry disabled
      if(settings.carryForward !== true){
        newBalance[name] = max;
        return;
      }

      let startDate = new Date(cycleStart);
      let endDate = new Date(cycleEnd);

      // 🔥 MONTHLY MODE
      if(settings.carryType === "monthly"){

        if(settings.monthlyEnabled !== true){
          newBalance[name] = max;
          return;
        }

        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth()+1, 0);
      }

      let usedDates = new Set();
      let leaves = leaveMap[name] || [];

      leaves.forEach(l => {

        let leaveStart = new Date(l.startDate);
        let leaveEnd = new Date(l.endDate);

        if(leaveEnd < startDate || leaveStart > endDate) return;

        let current = new Date(leaveStart);

        while(current <= leaveEnd){

          if(current >= startDate && current <= endDate){
            usedDates.add(current.toISOString().split("T")[0]);
          }

          current.setDate(current.getDate()+1);
        }

      });

      let used = usedDates.size;
      let remaining = Math.max(0, max - used);

      // ❌ IMPORTANT FIX (your bug)
      if(leaves.length === 0 || remaining <= 0){
        carry = 0;
        finalBalance = max;
      }else{

      if(settings.carryRemaining === true){

  // ✅ FULL carry forward
  carry = remaining;

}else{

  let maxCarry = settings.carryForwardMax ?? remaining;

  if(settings.carryForwardMax === 0){
    carry = 0;
  }else{
    carry = Math.min(remaining, maxCarry);
  }

}

        // 🔵 YEARLY
        if(settings.carryType !== "monthly" && runYearly){
          finalBalance = max + carry;
        }

        // 🟢 MONTHLY
        else if(settings.carryType === "monthly" && runMonthly){
          let monthlyAdd = max / 12;
          finalBalance = Math.floor(max + carry + monthlyAdd);
        }

        else{
          finalBalance = max;
        }

      }

      carryData[name] = carry;
      newBalance[name] = finalBalance;

    });

    // ===============================
    // UPDATE USER
    // ===============================
    await db.collection("users").doc(uid).update({
      leave_balance: newBalance,
      carry_forward: carryData,
      lastCarryForward: firebase.firestore.FieldValue.serverTimestamp()
    });

    // ===============================
    // NOTIFICATION
    // ===============================
    await db.collection("notifications").add({
      userId: uid,
      role: "employee",
      type: "carry_forward",
      message: "📅 Your leave balance updated with carry forward",
      read: false,
      hidden: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

  }

  // ===============================
  // SAVE SYSTEM STATE
  // ===============================
  await settingsRef.update({
    lastResetYear: runYearly ? currentYear : lastResetYear,
    lastResetMonth: currentMonth
  });

  console.log("✅ New carry forward system executed");

}

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

let rowMap = {} // 🔥 store rows by userId

db.collection("users")
.where("role","==","employee")
.onSnapshot(snapshot=>{

snapshot.docChanges().forEach(change=>{

const doc = change.doc
const data = doc.data()
const id = doc.id

// ===============================
// BUILD ROW FUNCTION
// ===============================
function createRow(){

let status = data.status || "pending"

let action = ""
let statusBadge = ""

// STATUS
if(status === "approved"){
    statusBadge = `<span style="color:green;font-weight:bold;">Approved</span>`
}
else if(status === "pending"){
    statusBadge = `<span style="color:orange;font-weight:bold;">Pending</span>`
}
else if(status === "deleted"){
    statusBadge = `<span style="color:red;font-weight:bold;">Deleted</span>`
}
else return null

// ACTIONS
if(status === "pending"){
    action = `
        <button onclick="approveEmployee('${id}')">Approve</button>
        <button onclick="rejectEmployee('${id}')">Reject</button>
    `
}
else if(status === "approved"){
    action = `
<div style="display:flex;align-items:center;gap:12px;">
    <button onclick="resetLeave('${id}')">🔄</button>

    <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:12px;">Probation</span>

        <label class="switch">
            <input type="checkbox"
                ${data.probation === true ? "checked" : ""}
                onchange="setProbation('${id}', this.checked)">
            <span class="slider"></span>
        </label>
    </div>

    <button onclick="deleteEmployee('${id}')">🗑</button>
</div>
`
}
else if(status === "deleted"){
    action = `
        <button onclick="restoreEmployee('${id}')">♻ Restore</button>
        <button onclick="permanentDeleteEmployee('${id}')">❌ Delete</button>
    `
}

// EXTRA STATUS
let extraStatus = ""
if(status === "approved"){
    extraStatus = data.probation
        ? "<span style='color:orange;'>🟡 Probation</span>"
        : "<span style='color:green;'>🟢 Confirmed</span>"
}

// CREATE TR
let tr = document.createElement("tr")
tr.innerHTML = `
<td>${data.name}</td>
<td>${data.email}</td>
<td>
  ${statusBadge}
  <br>${extraStatus}
</td>
<td>${action}</td>
`

return tr
}

// ===============================
// HANDLE CHANGES
// ===============================

// 🟢 ADDED
if(change.type === "added"){

    let tr = createRow()
    if(!tr) return

    tr.classList.add("fade-in")

    rowMap[id] = tr
    employeeTable.appendChild(tr)
}

// 🟡 MODIFIED
else if(change.type === "modified"){

    let oldRow = rowMap[id]
    if(oldRow){

        let newRow = createRow()
        if(!newRow) return

        newRow.classList.add("fade-in")

        employeeTable.replaceChild(newRow, oldRow)
        rowMap[id] = newRow
    }
}

// 🔴 REMOVED
else if(change.type === "removed"){

    let row = rowMap[id]
    if(row){
        row.remove()
        delete rowMap[id]
    }
}

})

})
}

// ===============================
// APPROVE EMPLOYEE
// ===============================
let approvingUsers = new Set(); // 🔥 prevent spam clicks

async function approveEmployee(uid) {

    if (approvingUsers.has(uid)) return; // 🚫 already processing

    if (!confirm("Approve employee and set probation?")) return;

    approvingUsers.add(uid);

    try {

        const userRef = db.collection("users").doc(uid);

        // ===============================
        // 🔥 TRANSACTION (VERY IMPORTANT)
        // ===============================
        await db.runTransaction(async (transaction) => {

            const userSnap = await transaction.get(userRef);

            if (!userSnap.exists) {
                throw new Error("User not found");
            }

            const userData = userSnap.data();

            // 🚫 SAFE CHECK (atomic)
            if (userData.status === "approved") {
                throw new Error("Already approved");
            }

            // 🔥 get leave types (outside transaction is better but safe here small scale)
            const leaveTypesSnapshot = await db.collection("leave_types").get();

            if (leaveTypesSnapshot.empty) {
                throw new Error("No leave types found");
            }

            let leaveBalance = {};

            leaveTypesSnapshot.forEach(doc => {
                const leave = doc.data();
                leaveBalance[leave.name] = parseInt(leave.max_days) || 0;
            });

            // ✅ update inside transaction
            transaction.update(userRef, {
                status: "approved",
                probation: true,
                leave_balance: leaveBalance,
                approvedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

        });

        // ===============================
        // 🔔 NOTIFICATION (after success)
        // ===============================
        await db.collection("notifications").add({
            userId: uid,
            role: "employee",
            type: "account_approved",
            message: "🎉 Your account has been approved. You can now apply for leave.",
            read: false,
            hidden: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // ✅ better UX
        showToast("✅ Employee approved");

    } catch (error) {

        console.error("Approve Error:", error);

        if (error.message === "Already approved") {
            showToast("⚠ Already approved");
        } else {
            showToast("❌ Failed to approve");
        }

    } finally {
        approvingUsers.delete(uid); // 🔓 unlock button
    }
}

// ===============================
// REJECT EMPLOYEE
// ===============================

let rejectingUsers = new Set(); // 🔥 prevent spam

async function rejectEmployee(uid){

    if (rejectingUsers.has(uid)) return;

    if (!confirm("Reject this employee?")) return;

    rejectingUsers.add(uid);

    try {

        const userRef = db.collection("users").doc(uid);

        // ===============================
        // 🔥 TRANSACTION (SAFE)
        // ===============================
        await db.runTransaction(async (transaction) => {

            const userSnap = await transaction.get(userRef);

            if (!userSnap.exists) {
                throw new Error("User not found");
            }

            const data = userSnap.data();

            // 🚫 prevent invalid state change
            if (data.status === "rejected") {
                throw new Error("Already rejected");
            }

            if (data.status === "approved") {
                throw new Error("Already approved");
            }

            transaction.update(userRef, {
                status: "rejected",
                rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

        });

        // ===============================
        // 🔔 NOTIFICATION
        // ===============================
        await db.collection("notifications").add({
            userId: uid,
            role: "employee",
            type: "account_rejected",
            message: "❌ Your account has been rejected",
            read: false,
            hidden: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // ✅ smooth UX
        showToast("❌ Employee rejected");

    } catch (error) {

        console.error(error);

        if (error.message === "Already rejected") {
            showToast("⚠ Already rejected");
        } 
        else if (error.message === "Already approved") {
            showToast("⚠ Cannot reject approved user");
        }
        else {
            showToast("❌ Failed to reject");
        }

    } finally {
        rejectingUsers.delete(uid); // 🔓 unlock
    }
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

let leaveRowMap = new Map();   // 🔥 cache rows

function loadLeaveRequests(){

const leaveTable = document.getElementById("leaveRequests")
if(!leaveTable) return

const totalElement = document.getElementById("totalLeaveRequests")
const insightBox = document.getElementById("aiInsight")

db.collection("leaves")
.orderBy("createdAt","desc")
.onSnapshot(snapshot=>{

let leaveCount = {}
let count = 0

snapshot.docChanges().forEach(change=>{

const doc = change.doc
const data = doc.data()
const id = doc.id

// ===============================
// CALCULATE DAYS
// ===============================
let totalDays = 0
if(data.startDate && data.endDate){
    totalDays = calculateDays(data.startDate, data.endDate)
}

// ===============================
// AI TRACKING
// ===============================
leaveCount[data.userId] = (leaveCount[data.userId] || 0) + 1
userMap[data.userId] = data.name

// ===============================
// BUILD ROW FUNCTION
// ===============================
function createRow(){

let action = ""
let aiSuggestion = ""

// 🤖 AI Suggestion
if(totalDays <= 2){
    aiSuggestion = `<span style="color:green;font-size:12px;">✅ Safe</span>`
}
else if(totalDays >= 5){
    aiSuggestion = `<span style="color:red;font-size:12px;">⚠️ Review</span>`
}

// ACTION
if(data.status === "pending"){
    action = `
    <button onclick="approveLeave('${id}')">Approve</button>
    <button onclick="rejectLeave('${id}')">Reject</button>
    <button onclick="deleteLeave('${id}')">Delete</button>
    <br>${aiSuggestion}
    `
}else{
    action = `<button onclick="deleteLeave('${id}')">Delete</button>`
}

// STATUS FIX ✅
let statusBadge = ""
if(data.status === "approved"){
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

// CREATE ROW
let tr = document.createElement("tr")
tr.id = "leave-"+id

tr.innerHTML = `
<td>${data.name}</td>
<td>${data.leaveType}</td>
<td>${data.startDate}</td>
<td>${data.endDate}</td>
<td>${totalDays}</td>
<td>${data.department || "-"}</td>
<td>${data.reason}</td>
<td>${data.adjustment || "-"}</td>
<td>${statusBadge}</td>
<td>${action}</td>
`

return tr
}

// ===============================
// HANDLE CHANGES
// ===============================

// 🟢 ADDED
if(change.type === "added"){

let tr = createRow()
tr.classList.add("fade-in")

leaveRowMap.set(id, tr)
leaveTable.prepend(tr)   // latest on top
}

// 🟡 MODIFIED
else if(change.type === "modified"){

let oldRow = leaveRowMap.get(id)
if(oldRow){

let newRow = createRow()
newRow.classList.add("fade-in")

leaveTable.replaceChild(newRow, oldRow)
leaveRowMap.set(id, newRow)
}
}

// 🔴 REMOVED
else if(change.type === "removed"){

let row = leaveRowMap.get(id)
if(row){
row.remove()
leaveRowMap.delete(id)
}
}

})

// ===============================
// UPDATE COUNT
// ===============================
count = leaveRowMap.size

if(totalElement){
    totalElement.innerText = count
}

// ===============================
// AI INSIGHT (FIXED)
// ===============================
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

let carry = user.carry_forward?.[type] || 0;

let remaining = (maxAllowed + carry) - usedDays;

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

// 🔥 GLOBAL CACHE (add at top of file)
let userCache = []

// 🔥 LOAD USERS ONCE
async function loadUsersOnce(){
    const snapshot = await db.collection("users")
    .where("role","==","employee")
    .get()

    userCache = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }))
}

// ===============================
// LOAD LEAVE BALANCE (OPTIMIZED)
// ===============================

let balanceRowMap = new Map()
let balanceCardMap = new Map()

async function loadLeaveBalance(){

const header = document.getElementById("leaveHeader")
const table = document.getElementById("leaveBalanceTable")
const cards = document.getElementById("leaveBalanceCards")

if(!header || !table) return

header.innerHTML = `<th>Employee</th><th>Email</th>`

// ===============================
// 1. GET LEAVE TYPES (ONCE)
// ===============================
const leaveTypesSnapshot = await db.collection("leave_types").get()

let leaveTypes = []

leaveTypesSnapshot.forEach(doc=>{
    const data = doc.data()

    leaveTypes.push({
        name: data.name,
        max: parseInt(data.max_days) || 0,
        settings: data.settings || {}
    })

    header.innerHTML += `<th>${data.name}</th>`
})

// ===============================
// 2. REAL-TIME LEAVE LISTENER
// ===============================
db.collection("leaves")
.where("status","==","approved")
.onSnapshot((leaveSnap)=>{

let leaveMap = {}

leaveSnap.forEach(doc=>{
    let d = doc.data()

    if(!leaveMap[d.userId]) leaveMap[d.userId] = {}
    if(!leaveMap[d.userId][d.leaveType]) leaveMap[d.userId][d.leaveType] = []

    leaveMap[d.userId][d.leaveType].push(d)
})

// ===============================
// LOOP USERS
// ===============================
for(const user of userCache){

const uid = user.id
let carryData = user.carry_forward || {}

let rowHTML = `
<tr>
<td>${user.name}</td>
<td>${user.email}</td>
`

let cardHTML = `
<div class="leave-card">
<h3>${user.name}</h3>
<p>${user.email}</p>
`

// ===============================
// LOOP LEAVE TYPES
// ===============================
for(const leave of leaveTypes){

let leaves = leaveMap[uid]?.[leave.name] || []

let uniqueDates = new Set()

leaves.forEach(l=>{
    let current = new Date(l.startDate)
    let end = new Date(l.endDate)

    while(current <= end){
        uniqueDates.add(current.toISOString().split("T")[0])
        current.setDate(current.getDate()+1)
    }
})

let used = uniqueDates.size

const max = leave.max
let settings = leave.settings || {}
let isCarryEnabled = settings.carryForward === true

let carry = 0

if(isCarryEnabled){
    let rawCarry = carryData[leave.name] || 0
    if(rawCarry > 0 && used > 0){
        carry = rawCarry
    }
}

let total = isCarryEnabled ? (max + carry) : max
let remaining = Math.max(0, total - used)

let percent = max > 0 ? (used / max) * 100 : 0
if(percent > 100) percent = 100

// STATUS
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
// TABLE UI
// ===============================
rowHTML += `
<td data-label="${leave.name}">
<b>${total}</b> / ${remaining}
<br>
${
isCarryEnabled
? `<small style="color:green;">📦 +${carry}</small>`
: `<small style="color:#999;">—</small>`
}
</td>
`

// ===============================
// CARD UI
// ===============================
cardHTML += `
<div class="leave-item">

<div style="font-size:13px;font-weight:600;color:#333;margin-bottom:4px;">
<div class="leave-name">${leave.name}</div>
</div>

<div class="leave-top">
<span>Total: ${total}</span>
<span>Remaining: ${remaining}</span>
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

// CLOSE
rowHTML += `</tr>`
cardHTML += `</div>`

// ===============================
// UPDATE TABLE (NO CLEAR)
// ===============================
let existingRow = balanceRowMap.get(uid)

let temp = document.createElement("tbody")
temp.innerHTML = rowHTML
let newRow = temp.firstElementChild

if(existingRow){
    table.replaceChild(newRow, existingRow)
}else{
    table.appendChild(newRow)
}

balanceRowMap.set(uid, newRow)

// ===============================
// UPDATE CARDS (MOBILE)
// ===============================
if(cards){

let existingCard = balanceCardMap.get(uid)

let div = document.createElement("div")
div.innerHTML = cardHTML
let newCard = div.firstElementChild

if(existingCard){
    cards.replaceChild(newCard, existingCard)
}else{
    cards.appendChild(newCard)
}

balanceCardMap.set(uid, newCard)

}

}

})
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
toast.className = "toast fade-in"
toast.innerText = message

document.body.appendChild(toast)

setTimeout(()=>{
    toast.style.opacity = "0"
    toast.style.transform = "translateY(10px)"
},2500)

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

async function showCarryModeStatus(){

  const box = document.getElementById("carryModeStatus")
  if(!box) return

  try{

    const doc = await db.collection("leave_settings").doc("cycle").get()
    if(!doc.exists) return

    const data = doc.data()

    const mode = data.carryMode || "manual"
    const startMonth = parseInt(data.startMonth)

    const today = new Date()
    const currentYear = today.getFullYear()

    // ===============================
    // LAST RUN (USING YOUR FIELD)
    // ===============================
    let lastRunText = "Not yet executed"

    if(data.lastCarryForwardRun){
      lastRunText = new Date(data.lastCarryForwardRun).toLocaleString()
    }

    // ===============================
    // NEXT RUN
    // ===============================
    let nextRun = new Date(currentYear, startMonth - 1, 1)

    if(today > nextRun){
      nextRun = new Date(currentYear + 1, startMonth - 1, 1)
    }

    let nextRunText = nextRun.toDateString()

    // ===============================
    // STATUS
    // ===============================
    let status = ""

    if(mode === "auto"){
      status = data.lastCarryForwardRun
        ? "🟢 Automatic system active"
        : "⚠ Not executed yet"
    }else{
      status = "🟡 Manual execution required"
    }

    // ===============================
    // UI DESIGN
    // ===============================
    box.style.display = "block"

    if(mode === "auto"){
      box.style.background = "#e3f2fd"
      box.style.color = "#0d47a1"
    }else{
      box.style.background = "#fff3cd"
      box.style.color = "#856404"
    }

    box.innerHTML = `
      <div style="font-size:16px;">
        ${mode === "auto" ? "🤖 AUTOMATIC MODE" : "⚙ MANUAL MODE"}
      </div>

      <div style="margin-top:6px;">
        <b>Last Run:</b> ${lastRunText}
      </div>

      <div>
        <b>Next Run:</b> ${nextRunText}
      </div>

      <div style="margin-top:4px;">
        <b>Status:</b> ${status}
      </div>
    `

  }catch(error){
    console.log(error)
  }

}
