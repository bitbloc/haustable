import { Clock, CheckCircle, ChefHat, Utensils } from 'lucide-react'
import { useLanguage } from '../context/LanguageContext'

export function useStatusConfig() {
  const { t } = useLanguage()

  const BOOKING_STEPS = [
    { key: 'pending', label: t('stepPending'), sub: 'Waiting', icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-50' },
    { key: 'confirmed', label: t('stepConfirmed'), sub: 'Confirmed', icon: CheckCircle, color: 'text-blue-500', bg: 'bg-blue-50' },
    { key: 'seated', label: t('stepSeated'), sub: 'Arrived', icon: Utensils, color: 'text-green-500', bg: 'bg-green-50' },
    { key: 'completed', label: t('stepCompleted'), sub: 'Completed', icon: CheckCircle, color: 'text-gray-400', bg: 'bg-gray-100' },
  ]
  
  const PICKUP_STEPS = [
    { key: 'pending', label: t('stepPickupPending'), sub: 'Received', icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-50' },
    { key: 'confirmed', label: t('stepPickupConfirmed'), sub: 'Preparing', icon: ChefHat, color: 'text-orange-500', bg: 'bg-orange-50' }, 
    { key: 'preparing', label: t('stepPickupPreparing'), sub: 'Cooking', icon: ChefHat, color: 'text-orange-500', bg: 'bg-orange-50' },
    { key: 'ready', label: t('stepPickupReady'), sub: 'Ready', icon: Utensils, color: 'text-white', bg: 'bg-green-500' }, 
    { key: 'completed', label: t('stepPickupCompleted'), sub: 'Collected', icon: CheckCircle, color: 'text-gray-400', bg: 'bg-gray-100' },
  ]

  const getSteps = (isPickup) => isPickup ? PICKUP_STEPS : BOOKING_STEPS

  return { getSteps }
}
