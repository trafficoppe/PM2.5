// ==========================================
// ⚙️ CONFIGURATION (ตั้งค่าระบบ)
// ==========================================
const SHEET_ID = '1iMWkUIxMH1_QAEzwH2PYQBvLjOrDOF14jlXeAnzunFo'; 
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyZsxGlaJZtoytifGiztYsTTAUjtRHvyzhxPzZ7N6QPSXEMd700xhTxoDOG_PMxZYLL/exec'; 

const AUTO_SEND_TIME = {
    hour: 8,
    minute: 17
};

let allRows = [];
let currentIndex = -1;
let isAutoSending = false;

function startAutoScheduler() {
    setInterval(() => {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();

        const targetTimeStr = `${String(AUTO_SEND_TIME.hour).padStart(2,'0')}:${String(AUTO_SEND_TIME.minute).padStart(2,'0')}`;
        const autoStatusEl = document.getElementById('autoStatus');
        if (autoStatusEl) {
            autoStatusEl.innerText = `Time: ${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')} (Target: ${targetTimeStr})`;
        }

        if (hours === AUTO_SEND_TIME.hour && minutes === AUTO_SEND_TIME.minute && seconds === 0 && !isAutoSending) {
            isAutoSending = true; 
            fetchSheetData().then(() => {
                setTimeout(() => {
                    sendToLine(true); 
                    setTimeout(() => { isAutoSending = false; }, 60000);
                }, 5000); 
            }).catch(err => {
                isAutoSending = false;
            });
        }
    }, 1000);
}

// 🧮 ฟังก์ชันคำนวณ AQI ตามสูตรมาตรฐานกรมควบคุมมลพิษ (เทียบจาก PM2.5)
function calculateThaiAQI(pm25) {
    if (pm25 <= 15.0) return Math.round(((25 - 0) / (15.0 - 0)) * (pm25 - 0) + 0);
    if (pm25 <= 25.0) return Math.round(((50 - 26) / (25.0 - 15.1)) * (pm25 - 15.1) + 26);
    if (pm25 <= 37.5) return Math.round(((100 - 51) / (37.5 - 25.1)) * (pm25 - 25.1) + 51);
    if (pm25 <= 75.0) return Math.round(((200 - 101) / (75.0 - 37.6)) * (pm25 - 37.6) + 101);
    return Math.round(((300 - 201) / (250.0 - 75.1)) * (pm25 - 75.1) + 201); 
}

