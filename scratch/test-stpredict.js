// scratch/test-stpredict.js
/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
// Standalone simulation to verify math, Sai Mu matrix, and digested scannable Flex Message

function getDailySaiMuContext(dateObj) {
  const dayIndex = dateObj.getDay();
  const daysMap = [
    {
      dayName: 'วันอาทิตย์',
      element: 'ธาตุไฟ',
      powerNumber: 6,
      luckyColors: 'เขียวเหนี่ยวทรัพย์, ดำ/ม่วง',
      unluckyColor: 'น้ำเงิน/ฟ้า',
      luckyDirection: 'ทิศตะวันออกเฉียงใต้',
      deity: 'พระสิวลีมหาลาภ',
      saiMuHacks: 'วางผลส้มมงคลหรือเครื่องดื่มโทนส้ม-เขียวหน้าร้าน เปิดไฟป้ายร้านสว่างสดใสรับพลังสุริยะ'
    },
    {
      dayName: 'วันจันทร์',
      element: 'ธาตุดิน',
      powerNumber: 15,
      luckyColors: 'ส้ม/เหลืองทอง, ม่วงเม็ดมะปราง',
      unluckyColor: 'แดง',
      luckyDirection: 'ทิศตะวันออก',
      deity: 'ท้าวเวสสุวรรณ & แม่นางกวัก',
      saiMuHacks: 'ถวายน้ำสะอาดใสแจ๋วที่โต๊ะบูชา ยิ้มแย้มต้อนรับด้วยวาจามหาเสน่ห์ เจรจาปิดการขายคล่องตัว'
    },
    {
      dayName: 'วันอังคาร',
      element: 'ธาตุลม',
      powerNumber: 8,
      luckyColors: 'น้ำตาลทอง, น้ำเงิน/ฟ้ามหาเศรษฐี',
      unluckyColor: 'ขาว/ครีม',
      luckyDirection: 'ทิศตะวันออกเฉียงใต้',
      deity: 'พระพิฆเนศ',
      saiMuHacks: 'เคลียร์เคาน์เตอร์แคชเชียร์และบาร์น้ำให้โล่งสะอาด อากาศถ่ายเท รับคลื่นเงินหมุนเวียนเร็ว'
    },
    {
      dayName: 'วันพุธ',
      element: 'ธาตุน้ำ',
      powerNumber: 17,
      luckyColors: 'ดำ/เทาเงิน, ฟ้าคราม',
      unluckyColor: 'ชมพู',
      luckyDirection: 'ทิศใต้',
      deity: 'พระแม่ลักษมี',
      saiMuHacks: 'เปิดเพลงคลอเบาๆ จังหวะชวนผ่อนคลาย จัดไฟวอร์มไวท์อบอุ่น ดึงดูดลูกค้าให้นั่งชิลและสั่งเพิ่ม'
    },
    {
      dayName: 'วันพฤหัสบดี',
      element: 'ธาตุดิน',
      powerNumber: 19,
      luckyColors: 'แดงส้มมหาลาภ, ขาว/ทองประกาย',
      unluckyColor: 'ดำ/ม่วงเข้ม',
      luckyDirection: 'ทิศตะวันตก',
      deity: 'พระพรหม',
      saiMuHacks: 'จัดระเบียบเงินในลิ้นชักเรียงแบงก์หน้าเดียวกัน ตั้งจิตขอบคุณลูกค้า เสริมบารมีร้านค้า'
    },
    {
      dayName: 'วันศุกร์',
      element: 'ธาตุน้ำ',
      powerNumber: 21,
      luckyColors: 'ชมพูดึงดูดลูกค้า, เขียวมรกตเรียกบิลใหญ่',
      unluckyColor: 'เทา/ดำด้าน',
      luckyDirection: 'ทิศเหนือ',
      deity: 'พระแม่ลักษมี',
      saiMuHacks: 'ฉีดกลิ่นหอมสะอาดสดชื่นบริเวณทางเข้าร้าน ตกแต่งมุมถ่ายรูปสวยๆ รับทราฟฟิกสายเช็คอิน'
    },
    {
      dayName: 'วันเสาร์',
      element: 'ธาตุไฟ',
      powerNumber: 10,
      luckyColors: 'น้ำเงินเข้ม, ทองอร่ามเหนี่ยวทรัพย์',
      unluckyColor: 'เขียวตองอ่อน',
      luckyDirection: 'ทิศตะวันตกเฉียงใต้',
      deity: 'พญานาคราชริมโขง',
      saiMuHacks: 'ตั้งแก้วน้ำสะอาดริมแม่น้ำ/หน้าร้าน ขอบารมีพญานาคราชประทานโชคลาภ ดึงดูดโต๊ะใหญ่'
    }
  ];
  return daysMap[dayIndex] || daysMap[0];
}

