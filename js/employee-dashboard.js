// =============================
// CHECK LOGIN
// =============================

auth.onAuthStateChanged(function(user){
loadEmployeeName(user.uid)
if(!user){
window.location.href = "login.html"
return
}

const uid = user.uid

loadDashboard(uid)
loadLeaveBalance(uid)

})


// =============================
// LOAD DASHBOARD DATA
// =============================

function loadDashboard(uid){

let total = 0
let pending = 0
let approved = 0

const table = document.getElementById("leaveTable")

db.collection("leaves")
.where("userId","==",uid)
.onSnapshot(snapshot=>{

table.innerHTML = ""

total = 0
pending = 0
approved = 0

snapshot.forEach(doc=>{

let data = doc.data()

total++

if(data.status === "pending"){
pending++
}

if(data.status === "approved"){
approved++
}

let row = `
<tr>
<td>${data.leaveType}</td>
<td>${data.startDate}</td>
<td>${data.endDate}</td>
<td>${data.status}</td>
</tr>
`

table.innerHTML += row

})

document.getElementById("totalLeaves").innerText = total
document.getElementById("pendingLeaves").innerText = pending
document.getElementById("approvedLeaves").innerText = approved

})

}



// =============================
// LOAD LEAVE BALANCE
// =============================

function loadLeaveBalance(uid){

const table = document.getElementById("leaveBalanceTable")

table.innerHTML = ""

db.collection("leave_types").get().then(typeSnapshot=>{

typeSnapshot.forEach(typeDoc=>{

let typeData = typeDoc.data()

let leaveName = typeData.name

// get max leave from admin created leave type
let maxLeave = Number(typeData.max_days || 0)

db.collection("leaves")
.where("userId","==",uid)
.where("leaveType","==",leaveName)
.where("status","==","approved")
.get()
.then(snapshot=>{

let used = snapshot.size

// prevent negative value
let remaining = Math.max(0 , maxLeave - used)

let row = `
<tr>
<td>${leaveName}</td>
<td>${maxLeave}</td>
<td>${used}</td>
<td>${remaining}</td>
</tr>
`

table.innerHTML += row

})

})

})

}