async function fetchSheetData() {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('loading').innerHTML = '<i class="fas fa-spinner fa-spin fa-2x"></i><br>กำลังดึงข้อมูลจากชีท...';
    
    try {
        const response = await fetch(SHEET_URL + '&t=' + new Date().getTime());
        const text = await response.text();
        const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);/);
        
        if (!match) throw new Error("รูปแบบข้อมูลผิดพลาด (ตรวจสอบการแชร์อีกครั้ง)");
        const json = JSON.parse(match[1]);
        if (json.status === 'error') throw new Error(json.errors[0].message);

        allRows = [];

        json.table.rows.forEach(row => {
            const c = row.c;
            if (!c) return; 

            const dateRaw = c[0] ? (c[0].f || c[0].v) : null;
            const pm25Val = (c[1] && c[1].v != null) ? parseFloat(c[1].v) : 0;
            const pm10Val = (c[2] && c[2].v != null) ? parseFloat(c[2].v) : 0;

            if (isNaN(pm25Val) || pm25Val <= 0) return;

            // ประเมินผลตามเกณฑ์ใหม่ 5 ระดับ
            let calcAqi = calculateThaiAQI(pm25Val);
            let calcStatus = '';
            let cAdvice1 = '';
            let cAdvice2 = '';

            if (pm25Val <= 15.0) {
                calcStatus = 'ดีมาก';
                cAdvice1 = 'อากาศดีมาก หายใจได้เต็มปอดเลยค่ะ 🩵';
                cAdvice2 = 'เหมาะสำหรับทำกิจกรรมกลางแจ้งและท่องเที่ยว';
            } 
            else if (pm25Val <= 25.0) {
                calcStatus = 'ดี';
                cAdvice1 = 'อากาศดีค่ะ สามารถใช้ชีวิตประจำวันได้ปกติ 💚';
                cAdvice2 = 'ลุยกิจกรรมกลางแจ้งหรือออกกำลังกายได้สบายๆ ชิลๆ เลยค่ะ';
            } 
            else if (pm25Val <= 37.5) {
                calcStatus = 'ปานกลาง';
                cAdvice1 = 'อากาศระดับกลางๆ ทั่วไปค่ะ ยังโอเคอยู่ 💛';
                cAdvice2 = 'คนทั่วไปใช้ชีวิตได้ปกติ แต่ถ้าใครแพ้ฝุ่นง่ายก็ระวังตัวนิดนึงนะคะ';
            } 
            else if (pm25Val <= 75.0) {
                calcStatus = 'เริ่มมีผลกระทบต่อสุขภาพ';
                cAdvice1 = 'ฝุ่นเริ่มเยอะแล้วค่ะ! ระวังสุขภาพกันด้วยนะคะ 🧡';
                cAdvice2 = 'ควรลดระยะเวลาทำกิจกรรมกลางแจ้ง และสวมหน้ากากป้องกันฝุ่นค่ะ';
            } 
            else {
                calcStatus = 'มีผลกระทบต่อสุขภาพ';
                cAdvice1 = 'โอ้โห ฝุ่นหนามาก! อันตรายต่อสุขภาพสุดๆ ❤️';
                cAdvice2 = 'งดทำกิจกรรมกลางแจ้งไปเลยค่ะ และควรสวมหน้ากาก N95 เท่านั้น!';
            }

            allRows.push({
                dateTimeRaw: dateRaw,
                location: 'มหาวิทยาลัยมหิดล ศาลายา',
                pm25: pm25Val,
                pm10: pm10Val,
                aqi: calcAqi,
                status: calcStatus,
                advice1: cAdvice1,
                advice2: cAdvice2
            });
        });

        if (allRows.length > 0) {
            currentIndex = allRows.length - 1;
            renderData(currentIndex);
            document.getElementById('loading').style.display = 'none';
            return Promise.resolve();
        } else {
            throw new Error("เจอชีทแล้ว แต่ไม่พบข้อมูลตัวเลขฝุ่น");
        }

    } catch (error) {
        console.error("Fetch Error:", error);
        document.getElementById('loading').innerHTML = `
            <i class='fas fa-exclamation-triangle' style='color:red; margin-bottom:10px;'></i><br>
            <span style='font-size:1.2rem; text-align:center;'>
                ดึงข้อมูลไม่สำเร็จ<br>
                <small style='color:#666;'>กรุณาตรวจสอบความถูกต้องของ SHEET_ID</small>
            </span>`;
        return Promise.reject(error);
    }
}

function formatThaiDateTime(dateRaw) {
    if(!dateRaw) return "ไม่ระบุเวลา";
    
    let dateObj = new Date(dateRaw);
    if (isNaN(dateObj.getTime())) return String(dateRaw);

    const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const timeStr = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')} น.`;

    return `วัน${days[dateObj.getDay()]}ที่ ${dateObj.getDate()} ${months[dateObj.getMonth()]} ${dateObj.getFullYear() + 543} เวลา ${timeStr}`;
}

function renderData(index) {
    const data = allRows[index];
    if (!data) return;

    document.getElementById('dispDateTime').innerText = formatThaiDateTime(data.dateTimeRaw);
    document.getElementById('dispAqi').innerText = data.aqi;
    document.getElementById('dispStatus').innerText = data.status;
    document.getElementById('dispPm25').innerHTML = `${data.pm25.toFixed(2)} <span class="unit">µg/m³</span>`;
    document.getElementById('dispPm10').innerHTML = `${data.pm10.toFixed(2)} <span class="unit">µg/m³</span>`;
    document.getElementById('dispAdvice1').innerHTML = `<i class="fas fa-check-circle"></i> ${data.advice1}`;
    document.getElementById('dispAdvice2').innerHTML = `<i class="fas fa-heart"></i> ${data.advice2}`;

    updateTheme(data.status);

    document.getElementById('btnPrev').disabled = (index <= 0);
    document.getElementById('btnNext').disabled = (index >= allRows.length - 1);
    
    if (index === allRows.length - 1) {
        document.getElementById('rowIndicator').innerText = "ข้อมูลล่าสุด";
    } else {
        document.getElementById('rowIndicator').innerText = `ย้อนหลัง ${allRows.length - 1 - index} รายการ`;
    }
}

