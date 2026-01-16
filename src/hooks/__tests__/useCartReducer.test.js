import { describe, it, expect } from 'vitest'
import { cartReducer } from '../useCartReducer'

describe('cartReducer', () => {
    it('should add a new item to empty cart', () => {
        const initialState = []
        const newItem = { id: 1, name: 'Steak', price: 500, quantity: 1, selectedOptions: {} }
        const newState = cartReducer(initialState, { type: 'ADD_TO_CART', payload: newItem })
        expect(newState).toHaveLength(1)
        expect(newState[0]).toEqual(newItem)
    })

    it('should stack items if same ID and options', () => {
        const initialState = [{ id: 1, name: 'Steak', price: 500, quantity: 1, selectedOptions: { doneness: 'Medium' } }]
        const newItem = { id: 1, name: 'Steak', price: 500, quantity: 2, selectedOptions: { doneness: 'Medium' } }
        const newState = cartReducer(initialState, { type: 'ADD_TO_CART', payload: newItem })
        
        expect(newState).toHaveLength(1)
        expect(newState[0].quantity).toBe(3)
    })

    it('should NOT stack items if different options', () => {
        const initialState = [{ id: 1, name: 'Steak', price: 500, quantity: 1, selectedOptions: { doneness: 'Medium' } }]
        const newItem = { id: 1, name: 'Steak', price: 500, quantity: 1, selectedOptions: { doneness: 'Rare' } }
        const newState = cartReducer(initialState, { type: 'ADD_TO_CART', payload: newItem })
        
        expect(newState).toHaveLength(2)
    })

    it('should remove item by index', () => {
        const initialState = [{ id: 1 }, { id: 2 }]
        const newState = cartReducer(initialState, { type: 'REMOVE_FROM_CART', payload: 0 }) // Remove first
        expect(newState).toHaveLength(1)
        expect(newState[0].id).toBe(2)
    })

    it('should update quantity', () => {
        const initialState = [{ id: 1, quantity: 1 }]
        const newState = cartReducer(initialState, { type: 'UPDATE_QUANTITY', payload: { index: 0, quantity: 5 } })
        expect(newState[0].quantity).toBe(5)
    })

    it('should remove item if quantity updated to 0', () => {
        const initialState = [{ id: 1, quantity: 1 }]
        const newState = cartReducer(initialState, { type: 'UPDATE_QUANTITY', payload: { index: 0, quantity: 0 } })
        expect(newState).toHaveLength(0)
    })
})
