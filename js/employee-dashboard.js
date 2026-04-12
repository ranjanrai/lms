

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



// ============================
// PROBATION STATUS
// ============================

const banner = document.getElementById("probationBanner")

if(data.probation === true){

    banner.style.display = "block"
    banner.style.background = "#fff3cd"
    banner.style.color = "#856404"
    banner.innerHTML = "🟡 You are currently on probation. Leave limits may apply."

}else{

    banner.style.display = "block"
    banner.style.background = "#d4edda"
    banner.style.color = "#155724"
    banner.innerHTML = "🟢 You are a confirmed employee."

}

if(data.probation === true){

    banner.style.display = "block"
    banner.style.background = "#fff3cd"
    banner.style.color = "#856404"
    banner.innerHTML = "🟡 You are on probation. Leave limits apply."

}else{
    banner.style.display = "none"
}
if(data.probation === undefined){
    data.probation = false
}

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
// ✅ ADD THESE HERE
loadNotifications(uid)
loadNotificationCount(uid)
// ✅ ADD THIS
loadLeaveInstructions()

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

let start = new Date(data.startDate)
let end = new Date(data.endDate)

// calculate days
let diffTime = end - start
let days = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1

let row = `
<tr>
<td>${data.leaveType}</td>
<td>${data.startDate}</td>
<td>${data.endDate}</td>
<td>${days}</td>   <!-- ✅ SHOW DAYS -->
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
// LOAD LEAVE BALANCE (OPTIMIZED)
// =============================

async function loadLeaveBalance(uid){

    const table = document.getElementById("leaveBalanceTable");
    table.innerHTML = "";

    try {

        // 🔥 0. GET USER DATA (FIXED)
        const userDoc = await db.collection("users").doc(uid).get()
        const userData = userDoc.data() || {}

        const carryData = userData.carry_forward || {}

        // 🔥 1. Get all leave types
        const typeSnapshot = await db.collection("leave_types").get();

        // 🔥 2. Get all approved leaves (ONLY ONCE)
        const leaveSnapshot = await db.collection("leaves")
            .where("userId","==",uid)
            .where("status","==","approved")
            .get();

        // 🔥 3. Group leaves by type
        let leaveMap = {}

        leaveSnapshot.forEach(doc => {
            let data = doc.data()

            if(!leaveMap[data.leaveType]){
                leaveMap[data.leaveType] = []
            }

            leaveMap[data.leaveType].push(data)
        })

        // 🔥 4. Loop each leave type
        for(const typeDoc of typeSnapshot.docs){

            let typeData = typeDoc.data()
            let leaveName = typeData.name
            let maxLeave = Number(typeData.max_days || 0)

            let leaves = leaveMap[leaveName] || []
            let uniqueDates = new Set()

            // 🔥 calculate used days
            leaves.forEach(d => {

                let current = new Date(d.startDate)
                let end = new Date(d.endDate)

                while (current <= end) {
                    let dateStr = current.toISOString().split("T")[0]
                    uniqueDates.add(dateStr)
                    current.setDate(current.getDate() + 1)
                }
            })

            let used = uniqueDates.size

            // 🔥 SETTINGS
            let settings = typeData.settings || {}

let isCarryEnabled = settings.carryForward === true

let carryType = settings.carryType === "monthly" ? "Monthly" : "Yearly"

// ✅ ONLY APPLY IF ENABLED
let carry = isCarryEnabled ? (carryData[leaveName] || 0) : 0

// ✅ TOTAL FIX
let totalWithCarry = isCarryEnabled ? (maxLeave + carry) : maxLeave

let remaining = Math.max(0, totalWithCarry - used)

            // 🔥 UI ROW
            table.innerHTML += `
            <tr>
                <td>${leaveName}</td>
                <td>${totalWithCarry}</td>
                <td>${used}</td>
                <td>${remaining}</td>
              <td>
    ${
        isCarryEnabled
        ? `<span style="color:${carry > 0 ? 'green':'gray'};">
                +${carry}
                <br>
                <small>from last cycle</small>
           </span>`
        : `<span style="color:#999;">—</span>`
    }
