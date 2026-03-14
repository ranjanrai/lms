// ==========================
// LOAD ALL LEAVE REQUESTS
// ==========================

function loadLeaveRequests(){

db.collection("leave_requests")
.orderBy("applied_at","desc")
.onSnapshot(snapshot => {

let html=""

snapshot.forEach(doc => {

let data = doc.data()

html += `
<tr>

<td>${data.user_id}</td>
<td>${data.leave_type}</td>
<td>${data.start_date}</td>
<td>${data.end_date}</td>
<td>${data.reason}</td>
<td>${data.status}</td>

<td>

<button onclick="approveLeave('${doc.id}')">Approve</button>

<button onclick="rejectLeave('${doc.id}')">Reject</button>

</td>

</tr>
`

})

document.getElementById("leaveRequests").innerHTML = html

})

}

loadLeaveRequests()



// ==========================
// APPROVE LEAVE
// ==========================

function approveLeave(id){

db.collection("leave_requests")
.doc(id)
.update({
status:"approved"
})

.then(()=>{

alert("Leave Approved")

})

}



// ==========================
// REJECT LEAVE
// ==========================

function rejectLeave(id){

db.collection("leave_requests")
.doc(id)
.update({
status:"rejected"
})

.then(()=>{

alert("Leave Rejected")

})

}



// ==========================
// LOAD EMPLOYEES
// ==========================

function loadEmployees(){

db.collection("users")
.where("role","==","employee")
.onSnapshot(snapshot => {

let html=""

snapshot.forEach(doc => {

let data = doc.data()

html += `
<tr>

<td>${data.name}</td>
<td>${data.email}</td>
<td>${data.status}</td>

<td>

<button onclick="approveEmployee('${doc.id}')">
Approve
</button>

</td>

</tr>
`

})

document.getElementById("employeeTable").innerHTML = html

})

}



// ==========================
// APPROVE EMPLOYEE
// ==========================

function approveEmployee(id){

db.collection("users")
.doc(id)
.update({

status:"approved"

})

.then(()=>{

alert("Employee Approved")

})

}



// ==========================
// ADD LEAVE TYPE
// ==========================

function addLeaveType(){

let name = document.getElementById("leaveName").value
let days = document.getElementById("maxDays").value
let description = document.getElementById("description").value

db.collection("leave_types").add({

name:name,
max_days:days,
description:description

})

.then(()=>{

alert("Leave Type Added")

})

}



// ==========================
// ADD HOLIDAY
// ==========================

function addHoliday(){

let name = document.getElementById("holidayName").value
let date = document.getElementById("holidayDate").value
let description = document.getElementById("holidayDescription").value

db.collection("holidays").add({

holiday_name:name,
holiday_date:date,
description:description

})

.then(()=>{

alert("Holiday Added")

})

}



// ==========================
// LOGOUT
// ==========================

function logout(){

firebase.auth().signOut().then(()=>{

window.location="login.html"

})

}