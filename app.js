const firebaseConfig = {
    apiKey: "AIzaSyA11zPbXEFs-sdIHKaxhkprkoGSGP1whfg",
    authDomain: "ims-fei.firebaseapp.com",
    databaseURL: "https://ims-fei-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ims-fei",
    storageBucket: "ims-fei.firebasestorage.app",
    messagingSenderId: "791711191329",
    appId: "1:791711191329:web:0a4ba03cd5f11eb71bae60"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentType = 'expense', transactions = [], dailyChart, statsChart;
const categories = ['อาหาร', 'เดินทาง', 'ช้อปปิ้ง', 'บ้าน', 'เงินเดือน', 'อื่นๆ'];
const catColors = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6', '#06b6d4'];

function toggleDarkMode() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    document.getElementById('darkIcon').className = isDark ? 'fa-solid fa-sun text-yellow-400' : 'fa-solid fa-moon text-slate-600';
    updateUI();
}

function setType(t) {
    currentType = t;
    updateUI();
}

function saveTransaction() {
    const amt = parseFloat(document.getElementById('amountInput').value);
    if (!amt) return;
    const id = Date.now();
    db.ref('money_flow/' + id).set({
        id, cat: document.getElementById('categorySelect').value,
        note: document.getElementById('noteInput').value,
        amount: currentType === 'expense' ? -amt : amt,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    });
    document.getElementById('amountInput').value = '';
    document.getElementById('noteInput').value = '';
}

db.ref('money_flow').on('value', s => {
    transactions = s.val() ? Object.values(s.val()) : [];
    updateUI();
    if (document.getElementById('page-daily').classList.contains('active')) renderDaily();
    if (document.getElementById('page-stats').classList.contains('active')) renderStats();
});

function updateUI() {
    const total = transactions.reduce((s, t) => s + t.amount, 0);
    document.getElementById('mainBalance').innerText = total.toLocaleString(undefined, { minimumFractionDigits: 2 });
    const isDark = document.body.classList.contains('dark');
    const activeClass = isDark ? 'bg-zinc-800' : 'bg-white shadow-sm';
    document.getElementById('btnExp').className = `flex-1 py-4 rounded-xl font-bold text-sm transition-all ${currentType === 'expense' ? activeClass + ' text-rose-500' : 'text-slate-400'}`;
    document.getElementById('btnInc').className = `flex-1 py-4 rounded-xl font-bold text-sm transition-all ${currentType === 'income' ? activeClass + ' text-emerald-500' : 'text-slate-400'}`;
}

function renderDaily() {
    const catSum = {};
    transactions.forEach(t => { catSum[t.cat] = (catSum[t.cat] || 0) + Math.abs(t.amount); });
    const labels = Object.keys(catSum);
    const colors = labels.map(l => catColors[categories.indexOf(l)]);

    const ctx = document.getElementById('dailyChart').getContext('2d');
    if (dailyChart) dailyChart.destroy();
    dailyChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: Object.values(catSum), backgroundColor: colors, borderWidth: 0 }] },
        options: { cutout: '65%', plugins: { legend: { display: true, position: 'bottom', labels: { color: document.body.classList.contains('dark') ? '#fff' : '#000', usePointStyle: true, font: { family: 'Anuphan' } } } } }
    });

    document.getElementById('dailyList').innerHTML = transactions.slice().reverse().map(t => `
        <div class="flex justify-between items-center p-5 border-b dark:border-zinc-900 border-slate-50">
            <div><p class="text-sm font-black">${t.cat}</p><p class="text-[10px] font-bold opacity-30">${t.date} • ${t.time}</p></div>
            <div class="flex items-center gap-4">
                <p class="font-inter font-black ${t.amount < 0 ? 'text-rose-500' : 'text-emerald-500'}">${t.amount.toLocaleString()}</p>
                <button onclick="deleteItem(${t.id})" class="text-slate-300 hover:text-rose-500"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        </div>`).join('');
}

function renderStats() {
    const month = document.getElementById('monthPicker').value || new Date().toISOString().slice(0, 7);
    const filtered = transactions.filter(t => t.date.startsWith(month));
    const expTotal = Math.abs(filtered.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0));
    const incTotal = filtered.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);

    document.getElementById('statsSummary').innerHTML = `
        <div class="stat-box"><p class="stat-label">รายรับ</p><p class="stat-value text-emerald-500">${incTotal.toLocaleString()}</p></div>
        <div class="stat-box"><p class="stat-label">รายจ่าย</p><p class="stat-value text-rose-500">${expTotal.toLocaleString()}</p></div>
    `;

    const incomeData = categories.map(c => filtered.filter(t => t.cat === c && t.amount > 0).reduce((s, t) => s + t.amount, 0));
    const expenseData = categories.map(c => Math.abs(filtered.filter(t => t.cat === c && t.amount < 0).reduce((s, t) => s + t.amount, 0)));

    const ctx = document.getElementById('statsChart').getContext('2d');
    if (statsChart) statsChart.destroy();
    statsChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: categories, datasets: [{ label: 'รายรับ', data: incomeData, backgroundColor: '#10b981', borderRadius: 4 }, { label: 'รายจ่าย', data: expenseData, backgroundColor: '#f43f5e', borderRadius: 4 }] },
        options: { scales: { y: { display: false }, x: { ticks: { color: document.body.classList.contains('dark') ? '#ffffff66' : '#000', font: { size: 9 } } } }, plugins: { legend: { display: true, position: 'top', labels: { color: document.body.classList.contains('dark') ? '#fff' : '#000' } } } }
    });

    document.getElementById('statsList').innerHTML = filtered.reverse().map(t => `
        <div class="flex justify-between items-center py-3 border-b dark:border-zinc-900 border-slate-50">
            <div><p class="text-[11px] font-black">${t.cat}</p><p class="text-[9px] font-bold opacity-30">${t.date} • ${t.time}</p></div>
            <span class="font-inter font-black text-[11px] ${t.amount < 0 ? 'text-rose-500' : 'text-emerald-500'}">${t.amount.toLocaleString()}</span>
        </div>`).join('');
}

function showPage(id, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('nav-active'));
    el.classList.add('nav-active');
    if (id === 'page-daily') renderDaily();
    if (id === 'page-stats') renderStats();
}

function deleteItem(id) {
    db.ref('money_flow/' + id).remove();
}

document.getElementById('categorySelect').innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
document.getElementById('monthPicker').value = new Date().toISOString().slice(0, 7);