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
    const reason = document.getElementById("reason").value;

    // ===========================
    // VALIDATION
    // ===========================

    if (!leaveType || !startDate || !endDate || !reason) {
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
        // GET USER DATA
        // ===========================

        const userDoc = await db.collection("users").doc(user.uid).get();

        if (!userDoc.exists) {
            alert("User record not found");
            return;
        }

        const userData = userDoc.data();


        // ===========================
        // GET LEAVE TYPE LIMIT
        // ===========================

        const leaveTypeSnapshot = await db.collection("leave_types")
            .where("name", "==", leaveType)
            .get();

        if (leaveTypeSnapshot.empty) {
            alert("Leave type not found");
            return;
        }

        let maxDays = 0;

        leaveTypeSnapshot.forEach(doc => {
            maxDays = Number(doc.data().max_days);
        });


        // ===========================
        // COUNT APPROVED LEAVES
        // ===========================

        const leavesSnapshot = await db.collection("leaves")
            .where("userId", "==", user.uid)
            .where("leaveType", "==", leaveType)
            .where("status", "==", "approved")
            .get();

        let usedDays = 0;

        leavesSnapshot.forEach(doc => {

            let leave = doc.data();

            let start = new Date(leave.startDate);
            let end = new Date(leave.endDate);

            let diff = (end - start) / (1000 * 60 * 60 * 24) + 1;

            usedDays += diff;
        });


        // ===========================
        // CALCULATE REQUEST DAYS
        // ===========================

        const start = new Date(startDate);
        const end = new Date(endDate);

       const holidays = await getHolidays()

let requestedDays = 0
let current = new Date(startDate)

while(current <= new Date(endDate)){

    let d = current.toISOString().split("T")[0]

    if(!holidays.includes(d)){
        requestedDays++
    }

    current.setDate(current.getDate() + 1)
}

        if ((usedDays + requestedDays) > maxDays) {
            alert("Leave limit exceeded. Remaining: " + (maxDays - usedDays));
            return;
        }


        // ===========================
        // CHECK MONTHLY LIMIT
        // ===========================

        const settingsDoc = await db.collection("leave_settings").doc("cycle").get();

        if (settingsDoc.exists) {

            let settings = settingsDoc.data();

            if (settings.monthlyLimitEnabled) {

                let month = start.getMonth();
                let year = start.getFullYear();

                const monthlySnapshot = await db.collection("leaves")
                    .where("userId", "==", user.uid)
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
                    alert("Monthly leave limit exceeded");
                    return;
                }

            }

        }


        // ===========================
        // SAVE LEAVE REQUEST
        // ===========================

        await db.collection("leaves").add({

            userId: user.uid,
            name: userData.name,
            email: userData.email,
            leaveType: leaveType,
            startDate: startDate,
            endDate: endDate,
            reason: reason,
            status: "pending",
            createdAt: firebase.firestore.FieldValue.serverTimestamp()

        });


        // ===========================
        // CREATE ADMIN NOTIFICATION
        // ===========================

   // ===========================
// CREATE ADMIN NOTIFICATION
// ===========================

const adminSnapshot = await db.collection("users")
.where("role","==","admin")
.get()

adminSnapshot.forEach(admin => {

    db.collection("notifications").add({

        type: "leave_request",
        title: "New Leave Request",
        message: userData.name + " applied for " + leaveType,

        userId: admin.id, // ✅ SEND TO ADMIN
        role: "admin", // ✅ VERY IMPORTANT

        read: false,
        hidden: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()

    })

})


        // ===========================
        // SUCCESS
        // ===========================

        alert("Leave request submitted successfully");
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
