import { db } from './firebaseConfig.js';
import { ref, onValue, get, set } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    window.location.href = 'index.html';
  });
}

const listEl = document.getElementById('list');
const historyModal = document.getElementById('historyModal');
const viewHistoryBtn = document.getElementById('viewHistoryBtn');
const closeHistory = document.getElementById('closeHistory');

// topbar buttons and related handlers
let addExpenseBtn, viewBalanceBtn;
let expenseModal, expenseForm, cancelExpense, expenseErr;
let balanceModal, closeBalance, exportReportBtn;

function initTopbar(){
  addExpenseBtn = document.getElementById('addExpenseBtn');
  viewBalanceBtn = document.getElementById('viewBalanceBtn');

  expenseModal = document.getElementById('expenseModal');
  expenseForm = document.getElementById('expenseForm');
  cancelExpense = document.getElementById('cancelExpense');
  expenseErr = document.getElementById('expenseErr');

  balanceModal = document.getElementById('balanceModal');
  closeBalance = document.getElementById('closeBalance');
  exportReportBtn = document.getElementById('exportReportBtn');

  if (addExpenseBtn) addExpenseBtn.addEventListener('click', () => {
    if (expenseModal) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const el = document.getElementById('expenseDate');
      if (el) el.value = `${yyyy}-${mm}-${dd}`;
      expenseModal.classList.add('open');
    }
  });
  if (cancelExpense) cancelExpense.addEventListener('click', () => { if (expenseModal) expenseModal.classList.remove('open'); });

  if (viewBalanceBtn) viewBalanceBtn.addEventListener('click', async () => {
    try {
      const creditSnap = await get(ref(db, 'credit'));
      const credits = creditSnap.val() || {};
      // Sum credits
      let creditCash = 0, creditOnline = 0;
      for (const k in credits) {
        const c = credits[k] || {};
        creditCash += Number(c.cash) || 0;
        creditOnline += Number(c.online) || 0;
      }

      // Sum debits
      const debitSnap = await get(ref(db, 'debit'));
      const debits = debitSnap.val() || {};
      let debitCash = 0, debitOnline = 0;
      for (const k in debits) {
        const d = debits[k] || {};
        debitCash += Number(d.cash) || 0;
        debitOnline += Number(d.online) || 0;
      }

      // Sum owners due (only positive amounts)
      const ownersSnap = await get(ref(db, 'flatowners'));
      const owners = ownersSnap.val() || {};
      let totalDue = 0;
      for (const k in owners) {
        const o = owners[k] || {};
        const dueVal = Number(o.due) || 0;
        if (dueVal > 0) totalDue += dueVal;
      }

      // Apply formula: total cash = credit.cash - debit.cash; total online = credit.online - debit.online
      const totalCash = creditCash - debitCash;
      const totalBank = creditOnline - debitOnline;

      if (document.getElementById('totalCash')) document.getElementById('totalCash').textContent = '₹ ' + totalCash;
      if (document.getElementById('totalBank')) document.getElementById('totalBank').textContent = '₹ ' + totalBank;
      if (document.getElementById('totalDue')) document.getElementById('totalDue').textContent = '₹ ' + totalDue;

      if (balanceModal) balanceModal.classList.add('open');
    } catch (e) {
      console.error(e);
    }
  });

  if (closeBalance) closeBalance.addEventListener('click', () => { if (balanceModal) balanceModal.classList.remove('open'); });

 if (exportReportBtn) exportReportBtn.addEventListener('click', async () => {
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
});


  // Expense form submit -> save to debit/debitN
  if (expenseForm) {
    expenseForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (expenseErr) expenseErr.textContent = '';
      const summary = document.getElementById('expenseSummary')?.value?.trim();
      const dateVal = document.getElementById('expenseDate')?.value?.trim();
      const cash = document.getElementById('expenseCash')?.value?.trim() || '';
      const online = document.getElementById('expenseOnline')?.value?.trim() || '';

      if (!summary || !dateVal) {
        if (expenseErr) expenseErr.textContent = 'Please enter summary and date.';
        return;
      }

      try {
        const submitBtn = document.getElementById('submitExpense');
        if (submitBtn) submitBtn.disabled = true;

        const debitSnap = await get(ref(db, 'debit'));
        const debitNodes = debitSnap.val() || {};
        let max = 0;
        for (const k in debitNodes) {
          const m = String(k).match(/^debit(\d+)$/i);
          if (m) {
            const n = Number(m[1]); if (!Number.isNaN(n) && n > max) max = n;
          }
        }
        const nextKey = 'debit' + (max + 1);

        const p = dateVal.split('-');
        const dateOut = p.length===3 ? `${p[2]}/${p[1]}/${p[0]}` : dateVal;

        const payload = {
          cash: String(Number(cash) || ''),
          date: dateOut,
          online: String(Number(online) || ''),
          summary: summary
        };

        await set(ref(db, `debit/${nextKey}`), payload);
        if (submitBtn) submitBtn.disabled = false;
        if (expenseModal) expenseModal.classList.remove('open');
        if (expenseForm) expenseForm.reset();
      } catch (e) {
        console.error(e);
        if (expenseErr) expenseErr.textContent = 'Failed to save expense.';
      }
    });
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initTopbar);
} else {
  initTopbar();
}

