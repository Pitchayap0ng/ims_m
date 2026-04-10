let myChart = null;
let myPieChart = null;

function updateReportTables(salesHistory, expenseHistory) {
    // 1. ตารางการขาย
    const sTable = document.getElementById('webSaleTable');
    if (sTable) {
        sTable.innerHTML = salesHistory.length ? '' : '<tr><td colspan="6" class="text-center p-4">ไม่มีประวัติการขาย</td></tr>';
        salesHistory.sort((a, b) => b.id - a.id).forEach(s => {
            const reasonHtml = s.editReason ? `<br><span class="text-red-400 font-bold text-[9px] italic">[แก้: ${s.editReason}]</span>` : "";
            sTable.innerHTML += `
                <tr class="border-b dark:border-slate-800 text-[11px]">
                    <td class="py-2"><b>${s.name}</b>${reasonHtml}<br><small class="opacity-50">${s.timestamp}</small></td>
                    <td class="text-center">${s.price.toLocaleString()}</td>
                    <td class="text-center text-blue-500 font-bold">${s.qty}</td>
                    <td class="text-right font-bold">${s.totalPrice.toLocaleString()}</td>
                    <td class="text-right text-emerald-500 font-bold">+${(s.profit || 0).toLocaleString()}</td>
                    <td class="text-right">
                        <button onclick="editEntry('sales', '${s.id}')" class="p-1 opacity-40 hover:opacity-100">✏️</button>
                    </td>
                </tr>`;
        });
    }

    // 2. ตารางรายรับ-รายจ่าย
    const eTable = document.getElementById('webExpenseTable');
    if (eTable) {
        eTable.innerHTML = expenseHistory.sort((a, b) => b.id - a.id).map(e => {
            const reasonHtml = e.editReason ? `<br><span class="text-red-400 font-bold text-[9px] italic">[แก้: ${e.editReason}]</span>` : "";
            return `
            <tr class="border-b dark:border-slate-800 text-[11px]">
                <td class="py-2 flex justify-between items-center w-full">
                    <span><b>${e.name}</b>${reasonHtml}<br><small class="opacity-50">${e.timestamp}</small></span>
                    <span class="font-bold ${e.amount > 0 ? 'text-emerald-500' : 'text-red-500'}">
                        ${e.amount.toLocaleString()} 
                        <button onclick="editEntry('expenses', '${e.id}')" class="ml-1 opacity-30">✏️</button>
                    </span>
                </td>
            </tr>`}).join('');
    }
    renderAnalytics(salesHistory, expenseHistory);
}

function renderAnalytics(sales, expenses) {
    // กราฟแท่ง Top 5 (ชื่อจะสะอาดเพราะเราล้างที่ app.js แล้ว)
    const rankingMap = {};
    sales.forEach(s => { rankingMap[s.name] = (rankingMap[s.name] || 0) + s.qty; });
    const sortedRank = Object.entries(rankingMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const ctxBar = document.getElementById('saleChart');
    if (ctxBar) {
        if (myChart) myChart.destroy();
        myChart = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: sortedRank.map(i => i[0]),
                datasets: [{ label: 'ยอดขาย (ชิ้น)', data: sortedRank.map(i => i[1]), backgroundColor: '#3b82f6', borderRadius: 8 }]
            },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });
    }

    // กราฟวงกลม
    const incomeTotal = expenses.filter(e => e.amount > 0).reduce((a, b) => a + b.amount, 0);
    const expenseTotal = Math.abs(expenses.filter(e => e.amount < 0).reduce((a, b) => a + b.amount, 0));
    const costTotal = sales.reduce((a, b) => a + (b.cost * b.qty), 0);
    const profitTotal = sales.reduce((a, b) => a + b.profit, 0) + expenses.reduce((a, b) => a + b.amount, 0);

    const ctxPie = document.getElementById('pieChart');
    if (ctxPie) {
        if (myPieChart) myPieChart.destroy();
        myPieChart = new Chart(ctxPie, {
            type: 'pie',
            data: {
                labels: ['รายรับอื่น', 'รายจ่ายอื่น', 'ต้นทุนรวม', 'กำไรสุทธิ'],
                datasets: [{
                    data: [incomeTotal, expenseTotal, costTotal, profitTotal > 0 ? profitTotal : 0],
                    backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#3b82f6'],
                    borderWidth: 2, borderColor: '#ffffff'
                }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
    }
}

function exportRichExcel() {
    // 1. แสดง Loading แจ้งเตือน
    Swal.fire({ 
        title: 'กำลังสร้างไฟล์ Excel...', 
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading() 
    });

    // 2. คำนวณกำไรสุทธิรวมแบบ "เลขเต็ม"
    const totalSalesProfit = salesHistory.reduce((sum, item) => sum + (parseFloat(item.profit) || 0), 0);
    const totalExpensesEffect = expenseHistory.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const netProfitFull = totalSalesProfit + totalExpensesEffect;

    // 3. กำหนดหัวตาราง (ใส่ "" ล้อมรอบหัวข้อเพื่อป้องกันการเพี้ยน)
    let csv = "\uFEFF"; // BOM สำหรับอ่านภาษาไทยใน Excel
    csv += `"วันที่","เวลา","ประเภทรายการ","ชื่อรายการ","จำนวน","ทุน/หน่วย","ราคาขาย/หน่วย","กำไรหรือยอดเงิน","เหตุผลการแก้ไข"\n`;
    
    // 4. ข้อมูลการขาย
    salesHistory.forEach(s => {
        csv += `"${s.date}","${s.time}","ขายสินค้า","${s.name}",${s.qty},${s.cost},${s.price},${s.profit},"${s.editReason || ''}"\n`;
    });

    // 5. ข้อมูลรายรับ-รายจ่าย
    expenseHistory.forEach(e => {
        const type = e.amount > 0 ? 'รายรับอื่น' : 'รายจ่ายอื่น';
        csv += `"${e.date}","${e.time}","${type}","${e.name}","-","-","-",${e.amount},"${e.editReason || ''}"\n`;
    });

    // 6. บรรทัดสรุปยอด (กำไรสุทธิเลขเต็ม)
    csv += `\n,,,,,,,"กำไรสุทธิรวมทั้งสิ้น:","${netProfitFull}"\n`;

    // 7. กระบวนการดาวน์โหลด
    try {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        link.setAttribute("href", url);
        link.setAttribute("download", `Report_IMS_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // 8. ปิด Loading และแจ้งเตือนสำเร็จ
        Swal.close();
        Swal.fire({
            icon: 'success',
            title: 'ดาวน์โหลดสำเร็จ',
            timer: 2000,
            showConfirmButton: false
        });
    } catch (err) {
        Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถดาวน์โหลดไฟล์ได้', 'error');
    }
}