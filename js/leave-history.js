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

<td>${data.leaveType}</td>
<td>${data.startDate}</td>
<td>${data.endDate}</td>
<td>${days}</td>
<td>${data.reason}</td>
<td class="${statusClass}">${data.status}</td>
<td>${action}</td>

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