// Add-modal elements
const addBtn = document.getElementById('addBtn');
const addModal = document.getElementById('addModal');
const addForm = document.getElementById('addForm');
const cancelAdd = document.getElementById('cancelAdd');
const formErr = document.getElementById('formErr');

function openModal(){
  if(addModal) addModal.classList.add('open');
}
function closeModal(){
  if(addModal) addModal.classList.remove('open');
  if(addForm) addForm.reset();
  if(formErr) formErr.textContent = '';
}

if (addBtn) addBtn.addEventListener('click', openModal);
if (cancelAdd) cancelAdd.addEventListener('click', closeModal);

// handle submit to add new flatowner
if (addForm) addForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (formErr) formErr.textContent = '';

  const name = document.getElementById('nameInput')?.value.trim();
  const flat = document.getElementById('flatInput')?.value.trim();
  const contact = document.getElementById('contactInput')?.value.trim();
  const maintenance = document.getElementById('maintenanceInput')?.value.trim();
  const due = document.getElementById('dueInput')?.value.trim();

  if (!name || !flat || !contact || maintenance === '' || due === '') {
    if (formErr) formErr.textContent = 'Please fill all required fields.';
    return;
  }

  const payload = {
    name,
    flat,
    contact,
    maintenance: Number(maintenance) || 0,
    due: Number(due) || 0
  };

  try {
    const submitBtn = document.getElementById('submitAdd');
    if (submitBtn) submitBtn.disabled = true;

    const listSnap = await get(ref(db, 'flatowners'));
    const nodes = listSnap.val() || {};
    let max = 0;
    for (const k in nodes) {
      const m = String(k).match(/^flatowners(\d+)$/i);
      if (m) {
        const n = Number(m[1]);
        if (!Number.isNaN(n) && n > max) max = n;
      }
    }
    const nextKey = 'flatowners' + (max + 1);

    await set(ref(db, `flatowners/${nextKey}`), payload);

    if (submitBtn) submitBtn.disabled = false;
    closeModal();
  } catch (err) {
    console.error(err);
    if (formErr) formErr.textContent = 'Failed to save. Try again.';
  }
});

function renderEmpty(text){
  listEl.innerHTML = `<div class="empty">${text}</div>`;
}

function render(items){
  if (!items || Object.keys(items).length === 0) {
    renderEmpty('No flat owners found');
    return;
  }

const rows = Object.keys(items)
  .sort((a, b) => {
    const dueA = Number(items[a]?.due) || 0;
    const dueB = Number(items[b]?.due) || 0;
    return dueB - dueA; // highest due first
  })
  .map(k => {
    const it = items[k] || {};
    const name = it.name || it.username || '—';
    const flat = it.flat || '';
    const maintenance = it.maintenance ?? '';
    const due = it.due ?? '';
    const contact = it.contact || '';

    const dueNum = Number(due) || 0;
    const smsMsg = dueNum < 1
      ? `** Reminder from BNA(BLOCK-A) **\nThank you. You have no pending maintenance dues.`
      : `** Reminder from BNA(BLOCK-A) **\nYou have pending maintenance dues of ₹${dueNum}. Please clear them at the earliest possible.`;
    const smsEncoded = encodeURIComponent(smsMsg);

    return `
      <div class="row">
        <div class="left">
          <div class="name">${escapeHtml(name)}</div>
          <div class="meta">${flat} <span class="small">· Maintenance: ${maintenance} · Due: ${due}</span></div>
        </div>
        <div class="actions">
          ${contact ? `<a class="icon" href="tel:${contact}" title="Call">📞</a>` : ''}
          <a class="icon" href="sms:${contact}?body=${smsEncoded}" title="SMS">💬</a>
          <button class="icon-btn payment-btn" data-key="${k}" data-name="${escapeHtml(name)}" data-flat="${escapeHtml(flat)}" data-maintenance="${maintenance}" data-due="${due}" title="Add Payment" style="background:none;border:none;cursor:pointer;color:#3a86ff;font-size:16px">+</button>
        </div>
      </div>`;
  });

  listEl.innerHTML = rows.join('\n');

  document.querySelectorAll('.payment-btn').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      const name = btn.getAttribute('data-name');
      const maintenance = btn.getAttribute('data-maintenance');
      const due = btn.getAttribute('data-due');
      const flat = btn.getAttribute('data-flat') || '';
      const key = btn.getAttribute('data-key');
      openPaymentModal(key, name, maintenance, due, flat);
    });
  });
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
}

