const adminForm = document.getElementById("adminRegisterForm");

adminForm.addEventListener("submit", async function(e){

e.preventDefault();

const name = document.getElementById("name").value;
const email = document.getElementById("email").value;
const password = document.getElementById("password").value;

try{

// create admin in authentication
const userCredential = await auth.createUserWithEmailAndPassword(email,password);

const uid = userCredential.user.uid;

// save admin in firestore
await db.collection("users").doc(uid).set({

name: name,
email: email,
role: "admin",
status: "approved",
createdAt: new Date()

});

alert("Admin account created successfully");

window.location.href="login.html";

}catch(error){

alert(error.message);

}

});