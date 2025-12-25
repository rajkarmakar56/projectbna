import { auth } from './firebaseConfig.js';
import { signInWithEmailAndPassword } 
from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

window.login = async () => {
  const email = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const msgEl = document.getElementById('msg');

  try {
    await signInWithEmailAndPassword(auth, email, password);
    msgEl.textContent = 'Login successful ✅';
    msgEl.className = 'msg success';
    setTimeout(() => window.location.href = 'info.html', 800);
  } catch (err) {
    msgEl.textContent = 'Invalid credentials';
    msgEl.className = 'msg error';
  }
};
