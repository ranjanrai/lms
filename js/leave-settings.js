// ===============================
// SAVE OR UPDATE LEAVE SETTINGS
// ===============================

function saveLeaveSettings(){

  const startMonth = document.getElementById("startMonth").value;
  const startYear = document.getElementById("startYear").value;

  const endMonth = document.getElementById("endMonth").value;
  const endYear = document.getElementById("endYear").value;

  // ✅ Validation (important)
  if(!startMonth || !startYear || !endMonth || !endYear){
    alert("Please fill all fields");
    return;
  }

  db.collection("leave_settings")
    .doc("cycle")
    .set({
      startMonth: startMonth,
      startYear: startYear,
      endMonth: endMonth,
      endYear: endYear,
      updatedAt: new Date()   // ✅ useful for tracking
    })
    .then(()=>{

      const msg = document.getElementById("successMsg");

      if(msg){
        msg.style.display = "block";

        setTimeout(()=>{
          msg.style.display = "none";
        },3000);
      }

      loadLeaveSettings(); // refresh table

    })
    .catch((error)=>{
      console.log(error);
      alert("Error saving settings");
    });

}


// ===============================
// LOAD SETTINGS
// ===============================

function loadLeaveSettings(){

  db.collection("leave_settings")
    .doc("cycle")
    .get()
    .then((doc)=>{

      const table = document.getElementById("leaveSettingsTable");

      if(doc.exists){

        let data = doc.data();

        // ✅ Fill form safely
        document.getElementById("startMonth").value = data.startMonth || "";
        document.getElementById("startYear").value = data.startYear || "";
        document.getElementById("endMonth").value = data.endMonth || "";
        document.getElementById("endYear").value = data.endYear || "";

        // ✅ Update table
        if(table){
          table.innerHTML = `
          <tr>
            <td>${data.startMonth}</td>
            <td>${data.startYear}</td>
            <td>${data.endMonth}</td>
            <td>${data.endYear}</td>
          </tr>
          `;
        }

      } else {

        // ✅ No data case
        if(table){
          table.innerHTML = `
          <tr>
            <td colspan="4" style="text-align:center;">
              No settings found
            </td>
          </tr>
          `;
        }

      }

    })
    .catch((error)=>{
      console.log(error);
    });

}


// ===============================
// AUTO LOAD SETTINGS
// ===============================

document.addEventListener("DOMContentLoaded", function(){
  loadLeaveSettings();
});

// ===============================
// LOAD LEAVE INSTRUCTIONS
// ===============================
// ===============================
// GLOBAL VARIABLE
// ===============================
let editId = null


// ===============================
// LOAD LEAVE INSTRUCTIONS
// ===============================
function loadLeaveInstructions(){

  const container = document.getElementById("leaveList")
  container.innerHTML = "<p>Loading...</p>"

  db.collection("leave_instructions")
  .orderBy("createdAt", "desc")
  .get()
  .then(snapshot => {

    if(snapshot.empty){
      container.innerHTML = "<p>No instructions added yet</p>"
      return
    }

    container.innerHTML = ""

    snapshot.forEach(doc => {

      const data = doc.data()

      container.innerHTML += `
        <div class="leave-item">
          
          <div class="leave-top">
            <b>${data.code} - ${data.name}</b>
            <span class="days">${data.days} days</span>
          </div>

          <p class="rules">${data.rules}</p>

          <div class="leave-actions">
            <button onclick="editLeave('${doc.id}', '${data.name}', '${data.code}', '${data.days}', \`${data.rules}\`)">✏️ Edit</button>
            <button onclick="deleteLeave('${doc.id}')">🗑 Delete</button>
          </div>

        </div>
      `
    })

  })
}


// ===============================
// EDIT FUNCTION
// ===============================
function editLeave(id, name, code, days, rules){

  document.getElementById("leaveName").value = name
  document.getElementById("leaveCode").value = code
  document.getElementById("leaveDays").value = days
  document.getElementById("leaveRules").value = rules

  editId = id

  document.querySelector("button[onclick='saveLeaveInstruction()']").innerText = "Update Instruction"
}


// ===============================
// SAVE / UPDATE
// ===============================
function saveLeaveInstruction(){

  const name = document.getElementById("leaveName").value
  const code = document.getElementById("leaveCode").value
  const days = document.getElementById("leaveDays").value
  const rules = document.getElementById("leaveRules").value

  if(!name || !code || !days || !rules){
    alert("Please fill all fields")
    return
  }

  if(editId){

    // UPDATE
    db.collection("leave_instructions").doc(editId).update({
      name,
      code,
      days: Number(days),
      rules
    })
    .then(()=>{
      alert("✅ Updated successfully")
      resetForm()
      loadLeaveInstructions()
    })

  } else {

    // CREATE
    db.collection("leave_instructions").add({
      name,
      code,
      days: Number(days),
      rules,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(()=>{
      alert("✅ Instruction saved")
      resetForm()
      loadLeaveInstructions()
    })

  }

}


// ===============================
// RESET FORM
// ===============================
function resetForm(){

  document.getElementById("leaveName").value = ""
  document.getElementById("leaveCode").value = ""
  document.getElementById("leaveDays").value = ""
  document.getElementById("leaveRules").value = ""

  editId = null

  document.querySelector("button[onclick='saveLeaveInstruction()']").innerText = "Save Instruction"
}


// ===============================
// DELETE
// ===============================
function deleteLeave(id){

  if(confirm("Are you sure you want to delete this?")){

    db.collection("leave_instructions").doc(id).delete()
    .then(()=>{
      alert("🗑 Deleted")
      loadLeaveInstructions()
    })

  }

}


// ===============================
// AUTO LOAD
// ===============================
window.onload = function(){
  loadLeaveInstructions()
}
