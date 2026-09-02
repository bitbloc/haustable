/**
 * Helper to dispatch email and push notifications when a new Hausmade order is placed.
 * Target: Rithawat@gmail.com
 */
import { getAppOrigin } from './urlHelper'

export async function sendOrderNotificationEmail(orderData, orderItems = []) {
    if (!orderData) return { success: false, error: 'No order data' }

    try {
        const appOrigin = getAppOrigin()
        const targetEmail = 'Rithawat@gmail.com'

        const payload = {
            orderData,
            orderItems,
            targetEmail,
            appOrigin
        }

        // Call the serverless function endpoint
        const response = await fetch(`${appOrigin}/api/send-order-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })

        const data = await response.json()
        console.log('[orderNotificationHelper] Notification dispatch result:', data)
        return data
    } catch (err) {
        console.warn('[orderNotificationHelper] Failed to dispatch email notification:', err)
        return { success: false, error: err.message }
    }
}