function buildDeterministicAiAnalysis(summaryPayload, saiMu) {
  const peakHourStr = summaryPayload.peakHour || '19.00 น.';
  const primeDinner = summaryPayload.dayparts.find(d => d.key === 'dinner');
  
  return {
    sai_mu_oracle: {
      auspicious_window: `ฤกษ์เปิดทรัพย์ ${peakHourStr} (ช่วงเหนี่ยวทรัพย์หนาแน่น)`,
      lucky_color_advice: `ทีมงานสวมใส่หรือพกไอเทม ${saiMu.luckyColors} เปิดรับทรัพย์ (เลี่ยง ${saiMu.unluckyColor})`,
      money_direction: `จัดโต๊ะต้อนรับหรือเคาน์เตอร์คิดเงินทาง ${saiMu.luckyDirection} เสริมพลัง ${saiMu.element}`,
      sai_mu_hack: saiMu.saiMuHacks
    },
    operational_advice: {
      kitchen_bar: `เตรียมสำรองสต็อกวัตถุดิบและพรีเซตเครื่องดื่มล่วงหน้าเพื่อรองรับ ~${primeDinner ? primeDinner.forecastPax : 35} ท่านช่วง Prime Dinner`,
      floor_service: `จัดโซนโต๊ะรองรับกลุ่ม Walk-in ควบคู่กับลูกค้าที่โทร/LINE จองโต๊ะล่วงหน้าเพื่อการระบายรอบโต๊ะที่รวดเร็ว`,
      marketing_ads: summaryPayload.adStats.totalAdDirections > 0 
        ? `พบสัญญาณลูกค้าขอเส้นทางใน Google Maps ${summaryPayload.adStats.totalAdDirections} ครั้ง เตรียมทีมหน้าร้านต้อนรับกลุ่มที่กำลังเดินทางมา`
        : `บูสต์โพสต์โปรโมทบรรยากาศริมโขงและเมนูซิกเนเจอร์ช่วงเย็นเพื่อดึงดูดลูกค้ามื้อค่ำ`
    },
    executive_summary: `วันนี้ทราฟฟิกมีจังหวะความเร็ว ${summaryPayload.dayPacePct >= 0 ? `+${summaryPayload.dayPacePct}%` : `${summaryPayload.dayPacePct}%`} เทียบสถิติเดิม คาดการณ์ยอดปิดวันรวม ~${summaryPayload.forecastedClosingPax} ท่าน`
  };
}

