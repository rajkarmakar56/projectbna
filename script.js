import { db } from './firebaseConfig.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

window.login = async () => {
  const u = (document.getElementById('username')?.value || '').trim().toLowerCase();
  const p = (document.getElementById('password')?.value || '').trim();
  const msgEl = document.getElementById('msg');
  if (msgEl) msgEl.textContent = 'Checking...';

  try {
    const snap = await get(ref(db, 'users'));
    const users = snap.val() || {};
    let ok = false;

    for (let k in users) {
      const user = users[k] || {};
      if (
        (user.username || '').trim().toLowerCase() === u &&
        (user.pass || '').trim() === p
      ) {
        ok = true;
        break;
      }
    }

    if (msgEl) {
      msgEl.textContent = ok ? 'Login successful ✅' : 'Invalid username or password';
      msgEl.className = 'msg ' + (ok ? 'success' : 'error');
      if (ok) {
        // show success briefly then navigate to info page
        setTimeout(() => { window.location.href = 'info.html'; }, 800);
      }
    }
  } catch (e) {
    console.error(e);
    if (msgEl) {
      msgEl.textContent = 'Firebase error';
      msgEl.className = 'msg error';
    }
  }
};
