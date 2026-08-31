/**
 * Thai Tax Revenue Department Cash Report (รายงานเงินสด รับ - จ่าย บุคคลธรรมดา ม.161)
 * Excel (.xlsx) Template Exporter using ExcelJS
 */
import ExcelJS from 'exceljs';
import { formatTaxId } from './thaiTaxHelper';
import { getCleanCategoryLabel } from './expenseConstants';

/**
 * Checks whether an expense item belongs to 'ซื้อสินค้า' (Cost of Goods / Inventory / Raw Materials)
 * or 'ค่าใช้จ่ายอื่นๆ' (Other Operating Expenses).
 * 
 * @param {Object} expense 
 * @returns {'goods' | 'other'}
 */
export function classifyExpenseType(expense) {
    if (!expense) return 'other';
    const cat = String(expense.category || expense.rawExpense?.category || '').toLowerCase();
    const title = String(expense.title || expense.rawExpense?.title || expense.rawExpense?.description || '').toLowerCase();
    const vendor = String(expense.vendor_name || expense.rawExpense?.vendor_name || '').toLowerCase();

    // 1. Raw materials, fresh produce, Makro groceries, ingredients, coffee beans, meat, vegetables
    if (
        cat.includes('raw_material') || 
        cat.includes('วัตถุดิบ') || 
        cat.includes('ของสด') ||
        cat.includes('ingredient') ||
        cat.includes('อาหารสด')
    ) {
        return 'goods';
    }

    // 2. Packaging & Supplies for resale or serving food (ถุง แก้ว กล่อง)
    if (
        cat.includes('packaging') || 
        cat.includes('บรรจุภัณฑ์') || 
        cat.includes('equipment_supplies') ||
        cat.includes('ถุง') ||
        cat.includes('แก้ว') ||
        cat.includes('กล่อง')
    ) {
        return 'goods';
    }

    // 3. Keyword heuristic on vendor & title
    if (
        vendor.includes('makro') || 
        vendor.includes('แม็คโคร') || 
        vendor.includes('ตลาดสด') ||
        vendor.includes('ตลาดไท') ||
        vendor.includes('โรงน้ำแข็ง') ||
        vendor.includes('น้ำแข็ง') ||
        title.includes('ซื้อวัตถุดิบ') ||
        title.includes('ซื้อเนื้อ') ||
        title.includes('ซื้อผัก') ||
        title.includes('ซื้อสินค้า') ||
        title.includes('เมล็ดกาแฟ')
    ) {
        return 'goods';
    }

    // Default to Other Operating Expenses (utilities, rent, ads, wages, fuel, repairs, software, etc.)
    return 'other';
}

/**
 * Formats a date string (YYYY-MM-DD) into Thai display format
 * e.g. "2026-08-01" -> "1 ส.ค. 2569" or "01/08/2569"
 * 
 * @param {string} dateStr 
 * @param {boolean} shortWords 
 * @returns {string}
 */
export function formatThaiDateForExcel(dateStr, shortWords = true) {
    if (!dateStr) return '';
    try {
        const clean = String(dateStr).slice(0, 10);
        const [y, m, d] = clean.split('-');
        if (!y || !m || !d) return dateStr;

        const dayNum = parseInt(d, 10);
        const monthNum = parseInt(m, 10);
        const thaiYear = parseInt(y, 10) + 543;

        if (shortWords) {
            const shortMonths = [
                'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
            ];
            const mLabel = shortMonths[monthNum - 1] || m;
            return `${dayNum} ${mLabel} ${thaiYear}`;
        }

        return `${String(dayNum).padStart(2, '0')}/${String(monthNum).padStart(2, '0')}/${thaiYear}`;
    } catch {
        return String(dateStr);
    }
}

/**
 * Generates and downloads the Official Thai Revenue Department Cash Income/Expense Excel Report (.xlsx)
 * 
 * @param {Object} options
 * @param {Array} options.records - Array of income and expense items
 * @param {Object} options.companySettings - Tax and business configuration
 * @param {string} options.periodLabel - e.g. "ประจำเดือน สิงหาคม พ.ศ. 2569"
 * @param {string} options.periodMonth - e.g. "2026-08"
 * @param {string} options.mode - 'daily' (aggregated per day) | 'detailed' (per transaction)
 */
