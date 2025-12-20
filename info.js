import { db } from './firebaseConfig.js';
import { ref, onValue, get, set } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';

// Topbar & UI Elements
const logoutBtn = document.getElementById('logoutBtn');
const listEl = document.getElementById('list');
const historyModal = document.getElementById('historyModal');
const viewHistoryBtn = document.getElementById('viewHistoryBtn');
const closeHistory = document.getElementById('closeHistory');

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

if (logoutBtn) logoutBtn.addEventListener('click', (e) => { e.preventDefault(); window.location.href = 'index.html'; });

function initTopbar(){
  const addExpenseBtn = document.getElementById('addExpenseBtn');
  const viewBalanceBtn = document.getElementById('viewBalanceBtn');
  const expenseModal = document.getElementById('expenseModal');
  const balanceModal = document.getElementById('balanceModal');

  // Add Expense Open
  if (addExpenseBtn) addExpenseBtn.addEventListener('click', () => {
    document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
    expenseModal.classList.add('open');
  });

  // History Fetching Logic
  if (viewHistoryBtn) viewHistoryBtn.addEventListener('click', async () => {
    const creditSnap = await get(ref(db, 'credit'));
    const debitSnap = await get(ref(db, 'debit'));
    
    renderHistoryTable('creditTableBody', creditSnap.val(), ['date', 'flatno', 'name', 'cash', 'online', 'txnid']);
    renderHistoryTable('debitTableBody', debitSnap.val(), ['date', 'summary', 'cash', 'online']);
    
    historyModal.classList.add('open');
  });

  if (closeHistory) closeHistory.addEventListener('click', () => historyModal.classList.remove('open'));

  // Balance Logic
  if (viewBalanceBtn) viewBalanceBtn.addEventListener('click', async () => {
    const cSnap = await get(ref(db, 'credit'));
    const dSnap = await get(ref(db, 'debit'));
    const oSnap = await get(ref(db, 'flatowners'));
    
    let cCash=0, cOnline=0, dCash=0, dOnline=0, tDue=0;
    Object.values(cSnap.val()||{}).forEach(v => { cCash += Number(v.cash)||0; cOnline += Number(v.online)||0; });
    Object.values(dSnap.val()||{}).forEach(v => { dCash += Number(v.cash)||0; dOnline += Number(v.online)||0; });
    Object.values(oSnap.val()||{}).forEach(v => { if(v.due > 0) tDue += Number(v.due); });

    document.getElementById('totalCash').textContent = '₹ ' + (cCash - dCash);
    document.getElementById('totalBank').textContent = '₹ ' + (cOnline - dOnline);
    document.getElementById('totalDue').textContent = '₹ ' + tDue;
    balanceModal.classList.add('open');
  });

  exportReportBtn.onclick = async () => {
  try {
    const ownersSnap = await get(ref(db, 'flatowners'));
    const creditSnap = await get(ref(db, 'credit'));
    const debitSnap = await get(ref(db, 'debit'));
    
    const owners = ownersSnap.val() || {};
    const credits = creditSnap.val() || {};
    const debits = debitSnap.val() || {};

    // 1. Calculate Totals
    let cashIn = 0, onlineIn = 0, cashOut = 0, onlineOut = 0, totalDue = 0;
    
    Object.values(credits).forEach(c => {
      cashIn += Number(c.cash) || 0;
      onlineIn += Number(c.online) || 0;
    });
    Object.values(debits).forEach(d => {
      cashOut += Number(d.cash) || 0;
      onlineOut += Number(d.online) || 0;
    });
    Object.values(owners).forEach(o => {
      totalDue += Number(o.due) || 0;
    });

    // 2. Build the CSV Content
    let csv = "=== TOTAL BALANCE ===\n";
    csv += "TYPE,AMOUNT\n";
    csv += `CASH_IN,${cashIn}\n`;
    csv += `CASH_OUT,${cashOut}\n`;
    csv += `CASH_LEFT,${cashIn - cashOut}\n`;
    csv += `ACCOUNT_IN,${onlineIn}\n`;
    csv += `ACCOUNT_OUT,${onlineOut}\n`;
    csv += `ACCOUNT_LEFT,${onlineIn - onlineOut}\n`;
    csv += `TOTAL_DUE,${totalDue}\n\n`;

    // 3. Add CREDIT History (Payments)
    csv += "=== CREDIT HISTORY (PAYMENTS) ===\n";
    csv += "Date,Flat,Name,Cash,Online,TxnID\n";
    Object.values(credits).reverse().forEach(c => {
      csv += `${c.date},${c.flatno},"${c.name}",${c.cash || 0},${c.online || 0},${c.txnid || '-'}\n`;
    });
    csv += "\n";

    // 4. Add DEBIT History (Expenses)
    csv += "=== DEBIT HISTORY (EXPENSES) ===\n";
    csv += "Date,Summary,Cash,Online\n";
    Object.values(debits).reverse().forEach(d => {
      csv += `${d.date},"${d.summary}",${d.cash || 0},${d.online || 0}\n`;
    });
    csv += "\n";

    // 5. Add OWNER STATUS
    csv += "=== OWNERS CURRENT STATUS ===\n";
    csv += '"name","flat","contact","maintenance","due"\n';
    const sortedOwners = Object.values(owners).sort((a, b) => 
      a.flat.localeCompare(b.flat, undefined, { numeric: true })
    );
    sortedOwners.forEach(o => {
      csv += `"${o.name}","${o.flat}","${o.contact}","${o.maintenance}","${o.due}"\n`;
    });

    // 6. Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BNA_Full_Report_${new Date().toLocaleDateString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
  } catch (e) {
    console.error("Export Error:", e);
    alert("Failed to generate complete report");
  }
};

  document.getElementById('cancelExpense').onclick = () => expenseModal.classList.remove('open');
  document.getElementById('closeBalance').onclick = () => balanceModal.classList.remove('open');
}

