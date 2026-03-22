// ===========================
// CHECK LOGIN
// ===========================

auth.onAuthStateChanged(function(user){

if(!user){
window.location = "login.html"
return
}

loadLeaveHistory(user.uid)

})



// ===========================
// LOAD LEAVE HISTORY
// ===========================

function loadLeaveHistory(uid){

const table = document.getElementById("leaveTable")

db.collection("leaves")
.where("userId","==",uid)
.get()
.then((snapshot)=>{

table.innerHTML=""

snapshot.forEach((doc)=>{

let data = doc.data()

let start = new Date(data.startDate)
let end = new Date(data.endDate)

let days = Math.ceil((end-start)/(1000*60*60*24))+1

let statusClass = "status-" + data.status

let action=""

if(data.status==="pending"){
action=`<button onclick="cancelLeave('${doc.id}')">Cancel</button>`
}else{
action="-"
}

let row = `
<tr>
<td data-label="Leave Type">${data.leaveType}</td>
<td data-label="Start Date">${data.startDate}</td>
<td data-label="End Date">${data.endDate}</td>
<td data-label="Days">${days}</td>
<td data-label="Reason">${data.reason}</td>
<td data-label="Status">${data.status}</td>
<td data-label="Action">${action}</td>
</tr>
`

table.innerHTML += row

})

})

}



// ===========================
// CANCEL LEAVE
// ===========================

function cancelLeave(id){

if(!confirm("Cancel this leave request?")) return

db.collection("leaves").doc(id).update({
status:"cancelled"
}).then(()=>{
location.reload()
})

}