function createTrafficPredictorFlexMessage(trafficData, saiMuData, aiAnalysis, dateTitleStr, currentTimeFormatted, nextHoursInfo) {
  const {
    totalActualPax,
    totalActualBills,
    forecastedClosingPax,
    forecastedClosingPaxLow,
    forecastedClosingPaxHigh,
    dayPacePct,
    peakHour,
    peakCapacityLoad,
    dayparts
  } = trafficData;

  const peakHourLabel = peakHour ? `${peakHour.hour}.00 - ${peakHour.hour + 1}.00 น.` : '19.00 - 20.00 น.';
  const peakPaxVal = peakHour ? (peakHour.isFuture ? peakHour.forecast : peakHour.actual) : 0;

  // Render Daypart Rows (Hallmark Zero-Icon Minimalist Badges)
  const daypartRows = dayparts.map((dp, idx) => {
    let statusBg = "#F4F1EA";
    let statusColor = "#78736A";
    let statusText = "FORECAST";

    if (dp.status === 'passed') {
      statusBg = "#E8F0E4";
      statusColor = "#4A6B3D";
      statusText = "PASSED";
    } else if (dp.status === 'active') {
      statusBg = "#FDEBD0";
      statusColor = "#B45309";
      statusText = "LIVE ACTIVE";
    }

    const paxDisplay = dp.status === 'passed'
      ? `${dp.actualPax} ท่าน`
      : `~${dp.forecastPax} ท่าน`;

    return {
      type: "box",
      layout: "horizontal",
      margin: idx === 0 ? "xs" : "sm",
      contents: [
        {
          type: "box",
          layout: "vertical",
          flex: 6,
          contents: [
            { type: "text", text: dp.title, size: "xs", weight: "bold", color: "#1E1B18" },
            { type: "text", text: dp.timeLabel, size: "xxs", color: "#78736A" }
          ]
        },
        {
          type: "box",
          layout: "vertical",
          flex: 3,
          contents: [
            { type: "text", text: paxDisplay, size: "xs", weight: "bold", color: "#1E1B18", align: "end" },
            { type: "text", text: `เทียบฐาน ${dp.diffPct >= 0 ? `+${dp.diffPct}%` : `${dp.diffPct}%`}`, size: "xxs", color: dp.diffPct >= 0 ? "#4A6B3D" : "#888888", align: "end" }
          ]
        },
        {
          type: "box",
          layout: "horizontal",
          flex: 3,
          justifyContent: "flex-end",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              backgroundColor: statusBg,
              cornerRadius: "xs",
              paddingStart: "sm",
              paddingEnd: "sm",
              paddingTop: "xs",
              paddingBottom: "xs",
              contents: [
                { type: "text", text: statusText, size: "xxs", weight: "bold", color: statusColor }
              ]
            }
          ]
        }
      ]
    };
  });

  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#1E1B18",
      paddingAll: "18px",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "HAUS PRO FORECAST // FAST DIGEST", size: "xxs", weight: "bold", color: "#C85A32", flex: 8 },
            { type: "text", text: `[${currentTimeFormatted}]`, size: "xxs", weight: "bold", color: "#E6E1D6", align: "end", flex: 4, gravity: "center" }
          ]
        },
        {
          type: "text",
          text: `พยากรณ์ทราฟฟิก & สรุปข้อมูลฉับไว · ${dateTitleStr}`,
          size: "sm",
          weight: "bold",
          color: "#FBF9F5",
          margin: "xs"
        }
      ]
    },
    body: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#FBF9F5",
      paddingAll: "16px",
      contents: [
        // 1. HIGHLIGHT DIGEST BOX: ณ ปัจจุบัน & คาดการณ์ช่วงถัดไป (อ่านจบใน 3 วิ)
        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#F4F1EA",
          cornerRadius: "sm",
          borderColor: "#E6E1D6",
          borderWidth: "1px",
          paddingAll: "14px",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: `SNAPSHOT ปัจจุบัน [${currentTimeFormatted}]`, size: "xxs", weight: "bold", color: "#C85A32", flex: 7 },
                {
                  type: "text",
                  text: `${dayPacePct >= 0 ? `+${dayPacePct}%` : `${dayPacePct}%`} PACING`,
                  size: "xxs",
                  weight: "bold",
                  color: dayPacePct >= 0 ? "#4A6B3D" : "#9E2D2D",
                  align: "end",
                  flex: 5
                }
              ]
            },
            { type: "separator", margin: "sm", color: "#E6E1D6" },
            {
              type: "box",
              layout: "horizontal",
              margin: "sm",
              contents: [
                {
                  type: "box",
                  layout: "vertical",
                  flex: 6,
                  contents: [
                    { type: "text", text: "ลูกค้าจริงสะสมขณะนี้:", size: "xxs", color: "#78736A" },
                    { type: "text", text: `${totalActualPax} ท่าน`, size: "lg", weight: "bold", color: "#1E1B18" },
                    { type: "text", text: `ชำระแล้ว ${totalActualBills} บิล`, size: "xxs", color: "#78736A" }
                  ]
                },
                {
                  type: "box",
                  layout: "vertical",
                  flex: 6,
                  alignItems: "flex-end",
                  contents: [
                    { type: "text", text: `คาดการณ์ 1-2 ชม. ข้างหน้า:`, size: "xxs", color: "#78736A" },
                    { type: "text", text: `~${nextHoursInfo.forecastPax} ท่าน`, size: "lg", weight: "bold", color: "#C85A32" },
                    { type: "text", text: `(${nextHoursInfo.label})`, size: "xxs", color: "#78736A" }
                  ]
                }
              ]
            },
            { type: "separator", margin: "sm", color: "#E6E1D6" },
            {
              type: "box",
              layout: "horizontal",
              margin: "sm",
              contents: [
                { type: "text", text: "คาดการณ์ยอดปิดวัน:", size: "xxs", weight: "bold", color: "#1E1B18", flex: 5 },
                { type: "text", text: `~${forecastedClosingPax} ท่าน (${forecastedClosingPaxLow}-${forecastedClosingPaxHigh})`, size: "xxs", weight: "bold", color: "#1E1B18", align: "end", flex: 7 }
              ]
            },
            {
              type: "box",
              layout: "horizontal",
              margin: "xs",
              contents: [
                { type: "text", text: "ชั่วโมงลูกค้าสูงสุด (Peak):", size: "xxs", weight: "bold", color: "#C85A32", flex: 5 },
                { type: "text", text: `${peakHourLabel} (~${peakPaxVal} คน | โหลด ${peakCapacityLoad}%)`, size: "xxs", color: "#C85A32", align: "end", flex: 7 }
              ]
            }
          ]
        },

        // 2. FAST ACTION & SAI MU (กลยุทธ์ & เสริมดวง ย่อยเร็ว)
        {
          type: "box",
          layout: "vertical",
          backgroundColor: "#FFFDF7",
          borderColor: "#E8DEC8",
          borderWidth: "1px",
          cornerRadius: "sm",
          paddingAll: "12px",
          margin: "md",
          contents: [
            {
              type: "box",
              layout: "horizontal",
              contents: [
                { type: "text", text: "SAI MU & ACTION // เสริมดวง & สิ่งที่ต้องทำทันที", size: "xxs", weight: "bold", color: "#B45309", flex: 8 },
                { type: "text", text: `[${saiMuData.dayName}]`, size: "xxs", weight: "bold", color: "#78736A", align: "end", flex: 4 }
              ]
            },
            { type: "separator", margin: "sm", color: "#E8DEC8" },
            {
              type: "box",
              layout: "vertical",
              margin: "xs",
              spacing: "xs",
              contents: [
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "ฤกษ์ดูดทรัพย์:", size: "xxs", weight: "bold", color: "#1E1B18", flex: 3 },
                    { type: "text", text: aiAnalysis.sai_mu_oracle.auspicious_window, size: "xxs", color: "#B45309", weight: "bold", flex: 9, wrap: true }
                  ]
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "สีมงคล / เลี่ยง:", size: "xxs", weight: "bold", color: "#1E1B18", flex: 3 },
                    { type: "text", text: `${saiMuData.luckyColors} (เลี่ยง: ${saiMuData.unluckyColor})`, size: "xxs", color: "#4A6B3D", weight: "bold", flex: 9, wrap: true }
                  ]
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "ทิศรับเงิน:", size: "xxs", weight: "bold", color: "#1E1B18", flex: 3 },
                    { type: "text", text: `${saiMuData.luckyDirection} (เสริมพลัง: ${saiMuData.element})`, size: "xxs", color: "#1E1B18", flex: 9, wrap: true }
                  ]
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "ทริคหน้าร้าน:", size: "xxs", weight: "bold", color: "#1E1B18", flex: 3 },
                    { type: "text", text: aiAnalysis.sai_mu_oracle.sai_mu_hack, size: "xxs", color: "#555555", flex: 9, wrap: true }
                  ]
                },
                { type: "separator", margin: "xs", color: "#E8DEC8" },
                {
                  type: "box",
                  layout: "horizontal",
                  margin: "xs",
                  contents: [
                    { type: "text", text: "ครัวและบาร์:", size: "xxs", weight: "bold", color: "#C85A32", flex: 3 },
                    { type: "text", text: aiAnalysis.operational_advice.kitchen_bar, size: "xxs", color: "#1E1B18", flex: 9, wrap: true }
                  ]
                },
                {
                  type: "box",
                  layout: "horizontal",
                  contents: [
                    { type: "text", text: "จัดโต๊ะ/บริการ:", size: "xxs", weight: "bold", color: "#C85A32", flex: 3 },
                    { type: "text", text: aiAnalysis.operational_advice.floor_service, size: "xxs", color: "#1E1B18", flex: 9, wrap: true }
                  ]
                }
              ]
            }
          ]
        },

        // 3. DAYPARTS TIMELINE (4 ช่วงเวลา ย่ออ่านง่าย)
        {
          type: "box",
          layout: "horizontal",
          margin: "sm",
          contents: [
            { type: "text", text: "DAYPARTS TIMELINE // 4 ช่วงเวลาของวัน", size: "xxs", weight: "bold", color: "#78736A", flex: 1 }
          ]
        },
        ...daypartRows
      ]
    },
    footer: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#FBF9F5",
      paddingAll: "14px",
      spacing: "xs",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          spacing: "sm",
          contents: [
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: {
                type: "message",
                label: "ยอดขายสด (STSALES)",
                text: "stsales"
              },
              color: "#F4F1EA"
            },
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: {
                type: "message",
                label: "บิลล่าสุด (STBILL)",
                text: "stbill"
              },
              color: "#F4F1EA"
            },
            {
              type: "button",
              style: "secondary",
              height: "sm",
              action: {
                type: "message",
                label: "ออเดอร์ครัว (STORDER)",
                text: "storder"
              },
              color: "#F4F1EA"
            }
          ]
        }
      ]
    }
  };
}

