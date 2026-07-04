const SHEET_URL = "https://docs.google.com/spreadsheets/d/1AJVcXjwuzlm5U_UPD91wWPKz76jTRrW2VPsL22MR9CU/export?format=csv";

// Helper for splitting tasks
const splitTasks = (taskStr) => {
    if (!taskStr) return [];
    const result = [];
    let current = '';
    let depth = 0;
    for (let i = 0; i < taskStr.length; i++) {
        const char = taskStr[i];
        if (char === '(' || char === '[' || char === '{') {
            depth++;
        } else if (char === ')' || char === ']' || char === '}') {
            depth--;
        }
        
        if (char === ',' && depth === 0) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    if (current.trim()) {
        result.push(current.trim());
    }
    return result.filter(Boolean);
};

async function analyzeCSV() {
    try {
        const res = await fetch(SHEET_URL);
        const text = await res.text();
        const lines = text.split('\n');
        
        let maxOpening = 0;
        let maxOpeningRow = null;
        let maxClosing = 0;
        let maxClosingRow = null;
        
        // Simple CSV parser
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;
            
            // Parse row columns
            const row = [];
            let current = '';
            let insideQuote = false;
            for (let j = 0; j < line.length; j++) {
                const char = line[j];
                if (char === '"') {
                    insideQuote = !insideQuote;
                } else if (char === ',' && !insideQuote) {
                    row.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }
            row.push(current);
            
            const shiftType = row[2] || '';
            if (shiftType.includes('เปิด')) {
                const dTasks = splitTasks(row[3]);
                const eTasks = splitTasks(row[4]);
                const total = dTasks.length + eTasks.length;
                if (total > maxOpening) {
                    maxOpening = total;
                    maxOpeningRow = row;
                }
            } else if (shiftType.includes('ปิด')) {
                const jTasks = splitTasks(row[9]);
                const kTasks = splitTasks(row[10]);
                const total = jTasks.length + kTasks.length;
                if (total > maxClosing) {
                    maxClosing = total;
                    maxClosingRow = row;
                }
            }
        }
        
        console.log(`Max Opening Tasks found: ${maxOpening}`);
        if (maxOpeningRow) {
            console.log(`- Column 3: ${maxOpeningRow[3]}`);
            console.log(`- Column 4: ${maxOpeningRow[4]}`);
        }
        
        console.log(`\nMax Closing Tasks found: ${maxClosing}`);
        if (maxClosingRow) {
            console.log(`- Column 9: ${maxClosingRow[9]}`);
            console.log(`- Column 10: ${maxClosingRow[10]}`);
        }
    } catch (e) {
        console.error(e);
    }
}

analyzeCSV();
