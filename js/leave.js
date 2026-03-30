async function displayHolidays(){

    const list = document.getElementById("holidayList")
    list.innerHTML = ""

    const snapshot = await db.collection("holidays").get()

    snapshot.forEach(doc=>{
        let data = doc.data()

        let li = document.createElement("li")
        li.textContent = data.holiday_date + " - " + data.holiday_name

        list.appendChild(li)
    })
}
async function getHolidays(){

    const snapshot = await db.collection("holidays").get()

    let holidays = []

    snapshot.forEach(doc=>{
        holidays.push(doc.data().holiday_date)
    })

    return holidays
}


async function checkHolidayInput(){

    const holidays = await getHolidays()

    const startInput = document.getElementById("startDate")
    const endInput = document.getElementById("endDate")

    function validate(){

        if(startInput.value && holidays.includes(startInput.value)){
            alert("Start date is a holiday!")
            startInput.value = ""
        }

        if(endInput.value && holidays.includes(endInput.value)){
            alert("End date is a holiday!")
            endInput.value = ""
        }
    }

    startInput.addEventListener("change", validate)
    endInput.addEventListener("change", validate)
}

document.addEventListener("DOMContentLoaded", function () {
    displayHolidays()
    checkHolidayInput()
})
// ===========================
// LOAD LEAVE TYPES
// ===========================

document.addEventListener("DOMContentLoaded", function () {

    const leaveTypeSelect = document.getElementById("leaveType");

    db.collection("leave_types").onSnapshot((snapshot) => {

        leaveTypeSelect.innerHTML = '<option value="">Select Leave</option>';

        snapshot.forEach((doc) => {

            let data = doc.data();

            let option = document.createElement("option");
            option.value = data.name;
            option.textContent = data.name;

            leaveTypeSelect.appendChild(option);
        });

    });

});


// ===========================
// APPLY LEAVE
// ===========================

