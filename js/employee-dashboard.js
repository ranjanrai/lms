
function saveCache(key, data){
    localStorage.setItem(key, JSON.stringify(data))
}

function getCache(key){
    let data = localStorage.getItem(key)
    return data ? JSON.parse(data) : null
}
// =============================
// CHECK LOGIN
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
    banner.innerHTML = "🟡 You are on probation. Leave limits apply."
}else{
    banner.style.display = "none"
}

// 🚫 BLOCK NON-EMPLOYEE
if(data.role !== "employee"){
    alert("Access denied")
    await auth.signOut()
    window.location.href = "login.html"
    return
}

// 🚫 BLOCK NON-APPROVED USERS
if(data.status !== "approved"){
    alert("Your account is not approved or has been removed")
    await auth.signOut()
    window.location.href = "login.html"
    return
}

// ✅ ALLOW ACCESS
const uid = user.uid

// 🔥 ONLY REQUIRED FUNCTIONS
loadDashboard(uid)
loadLeaveBalance(uid)
loadNotifications(uid)
loadLeaveInstructions()
// ✅ AUTO CARRY FORWARD (ADD THIS)
checkAutoCarryForward()
})


// =============================
// LOAD DASHBOARD DATA
// =============================

let leaveRowMap = new Map()

function loadDashboard(uid){

const table = document.getElementById("leaveTable")
if(!table) return

const cacheKey = "dashboard_" + uid

// ===============================
// 🔥 1. LOAD FROM CACHE
// ===============================
const cached = localStorage.getItem(cacheKey)

if(cached){

table.innerHTML = ""
leaveRowMap.clear()

JSON.parse(cached).forEach(item=>{

let tr = document.createElement("tr")
tr.innerHTML = item.html
tr.id = "leave-"+item.id

table.appendChild(tr)

// ✅ store full object (IMPORTANT)
leaveRowMap.set(item.id, {
    row: tr,
    days: item.days,
    status: item.status
})

})

}

// ===============================
// 🔥 2. REAL-TIME FIRESTORE
// ===============================
db.collection("leaves")
.where("userId","==",uid)
.onSnapshot(snapshot=>{

// 🔥 first load reset
if(snapshot.metadata.fromCache === false && snapshot.docChanges().length === snapshot.size){
    leaveRowMap.clear()
    table.innerHTML = ""
}

snapshot.docChanges().forEach(change=>{

const doc = change.doc
const data = doc.data()
const id = doc.id

let start = new Date(data.startDate)
let end = new Date(data.endDate)

let days = Math.floor((end - start)/(1000*60*60*24)) + 1

function createRow(){

let tr = document.createElement("tr")
tr.id = "leave-"+id

tr.innerHTML = `
<td>${data.leaveType}</td>
<td>${data.startDate}</td>
<td>${data.endDate}</td>
<td>${days}</td>
<td>${data.status}</td>
`

return tr
}

// ===============================
// 🟢 ADD
// ===============================
if(change.type === "added"){

if(!leaveRowMap.has(id)){

let tr = createRow()

leaveRowMap.set(id, {
    row: tr,
    days: days,
    status: data.status
})

table.prepend(tr)

}

}

// ===============================
// 🟡 UPDATE
// ===============================
else if(change.type === "modified"){

let old = leaveRowMap.get(id)

if(old && old.row && old.row.parentNode){

let newRow = createRow()

table.replaceChild(newRow, old.row)

leaveRowMap.set(id, {
    row: newRow,
    days: days,
    status: data.status
})

}

}

// ===============================
// 🔴 REMOVE
// ===============================
else if(change.type === "removed"){

let obj = leaveRowMap.get(id)

if(obj){
obj.row.remove()
leaveRowMap.delete(id)
}

}

})

// ===============================
// 🔥 3. CALCULATE STATS (DAYS)
// ===============================
// ===============================
// ✅ CORRECT STATS CALCULATION
// ===============================
let total = 0
let pending = 0
let approved = 0

snapshot.forEach(doc => {
    let data = doc.data()

    total++

    if(data.status === "pending"){
        pending++
    }

    if(data.status === "approved"){
        approved++
    }
})

// update UI
document.getElementById("totalLeaves").innerText = total
document.getElementById("pendingLeaves").innerText = pending
document.getElementById("approvedLeaves").innerText = approved

// ===============================
// 🔥 4. SAVE CACHE (FULL DATA)
// ===============================
let cacheData = []

leaveRowMap.forEach((item, id)=>{

cacheData.push({
    id: id,
    html: item.row.innerHTML,
    days: item.days,
    status: item.status
})

})

localStorage.setItem(cacheKey, JSON.stringify(cacheData))

})

}
// =============================
// LOAD LEAVE BALANCE (OPTIMIZED)
// =============================