// 🎨 เปลี่ยนสีตามคุณภาพอากาศ (อิงตามเกณฑ์ 5 ระดับ)
function updateTheme(status) {
    const card = document.getElementById('aqiCard');
    const box = document.getElementById('adviceBox');
    const icon = document.getElementById('aqiIcon');
    let bg, shadow, adviceColor, iconClass;

    if(status === 'ดีมาก') {
        bg = 'linear-gradient(135deg, #00c6ff, #0072ff)'; // ฟ้า
        shadow = '0 10px 25px rgba(0, 198, 255, 0.4)';
        adviceColor = '#e0f7fa'; iconClass = 'fas fa-laugh-squint';
    } else if(status === 'ดี') {
        bg = 'linear-gradient(135deg, #7b920a, #92d050)'; // เขียว
        shadow = '0 10px 25px rgba(146, 208, 80, 0.4)';
        adviceColor = '#e8f5e9'; iconClass = 'fas fa-laugh-beam';
    } else if (status === 'ปานกลาง') {
        bg = 'linear-gradient(135deg, #f2c94c, #f2994a)'; // เหลือง
        shadow = '0 10px 25px rgba(242, 201, 76, 0.4)';
        adviceColor = '#fffde7'; iconClass = 'fas fa-smile';
    } else if (status === 'เริ่มมีผลกระทบต่อสุขภาพ') {
        bg = 'linear-gradient(135deg, #ff9900, #ff5e62)'; // ส้ม
        shadow = '0 10px 25px rgba(255, 153, 0, 0.4)';
        adviceColor = '#fff3e0'; iconClass = 'fas fa-head-side-mask';
    } else {
        bg = 'linear-gradient(135deg, #cb2d3e, #ef473a)'; // แดง
        shadow = '0 10px 25px rgba(239, 71, 58, 0.4)';
        adviceColor = '#ffebee'; iconClass = 'fas fa-skull-crossbones';
    }
    
    card.style.background = bg;
    card.style.boxShadow = shadow;
    box.style.background = adviceColor;
    icon.className = iconClass;
}

function navigate(direction) {
    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < allRows.length) {
        currentIndex = newIndex;
        renderData(currentIndex);
    }
}

function saveAsImage() {
    const element = document.getElementById("captureArea");
    html2canvas(element, { scale: 2, backgroundColor: "#ffffff", useCORS: true }).then(canvas => {
        const link = document.createElement('a');
        link.download = `AQI-Report-${new Date().getTime()}.jpg`;
        link.href = canvas.toDataURL("image/jpeg", 0.9);
        link.click();
    });
}

function sendToLine(isAuto = false) {
    const btn = document.getElementById('btnLine');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังส่ง...';
    btn.disabled = true;

    const element = document.getElementById("captureArea");
    html2canvas(element, { scale: 1.5, backgroundColor: "#ffffff", useCORS: true }).then(canvas => {
        const base64Image = canvas.toDataURL("image/jpeg", 0.8);
        
        fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Image })
        }).then(() => {
            const statusDiv = document.getElementById('autoStatus');
            if(statusDiv) statusDiv.innerHTML = `<span style="color:#aaffaa">✅ ส่งไลน์สำเร็จแล้ว (${new Date().toLocaleTimeString()})</span>`;
            if (!isAuto) alert('ส่งรูปภาพไปที่ LINE สำเร็จแล้วครับ!');
            btn.innerHTML = originalText;
            btn.disabled = false;
        }).catch(err => {
            if (!isAuto) alert('เกิดข้อผิดพลาด: ' + err);
            btn.innerHTML = originalText;
            btn.disabled = false;
        });
    });
}

// เริ่มการทำงาน
fetchSheetData();
startAutoScheduler();