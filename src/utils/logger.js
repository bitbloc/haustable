// Logger utility to capture JS errors, console logs, and native crashes in localStorage.
// This serves as an offline-friendly, local Crash Reporting & Diagnostics tool for POS terminals.

const LOGS_KEY = 'onhaus_debug_logs';
const PENDING_ACTION_KEY = 'onhaus_pending_native_action';
const MAX_LOGS = 150;

// Device & Environment metadata
function getSystemMetadata() {
    return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        online: navigator.onLine,
        url: window.location.href,
        screenSize: `${window.screen.width}x${window.screen.height}`,
        devicePixelRatio: window.devicePixelRatio,
    };
}

class AppLogger {
    constructor() {
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        this.initialized = true;

        // 1. Intercept global JS uncaught errors
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

        // 3. Check for previous native crash
        this.checkPreviousNativeCrash();
    }

    getLogs() {
        try {
            const stored = localStorage.getItem(LOGS_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('Failed to read debug logs:', e);
            return [];
        }
    }

    saveLogs(logs) {
        try {
            // Keep logs within size limit
            const trimmed = logs.slice(-MAX_LOGS);
            localStorage.setItem(LOGS_KEY, JSON.stringify(trimmed));
        } catch (e) {
            console.error('Failed to save debug logs:', e);
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
        this.saveLogs(logs);
        
        // Print to original console
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

    // Call before starting a native plugin operation (e.g. printing)
    logNativeStart(actionName, details = null) {
        try {
            localStorage.setItem(PENDING_ACTION_KEY, JSON.stringify({
                action: actionName,
                timestamp: Date.now(),
                details
            }));
            this.info(`Native Operation Started: ${actionName}`, details);
        } catch (e) {
            console.error('Failed to log native start:', e);
        }
    }

    // Call after a native plugin operation completes successfully
    logNativeEnd(actionName) {
        try {
            localStorage.removeItem(PENDING_ACTION_KEY);
            this.info(`Native Operation Completed: ${actionName}`);
        } catch (e) {
            console.error('Failed to log native end:', e);
        }
    }

    // Check if the app crashed during a pending native action
    checkPreviousNativeCrash() {
        try {
            const pending = localStorage.getItem(PENDING_ACTION_KEY);
            if (pending) {
                const parsed = JSON.parse(pending);
                // The app closed unexpectedly while this was running (native crash detected!)
                this.crash(`Native Crash Detected (${parsed.action})`, {
                    message: `Application crashed/terminated during native operation: ${parsed.action}`,
                    timeOfAction: new Date(parsed.timestamp).toISOString(),
                    actionDetails: parsed.details
                });
                // Clear the pending state so we don't report it again
                localStorage.removeItem(PENDING_ACTION_KEY);
            }
        } catch (e) {
            console.error('Failed to check previous native crash:', e);
        }
    }

    clearLogs() {
        try {
            localStorage.removeItem(LOGS_KEY);
            localStorage.removeItem(PENDING_ACTION_KEY);
            this.info('Debug logs cleared by user');
        } catch (e) {
            console.error('Failed to clear logs:', e);
        }
    }
}

export const logger = new AppLogger();
