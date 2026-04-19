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
  startMonth,
  startYear,
  endMonth,
  endYear,
  carryMode: document.getElementById("carryMode").value,
  updatedAt: new Date()
}, { merge: true })
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
       const select = document.getElementById("carryMode")

if(select){

  const mode = data.carryMode || "manual"

  console.log("Loaded carry mode:", mode)  // ✅ DEBUG

  // 🔥 force update safely
  setTimeout(() => {
    select.value = mode
  }, 50)

}

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
function loadLeaveTypeDropdown(){

  const select = document.getElementById("resetLeaveType")
  if(!select) return

  db.collection("leave_types").get().then(snapshot=>{

    select.innerHTML = `<option value="">Select Leave Type</option>`

    snapshot.forEach(doc=>{
      let d = doc.data()

      let option = document.createElement("option")
      option.value = d.name
      option.textContent = d.name

      select.appendChild(option)
    })

  })

}

// 🔥 AUTO LOAD
document.addEventListener("DOMContentLoaded", loadLeaveTypeDropdown)
let resetMode = null

function openResetModal(mode){

  resetMode = mode

  const msg = document.getElementById("resetMessage")

  if(mode === "year"){
    const year = document.getElementById("resetYear").value

    if(!year){
      alert("Enter year")
      return
    }

    msg.innerText = `Reset carry forward for year ${year}?`
  }

  if(mode === "type"){
    const type = document.getElementById("resetLeaveType").value

    if(!type){
      alert("Select leave type")
      return
    }

    msg.innerText = `Reset carry forward for ${type}?`
  }

  document.getElementById("resetModal").style.display = "flex"
}

function closeResetModal(){
  document.getElementById("resetModal").style.display = "none"
}
async function confirmReset(){

  closeResetModal()

  try{

    const snapshot = await db.collection("users")
      .where("role","==","employee")
      .get()

    let batch = db.batch()
    let count = 0

    const selectedType = document.getElementById("resetLeaveType").value

    snapshot.forEach(doc=>{

      let data = doc.data()
      let carry = data.carry_forward || {}

      // ===============================
      // RESET BY TYPE
      // ===============================
      if(resetMode === "type"){
        if(carry[selectedType]){
          carry[selectedType] = 0
        }
      }

      // ===============================
      // RESET BY YEAR (FULL RESET)
      // ===============================
      if(resetMode === "year"){
        carry = {}
      }

      const ref = db.collection("users").doc(doc.id)

      batch.update(ref, {
        carry_forward: carry
      })

      count++

      if(count === 500){
        batch.commit()
        batch = db.batch()
        count = 0
      }

    })

    if(count > 0){
      await batch.commit()
    }

    alert("✅ Reset completed successfully")

  }catch(error){
    console.error(error)
    alert("Error: " + error.message)
  }

}
