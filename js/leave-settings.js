// ===============================
// SAVE OR UPDATE LEAVE SETTINGS
// ===============================

function saveLeaveSettings(){

let startMonth = document.getElementById("startMonth").value
let startYear = document.getElementById("startYear").value

let endMonth = document.getElementById("endMonth").value
let endYear = document.getElementById("endYear").value

let monthlyLimit = document.getElementById("monthlyLimit").value

let monthlyLimitEnabled =
document.getElementById("monthlyLimitEnabled").value === "true"


db.collection("leave_settings")
.doc("cycle")
.set({

startMonth:startMonth,
startYear:startYear,
endMonth:endMonth,
endYear:endYear,
monthlyLimit:monthlyLimit,
monthlyLimitEnabled:monthlyLimitEnabled

})
.then(()=>{

let msg = document.getElementById("successMsg")

msg.style.display="block"

setTimeout(()=>{
msg.style.display="none"
},3000)
loadLeaveSettings() // refresh table
})
.catch((error)=>{

console.log(error)
alert("Error saving settings")

})

}



// ===============================
// LOAD SETTINGS
// ===============================

// ===============================
// LOAD SETTINGS
// ===============================

function loadLeaveSettings(){

db.collection("leave_settings")
.doc("cycle")
.get()
.then((doc)=>{

const table = document.getElementById("leaveSettingsTable")

if(doc.exists){

let data = doc.data()

// Fill form
document.getElementById("startMonth").value = data.startMonth || ""
document.getElementById("startYear").value = data.startYear || ""
document.getElementById("endMonth").value = data.endMonth || ""
document.getElementById("endYear").value = data.endYear || ""
document.getElementById("monthlyLimit").value = data.monthlyLimit || ""
document.getElementById("monthlyLimitEnabled").value =
data.monthlyLimitEnabled ? "true" : "false"


// Update table
table.innerHTML = `
<tr>
<td>${data.startMonth}</td>
<td>${data.startYear}</td>
<td>${data.endMonth}</td>
<td>${data.endYear}</td>
<td>${data.monthlyLimit}</td>
<td>${data.monthlyLimitEnabled ? "Enabled" : "Disabled"}</td>
</tr>
`

}

})
.catch((error)=>{
console.log(error)
})

}



// ===============================
// AUTO LOAD SETTINGS
// ===============================

document.addEventListener("DOMContentLoaded",function(){

loadLeaveSettings()

})
