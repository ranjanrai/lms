<!DOCTYPE html>

<html lang="en">
<head>

<title>Employee Dashboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<!-- MAIN CSS -->

<link rel="stylesheet" href="css/style.css">

<!-- ICONS -->

<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">

</head>

<body>

<!-- SIDEBAR -->

<div class="sidebar" id="sidebar">

<h2>Employee Panel</h2>

<a href="employee-dashboard.html" class="menu active">
<i class="fas fa-home"></i> <span>Dashboard</span>
</a>

<a href="apply-leave.html" class="menu">
<i class="fas fa-paper-plane"></i> <span>Apply Leave</span>
</a>

<a href="leave-history.html" class="menu">
<i class="fas fa-history"></i> <span>Leave History</span>
</a>

<a href="#" class="menu" onclick="logout()">
<i class="fas fa-sign-out-alt"></i> <span>Logout</span>
</a>

</div>

<!-- MAIN -->

<div class="main">

<!-- HEADER -->

<div class="header">

<button onclick="toggleSidebar()">
<i class="fas fa-bars"></i>
</button>

<h2>Employee Dashboard</h2>
<div id="probationBanner" style="
margin:10px 0;
padding:10px;
border-radius:6px;
font-weight:bold;
display:none;">
</div>

<!-- 🔔 Notification Bell -->
<div class="notif-bell" onclick="toggleNotifBox()">
<i class="fas fa-bell"></i>
<span id="notifCount">0</span>
</div>

</div>
<div class="notif-box" id="notifBox" style="display:none;">
 <div class="notif-header">
  <h4>🔔 Notifications</h4>

  <div class="notif-actions">
    <button onclick="markAllRead()">Mark all</button>
    <button onclick="toggleNotifBox()" class="close-btn">✖</button>
  </div>
</div>

  <div id="notificationList" class="notif-list"></div>
</div>

 <h3>Leave Instructions</h3>
<div class="leave-grid" id="leaveInstructions"></div>

<!-- CARDS -->

<div class="cards">
  

<div class="card fade-in">
<h3>Total Leaves</h3>
<p id="totalLeaves">0</p>
</div>

<div class="card fade-in">
<h3>Pending</h3>
<p id="pendingLeaves">0</p>
</div>

<div class="card fade-in">
<h3>Approved</h3>
<p id="approvedLeaves">0</p>
</div>

</div>
<p id="carryInfo" style="color:green;font-weight:bold;"></p>
<!-- LEAVE BALANCE -->

<div class="card fade-in" style="margin-top:20px;">

<h3>Leave Balance</h3>

<table>
<thead>
<tr>
<th>Leave Type</th>
<th>Total</th>
<th>Used</th>
<th>Remaining</th>
<th>Carry Forward</th>   <!-- NEW -->
<th>Type</th> 
</tr>
</thead>

<tbody id="leaveBalanceTable"></tbody>
</table>

</div>




<!-- RECENT LEAVES -->

<div class="card fade-in" style="margin-top:20px;">

<h3>Recent Leave Requests</h3>

<table>
<thead>
<tr>
<th>Leave Type</th>
<th>Start Date</th>
<th>End Date</th>
<th>Days</th>   <!-- ✅ ADD THIS -->
<th>Status</th>
</tr>
</thead>

<tbody id="leaveTable"></tbody>
</table>

</div>
<div id="leaveModal" class="modal">

  <div class="modal-content">
    
    <span class="close" onclick="closeLeaveModal()">&times;</span>
    
    <h3 id="modalTitle"></h3>
    
    <div id="modalBody"></div>

  </div>

</div>
</div>

<!-- FIREBASE -->

<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>

<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>

<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>

<script src="js/firebase.js"></script>

<script src="js/auth.js"></script>

<script src="js/employee-dashboard.js"></script>

<script>

// SIDEBAR TOGGLE (MATCH ADMIN)
function toggleSidebar(){

const sidebar=document.getElementById("sidebar")

if(window.innerWidth <= 768){
sidebar.classList.toggle("active")
}else{
sidebar.classList.toggle("collapsed")
}

}
function toggleNotifBox(){
  const box = document.getElementById("notifBox")
  box.style.display = box.style.display === "block" ? "none" : "block"
}
</script>

</body>
</html>