export async function exportCashTaxTemplateExcel({
    records = [],
    companySettings = {},
    periodLabel = '',
    periodMonth = '',
    mode = 'daily'
}) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'IN THE HAUS POS - TAX ENGINE';
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheetName = 'รายงานเงินสดรับ-จ่าย';
    const worksheet = workbook.addWorksheet(sheetName, {
        views: [{ showGridLines: true }],
        pageSetup: {
            paperSize: 9, // A4
            orientation: 'portrait',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: {
                left: 0.4,
                right: 0.4,
                top: 0.5,
                bottom: 0.5,
                header: 0.2,
                footer: 0.2
            }
        }
    });

    // 1. Column Definitions & Calibrated Widths
    worksheet.columns = [
        { key: 'date', width: 15 },           // Col A: ว/ด/ป
        { key: 'description', width: 36 },    // Col B: รายการ
        { key: 'income', width: 17 },         // Col C: รายรับ (บาท)
        { key: 'expense_goods', width: 17 },  // Col D: ซื้อสินค้า (บาท)
        { key: 'expense_other', width: 17 },  // Col E: ค่าใช้จ่ายอื่นๆ (บาท)
        { key: 'remark', width: 22 }          // Col F: หมายเหตุ
    ];

    // Standard Styles
    const fontMain = { name: 'Sarabun', size: 10, color: { argb: 'FF000000' } };
    const fontBold = { name: 'Sarabun', size: 10, bold: true, color: { argb: 'FF000000' } };
    const fontTitle1 = { name: 'Sarabun', size: 13, bold: true, color: { argb: 'FF000000' } };
    const fontTitle2 = { name: 'Sarabun', size: 11, bold: true, color: { argb: 'FF000000' } };

    const thinBorder = {
        top: { style: 'thin', color: { argb: 'FF555555' } },
        left: { style: 'thin', color: { argb: 'FF555555' } },
        bottom: { style: 'thin', color: { argb: 'FF555555' } },
        right: { style: 'thin', color: { argb: 'FF555555' } }
    };

    const doubleBottomBorder = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF555555' } },
        bottom: { style: 'double', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF555555' } }
    };

    const headerFill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF9FAFB' }
    };

    // Metadata Fallbacks
    const proprietorName = companySettings.tax_proprietor_name || 
                           companySettings.tax_signature_name || 
                           companySettings.tax_company_name || 
                           'นายธนภัทร บุญเจริญ';
    
    const citizenId = companySettings.tax_citizen_id || 
                      companySettings.tax_id || 
                      '1120100144907';

    const establishmentName = companySettings.tax_establishment_name || 
                              companySettings.tax_company_name || 
                              companySettings.company_name || 
                              'ร้านในบ้าน นครพนม (IN THE HAUS)';

    const taxId = companySettings.tax_id || citizenId;

    // 2. Construct Header Section (Row 1 to 6)
    
    // Row 1: Title
    worksheet.mergeCells('A1:F1');
    const cellR1 = worksheet.getCell('A1');
    cellR1.value = 'รายงานเงินสด : รับ - จ่าย';
    cellR1.font = fontTitle1;
    cellR1.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 24;

    // Row 2: Boxed Label "ใช้บันทึกรายรับ - รายจ่าย"
    worksheet.mergeCells('A2:F2');
    const cellR2 = worksheet.getCell('A2');
    cellR2.value = 'ใช้บันทึกรายรับ - รายจ่าย';
    cellR2.font = fontTitle2;
    cellR2.alignment = { horizontal: 'center', vertical: 'middle' };
    cellR2.border = {
        top: { style: 'medium', color: { argb: 'FF1E3A1E' } },
        bottom: { style: 'medium', color: { argb: 'FF1E3A1E' } },
        left: { style: 'medium', color: { argb: 'FF1E3A1E' } },
        right: { style: 'medium', color: { argb: 'FF1E3A1E' } }
    };
    cellR2.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0FDF4' }
    };
    worksheet.getRow(2).height = 22;

    // Row 3: Entity Type
    worksheet.mergeCells('A3:F3');
    const cellR3 = worksheet.getCell('A3');
    cellR3.value = 'ของร้านค้า/กิจการ ในนามบุคคลธรรมดา';
    cellR3.font = fontMain;
    cellR3.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(3).height = 18;

    // Row 4: Subtitle Underlined
    worksheet.mergeCells('A4:F4');
    const cellR4 = worksheet.getCell('A4');
    cellR4.value = `รายงานเงินสด รับ - จ่าย ${periodLabel ? `(${periodLabel})` : ''}`;
    cellR4.font = { ...fontBold, underline: true };
    cellR4.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(4).height = 20;

    // Row 5: Proprietor & Citizen ID
    worksheet.getCell('A5').value = 'ชื่อผู้ประกอบกิจการ:';
    worksheet.getCell('A5').font = fontBold;
    worksheet.getCell('A5').alignment = { horizontal: 'left', vertical: 'middle' };

    worksheet.mergeCells('B5:C5');
    worksheet.getCell('B5').value = proprietorName;
    worksheet.getCell('B5').font = fontMain;
    worksheet.getCell('B5').alignment = { horizontal: 'left', vertical: 'middle' };

    worksheet.getCell('D5').value = 'เลขประจำตัวประชาชน:';
    worksheet.getCell('D5').font = fontBold;
    worksheet.getCell('D5').alignment = { horizontal: 'left', vertical: 'middle' };

    worksheet.mergeCells('E5:F5');
    worksheet.getCell('E5').value = formatTaxId(citizenId);
    worksheet.getCell('E5').font = { ...fontMain, name: 'Consolas' };
    worksheet.getCell('E5').alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.getRow(5).height = 20;

    // Row 6: Establishment & Tax ID
    worksheet.getCell('A6').value = 'ชื่อสถานประกอบการ:';
    worksheet.getCell('A6').font = fontBold;
    worksheet.getCell('A6').alignment = { horizontal: 'left', vertical: 'middle' };

    worksheet.mergeCells('B6:C6');
    worksheet.getCell('B6').value = establishmentName;
    worksheet.getCell('B6').font = fontMain;
    worksheet.getCell('B6').alignment = { horizontal: 'left', vertical: 'middle' };

    worksheet.getCell('D6').value = 'เลขประจำตัวผู้เสียภาษีอากร:';
    worksheet.getCell('D6').font = fontBold;
    worksheet.getCell('D6').alignment = { horizontal: 'left', vertical: 'middle' };

    worksheet.mergeCells('E6:F6');
    worksheet.getCell('E6').value = formatTaxId(taxId);
    worksheet.getCell('E6').font = { ...fontMain, name: 'Consolas' };
    worksheet.getCell('E6').alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.getRow(6).height = 20;

    // Add empty space row (Row 7)
    worksheet.getRow(7).height = 8;

    // 3. Construct Table Header (Row 8 & Row 9)
    // Row 8: Upper Headers
    worksheet.getCell('A8').value = 'ว/ด/ป';
    worksheet.getCell('B8').value = 'รายการ';
    worksheet.getCell('C8').value = 'รายรับ';
    worksheet.getCell('D8').value = 'รายจ่าย (บาท)';
    worksheet.getCell('F8').value = 'หมายเหตุ';

    // Row 9: Lower Sub-headers
    worksheet.getCell('C9').value = '(บาท)';
    worksheet.getCell('D9').value = 'ซื้อสินค้า';
    worksheet.getCell('E9').value = 'ค่าใช้จ่ายอื่นๆ';

    // Merges for Table Header
    worksheet.mergeCells('A8:A9');
    worksheet.mergeCells('B8:B9');
    worksheet.mergeCells('D8:E8');
    worksheet.mergeCells('F8:F9');

    // Style Table Header Cells
    const headerCells = ['A8', 'A9', 'B8', 'B9', 'C8', 'C9', 'D8', 'D9', 'E8', 'E9', 'F8', 'F9'];
    headerCells.forEach(cellRef => {
        const cell = worksheet.getCell(cellRef);
        cell.font = fontBold;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = thinBorder;
        cell.fill = headerFill;
    });

    worksheet.getRow(8).height = 22;
    worksheet.getRow(9).height = 22;

    // 4. Process Data Records
    let processedRows = [];

    if (mode === 'daily') {
        // Group records by Date (YYYY-MM-DD)
        const dateGroups = {};
        
        records.forEach(item => {
            const d = String(item.date || '').slice(0, 10);
            if (!d) return;
            if (!dateGroups[d]) {
                dateGroups[d] = {
                    date: d,
                    incomes: [],
                    expenses: []
                };
            }
            if (item.type === 'INCOME') {
                dateGroups[d].incomes.push(item);
            } else {
                dateGroups[d].expenses.push(item);
            }
        });

        const sortedDates = Object.keys(dateGroups).sort();

        sortedDates.forEach(dateKey => {
            const group = dateGroups[dateKey];
            
            // 4.1 Daily POS Revenue Aggregated Line
            if (group.incomes.length > 0) {
                const totalDailyIncome = group.incomes.reduce((s, it) => s + Number(it.inAmount || 0), 0);
                const billCount = group.incomes.length;
                
                processedRows.push({
                    date: dateKey,
                    description: `ยอดขายประจำวัน (บิลขาย POS รวม ${billCount} บิล)`,
                    income: totalDailyIncome,
                    expenseGoods: null,
                    expenseOther: null,
                    remark: `รวม ${billCount} รายการ`
                });
            }

            // 4.2 Individual Expense Lines on that date
            group.expenses.forEach(exp => {
                const expType = classifyExpenseType(exp);
                const amount = Number(exp.outAmount || 0);
                const docNo = exp.docNo || exp.rawExpense?.receipt_number || '';
                const proofType = exp.proofType || 'ใบเสร็จรับเงิน';
                const catLabel = exp.category ? `[${exp.category}] ` : '';
                const remarkStr = docNo ? `${docNo} (${proofType})` : proofType;

                processedRows.push({
                    date: dateKey,
                    description: `${catLabel}${exp.title || 'ค่าใช้จ่ายดำเนินงาน'}`,
                    income: null,
                    expenseGoods: expType === 'goods' ? amount : null,
                    expenseOther: expType === 'other' ? amount : null,
                    remark: remarkStr
                });
            });
        });
    } else {
        // Detailed Mode (Line by Line)
        processedRows = records.map(item => {
            if (item.type === 'INCOME') {
                return {
                    date: item.date,
                    description: item.title || 'ยอดขายหน้าร้าน (POS)',
                    income: Number(item.inAmount || 0),
                    expenseGoods: null,
                    expenseOther: null,
                    remark: item.docNo || 'บิล POS'
                };
            } else {
                const expType = classifyExpenseType(item);
                const amount = Number(item.outAmount || 0);
                const docNo = item.docNo || item.rawExpense?.receipt_number || '';
                const proofType = item.proofType || 'ใบเสร็จ';
                const remarkStr = docNo ? `${docNo} (${proofType})` : proofType;

                return {
                    date: item.date,
                    description: item.title || 'ค่าใช้จ่าย',
                    income: null,
                    expenseGoods: expType === 'goods' ? amount : null,
                    expenseOther: expType === 'other' ? amount : null,
                    remark: remarkStr
                };
            }
        });
    }

    // Sort all rows chronologically by date
    processedRows.sort((a, b) => {
        if (a.date === b.date) {
            // Income lines first, then expenses
            if (a.income && !b.income) return -1;
            if (!a.income && b.income) return 1;
            return 0;
        }
        return new Date(a.date) - new Date(b.date);
    });

    // 5. Populate Data Rows into Sheet (Starting at Row 10)
    let currentRowIdx = 10;

    processedRows.forEach((row) => {
        const rowObj = worksheet.getRow(currentRowIdx);
        
        // Col A: Date formatted in Thai
        rowObj.getCell(1).value = formatThaiDateForExcel(row.date, true);
        rowObj.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        rowObj.getCell(1).font = fontMain;
        rowObj.getCell(1).border = thinBorder;

        // Col B: Description
        rowObj.getCell(2).value = row.description;
        rowObj.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
        rowObj.getCell(2).font = fontMain;
        rowObj.getCell(2).border = thinBorder;

        // Col C: Income (Number)
        rowObj.getCell(3).value = row.income !== null && row.income !== undefined ? Number(row.income) : null;
        rowObj.getCell(3).numFmt = '#,##0.00;(#,##0.00);"-"';
        rowObj.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
        rowObj.getCell(3).font = row.income ? fontBold : fontMain;
        rowObj.getCell(3).border = thinBorder;

        // Col D: Purchase of Goods (Number)
        rowObj.getCell(4).value = row.expenseGoods !== null && row.expenseGoods !== undefined ? Number(row.expenseGoods) : null;
        rowObj.getCell(4).numFmt = '#,##0.00;(#,##0.00);"-"';
        rowObj.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
        rowObj.getCell(4).font = fontMain;
        rowObj.getCell(4).border = thinBorder;

        // Col E: Other Expenses (Number)
        rowObj.getCell(5).value = row.expenseOther !== null && row.expenseOther !== undefined ? Number(row.expenseOther) : null;
        rowObj.getCell(5).numFmt = '#,##0.00;(#,##0.00);"-"';
        rowObj.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
        rowObj.getCell(5).font = fontMain;
        rowObj.getCell(5).border = thinBorder;

        // Col F: Remarks
        rowObj.getCell(6).value = row.remark || '';
        rowObj.getCell(6).alignment = { horizontal: 'left', vertical: 'middle' };
        rowObj.getCell(6).font = fontMain;
        rowObj.getCell(6).border = thinBorder;

        rowObj.height = 20;
        currentRowIdx++;
    });

    // Guard: If no data rows, add at least one blank row
    if (processedRows.length === 0) {
        const rowObj = worksheet.getRow(currentRowIdx);
        for (let c = 1; c <= 6; c++) {
            rowObj.getCell(c).value = c === 2 ? 'ไม่มีรายการในรอบระยะเวลานี้' : '';
            rowObj.getCell(c).alignment = { horizontal: c === 2 ? 'left' : 'center', vertical: 'middle' };
            rowObj.getCell(c).font = fontMain;
            rowObj.getCell(c).border = thinBorder;
        }
        rowObj.height = 20;
        currentRowIdx++;
    }

    // 6. Summary Totals Row with Excel Formulas & Pre-Calculated Results
    const lastDataRow = currentRowIdx - 1;
    const summaryRow = worksheet.getRow(currentRowIdx);

    const totalIncomeCalc = processedRows.reduce((s, r) => s + (Number(r.income) || 0), 0);
    const totalGoodsCalc = processedRows.reduce((s, r) => s + (Number(r.expenseGoods) || 0), 0);
    const totalOtherCalc = processedRows.reduce((s, r) => s + (Number(r.expenseOther) || 0), 0);
    const netProfitCalc = totalIncomeCalc - (totalGoodsCalc + totalOtherCalc);

    // Merge A & B for "รวมทั้งสิ้น"
    worksheet.mergeCells(`A${currentRowIdx}:B${currentRowIdx}`);
    const summaryLabelCell = summaryRow.getCell(1);
    summaryLabelCell.value = 'รวมทั้งสิ้น (TOTAL)';
    summaryLabelCell.font = fontBold;
    summaryLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };
    summaryLabelCell.fill = headerFill;
    summaryLabelCell.border = doubleBottomBorder;

    summaryRow.getCell(2).border = doubleBottomBorder;

    // Col C: Total Income Formula (with pre-calculated number for instant display)
    const cellIncomeSum = summaryRow.getCell(3);
    cellIncomeSum.value = { 
        formula: `SUM(C10:C${lastDataRow})`,
        result: totalIncomeCalc
    };
    cellIncomeSum.numFmt = '#,##0.00;(#,##0.00);"-"';
    cellIncomeSum.font = { ...fontBold, color: { argb: 'FF15803D' } }; // Forest Green
    cellIncomeSum.alignment = { horizontal: 'right', vertical: 'middle' };
    cellIncomeSum.fill = headerFill;
    cellIncomeSum.border = doubleBottomBorder;

    // Col D: Total Goods Purchases Formula (with pre-calculated number for instant display)
    const cellGoodsSum = summaryRow.getCell(4);
    cellGoodsSum.value = { 
        formula: `SUM(D10:D${lastDataRow})`,
        result: totalGoodsCalc
    };
    cellGoodsSum.numFmt = '#,##0.00;(#,##0.00);"-"';
    cellGoodsSum.font = { ...fontBold, color: { argb: 'FFB91C1C' } }; // Rose Red
    cellGoodsSum.alignment = { horizontal: 'right', vertical: 'middle' };
    cellGoodsSum.fill = headerFill;
    cellGoodsSum.border = doubleBottomBorder;

    // Col E: Total Other Expenses Formula (with pre-calculated number for instant display)
    const cellOtherSum = summaryRow.getCell(5);
    cellOtherSum.value = { 
        formula: `SUM(E10:E${lastDataRow})`,
        result: totalOtherCalc
    };
    cellOtherSum.numFmt = '#,##0.00;(#,##0.00);"-"';
    cellOtherSum.font = { ...fontBold, color: { argb: 'FFB91C1C' } };
    cellOtherSum.alignment = { horizontal: 'right', vertical: 'middle' };
    cellOtherSum.fill = headerFill;
    cellOtherSum.border = doubleBottomBorder;

    // Col F: Remarks Column (clean blank matching official Revenue Dept template)
    const cellRemarkSum = summaryRow.getCell(6);
    cellRemarkSum.value = '';
    cellRemarkSum.fill = headerFill;
    cellRemarkSum.border = doubleBottomBorder;

    summaryRow.height = 24;

    // 6.1 Optional Net Profit Summary strip 2 rows below table
    const profitRowIdx = currentRowIdx + 2;
    worksheet.mergeCells(`A${profitRowIdx}:D${profitRowIdx}`);
    const profitLabelCell = worksheet.getCell(`A${profitRowIdx}`);
    profitLabelCell.value = 'กำไรสุทธิก่อนภาษี (รายรับ - รายจ่ายทั้งหมด):';
    profitLabelCell.font = fontBold;
    profitLabelCell.alignment = { horizontal: 'right', vertical: 'middle' };

    const profitValueCell = worksheet.getCell(`E${profitRowIdx}`);
    profitValueCell.value = {
        formula: `C${currentRowIdx}-(D${currentRowIdx}+E${currentRowIdx})`,
        result: netProfitCalc
    };
    profitValueCell.numFmt = '#,##0.00;(#,##0.00);"-"';
    profitValueCell.font = { ...fontBold, color: { argb: netProfitCalc >= 0 ? 'FF15803D' : 'FFB91C1C' } };
    profitValueCell.alignment = { horizontal: 'right', vertical: 'middle' };
    profitValueCell.border = {
        top: { style: 'thin', color: { argb: 'FF555555' } },
        bottom: { style: 'double', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF555555' } },
        right: { style: 'thin', color: { argb: 'FF555555' } }
    };
    profitValueCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: netProfitCalc >= 0 ? 'FFF0FDF4' : 'FFFDF2F2' }
    };

    const profitUnitCell = worksheet.getCell(`F${profitRowIdx}`);
    profitUnitCell.value = 'บาท';
    profitUnitCell.font = fontMain;
    profitUnitCell.alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.getRow(profitRowIdx).height = 22;

    // 7. Write to Buffer and Trigger Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });

    const safeMonth = periodMonth ? periodMonth.replace(/[^0-9-]/g, '') : 'all';
    const modeSuffix = mode === 'daily' ? '_สรุปรายวัน' : '_ละเอียดรายบิล';
    const filename = `รายงานเงินสดรับจ่าย_สรรพากร_${safeMonth}${modeSuffix}.xlsx`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true, filename, totalRows: processedRows.length };
}