async function applyLeave() {

    const leaveType = document.getElementById("leaveType").value;
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;
   const department = document.getElementById("department").value;
const reason = document.getElementById("reason").value;
const adjustment = document.getElementById("adjustment").value;
    
    

    if (!leaveType || !startDate || !endDate || !reason || !department) {
        alert("Please fill all fields");
        return;
    }

    if (new Date(endDate) < new Date(startDate)) {
        alert("End date cannot be before start date");
        return;
    }

    const user = auth.currentUser;
    if (!user) {
        alert("User not logged in");
        return;
    }

    try {

        // ===========================
        // GET USER
        // ===========================

        const userDoc = await db.collection("users").doc(user.uid).get();
        const userData = userDoc.data();

        // ===========================
// PROBATION WARNING
// ===========================

const warning = document.getElementById("probationWarning")

if(userData.probation === true){
    if(warning) warning.style.display = "block"
}else{
    if(warning) warning.style.display = "none"
}

// safety
if(userData.probation === undefined){
    userData.probation = false
}

        // ===========================
        // GET LEAVE TYPE + SETTINGS
        // ===========================

        const leaveTypeSnapshot = await db.collection("leave_types")
            .where("name", "==", leaveType)
            .get();

        if (leaveTypeSnapshot.empty) {
            alert("Leave type not found");
            return;
        }

        let maxDays = 0;
        let settings = {};

        leaveTypeSnapshot.forEach(doc => {
            let data = doc.data();
            maxDays = Number(data.max_days);
            settings = data.settings || {};
        });


        // ===========================
        // CALCULATE DAYS (EXCLUDE HOLIDAYS)
        // ===========================

        const holidays = await getHolidays();

        let requestedDays = 0;
        let current = new Date(startDate);

        while (current <= new Date(endDate)) {
            let d = current.toISOString().split("T")[0];

            if (!holidays.includes(d)) {
                requestedDays++;
            }

            current.setDate(current.getDate() + 1);
        }


        // ===========================
        // USED LEAVE COUNT
        // ===========================

        const leavesSnapshot = await db.collection("leaves")
            .where("userId", "==", user.uid)
            .where("leaveType", "==", leaveType)
            .where("status", "==", "approved")
            .get();

        let usedDays = 0;

        leavesSnapshot.forEach(doc => {
            let l = doc.data();

            let s = new Date(l.startDate);
            let e = new Date(l.endDate);

            let diff = (e - s) / (1000 * 60 * 60 * 24) + 1;
            usedDays += diff;
        });

        if ((usedDays + requestedDays) > maxDays) {
            alert("Leave limit exceeded. Remaining: " + (maxDays - usedDays));
            return;
        }


        // ===========================
        // MONTHLY LIMIT (NEW)
        // ===========================

        if (settings.monthlyEnabled) {

            let month = new Date(startDate).getMonth();
            let year = new Date(startDate).getFullYear();

            const monthlySnapshot = await db.collection("leaves")
                .where("userId", "==", user.uid)
                .where("leaveType", "==", leaveType)
                .get();

            let monthlyDays = 0;

            monthlySnapshot.forEach(doc => {

                let leave = doc.data();
                let leaveStart = new Date(leave.startDate);

                if (
                    (leave.status === "approved" || leave.status === "pending") &&
                    leaveStart.getMonth() === month &&
                    leaveStart.getFullYear() === year
                ) {

                    let s = new Date(leave.startDate);
                    let e = new Date(leave.endDate);

                    let diff = (e - s) / (1000 * 60 * 60 * 24) + 1;
                    monthlyDays += diff;
                }

            });

            if ((monthlyDays + requestedDays) > settings.monthlyLimit) {
                alert("Monthly limit exceeded for this leave type");
                return;
            }
        }


        // ===========================
        // ADVANCE APPLY RULE
        // ===========================

        if (settings.advanceEnabled) {

            let today = new Date();
            let start = new Date(startDate);

            let diffDays = Math.ceil((start - today) / (1000 * 60 * 60 * 24));

            if (diffDays < settings.advanceDays) {
                alert(`Apply at least ${settings.advanceDays} days in advance`);
                return;
            }
        }


        // ===========================
        // AFTER 1 YEAR RULE
        // ===========================

        if (settings.after1YearOnly) {

            let joinDate = new Date(userData.createdAt?.toDate?.() || userData.createdAt);
            let today = new Date();

            let diffYears = (today - joinDate) / (1000 * 60 * 60 * 24 * 365);

            if (diffYears < 1) {
                alert("This leave is allowed only after 1 year of service");
                return;
            }
        }

// ===========================
// PROBATION CHECK (FINAL)
// ===========================

if(userData.probation){

    let probationLimit = settings.probationLimit ?? 0

    // ❌ Not allowed at all
    if(probationLimit === 0){
        alert(`❌ ${leaveType} not allowed during probation`)
        return
    }

    // count used + pending leaves
    const snapshot = await db.collection("leaves")
        .where("userId", "==", user.uid)
        .where("leaveType", "==", leaveType)
        .get()

    let used = 0

    snapshot.forEach(doc => {
        let d = doc.data()

        if(d.status === "approved" || d.status === "pending"){

            let s = new Date(d.startDate)
            let e = new Date(d.endDate)

            let diff = (e - s) / (1000 * 60 * 60 * 24) + 1
            used += diff
        }
    })

    if((used + requestedDays) > probationLimit){
        alert(`❌ Only ${probationLimit} days allowed for ${leaveType} during probation`)
        return
    }
}


        // ===========================
        // SAVE LEAVE
        // ===========================

      await db.collection("leaves").add({

    userId: user.uid,
    name: userData.name,
    email: userData.email,

    leaveType: leaveType,
    startDate: startDate,
    endDate: endDate,

    department: department,        // ✅ NEW
    reason: reason,
    adjustment: adjustment,        // ✅ NEW

    status: "pending",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()

});


        // ===========================
        // ADMIN NOTIFICATION
        // ===========================

        const adminSnapshot = await db.collection("users")
            .where("role", "==", "admin")
            .get();

        adminSnapshot.forEach(admin => {

            db.collection("notifications").add({

                type: "leave_request",
                title: "New Leave Request",
                message: userData.name + " applied for " + leaveType,
                userId: admin.id,
                role: "admin",
                read: false,
                hidden: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()

            });

        });


        alert("✅ Leave request submitted successfully");
        document.getElementById("leaveForm").reset();

    } catch (error) {
        console.error(error);
        alert("Error: " + error.message);
    }
}


// ===========================
// AUTH SESSION CHECK
// ===========================

auth.onAuthStateChanged((user) => {

    if (user) {
        console.log("User logged in:", user.email);
    } else {
        console.log("No user logged in");
    }

});


// ===========================
// LOGOUT
// ===========================

function logout() {

    auth.signOut().then(() => {
        window.location = "login.html";
    });

}
