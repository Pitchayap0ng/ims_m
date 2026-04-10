// --- Firebase Config ---
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

function showPage(id, el) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(p => {
        p.classList.remove('active', 'animate__fadeInUp');
        if (p.id === id) {
            p.classList.add('active', 'animate__fadeInUp');
        }
    });

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('nav-active'));
    el.classList.add('nav-active');

    if (id === 'page-daily') renderDaily();
    if (id === 'page-stats') renderStats();
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
    }).then(() => {
        Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', timer: 1000, showConfirmButton: false });
        document.getElementById('amountInput').value = '';
    });
}

// โหลดข้อมูลอัตโนมัติ
db.ref('money_flow').on('value', s => {
    transactions = s.val() ? Object.values(s.val()) : [];
    updateUI();
});

function updateUI() {
    const total = transactions.reduce((s, t) => s + t.amount, 0);
    document.getElementById('mainBalance').innerText = total.toLocaleString();
    const isDark = document.body.classList.contains('dark');
    const activeClass = isDark ? 'bg-zinc-800 text-rose-500' : 'bg-white shadow-sm text-rose-500';
    const activeClassInc = isDark ? 'bg-zinc-800 text-emerald-500' : 'bg-white shadow-sm text-emerald-500';

    document.getElementById('btnExp').className = `flex-1 py-4 rounded-xl font-bold text-sm ${currentType === 'expense' ? activeClass : 'text-slate-400'}`;
    document.getElementById('btnInc').className = `flex-1 py-4 rounded-xl font-bold text-sm ${currentType === 'income' ? activeClassInc : 'text-slate-400'}`;
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
        options: { plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, font: { family: 'Anuphan' } } } } }
    });

    document.getElementById('dailyList').innerHTML = transactions.slice().reverse().map((t, index) => `
        <div class="flex justify-between items-center p-5 glass-card animate__animated animate__fadeInUp" style="animation-delay: ${index * 0.1}s">
            <div><p class="font-black dark:text-white">${t.cat}</p><p class="text-[10px] opacity-30 dark:text-white">${t.date} • ${t.time}</p></div>
            <p class="font-black ${t.amount < 0 ? 'text-rose-500' : 'text-emerald-500'}">${t.amount.toLocaleString()}</p>
        </div>`).join('');
}

function toggleDarkMode() {
    document.body.classList.toggle('dark');
}

// เริ่มต้นระบบ
document.getElementById('categorySelect').innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');