// Payment modal
const paymentModal = document.getElementById('paymentModal');
const paymentForm = document.getElementById('paymentForm');
const paymentType = document.getElementById('paymentType');
const txnIdLabel = document.getElementById('txnIdLabel');
const paymentTxnId = document.getElementById('paymentTxnId');
const cancelPayment = document.getElementById('cancelPayment');
const paymentErr = document.getElementById('paymentErr');
let currentPaymentKey = null;
let currentPaymentFlat = '';

function openPaymentModal(key, name, maintenance, due, flat){
  currentPaymentKey = key;
  currentPaymentFlat = flat;
  if (document.getElementById('paymentName')) document.getElementById('paymentName').textContent = name;
  if (document.getElementById('paymentMaintenance')) document.getElementById('paymentMaintenance').textContent = '₹ ' + maintenance;
  if (document.getElementById('paymentDue')) document.getElementById('paymentDue').textContent = '₹ ' + due;
  
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  if (document.getElementById('paymentDate')) {
    document.getElementById('paymentDate').value = `${yyyy}-${mm}-${dd}`;
  }

  if (paymentModal) paymentModal.classList.add('open');
  if (paymentType) paymentType.value = '';
  if (paymentTxnId) paymentTxnId.value = '';
  if (txnIdLabel) txnIdLabel.style.display = 'none';
  if (paymentErr) paymentErr.textContent = '';
}

function closePaymentModal(){
  if (paymentModal) paymentModal.classList.remove('open');
  if (paymentForm) paymentForm.reset();
  if (paymentErr) paymentErr.textContent = '';
  if (txnIdLabel) txnIdLabel.style.display = 'none';
  currentPaymentKey = null;
}

if (paymentType) {
  paymentType.addEventListener('change', () => {
    if (txnIdLabel) {
      txnIdLabel.style.display = paymentType.value === 'Online' ? 'block' : 'none';
    }
    if (paymentTxnId && paymentType.value === 'Cash') {
      paymentTxnId.removeAttribute('required');
    } else if (paymentTxnId) {
      paymentTxnId.setAttribute('required', 'required');
    }
  });
}

if (cancelPayment) {
  cancelPayment.addEventListener('click', closePaymentModal);
}

if (paymentForm) {
  paymentForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (paymentErr) paymentErr.textContent = '';

    const pType = paymentType?.value?.trim();
    const txnId = paymentTxnId?.value?.trim() || '';
    const amountRec = document.getElementById('amountReceived')?.value?.trim();
    const paymentDateVal = document.getElementById('paymentDate')?.value?.trim();

    if (!pType) {
      if (paymentErr) paymentErr.textContent = 'Please select payment type.';
      return;
    }

    if (!paymentDateVal) {
      if (paymentErr) paymentErr.textContent = 'Please select a date.';
      return;
    }

    if (!amountRec) {
      if (paymentErr) paymentErr.textContent = 'Please enter amount received.';
      return;
    }

    if (pType === 'Online' && !txnId) {
      if (paymentErr) paymentErr.textContent = 'Please enter transaction ID for Online payment.';
      return;
    }

    if (!currentPaymentKey) {
      if (paymentErr) paymentErr.textContent = 'Error: Flat owner key not found.';
      return;
    }

    try {
      const submitBtn = document.getElementById('submitPayment');
      if (submitBtn) submitBtn.disabled = true;

      const creditSnap = await get(ref(db, 'credit'));
      const creditNodes = creditSnap.val() || {};
      let max = 0;
      for (const k in creditNodes) {
        const m = String(k).match(/^credit(\d+)$/i);
        if (m) {
          const n = Number(m[1]);
          if (!Number.isNaN(n) && n > max) max = n;
        }
      }
      const nextKey = 'credit' + (max + 1);

      const parts = paymentDateVal.split('-');
      const dateFormatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : paymentDateVal;

      const creditPayload = {
        cash: '',
        date: dateFormatted,
        flatno: currentPaymentFlat || '',
        name: (document.getElementById('paymentName')?.textContent) || '',
        online: '',
        txnid: ''
      };

      if (pType === 'Cash') {
        creditPayload.cash = String(Number(amountRec) || 0);
      } else {
        creditPayload.online = String(Number(amountRec) || 0);
        creditPayload.txnid = txnId || '';
      }

      await set(ref(db, `credit/${nextKey}`), creditPayload);

      // Deduct amount received from the owner's due: flatowners.due = flatowners.due - amountRec
      try {
        const amt = Number(amountRec) || 0;
        if (currentPaymentKey && !Number.isNaN(amt)) {
          const ownerSnap = await get(ref(db, `flatowners/${currentPaymentKey}`));
          const owner = ownerSnap.val() || {};
          const oldDue = Number(owner.due) || 0;
          const newDue = oldDue - amt;
          await set(ref(db, `flatowners/${currentPaymentKey}/due`), newDue);
        }
      } catch (e) {
        console.error('Failed to update owner due:', e);
      }

      if (submitBtn) submitBtn.disabled = false;
      closePaymentModal();
    } catch (err) {
      console.error(err);
      if (paymentErr) paymentErr.textContent = 'Failed to save payment. Try again.';
    }
  });
}