</td>
                <td>${carryType === "Monthly" ? "🟢 Monthly" : "🔵 Yearly"}</td>
            </tr>
            `
        }

    } catch (error) {
        console.error("Error loading leave balance:", error)
    }
}

function loadNotifications(uid){

    const list = document.getElementById("notificationList")
    const countEl = document.getElementById("notifCount")

    if(!list) return

    db.collection("notifications")
.where("userId", "==", uid)
.orderBy("createdAt", "desc")
.onSnapshot(snapshot => {

        list.innerHTML = ""

        let unreadCount = 0

        if(snapshot.empty){
            list.innerHTML = "<div class='empty'>No notifications</div>"
            if(countEl) countEl.textContent = 0
            return
        }

        snapshot.forEach(doc => {

            let data = doc.data()

            if(data.hidden) return

            if(!data.read) unreadCount++

            let item = document.createElement("div")
            item.className = "notif-item " + (!data.read ? "unread" : "")

            item.innerHTML = `
                <div class="notif-icon">
                    ${data.read ? "✅" : "🔔"}
                </div>

                <div class="notif-content">
                    <div class="notif-text">${data.message}</div>
                    <div class="notif-time">${formatTime(data.createdAt)}</div>
                </div>

                <div class="notif-delete" title="Delete">🗑</div>
            `

            // ✅ MARK AS READ
            item.onclick = () => {
                db.collection("notifications")
                .doc(doc.id)
                .update({ read: true })
            }

            // ✅ DELETE BUTTON (FIXED)
            const deleteBtn = item.querySelector(".notif-delete")

            deleteBtn.onclick = (e) => {
                e.stopPropagation() // ❗ prevent mark as read

                // optional animation
                item.style.opacity = "0"
                item.style.transform = "translateX(20px)"

                setTimeout(() => {
                    db.collection("notifications")
                    .doc(doc.id)
                    .delete()
                }, 200)
            }

            list.appendChild(item)
        })

        // ✅ UPDATE BADGE
        if(countEl){
            countEl.textContent = unreadCount
            countEl.style.display = unreadCount > 0 ? "inline-block" : "none"
        }

    })
}
function formatTime(timestamp){

    if(!timestamp) return ""

    const now = new Date()
    const time = timestamp.toDate()
    const diff = Math.floor((now - time) / 1000)

    if(diff < 60) return "Just now"
    if(diff < 3600) return Math.floor(diff/60) + " min ago"
    if(diff < 86400) return Math.floor(diff/3600) + " hrs ago"

    return time.toLocaleDateString()
}
function markAllRead(){

  auth.onAuthStateChanged(user => {

    if(!user) return

    db.collection("notifications")
      .where("userId", "==", user.uid)
      .where("read", "==", false)
      .get()
      .then(snapshot => {

        snapshot.forEach(doc => {
          doc.ref.update({ read: true })
        })

      })
  })
}

function loadNotificationCount(uid){

    const countEl = document.getElementById("notifCount")

    db.collection("notifications")
    .where("userId", "==", uid)
    .onSnapshot(snapshot => {

        let count = 0

        snapshot.forEach(doc => {
            let data = doc.data()

            if(data.hidden) return     // ❌ skip hidden
            if(!data.read) count++     // ✅ count only unread
        })

        countEl.textContent = count > 99 ? "99+" : count
        countEl.style.display = count > 0 ? "inline-block" : "none"
    })
}

function markAsRead(id, e){
    e.stopPropagation()

    db.collection("notifications").doc(id).update({
        read: true
    })
}
function hideNotification(id, e){
    e.stopPropagation()

    db.collection("notifications").doc(id).update({
        hidden: true
    })
}
function deleteNotification(id, e){
    e.stopPropagation()

    if(!confirm("Delete this notification?")) return

    db.collection("notifications").doc(id).delete()
}

function toggleNotifBox(){

    const box = document.getElementById("notifBox")

    if(box.style.display === "block"){
        box.style.display = "none"
    } else {
        box.style.display = "block"
    }
}


// =============================
// LOAD LEAVE INSTRUCTIONS
// =============================
function loadLeaveInstructions(){

  const container = document.getElementById("leaveInstructions")

  if(!container) return

  container.innerHTML = "<p>Loading...</p>"

  db.collection("leave_instructions")
  .orderBy("createdAt", "asc")
  .get()
  .then(snapshot => {

    if(snapshot.empty){
      container.innerHTML = "<p>No leave instructions available</p>"
      return
    }

    container.innerHTML = ""

    snapshot.forEach(doc => {

      const data = doc.data()

      container.innerHTML += `
        <div class="leave-card" data-rules="${data.rules}">
          <h3>${data.code}</h3>
          <p>${data.name}</p>
          <span>${data.days} days/year</span>
        </div>
      `

    })

    attachLeaveClick()

  })

}
function attachLeaveClick(){

  document.querySelectorAll(".leave-card").forEach(card => {

    card.onclick = () => {

      const rules = card.getAttribute("data-rules")
      const title = card.querySelector("h3").innerText

      const titleEl = document.getElementById("modalTitle")
if(titleEl) titleEl.innerText = title

      // 🔥 Format rules nicely
      document.getElementById("modalBody").innerHTML = `
        <p style="white-space:pre-line;">${rules}</p>
      `

      document.getElementById("leaveModal").style.display = "block"

    }

  })

}
function closeLeaveModal(){
  const modal = document.getElementById("leaveModal")
  if(modal){
    modal.style.display = "none"
  }
}

window.onclick = function(event){
  const modal = document.getElementById("leaveModal")
  if(event.target === modal){
    modal.style.display = "none"
  }
}
