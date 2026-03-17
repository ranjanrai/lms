// ===========================
// LOAD HOLIDAYS
// ===========================

let holidayDates = []

function loadHolidays(){

db.collection("holidays").get().then(snapshot=>{

holidayDates = []

snapshot.forEach(doc=>{
  let data = doc.data()
  if(data.holiday_date){
    holidayDates.push(data.holiday_date)
  }
})

})

}

// CALL IT
loadHolidays()

// ===========================
// BLOCK HOLIDAY SELECTION
// ===========================

document.addEventListener("DOMContentLoaded", ()=>{

const startInput = document.getElementById("startDate")
const endInput = document.getElementById("endDate")

startInput.addEventListener("change", checkHoliday)
endInput.addEventListener("change", checkHoliday)

})

function checkHoliday(e){

let selectedDate = e.target.value

if(holidayDates.includes(selectedDate)){
  alert("This date is a holiday. Leave not allowed.")

  e.target.value = ""   // clear input
}

}

// ===========================
// LOAD LEAVE TYPES
// ===========================

document.addEventListener("DOMContentLoaded", () => {

const leaveTypeSelect = document.getElementById("leaveType")

db.collection("leave_types").onSnapshot(snapshot => {

  let html = '<option value="">Select Leave</option>'

  snapshot.forEach(doc => {
    let data = doc.data()
    html += `<option value="${data.name}">${data.name}</option>`
  })

  leaveTypeSelect.innerHTML = html

})

})


// ===========================
// APPLY LEAVE
// ===========================

async function applyLeave() {

const leaveType = document.getElementById("leaveType").value.trim()
const startDate = document.getElementById("startDate").value
const endDate = document.getElementById("endDate").value
const reason = document.getElementById("reason").value.trim()

// ===========================
// VALIDATION
// ===========================

if (!leaveType || !startDate || !endDate || !reason) {
  alert("Please fill all fields")
  return
}

if (new Date(endDate) < new Date(startDate)) {
  alert("End date cannot be before start date")
  return
}

// ===========================
// 🚨 BLOCK HOLIDAY RANGE (IMPORTANT)
// ===========================

let start = new Date(startDate)
let end = new Date(endDate)

for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {

  let check = d.toISOString().split("T")[0]

  if (holidayDates.includes(check)) {
    alert("Leave cannot include holiday dates")
    return
  }
}

// ===========================
// USER CHECK
// ===========================

const user = auth.currentUser

if (!user) {
  alert("User not logged in")
  return
}

try {

// ===========================
// GET USER DATA
// ===========================

const userDoc = await db.collection("users").doc(user.uid).get()

if (!userDoc.exists) {
  alert("User record not found")
  return
}

const userData = userDoc.data()


// ===========================
// PREVENT DUPLICATE REQUEST
// ===========================

const existing = await db.collection("leaves")
  .where("userId", "==", user.uid)
  .where("startDate", "==", startDate)
  .where("endDate", "==", endDate)
  .where("status", "in", ["pending", "approved"])
  .get()

if (!existing.empty) {
  alert("You already applied leave for these dates")
  return
}


// ===========================
// GET LEAVE TYPE LIMIT
// ===========================

const leaveTypeSnap = await db.collection("leave_types")
  .where("name", "==", leaveType)
  .limit(1)
  .get()

if (leaveTypeSnap.empty) {
  alert("Leave type not found")
  return
}

const maxDays = Number(leaveTypeSnap.docs[0].data().max_days)


// ===========================
// COUNT USED LEAVES
// ===========================

const leavesSnapshot = await db.collection("leaves")
  .where("userId", "==", user.uid)
  .where("leaveType", "==", leaveType)
  .where("status", "==", "approved")
  .get()

let usedDays = 0

for (const doc of leavesSnapshot.docs) {

  let leave = doc.data()

  let s = new Date(leave.startDate)
  let e = new Date(leave.endDate)

  usedDays += ((e - s) / (1000 * 60 * 60 * 24)) + 1
}


// ===========================
// CALCULATE REQUEST DAYS
// ===========================

const requestedDays = ((end - start) / (1000 * 60 * 60 * 24)) + 1

if ((usedDays + requestedDays) > maxDays) {
  alert(`Leave limit exceeded. Remaining: ${maxDays - usedDays}`)
  return
}


// ===========================
// MONTHLY LIMIT CHECK
// ===========================

const settingsDoc = await db.collection("leave_settings").doc("cycle").get()

if (settingsDoc.exists) {

  let settings = settingsDoc.data()

  if (settings.monthlyLimitEnabled) {

    let month = start.getMonth()
    let year = start.getFullYear()

    const monthlySnapshot = await db.collection("leaves")
      .where("userId", "==", user.uid)
      .get()

    let monthlyDays = 0

    for (const doc of monthlySnapshot.docs) {

      let leave = doc.data()
      let leaveStart = new Date(leave.startDate)

      if (
        (leave.status === "approved" || leave.status === "pending") &&
        leaveStart.getMonth() === month &&
        leaveStart.getFullYear() === year
      ) {

        let s = new Date(leave.startDate)
        let e = new Date(leave.endDate)

        monthlyDays += ((e - s) / (1000 * 60 * 60 * 24)) + 1
      }
    }

    if ((monthlyDays + requestedDays) > settings.monthlyLimit) {
      alert("Monthly leave limit exceeded")
      return
    }
  }
}


// ===========================
// SAVE LEAVE
// ===========================

await db.collection("leaves").add({
  userId: user.uid,
  name: userData.name || "N/A",
  email: userData.email || "N/A",
  leaveType,
  startDate,
  endDate,
  reason,
  status: "pending",
  createdAt: firebase.firestore.FieldValue.serverTimestamp()
})


// ===========================
// CREATE NOTIFICATION
// ===========================

await db.collection("notifications").add({
  type: "leave_request",
  title: "New Leave Request",
  message: `${userData.name} applied for ${leaveType}`,
  userId: user.uid,
  read: false,
  hidden: false,
  createdAt: firebase.firestore.FieldValue.serverTimestamp()
})


// ===========================
// SUCCESS
// ===========================

alert("Leave request submitted successfully")

document.getElementById("leaveForm").reset()

} catch (error) {

console.error(error)
alert("Error: " + error.message)

}

}

// ===========================
// AUTH CHECK
// ===========================

auth.onAuthStateChanged(user => {

if (!user) {
  console.log("No user logged in")
} else {
  console.log("User:", user.email)
}

})


// ===========================
// LOGOUT
// ===========================

function logout() {

auth.signOut().then(() => {
  window.location.href = "login.html"
})

}