let leaveBalanceRowMap = new Map()

function loadLeaveBalance(uid){

const table = document.getElementById("leaveBalanceTable")
if(!table) return

const cacheKey = "leaveBalance_" + uid

// ===============================
// 🔥 1. LOAD FROM CACHE (SYNC MAP)
// ===============================
const cached = localStorage.getItem(cacheKey)

if(cached){

table.innerHTML = ""
leaveBalanceRowMap.clear()

JSON.parse(cached).forEach(rowHTML=>{

    let tr = document.createElement("tr")
    tr.innerHTML = rowHTML

    let name = tr.children[0].innerText
    tr.id = "balance-" + name

    table.appendChild(tr)
    leaveBalanceRowMap.set(name, tr)

})

}else{
    table.innerHTML = "<tr><td colspan='6'>Loading...</td></tr>"
}

// ===============================
// 🔥 2. LOAD STATIC DATA (ONCE)
// ===============================
Promise.all([
    db.collection("leave_types").get(),
    db.collection("users").doc(uid).get()
]).then(([typeSnap, userDoc])=>{

    let leaveTypes = []
    let carryData = userDoc.data()?.carry_forward || {}

    typeSnap.forEach(doc=>{
        let d = doc.data()
        leaveTypes.push({
            name: d.name,
            max: Number(d.max_days || 0),
            settings: d.settings || {}
        })
    })

    // ===============================
    // 🔥 3. REAL-TIME LEAVES
    // ===============================
    db.collection("leaves")
    .where("userId","==",uid)
    .where("status","==","approved")
    .onSnapshot(snapshot=>{

        // 🔥 FIRST REAL LOAD RESET
        if(snapshot.metadata.fromCache === false){
            leaveBalanceRowMap.clear()
            table.innerHTML = ""
        }

        let leaveMap = {}

        snapshot.forEach(doc=>{
            let d = doc.data()
            if(!leaveMap[d.leaveType]) leaveMap[d.leaveType] = []
            leaveMap[d.leaveType].push(d)
        })

        let cacheData = []

        // ===============================
        // 🔥 4. UPDATE UI
        // ===============================
        leaveTypes.forEach(type=>{

            const name = type.name
            const max = type.max
            const settings = type.settings

            let leaves = leaveMap[name] || []

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

            let isCarryEnabled = settings.carryForward === true
            let carryType = settings.carryType || null

            let carry = 0
           if(isCarryEnabled){
    let rawCarry = carryData[name] || 0
    if(rawCarry > 0){
        carry = rawCarry   // ✅ FIX
    }
}

            let total = isCarryEnabled ? (max + carry) : max
            let remaining = Math.max(0, total - used)

            // ===============================
            // CREATE ROW
            // ===============================
            function createRow(){
                let tr = document.createElement("tr")
                tr.id = "balance-" + name

                tr.innerHTML = `
<td>${name}</td>
<td><b>${remaining}</b> / ${total}</td>
<td>${used}</td>
<td>${remaining}</td>
<td>
${
isCarryEnabled
? `<span style="color:${carry>0?'green':'#999'};">📦 +${carry}</span>`
: `<span style="color:#999;">—</span>`
}
</td>
<td>
${
isCarryEnabled
? (carryType === "monthly" ? "🟢 Monthly" : "🔵 Yearly")
: "-"
}
</td>
`
                return tr
            }

            // ===============================
            // ADD / UPDATE (SAFE)
            // ===============================
            let existingRow = leaveBalanceRowMap.get(name)

            if(existingRow && existingRow.parentNode){

                let newRow = createRow()
                table.replaceChild(newRow, existingRow)
                leaveBalanceRowMap.set(name, newRow)

            }else{

                let newRow = createRow()
                table.appendChild(newRow)
                leaveBalanceRowMap.set(name, newRow)

            }

            // 🔥 CACHE SAVE
            let rowRef = leaveBalanceRowMap.get(name)
            cacheData.push(rowRef.innerHTML)

        })

        // ===============================
        // 🔥 5. SAVE CACHE
        // ===============================
        localStorage.setItem(cacheKey, JSON.stringify(cacheData))

    })

}).catch(error=>{
    console.error("Leave balance error:", error)
})
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

async function disableButtonIfAuto(){

  const doc = await db.collection("leave_settings").doc("cycle").get();

  if(doc.exists && doc.data().carryMode === "auto"){
    console.log("Auto mode enabled");
  }

}
