let menuItems = [], salesHistory = [], expenseHistory = [], currentExpType = 'income';

// --- 1. ดึงข้อมูล Real-time ---
db.ref('menu').on('value', snap => { menuItems = snap.val() ? Object.values(snap.val()) : []; renderAll(); });
db.ref('sales').on('value', snap => { salesHistory = snap.val() ? Object.values(snap.val()) : []; renderAll(); });
db.ref('expenses').on('value', snap => { expenseHistory = snap.val() ? Object.values(snap.val()) : []; renderAll(); });

function formatShortNumber(num) {
    if (num === null || isNaN(num)) return "0";
    const absNum = Math.abs(num);
    const sign = num < 0 ? "-" : "";
    if (absNum >= 1000000) return sign + (absNum / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (absNum >= 1000) return sign + (absNum / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return sign + absNum.toLocaleString();
}

function renderAll() {
    const select = document.getElementById('selectMenu');
    if (select) {
        const cur = select.value;
        select.innerHTML = '<option value="">-- เลือกสินค้า --</option>' +
            menuItems.map(m => `<option value="${m.id}" ${cur == m.id ? 'selected' : ''}>${m.name}</option>`).join('');
    }

    const mList = document.getElementById('masterMenuList');
    if (mList) {
        mList.innerHTML = menuItems.map(m => `
            <div class="card p-4 flex justify-between items-center mb-2 shadow-sm">
                <div><b>${m.name}</b><br><small class="opacity-50">ทุน ${m.cost} | ขาย ${m.price}</small></div>
                <button onclick="deleteMenu(${m.id})" class="text-red-400 p-2">✕</button>
            </div>`).join('');
    }

    const totalSalesProfit = salesHistory.reduce((sum, item) => sum + (parseFloat(item.profit) || 0), 0);
    const totalExpensesEffect = expenseHistory.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const netProfit = totalSalesProfit + totalExpensesEffect;

    const profitEl = document.getElementById('netProfit');
    if (profitEl) {
        profitEl.innerText = formatShortNumber(netProfit);
        profitEl.className = netProfit >= 0 ? "text-emerald-500 font-black" : "text-red-500 font-black";
    }

    if (typeof updateReportTables === 'function') updateReportTables(salesHistory, expenseHistory);
}

// --- แก้ไขรายการ (แยกเหตุผล) ---
async function editEntry(type, id) {
    const { value: pw } = await Swal.fire({
        title: 'ยืนยันรหัสผ่าน',
        input: 'password',
        inputAttributes: { inputmode: 'numeric' },
        showCancelButton: true
    });
    if (pw !== MASTER_PASSWORD) return pw !== undefined && Swal.fire('รหัสไม่ถูกต้อง', '', 'error');

    const snapshot = await db.ref(type).once('value');
    let targetKey = id;
    snapshot.forEach(child => { if (child.val().id == id) targetKey = child.key; });

    const oldData = (await db.ref(`${type}/${targetKey}`).once('value')).val();
    if (!oldData) return;

    const cleanName = (oldData.name || "").split(' (แก้:')[0];

    const { value: formValues } = await Swal.fire({
        title: type === 'sales' ? 'แก้ไขจำนวน' : 'แก้ไขยอดเงิน',
        html: `
            <div class="text-left text-xs mb-2 text-blue-500"><b>รายการ:</b> ${cleanName}</div>
            <input id="swal-v" class="swal2-input" type="number" value="${type === 'sales' ? oldData.qty : Math.abs(oldData.amount)}">
            <input id="swal-r" class="swal2-input" type="text" placeholder="ระบุเหตุผลการแก้">
        `,
        showCancelButton: true,
        preConfirm: () => {
            const v = document.getElementById('swal-v').value;
            const r = document.getElementById('swal-r').value;
            if (!v || !r) return Swal.showValidationMessage('กรุณากรอกข้อมูลและเหตุผล');
            return { val: parseFloat(v), reason: r };
        }
    });

    if (formValues) {
        let updateData = {};
        if (type === 'sales') {
            updateData = {
                name: cleanName,
                qty: formValues.val,
                totalPrice: oldData.price * formValues.val,
                profit: (oldData.price - oldData.cost) * formValues.val,
                editReason: formValues.reason
            };
        } else {
            updateData = {
                name: cleanName,
                amount: oldData.amount < 0 ? -formValues.val : formValues.val,
                editReason: formValues.reason
            };
        }
        db.ref(`${type}/${targetKey}`).update(updateData).then(() => {
            Swal.fire({ icon: 'success', title: 'แก้ไขสำเร็จ', timer: 1000, showConfirmButton: false });
        });
    }
}

// --- เพิ่มรายการขาย ---
function recordSale() {
    const menuId = document.getElementById('selectMenu').value;
    const item = menuItems.find(m => m.id == menuId);
    if (!item) return Swal.fire('เลือกสินค้าก่อน');
    const qty = parseInt(document.getElementById('sellQty').value);
    const ts = Date.now();
    const now = new Date();
    db.ref('sales/' + ts).set({
        id: ts, name: item.name, qty: qty, cost: item.cost, price: item.price,
        totalPrice: item.price * qty, profit: (item.price - item.cost) * qty,
        date: now.toLocaleDateString('th-TH'), time: now.toLocaleTimeString('th-TH'),
        timestamp: `${now.toLocaleDateString('th-TH')}, ${now.toLocaleTimeString('th-TH')}`,
        editReason: ""
    }).then(() => {
        Swal.fire({ icon: 'success', title: 'บันทึกการขายแล้ว', timer: 1000, showConfirmButton: false });
        showPage('page-report');
    });
}

// --- เพิ่มรายรับ/รายจ่าย ---
function saveExpense() {
    const name = document.getElementById('expName').value;
    const amount = parseFloat(document.getElementById('expAmount').value);
    if (!name || isNaN(amount)) return Swal.fire('กรอกข้อมูลไม่ครบ');
    const ts = Date.now();
    const now = new Date();
    db.ref('expenses/' + ts).set({
        id: ts, name: name, amount: currentExpType === 'income' ? amount : -amount,
        date: now.toLocaleDateString('th-TH'), time: now.toLocaleTimeString('th-TH'),
        timestamp: `${now.toLocaleDateString('th-TH')}, ${now.toLocaleTimeString('th-TH')}`,
        editReason: ""
    }).then(() => {
        Swal.fire({ icon: 'success', title: 'บันทึกเรียบร้อย', timer: 1000, showConfirmButton: false });
        document.getElementById('expName').value = '';
        document.getElementById('expAmount').value = '';
        showPage('page-report');
    });
}

// --- เพิ่มเมนูสินค้า ---
function saveMenuItem() {
    const name = document.getElementById('newMenuName').value;
    const cost = parseFloat(document.getElementById('newMenuCost').value);
    const price = parseFloat(document.getElementById('newMenuPrice').value);
    if (!name || isNaN(cost) || isNaN(price)) return Swal.fire('กรอกข้อมูลไม่ครบ');
    const id = Date.now();
    db.ref('menu/' + id).set({ id, name, cost, price }).then(() => {
        Swal.fire({ icon: 'success', title: 'เพิ่มสินค้าแล้ว', timer: 1000, showConfirmButton: false });
        document.getElementById('newMenuName').value = '';
        document.getElementById('newMenuCost').value = '';
        document.getElementById('newMenuPrice').value = '';
    });
}

// --- ลบเมนู ---
async function deleteMenu(id) {
    const res = await Swal.fire({ title: 'ลบเมนูนี้?', icon: 'warning', showCancelButton: true });
    if (res.isConfirmed) {
        db.ref('menu/' + id).remove().then(() => {
            Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', timer: 800, showConfirmButton: false });
        });
    }
}

// ฟังก์ชันอื่นๆ คงเดิม...
function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active-nav', 'text-blue-500'));
    const btn = document.querySelector(`button[onclick="showPage('${id}')"]`);
    if (btn) btn.classList.add('active-nav', 'text-blue-500');
}
function toggleTheme() {
    const html = document.documentElement;
    const theme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', theme);
    localStorage.setItem('ims-theme', theme);
    document.getElementById('themeBtn').innerText = theme === 'dark' ? '☀️' : '🌙';
}
function adjQty(val) { document.getElementById('sellQty').value = Math.max(1, parseInt(document.getElementById('sellQty').value) + val); }
function setExpType(type) {
    currentExpType = type;
    const isInc = type === 'income';
    document.getElementById('btnIncome').className = isInc ? "flex-1 py-3 rounded-xl bg-white dark:bg-slate-700 text-emerald-600 shadow-sm font-bold" : "flex-1 py-3 rounded-xl text-slate-400 font-bold";
    document.getElementById('btnExpense').className = !isInc ? "flex-1 py-3 rounded-xl bg-white dark:bg-slate-700 text-red-500 shadow-sm font-bold" : "flex-1 py-3 rounded-xl text-slate-400 font-bold";
}
function updatePreview() {
    const item = menuItems.find(m => m.id == document.getElementById('selectMenu').value);
    if (item) {
        document.getElementById('previewArea').classList.remove('hidden');
        document.getElementById('preCost').innerText = item.cost;
        document.getElementById('prePrice').innerText = item.price;
    } else document.getElementById('previewArea').classList.add('hidden');
}
async function secureClearData() {
    const { value: pw } = await Swal.fire({ title: 'ใส่รหัสเพื่อล้างข้อมูล', input: 'password', showCancelButton: true });
    if (pw === MASTER_PASSWORD) {
        const c2 = await Swal.fire({ title: 'ยืนยันการลบทั้งหมด?', icon: 'warning', showCancelButton: true });
        if (c2.isConfirmed) {
            db.ref('sales').remove();
            db.ref('expenses').remove().then(() => {
                Swal.fire('ล้างข้อมูลเรียบร้อย', '', 'success');
            });
        }
    } else if (pw !== undefined) Swal.fire('รหัสไม่ถูกต้อง', '', 'error');
}
window.onload = () => {
    const saved = localStorage.getItem('ims-theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    showPage('page-sell');
};