// =============================
// CHECK LOGIN
// =============================

// =============================
// CHECK LOGIN (SECURE)
// =============================

auth.onAuthStateChanged(async function(user){

if(!user){
    window.location.href = "login.html"
    return
}

const doc = await db.collection("users").doc(user.uid).get()

if(!doc.exists){
    await auth.signOut()
    window.location.href = "login.html"
    return
}

const data = doc.data()

// 🚫 BLOCK NON-EMPLOYEE
if(data.role !== "employee"){
    alert("Access denied")
    await auth.signOut()
    window.location.href = "login.html"
    return
}

// 🚫 BLOCK NON-APPROVED USERS (THIS IS YOUR LINE)
if(data.status !== "approved"){
    alert("Your account is not approved or has been removed")
    await auth.signOut()
    window.location.href = "login.html"
    return
}

// ✅ ALLOW ACCESS
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
function loadNotifications(){

    const list = document.getElementById("notificationList")

    auth.onAuthStateChanged(user => {

        if(!user) return

        db.collection("notifications")
        .where("userId", "==", user.uid)
        .orderBy("createdAt", "desc")
        .onSnapshot(snapshot => {

            list.innerHTML = ""

            snapshot.forEach(doc => {

                let data = doc.data()

                let li = document.createElement("li")
                li.className = "notification-item"

            li.innerHTML = `
    <div class="notif-left">
        <span>${data.message}</span>
        <small>
            ${data.createdAt 
                ? data.createdAt.toDate().toLocaleString() 
                : ""}
        </small>
    </div>

    <button class="delete-btn" onclick="deleteNotification('${doc.id}', event)">
        <i class="fa fa-trash"></i>
    </button>
`

                // unread bold
                if(data.status === "unread"){
                    li.style.fontWeight = "bold"
                }

                // mark as read
                li.addEventListener("click", () => {
                    db.collection("notifications").doc(doc.id).update({
                        status: "read"
                    })
                })

                list.appendChild(li)
            })
        })
    })
}
function loadNotificationCount(){

    const countEl = document.getElementById("notifCount")

    auth.onAuthStateChanged(user => {

        if(!user) return

        db.collection("notifications")
        .where("userId", "==", user.uid)
        .where("status", "==", "unread")
        .onSnapshot(snapshot => {
            countEl.textContent = snapshot.size
        })
    })
}
function toggleNotifBox(){

    const box = document.getElementById("notifBox")

    if(box.style.display === "block"){
        box.style.display = "none"
    } else {
        box.style.display = "block"
    }
}
document.addEventListener("DOMContentLoaded", () => {
    loadNotifications()
    loadNotificationCount()
})
function deleteNotification(id, e){

    e.stopPropagation() // stop click conflict

    if(!confirm("Delete this notification?")) return

    const item = e.target.closest("li")

    if(item){
        item.style.opacity = "0.5"
    }

    db.collection("notifications")
    .doc(id)
    .delete()
    .then(()=>{
        console.log("Deleted")
    })
    .catch(error=>{
        console.log(error)
    })
}
