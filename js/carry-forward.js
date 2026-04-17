async function runCarryForward(){

  if(!confirm("Run carry forward for all employees?")) return;

  try{

    const settingsDoc = await db.collection("leave_settings").doc("cycle").get();

    if(!settingsDoc.exists){
      alert("Settings not found");
      return;
    }

    const cycle = settingsDoc.data();

    if(cycle.carryMode === "auto"){
      alert("⚠ System is set to AUTO mode");
      return;
    }

    const today = new Date().toISOString().split("T")[0];

    if(cycle.lastCarryForwardRun === today){
      alert("⚠ Carry forward already executed today");
      return;
    }

    await processCarryForward();

    await db.collection("leave_settings").doc("cycle").update({
      lastCarryForwardRun: today
    });

    alert("✅ Carry Forward Completed Successfully!");

  }catch(error){
    console.error(error);
    alert("Error: " + error.message);
  }

}
async function checkAutoCarryForward(){

  try{

    const doc = await db.collection("leave_settings").doc("cycle").get();
    if(!doc.exists) return;

    const cycle = doc.data();

    if(cycle.carryMode !== "auto") return;

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    if(
      today.getMonth()+1 !== Number(cycle.endMonth) ||
      today.getFullYear() !== Number(cycle.endYear)
    ){
      return;
    }

    if(cycle.lastCarryForwardRun === todayStr){
      console.log("Already executed");
      return;
    }

    console.log("🤖 AUTO Carry Forward Running...");

    await processCarryForward();

    await db.collection("leave_settings").doc("cycle").update({
      lastCarryForwardRun: todayStr
    });

  }catch(error){
    console.error("Auto Carry Error:", error);
  }

}
async function processCarryForward(){

  const settingsDoc = await db.collection("leave_settings").doc("cycle").get();
  const cycle = settingsDoc.data();

  const cycleStart = new Date(cycle.startYear, cycle.startMonth - 1, 1);
  const cycleEnd = new Date(cycle.endYear, cycle.endMonth, 0);

  // ===============================
  // 1. FETCH ALL DATA ONCE
  // ===============================
  const userSnapshot = await db.collection("users")
    .where("role","==","employee")
    .get();

  const typeSnapshot = await db.collection("leave_types").get();

  const leaveSnapshot = await db.collection("leaves")
    .where("status","==","approved")
    .get();

  // ===============================
  // 2. GROUP LEAVES BY USER + TYPE
  // ===============================
  let userLeaveMap = {};

  leaveSnapshot.forEach(doc=>{
    let d = doc.data();

    if(!userLeaveMap[d.userId]){
      userLeaveMap[d.userId] = {};
    }

    if(!userLeaveMap[d.userId][d.leaveType]){
      userLeaveMap[d.userId][d.leaveType] = [];
    }

    userLeaveMap[d.userId][d.leaveType].push(d);
  });

  // ===============================
  // 3. BATCH PROCESS USERS
  // ===============================
  let batch = db.batch();
  let count = 0;

  for(const userDoc of userSnapshot.docs){

    const uid = userDoc.id;
    let carryData = {};

    const leaveMap = userLeaveMap[uid] || {};

    for(const typeDoc of typeSnapshot.docs){

      const typeData = typeDoc.data();
      const leaveName = typeData.name;
      const maxDays = Number(typeData.max_days || 0);
      const settings = typeData.settings || {};

      // ❌ skip if carry not enabled
      if(settings.carryForward !== true) continue;

      let startDate = new Date(cycleStart);
      let endDate = new Date(cycleEnd);

      // ===============================
      // MONTHLY MODE SUPPORT
      // ===============================
      if(settings.carryType === "monthly"){
        if(settings.monthlyEnabled !== true) continue;

        const today = new Date();
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth()+1, 0);
      }

      let usedDates = new Set();
      let leaves = leaveMap[leaveName] || [];

      // ===============================
      // CALCULATE USED DAYS
      // ===============================
      leaves.forEach(l => {

        let leaveStart = new Date(l.startDate);
        let leaveEnd = new Date(l.endDate);

        if(leaveEnd < startDate || leaveStart > endDate) return;

        let current = new Date(leaveStart);

        while(current <= leaveEnd){
          if(current >= startDate && current <= endDate){
            usedDates.add(current.toISOString().split("T")[0]);
          }
          current.setDate(current.getDate()+1);
        }

      });

      let used = usedDates.size;
      let remaining = Math.max(0, maxDays - used);

      // ❌ skip only if no remaining
      if(remaining <= 0) continue;

      // ===============================
      // CALCULATE CARRY
      // ===============================
      let maxCarry = settings.carryForwardMax ?? remaining;

      let carry = settings.carryForwardMax === 0
        ? 0
        : Math.min(remaining, maxCarry);

      // ✅ ALWAYS SAVE (IMPORTANT FIX)
      carryData[leaveName] = carry;

    }

    // ===============================
    // SAVE TO FIRESTORE (BATCH)
    // ===============================
    const ref = db.collection("users").doc(uid);

    batch.update(ref, {
      carry_forward: carryData
    });

    count++;

    // 🔥 Firestore batch limit = 500
    if(count === 500){
      await batch.commit();
      batch = db.batch();
      count = 0;
    }

  }

  // ===============================
  // FINAL COMMIT
  // ===============================
  if(count > 0){
    await batch.commit();
  }

  console.log("✅ Carry forward updated successfully");

}
async function disableButtonIfAuto(){

  const doc = await db.collection("leave_settings").doc("cycle").get();

  if(doc.exists && doc.data().carryMode === "auto"){
    const btn = document.querySelector("button[onclick='runCarryForward()']");
    if(btn){
      btn.disabled = true;
      btn.innerText = "🤖 AUTO MODE ENABLED";
      btn.style.background = "gray";
    }
  }

}