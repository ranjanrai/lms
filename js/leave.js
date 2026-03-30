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

function showToast(message, type="error") {

    let toast = document.createElement("div")
    toast.innerText = message

    toast.style.position = "fixed"
    toast.style.top = "20px"
    toast.style.right = "20px"
    toast.style.padding = "12px 20px"
    toast.style.borderRadius = "6px"
    toast.style.color = "#fff"
    toast.style.zIndex = "9999"

    toast.style.background = type === "success" ? "#28a745" : "#dc3545"

    document.body.appendChild(toast)

    setTimeout(() => toast.remove(), 3000)
}



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

    const btn = document.getElementById("submitBtn")
    const btnText = document.getElementById("btnText")
    const btnLoader = document.getElementById("btnLoader")

    // 🔄 Start loading
    btn.disabled = true
    btnText.style.display = "none"
    btnLoader.style.display = "inline"

    // ===========================
    // BASIC VALIDATION
    // ===========================

    if (!leaveType || !startDate || !endDate || !reason || !department) {
        showToast("⚠ Please fill all required fields")
        return resetButton()
    }

    if (new Date(endDate) < new Date(startDate)) {
        showToast("End date cannot be before start date")
        return resetButton()
    }

    const user = auth.currentUser;
    if (!user) {
        showToast("User not logged in")
        return resetButton()
    }

    try {

        // ===========================
        // GET USER
        // ===========================

        const userDoc = await db.collection("users").doc(user.uid).get();
        const userData = userDoc.data();

        const warning = document.getElementById("probationWarning")

        if(userData.probation === true){
            if(warning) warning.style.display = "block"
        } else {
            if(warning) warning.style.display = "none"
        }

        if(userData.probation === undefined){
            userData.probation = false
        }

        // ===========================
        // GET LEAVE TYPE
        // ===========================

        const leaveTypeSnapshot = await db.collection("leave_types")
            .where("name", "==", leaveType)
            .get();

        if (leaveTypeSnapshot.empty) {
            showToast("Leave type not found")
            return resetButton()
        }

        let maxDays = 0;
        let settings = {};

        leaveTypeSnapshot.forEach(doc => {
            let data = doc.data();
            maxDays = Number(data.max_days);
            settings = data.settings || {};
        });

        // ===========================
        // CALCULATE DAYS
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
        // USED LEAVES
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

            usedDays += (e - s) / (1000 * 60 * 60 * 24) + 1;
        });

        if ((usedDays + requestedDays) > maxDays) {
            showToast(`Leave limit exceeded. Remaining: ${maxDays - usedDays}`)
            return resetButton()
        }

        // ===========================
        // MONTHLY LIMIT
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
                    monthlyDays += (e - s) / (1000 * 60 * 60 * 24) + 1;
                }
            });

            if ((monthlyDays + requestedDays) > settings.monthlyLimit) {
                showToast("Monthly limit exceeded")
                return resetButton()
            }
        }

        // ===========================
        // ADVANCE RULE
        // ===========================

        if (settings.advanceEnabled) {

            let today = new Date();
            let start = new Date(startDate);

            let diffDays = Math.ceil((start - today) / (1000 * 60 * 60 * 24));

            if (diffDays < settings.advanceDays) {
                showToast(`Apply at least ${settings.advanceDays} days in advance`)
                return resetButton()
            }
        }

        // ===========================
        // 1 YEAR RULE
        // ===========================

        if (settings.after1YearOnly) {

            let joinDate = new Date(userData.createdAt?.toDate?.() || userData.createdAt);
            let today = new Date();

            let diffYears = (today - joinDate) / (1000 * 60 * 60 * 24 * 365);

            if (diffYears < 1) {
                showToast("Allowed only after 1 year of service")
                return resetButton()
            }
        }

        // ===========================
        // PROBATION CHECK
        // ===========================

        if(userData.probation){

            let probationLimit = settings.probationLimit ?? 0

            if(probationLimit === 0){
                showToast(`${leaveType} not allowed during probation`)
                return resetButton()
            }

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
                    used += (e - s) / (1000 * 60 * 60 * 24) + 1
                }
            })

            if((used + requestedDays) > probationLimit){
                showToast(`Only ${probationLimit} days allowed during probation`)
                return resetButton()
            }
        }

        // ===========================
        // SAVE
        // ===========================

        await db.collection("leaves").add({

            userId: user.uid,
            name: userData.name,
            email: userData.email,

            leaveType,
            startDate,
            endDate,
            department,
            reason,
            adjustment,

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
                message: `${userData.name} applied for ${leaveType}`,
                userId: admin.id,
                role: "admin",
                read: false,
                hidden: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        showToast("✅ Leave submitted successfully", "success")
        document.getElementById("leaveForm").reset()

    } catch (error) {
        console.error(error)
        showToast("❌ " + error.message)
    }

    resetButton()
}
function resetButton(){
    const btn = document.getElementById("submitBtn")
    const btnText = document.getElementById("btnText")
    const btnLoader = document.getElementById("btnLoader")

    btn.disabled = false
    btnText.style.display = "inline"
    btnLoader.style.display = "none"
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
