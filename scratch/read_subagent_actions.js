import fs from 'fs';
import readline from 'readline';

const logPath = 'C:\\Users\\Ritha\\.gemini\\antigravity-ide\\brain\\e25bc0c6-fe7b-4ce2-a62e-df8dbf7a7a50\\.system_generated\\logs\\transcript_full.jsonl';

const fileStream = fs.createReadStream(logPath);
const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
});

rl.on('line', (line) => {
    try {
        const step = JSON.parse(line);
        if (step.step_index === 1217) {
            console.log('--- Untruncated Subagent Content ---');
            console.log(step.content);
        }
    } catch (e) {
        // Skip
    }
});
