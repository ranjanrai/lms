firebase.auth().onAuthStateChanged(function(user){

if(!user){
alert("Please login first");
window.location.href="login.html";
return;
}

const db = firebase.firestore();
const table = document.getElementById("leaveTable");

db.collection("leaves")
.where("userId","==",user.uid)
.orderBy("createdAt","desc")
.get()
.then((querySnapshot)=>{

table.innerHTML="";

querySnapshot.forEach((doc)=>{

const data = doc.data();

let statusClass = "status-" + data.status;

let row = `
<tr>
<td>${data.leaveType}</td>
<td>${data.startDate}</td>
<td>${data.endDate}</td>
<td>${data.days}</td>
<td>${data.reason}</td>
<td class="${statusClass}">${data.status}</td>
<td>
${data.status === "pending" ? 
`<button onclick="cancelLeave('${doc.id}')">Cancel</button>` 
: ""}
</td>
</tr>
`;

table.innerHTML += row;

});

});

});
function cancelLeave(id){

if(confirm("Cancel this leave request?")){

firebase.firestore()
.collection("leaves")
.doc(id)
.update({
status:"cancelled"
})
.then(()=>{
location.reload();
});

}

}
