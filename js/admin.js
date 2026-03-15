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
}

})



// ===============================
// DASHBOARD STATISTICS
// ===============================

function loadStats(){

// total employees
db.collection("users")
.where("role","==","employee")
.get()
.then(snapshot=>{
document.getElementById("totalEmployees").innerText = snapshot.size
})


// total leaves
db.collection("leaves")
.get()
.then(snapshot=>{
document.getElementById("totalLeaves").innerText = snapshot.size
})


// pending leaves
db.collection("leaves")
.where("status","==","pending")
.get()
.then(snapshot=>{
document.getElementById("pendingLeaves").innerText = snapshot.size
})

}

loadStats()



// ===============================
// LOAD EMPLOYEES
// ===============================

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

<button onclick="approveEmployee('${doc.id}')">
Approve
</button>

<button onclick="rejectEmployee('${doc.id}')">
Reject
</button>

<button onclick="resetLeave('${doc.id}')">
Reset Leave
</button>

</td>

</tr>
`

employeeTable.innerHTML += row

})

})



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

leave_balance: {
"Casual Leave": 10,
"Sick Leave": 10,
"Earned Leave": 10
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

const leaveTable = document.getElementById("leaveRequests")

db.collection("leaves")
.orderBy("createdAt","desc")
.onSnapshot(snapshot=>{

leaveTable.innerHTML=""

snapshot.forEach(doc=>{

let data = doc.data()

let action="";

if(data.status=="pending"){
action=`
<button onclick="approveLeave('${doc.id}')">Approve</button>
<button onclick="rejectLeave('${doc.id}')">Reject</button>
<button onclick="deleteLeave('${doc.id}')">Delete</button>
`;
}else{
action=`
<button onclick="deleteLeave('${doc.id}')">Delete</button>
`;
}

let row = `
<tr>
<td>${data.name}</td>
<td>${data.leaveType}</td>
<td>${data.startDate}</td>
<td>${data.endDate}</td>
<td>${data.reason}</td>
<td>${data.status}</td>
<td>${action}</td>
</tr>
`

leaveTable.innerHTML += row

})

})

async function loadLeaveBalance(){

const header = document.getElementById("leaveHeader")
const table = document.getElementById("leaveBalanceTable")

// load leave types
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


// load employees
const usersSnapshot = await db.collection("users")
.where("role","==","employee")
.get()

table.innerHTML=""

for(const userDoc of usersSnapshot.docs){

let user=userDoc.data()
let uid=userDoc.id

let row=`
<tr>
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

loadLeaveBalance()

// ===============================
// APPROVE LEAVE
// ===============================
function approveLeave(id){

db.collection("leaves").doc(id).get().then(doc=>{

let data = doc.data()

let uid = data.userId
let type = data.leaveType

let field = `leave_balance.${type}`

db.collection("users").doc(uid).update({

[field]: firebase.firestore.FieldValue.increment(-1)

})

})

db.collection("leaves").doc(id).update({

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

.then(()=>{
alert("Leave rejected")
})

}

// ===============================
// DELETE LEAVE
// ===============================

function deleteLeave(id){

if(confirm("Delete this leave request?")){

db.collection("leaves").doc(id).delete()
.then(()=>{

alert("Leave request deleted")

})
.catch(error=>{
console.log(error)
})

}

}

// ===============================
// LOGOUT
// ===============================

function logout(){

auth.signOut().then(()=>{

window.location.href="login.html"

})

}