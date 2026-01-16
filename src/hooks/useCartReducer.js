export const cartReducer = (state, action) => {
    switch (action.type) {
        case 'ADD_TO_CART': {
            // Check for existing item with SAME options
            // Action payload: { id, price, quantity, selectedOptions, ... }
            const existingIndex = state.findIndex(item => {
                if (item.id !== action.payload.id) return false
                
                // Deep compare options (simplified for common cases)
                // Assumes selectedOptions is object or array that can be JSON stringified safely for comparison
                // Or if we rely on IDs.
                // For this project, let's assume strict equality or simplified check
                const optsA = JSON.stringify(item.selectedOptions || {})
                const optsB = JSON.stringify(action.payload.selectedOptions || {})
                return optsA === optsB
            })

            if (existingIndex > -1) {
                const newState = [...state]
                newState[existingIndex].quantity += action.payload.quantity
                return newState
            }
            return [...state, action.payload]
        }
        case 'REMOVE_FROM_CART':
            // Payload is index
            return state.filter((_, i) => i !== action.payload)
            
        case 'UPDATE_QUANTITY': {
            // Payload: { index, quantity }
            if (action.payload.quantity <= 0) {
                 return state.filter((_, i) => i !== action.payload.index)
            }
            const newState = [...state]
            newState[action.payload.index].quantity = action.payload.quantity
            return newState
        }
        
        case 'CLEAR_CART':
            return []
            
        default:
            return state
    }
}

// Logic hook is just the reducer + initial state usually, 
// but we might export a helper if needed. For now, just the reducer is fine for Unit Testing.
