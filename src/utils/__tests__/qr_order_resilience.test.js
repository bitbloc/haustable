import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('QR Order Resilience & Print Scheduling', () => {
    let mockLocalStorage = {};

    beforeEach(() => {
        vi.useFakeTimers();
        mockLocalStorage = {};
        global.localStorage = {
            getItem: vi.fn((key) => mockLocalStorage[key] !== undefined ? mockLocalStorage[key] : null),
            setItem: vi.fn((key, val) => { mockLocalStorage[key] = String(val); }),
            removeItem: vi.fn((key) => { delete mockLocalStorage[key]; }),
            clear: vi.fn(() => { mockLocalStorage = {}; })
        };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Per-Booking Debounce Timers (Multi-table Isolation)', () => {
        it('should allow concurrent orders from different tables without cancelling each other', () => {
            const debounceMap = new Map();
            const executedPrints = [];

            const scheduleAutoPrint = (bookingId, tableName, delay = 500) => {
                if (!bookingId) return;
                if (debounceMap.has(bookingId)) {
                    clearTimeout(debounceMap.get(bookingId));
                }
                const timer = setTimeout(() => {
                    debounceMap.delete(bookingId);
                    executedPrints.push({ bookingId, tableName });
                }, delay);
                debounceMap.set(bookingId, timer);
            };

            // Table 1 places order at t=0
            scheduleAutoPrint('booking-t1', 'Table 1', 500);

            // Table 2 places order at t=200ms (within Table 1's debounce window)
            vi.advanceTimersByTime(200);
            scheduleAutoPrint('booking-t2', 'Table 2', 500);

            // At t=400ms: neither has executed yet
            vi.advanceTimersByTime(200);
            expect(executedPrints).toHaveLength(0);

            // At t=550ms: Table 1 should have executed, Table 2 still pending
            vi.advanceTimersByTime(150);
            expect(executedPrints).toHaveLength(1);
            expect(executedPrints[0].bookingId).toBe('booking-t1');

            // At t=750ms: Table 2 should also have executed
            vi.advanceTimersByTime(200);
            expect(executedPrints).toHaveLength(2);
            expect(executedPrints[1].bookingId).toBe('booking-t2');
        });

        it('should properly debounce multiple rapid items for the SAME table', () => {
            const debounceMap = new Map();
            const executedPrints = [];

            const scheduleAutoPrint = (bookingId, tableName, delay = 500) => {
                if (debounceMap.has(bookingId)) {
                    clearTimeout(debounceMap.get(bookingId));
                }
                const timer = setTimeout(() => {
                    debounceMap.delete(bookingId);
                    executedPrints.push(bookingId);
                }, delay);
                debounceMap.set(bookingId, timer);
            };

            // Rapid inserts for Table 1 (e.g. 3 items inserted into order_items)
            scheduleAutoPrint('booking-t1', 'Table 1', 500);
            vi.advanceTimersByTime(100);
            scheduleAutoPrint('booking-t1', 'Table 1', 500);
            vi.advanceTimersByTime(100);
            scheduleAutoPrint('booking-t1', 'Table 1', 500);

            // Advance past 500ms from last insert
            vi.advanceTimersByTime(550);

            // Must execute exactly once
            expect(executedPrints).toHaveLength(1);
            expect(executedPrints[0]).toBe('booking-t1');
        });
    });

    describe('Post-Print Verification & Deduplication', () => {
        it('should NOT record items as printed if printing fails or returns false', async () => {
            const bookingId = 'booking-test-fail';
            const storageKey = `qr_printed_items_${bookingId}`;

            const unprintedItems = [{ id: 'item-1' }, { id: 'item-2' }];

            // Simulate autoPrintQROrder returning false (e.g. printer error / out of paper)
            const mockAutoPrint = vi.fn().mockResolvedValue(false);

            const printSuccess = await mockAutoPrint();
            if (printSuccess) {
                const newPrinted = unprintedItems.map(i => i.id);
                global.localStorage.setItem(storageKey, JSON.stringify(newPrinted));
            }

            // localStorage must NOT contain printed records
            expect(global.localStorage.getItem(storageKey)).toBeNull();

            // When retried with successful print:
            mockAutoPrint.mockResolvedValue(true);
            const retrySuccess = await mockAutoPrint();
            if (retrySuccess) {
                const newPrinted = unprintedItems.map(i => i.id);
                global.localStorage.setItem(storageKey, JSON.stringify(newPrinted));
            }

            // Now it is recorded
            expect(JSON.parse(global.localStorage.getItem(storageKey))).toEqual(['item-1', 'item-2']);
        });
    });

    describe('Leak-Proof Concurrency Guard for Heartbeat Polling', () => {
        it('should prevent overlapping in-flight polling requests when connection is slow', async () => {
            const isHeartbeatRunning = { current: false };
            let concurrentExecutions = 0;
            let maxConcurrentObserved = 0;

            const slowHeartbeatTask = async () => {
                if (isHeartbeatRunning.current) return;
                isHeartbeatRunning.current = true;
                concurrentExecutions++;
                maxConcurrentObserved = Math.max(maxConcurrentObserved, concurrentExecutions);

                // Simulate slow 2-second DB query
                await new Promise(r => setTimeout(r, 2000));

                concurrentExecutions--;
                isHeartbeatRunning.current = false;
            };

            // Launch 1st task
            const p1 = slowHeartbeatTask();

            // Launch 2nd task immediately while 1st is in-flight
            const p2 = slowHeartbeatTask();

            // Advance time and resolve
            vi.advanceTimersByTime(2500);
            await Promise.all([p1, p2]);

            // Second call was blocked by lock, max concurrent is strictly 1
            expect(maxConcurrentObserved).toBe(1);
            expect(isHeartbeatRunning.current).toBe(false);
        });

        it('should adapt interval based on screen visibility (15s foreground, 30s background)', () => {
            let currentIntervalMs = 0;
            let timerId = null;

            const startHeartbeat = (ms) => {
                if (timerId) clearInterval(timerId);
                currentIntervalMs = ms;
                timerId = setInterval(() => {}, ms);
            };

            const updateHeartbeatMode = (isVisible) => {
                startHeartbeat(isVisible ? 15000 : 30000);
            };

            // Foreground: 15s
            updateHeartbeatMode(true);
            expect(currentIntervalMs).toBe(15000);

            // Background / folded: 30s (still running!)
            updateHeartbeatMode(false);
            expect(currentIntervalMs).toBe(30000);

            // Cleanup
            clearInterval(timerId);
        });
    });
});