function addFineToAll(){
  (async ()=>{
    try{
      const ownersSnap = await get(ref(db,'flatowners'));
      const owners = ownersSnap.val() || {};
      for(const k in owners){
        const o = owners[k] || {};
        const due = Number(o.due) || 0;
        if (due >= 1){
          const newDue = due + 50;
          await set(ref(db, `flatowners/${k}/due`), newDue);
        }
      }
      alert('Fine applied where applicable');
    }catch(e){ console.error(e); alert('Failed to apply fine'); }
  })();
}

function addMaintenanceToAll(){
  (async ()=>{
    try{
      const ownersSnap = await get(ref(db,'flatowners'));
      const owners = ownersSnap.val() || {};
      for(const k in owners){
        const o = owners[k] || {};
        const due = Number(o.due) || 0;
        const maintenance = Number(o.maintenance) || 0;
        const newDue = due + maintenance;
        await set(ref(db, `flatowners/${k}/due`), newDue);
      }
      alert('Maintenance added to all owners');
    }catch(e){ console.error(e); alert('Failed to add maintenance'); }
  })();
}

  // History Fetching Logic
  if (viewHistoryBtn) viewHistoryBtn.addEventListener('click', async () => {
    const creditSnap = await get(ref(db, 'credit'));
    const debitSnap = await get(ref(db, 'debit'));
    
    renderHistoryTable('creditTableBody', creditSnap.val(), ['date', 'flatno', 'name', 'cash', 'online', 'txnid']);
    renderHistoryTable('debitTableBody', debitSnap.val(), ['date', 'summary', 'cash', 'online']);
    
    if (historyModal) historyModal.classList.add('open');

  });

  if (closeHistory) closeHistory.addEventListener('click', () => historyModal.classList.remove('open'));

// ===== History Tab Switching (Credit / Debit) =====
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {

    // remove active class from all buttons
    document.querySelectorAll('.tab-btn').forEach(b =>
      b.classList.remove('active')
    );

    // hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab =>
      tab.classList.remove('active')
    );

    // activate clicked button
    btn.classList.add('active');

    // show related tab
    const tabId = btn.getAttribute('data-tab');
    const tabContent = document.getElementById(tabId);
    if (tabContent) tabContent.classList.add('active');
  });
});


// Wire up Fine and Maintenance buttons in Balance modal
const fineBtn = document.getElementById('fineBtn');
const maintenanceBtn = document.getElementById('maintenanceBtn');
if (fineBtn) fineBtn.addEventListener('click', ()=>{ if (confirm('Apply ₹50 fine to all owners with due >= 1?')) addFineToAll(); });
if (maintenanceBtn) maintenanceBtn.addEventListener('click', ()=>{ if (confirm('Add monthly maintenance to total due for all owners?')) addMaintenanceToAll(); });

renderEmpty('Loading...');

onValue(ref(db, 'flatowners'), snap => {
  render(snap.val());
});

function renderHistoryTable(tbodyId, data, columns) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!data) {
    tbody.innerHTML = `<tr><td colspan="${columns.length}">No records</td></tr>`;
    return;
  }

  // Convert object to array and SORT by DATE (latest first)
  const rows = Object.values(data).sort((a, b) => {
    // date format: DD/MM/YYYY
    const da = a.date?.split('/').reverse().join('-');
    const db = b.date?.split('/').reverse().join('-');
    return new Date(db) - new Date(da);
  });

  rows.forEach(item => {
    const tr = document.createElement('tr');

    columns.forEach(col => {
      const td = document.createElement('td');
      td.textContent = item[col] || '-';
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}
