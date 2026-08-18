// Logger utility to capture JS errors, console logs, and native crashes in localStorage.
// Optimized with in-memory buffering and debounced persistence to eliminate UI frame freezes.

const LOGS_KEY = 'onhaus_debug_logs';
const PENDING_ACTION_KEY = 'onhaus_pending_native_action';
const MAX_LOGS = 100;

function getSystemMetadata() {
    if (typeof window === 'undefined') return {};
    return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        online: navigator.onLine,
        url: window.location.href,
        screenSize: typeof window.screen !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : 'unknown',
        devicePixelRatio: window.devicePixelRatio || 1,
    };
}

class AppLogger {
    constructor() {
        this.initialized = false;
        this.memoryLogs = null;
        this.flushTimer = null;
    }

    init() {
        if (this.initialized) return;
        this.initialized = true;

        // 1. Intercept global JS uncaught errors
        if (typeof window !== 'undefined') {
            window.addEventListener('error', (event) => {
                const errorMsg = event.error ? event.error.stack || event.error.message : event.message;
                this.error('Uncaught JS Error', {
                    message: errorMsg,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno
                });
            });

            // 2. Intercept unhandled Promise rejections
            window.addEventListener('unhandledrejection', (event) => {
                const reason = event.reason;
                const errorMsg = reason instanceof Error ? reason.stack || reason.message : String(reason);
                this.error('Unhandled Promise Rejection', { reason: errorMsg });
            });
        }

        // 3. Check for previous native crash
        this.checkPreviousNativeCrash();
    }

    getLogs() {
        if (this.memoryLogs !== null) {
            return this.memoryLogs;
        }
        try {
            const stored = localStorage.getItem(LOGS_KEY);
            this.memoryLogs = stored ? JSON.parse(stored) : [];
        } catch {
            this.memoryLogs = [];
        }
        return this.memoryLogs;
    }

    scheduleFlush() {
        if (this.flushTimer) return;
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            this.flushLogsToStorage();
        }, 1500);
    }

    flushLogsToStorage() {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        try {
            const trimmed = (this.memoryLogs || []).slice(-MAX_LOGS);
            localStorage.setItem(LOGS_KEY, JSON.stringify(trimmed));
        } catch (e) {
            console.warn('[Logger] Storage write warning:', e);
        }
    }

    log(level, title, details = null) {
        const logs = this.getLogs();
        const newLog = {
            id: Date.now() + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toISOString(),
            level, // 'INFO' | 'WARN' | 'ERROR' | 'CRASH'
            title,
            details: typeof details === 'object' ? details : { message: String(details) },
            metadata: getSystemMetadata()
        };
        logs.push(newLog);
        if (logs.length > MAX_LOGS) {
            logs.shift();
        }

        // Critical logs flushed immediately, INFO logs debounced to keep UI smooth
        if (level === 'ERROR' || level === 'CRASH' || level === 'WARN') {
            this.flushLogsToStorage();
        } else {
            this.scheduleFlush();
        }
        
        // Output to console
        const formattedMsg = `[OnHaus Logger - ${level}] ${title} ${details ? JSON.stringify(details) : ''}`;
        if (level === 'ERROR' || level === 'CRASH') {
            console.error(formattedMsg);
        } else if (level === 'WARN') {
            console.warn(formattedMsg);
        } else {
            console.log(formattedMsg);
        }
    }

    info(title, details) { this.log('INFO', title, details); }
    warn(title, details) { this.log('WARN', title, details); }
    error(title, details) { this.log('ERROR', title, details); }
    crash(title, details) { this.log('CRASH', title, details); }

    logNativeStart(actionName, details = null) {
        try {
            localStorage.setItem(PENDING_ACTION_KEY, JSON.stringify({
                action: actionName,
                timestamp: Date.now(),
                details
            }));
        } catch {}
        this.info(`Native Operation Started: ${actionName}`, details);
    }

    logNativeEnd(actionName) {
        try {
            localStorage.removeItem(PENDING_ACTION_KEY);
        } catch {}
        this.info(`Native Operation Completed: ${actionName}`);
    }

    checkPreviousNativeCrash() {
        try {
            const pending = localStorage.getItem(PENDING_ACTION_KEY);
            if (pending) {
                const parsed = JSON.parse(pending);
                this.crash(`Native Crash Detected (${parsed.action})`, {
                    message: `Application crashed/terminated during native operation: ${parsed.action}`,
                    timeOfAction: new Date(parsed.timestamp).toISOString(),
                    actionDetails: parsed.details
                });
                localStorage.removeItem(PENDING_ACTION_KEY);
            }
        } catch (e) {
            console.error('Failed to check previous native crash:', e);
        }
    }

    clearLogs() {
        this.memoryLogs = [];
        try {
            localStorage.removeItem(LOGS_KEY);
            localStorage.removeItem(PENDING_ACTION_KEY);
        } catch (e) {
            console.error('Failed to clear logs:', e);
        }
    }
}

export const logger = new AppLogger();
