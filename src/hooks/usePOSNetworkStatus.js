import { useState, useEffect, useCallback, useRef } from 'react';
import { isOnline, getOfflineQueue, getDeadLetterQueue, checkRealConnectivity, syncOfflineQueue } from '../utils/offlineHelper';
import { toast } from 'sonner';

/**
 * Custom hook to monitor POS network status, offline queue, and connection transitions.
 * Complies with Dieter Rams and Thai Modern aesthetics (clean, informative, non-disruptive).
 */
export default function usePOSNetworkStatus() {
    const [online, setOnline] = useState(() => isOnline());
    const [queueCount, setQueueCount] = useState(() => getOfflineQueue().length);
    const [dlqCount, setDlqCount] = useState(() => getDeadLetterQueue().length);
    const [isChecking, setIsChecking] = useState(false);
    const [wasRecentlyRestored, setWasRecentlyRestored] = useState(false);
    const prevOnlineRef = useRef(online);
    const restoreTimerRef = useRef(null);

    const refreshQueue = useCallback(() => {
        setQueueCount(getOfflineQueue().length);
        setDlqCount(getDeadLetterQueue().length);
    }, []);

    const checkConnectivityNow = useCallback(async () => {
        setIsChecking(true);
        try {
            const connected = await checkRealConnectivity();
            setOnline(connected);
            if (connected) {
                syncOfflineQueue();
                toast.success('เชื่อมต่ออินเทอร์เน็ตสำเร็จ', {
                    description: 'สัญญาณเครือข่ายและเซิร์ฟเวอร์พร้อมใช้งาน'
                });
            } else {
                toast.warning('ยังไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้', {
                    description: 'ระบบยังคงทำงานในโหมดออฟไลน์อย่างต่อเนื่อง'
                });
            }
            return connected;
        } finally {
            setIsChecking(false);
            refreshQueue();
        }
    }, [refreshQueue]);

    useEffect(() => {
        const handleNetworkChanged = (e) => {
            const nextOnline = e?.detail?.isOnline !== undefined ? e.detail.isOnline : isOnline();
            
            // Online -> Offline transition
            if (prevOnlineRef.current && !nextOnline) {
                toast.warning('[OFFLINE] ขาดการเชื่อมต่ออินเทอร์เน็ต', {
                    description: 'POS สลับเป็นโหมดออฟไลน์อัตโนมัติ (เปิดโต๊ะ ขาย และพิมพ์สลิปได้ตามปกติ)'
                });
            }

            // Offline -> Online transition
            if (!prevOnlineRef.current && nextOnline) {
                toast.success('[ONLINE] สัญญาณอินเทอร์เน็ตกลับมาแล้ว', {
                    description: 'ระบบกำลังนำส่งข้อมูลที่ค้างในเครื่องขึ้นระบบคลาวด์...'
                });
                setWasRecentlyRestored(true);
                if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
                restoreTimerRef.current = setTimeout(() => {
                    setWasRecentlyRestored(false);
                }, 5000);
            }

            prevOnlineRef.current = nextOnline;
            setOnline(nextOnline);
            refreshQueue();
        };

        const handleOffline = () => {
            handleNetworkChanged({ detail: { isOnline: false } });
        };

        const handleOnline = async () => {
            const ok = await checkRealConnectivity();
            handleNetworkChanged({ detail: { isOnline: ok } });
        };

        window.addEventListener('pos-network-status-changed', handleNetworkChanged);
        window.addEventListener('offline-queue-changed', refreshQueue);
        window.addEventListener('offline-dlq-changed', refreshQueue);
        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);

        return () => {
            window.removeEventListener('pos-network-status-changed', handleNetworkChanged);
            window.removeEventListener('offline-queue-changed', refreshQueue);
            window.removeEventListener('offline-dlq-changed', refreshQueue);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
            if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
        };
    }, [refreshQueue]);

    return {
        isOnline: online,
        queueCount,
        dlqCount,
        isChecking,
        wasRecentlyRestored,
        checkConnectivityNow,
        refreshQueue
    };
}