// Test Run with 17.30 snapshot simulation
const now = new Date();
const saiMu = getDailySaiMuContext(now);

const dummyTraffic = {
  totalActualPax: 28,
  totalActualBills: 11,
  forecastedClosingPax: 68,
  forecastedClosingPaxLow: 58,
  forecastedClosingPaxHigh: 80,
  dayPacePct: 15,
  peakHour: { hour: 19, forecast: 18, isFuture: true },
  peakCapacityLoad: 40,
  dayparts: [
    { key: 'lunch', title: 'LUNCH RUSH', timeLabel: '11.00 - 14.00 น.', status: 'passed', actualPax: 24, forecastPax: 24, diffPct: 10 },
    { key: 'afternoon', title: 'AFTERNOON CAFE', timeLabel: '14.00 - 17.00 น.', status: 'passed', actualPax: 4, forecastPax: 12, diffPct: 5 },
    { key: 'dinner', title: 'PRIME DINNER', timeLabel: '17.00 - 21.00 น.', status: 'active', actualPax: 0, forecastPax: 36, diffPct: 20 },
    { key: 'late', title: 'LATE NIGHT / BAR', timeLabel: '21.00 - 23.00 น.', status: 'upcoming', actualPax: 0, forecastPax: 4, diffPct: -5 }
  ],
  adStats: { totalAdDirections: 5 }
};

const nextHoursInfo = {
  label: '18.00 - 20.00 น.',
  forecastPax: 32
};

const aiAnalysis = buildDeterministicAiAnalysis({
  peakHour: '19.00 น.',
  dayparts: dummyTraffic.dayparts,
  adStats: dummyTraffic.adStats,
  dayPacePct: 15,
  forecastedClosingPax: 68
}, saiMu);

const flexMessage = createTrafficPredictorFlexMessage(
  dummyTraffic,
  saiMu,
  aiAnalysis,
  'วันอาทิตย์ที่ 20 ก.ย. 2569',
  '17.30 น.',
  nextHoursInfo
);

console.log('Flex Bubble Type:', flexMessage.type);
console.log('Flex Header contents:', JSON.stringify(flexMessage.header.contents));
console.log('Total Body items:', flexMessage.body.contents.length);
console.log('SUCCESS: Fast digested Flex schema validated.');