// Render History Tables
function renderHistoryTable(targetId, data, fields) {
  const tbody = document.getElementById(targetId);
  if (!data) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">No Records</td></tr>'; return; }
  
  const sorted = Object.values(data).sort((a, b) => {
    return b.date.split('/').reverse().join('-').localeCompare(a.date.split('/').reverse().join('-'));
  });

  tbody.innerHTML = sorted.map(item => `
    <tr>${fields.map(f => `<td>${item[f] || '-'}</td>`).join('')}</tr>
  `).join('');
}

// Flat Owners Rendering (Main List)
function render(items){
  if (!items) { listEl.innerHTML = '<div class="empty">No owners found</div>'; return; }
  const rows = Object.keys(items).sort((a,b) => (items[b].due || 0) - (items[a].due || 0)).map(k => {
    const it = items[k];
    const sms = `** Reminder BNA **\nYour pending due is ₹${it.due}. Please pay soon.`;
    return `<div class="row">
      <div class="left"><div class="name">${it.name}</div><div class="meta">${it.flat} · Due: ₹${it.due}</div></div>
      <div class="actions">
        <a class="icon" href="tel:${it.contact}">📞</a>
        <a class="icon" href="sms:${it.contact}?body=${encodeURIComponent(sms)}">💬</a>
        <button class="icon-btn" onclick="openPay('${k}','${it.name}','${it.due}','${it.flat}')">+</button>
      </div>
    </div>`;
  });
  listEl.innerHTML = rows.join('');
}

window.openPay = (key, name, due, flat) => {
  document.getElementById('paymentName').textContent = name;
  document.getElementById('paymentDue').textContent = '₹ ' + due;
  document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];
  const modal = document.getElementById('paymentModal');
  modal.dataset.key = key; modal.dataset.flat = flat;
  modal.classList.add('open');
};

document.getElementById('paymentForm').onsubmit = async (e) => {
  e.preventDefault();
  const modal = document.getElementById('paymentModal');
  const amt = Number(document.getElementById('amountReceived').value);
  const type = document.getElementById('paymentType').value;
  const date = document.getElementById('paymentDate').value.split('-').reverse().join('/');
  
  const snap = await get(ref(db, 'credit'));
  const nextKey = 'credit' + (Object.keys(snap.val()||{}).length + 1);
  
  await set(ref(db, `credit/${nextKey}`), {
    date, name: document.getElementById('paymentName').textContent,
    flatno: modal.dataset.flat, cash: type === 'Cash' ? String(amt) : '',
    online: type === 'Online' ? String(amt) : '',
    txnid: document.getElementById('paymentTxnId').value
  });

  const dueRef = ref(db, `flatowners/${modal.dataset.key}/due`);
  const curDue = (await get(dueRef)).val();
  await set(dueRef, curDue - amt);
  modal.classList.remove('open');
};

// restored ORIGINAL SORTING LOGIC FOR UPDATE OWNER
const updateBtn = document.getElementById('updateUserBtn');
const updateModal = document.getElementById('updateModal');
const flatSelect = document.getElementById('updateFlatSelect');

updateBtn.onclick = async () => {
  flatSelect.innerHTML = '<option value="">Select Flat</option>';
  const snap = await get(ref(db, 'flatowners'));
  const owners = snap.val() || {};

  // Restored: Sort using localeCompare for natural flat numbering
  const sorted = Object.entries(owners).sort((a, b) => {
    return a[1].flat.localeCompare(b[1].flat, undefined, { numeric: true });
  });

  for (let [key, owner] of sorted) {
    const opt = document.createElement('option');
    opt.value = key; opt.textContent = owner.flat;
    flatSelect.appendChild(opt);
  }
  updateModal.classList.add('open');
};

flatSelect.onchange = async () => {
  const key = flatSelect.value; if(!key) return;
  const o = (await get(ref(db, 'flatowners/' + key))).val();
  document.getElementById('updateName').value = o.name;
  document.getElementById('updateFlat').value = o.flat;
  document.getElementById('updateContact').value = o.contact;
  document.getElementById('updateMaintenance').value = o.maintenance;
  document.getElementById('updateDue').value = o.due;
};

document.getElementById('saveUpdate').onclick = async () => {
  const key = flatSelect.value; if(!key) return;
  await set(ref(db, 'flatowners/' + key), {
    name: document.getElementById('updateName').value,
    flat: document.getElementById('updateFlat').value,
    contact: document.getElementById('updateContact').value,
    maintenance: Number(document.getElementById('updateMaintenance').value),
    due: Number(document.getElementById('updateDue').value)
  });
  updateModal.classList.remove('open');
};

document.getElementById('cancelUpdate').onclick = () => updateModal.classList.remove('open');
document.getElementById('cancelPayment').onclick = () => document.getElementById('paymentModal').classList.remove('open');
document.getElementById('paymentType').onchange = (e) => {
  document.getElementById('txnIdLabel').style.display = e.target.value === 'Online' ? 'block' : 'none';
};

initTopbar();
onValue(ref(db, 'flatowners'), snap => render(snap.val()));