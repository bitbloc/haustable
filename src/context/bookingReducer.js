export const initialState = {
    step: 1,
    direction: 0,
    date: '',
    time: null,
    pax: 2,
    selectedTable: null,
    cart: [],

    // UI State
    isExpanded: false,
    isCheckoutMode: false,
    isOptionModalOpen: false,
    selectedItemForOptions: null,

    // Form Data
    contactName: '',
    contactPhone: '',
    specialRequest: '',
    isAgreed: false,
    slipFile: null,

    // Auth (Hybrid)
    lineProfile: null, // { userId, displayName, pictureUrl }
    lineIdToken: null,

    // Data (Loaded via API)
    tables: [],
    bookedTableIds: [], // New
    blockedDates: [], // New - For store closure
    menuItems: [],
    categories: [],
    settings: {
        shopMode: 'auto',
        openingTime: '10:00',
        closingTime: '20:00',
        minSpend: 0,
        minAdvanceHours: 2,
        bookingTimeSlots: ['11:00', '12:00', '13:00', '14:00', '17:00', '18:00', '19:00', '20:00'],
        floorplanUrl: null,
        qrCodeUrl: null,
        policyNote: '',
        soundAlertUrl: null
    },
    isLoading: true
}

export function bookingReducer(state, action) {
    switch (action.type) {
        // --- Data Loading ---
        case 'LOAD_INITIAL_SUCCESS':
            return {
                ...state,
                tables: action.payload.tables || [],
                blockedDates: action.payload.blockedDates || [],
                settings: { ...state.settings, ...action.payload.settings },
                contactName: action.payload.user?.name || state.contactName,
                contactPhone: action.payload.user?.phone || state.contactPhone,
                isLoading: false // FAST LOAD DONE
            }

        case 'LOAD_MENU_SUCCESS':
            return {
                ...state,
                menuItems: action.payload.menuItems || [],
                categories: action.payload.categories || []
            }

        case 'SET_BOOKED_TABLES':
            return { ...state, bookedTableIds: action.payload }

        // --- Auth (Hybrid) ---
        case 'SET_LINE_PROFILE':
            return {
                ...state,
                lineProfile: action.payload.profile,
                lineIdToken: action.payload.idToken,
                // Auto-fill form data if available
                contactName: action.payload.profile?.displayName || state.contactName
            }
        case 'LOGOUT_LINE':
            return {
                ...state,
                lineProfile: null,
                lineIdToken: null,
                contactName: '',
                contactPhone: ''
            }

        // --- Step Navigation ---
        case 'NEXT_STEP':
            return { ...state, step: state.step + 1, direction: 1 }
        case 'PREV_STEP':
            return {
                ...state,
                step: Math.max(1, state.step - 1),
                direction: -1,
                isCheckoutMode: false // Reset checkout mode when going back
            }
        case 'GO_TO_STEP':
            return {
                ...state,
                step: action.payload,
                direction: action.payload > state.step ? 1 : -1
            }

        // --- Selection ---
        case 'SET_DATE':
            return { ...state, date: action.payload, time: null } // Reset time when date changes
        case 'SET_TIME':
            return { ...state, time: action.payload }
        case 'SET_PAX':
            return { ...state, pax: action.payload }

        // --- Table ---
        case 'SELECT_TABLE':
            return { ...state, selectedTable: action.payload, isExpanded: false }
        case 'TOGGLE_EXPAND':
            return { ...state, isExpanded: !state.isExpanded }

        // --- Cart ---
        case 'ADD_TO_CART': {
            const item = action.payload
            const exist = state.cart.find(i => i.id === item.id && !i.selectedOptions)
            let newCart
            if (exist) {
                newCart = state.cart.map(i => i === exist ? { ...i, qty: i.qty + 1 } : i)
            } else {
                newCart = [...state.cart, { ...item, qty: 1 }]
            }
            return { ...state, cart: newCart }
        }
        case 'ADD_CUSTOM_ITEM': {
            // Always add as new item for simplicity with options
            return { ...state, cart: [...state.cart, action.payload] }
        }
        case 'REMOVE_FROM_CART': {
            const item = action.payload
            const exist = state.cart.find(i => i.id === item.id)
            if (!exist) return state

            let newCart
            if (exist.qty === 1) {
                newCart = state.cart.filter(i => i.id !== item.id)
            } else {
                newCart = state.cart.map(i => i.id === item.id ? { ...i, qty: i.qty - 1 } : i)
            }
            return { ...state, cart: newCart }
        }
        case 'OPEN_OPTION_MODAL':
            return { ...state, isOptionModalOpen: true, selectedItemForOptions: action.payload }
        case 'CLOSE_OPTION_MODAL':
            return { ...state, isOptionModalOpen: false, selectedItemForOptions: null }

        // --- Checkout Flow ---
        case 'SET_CHECKOUT_MODE':
            return { ...state, isCheckoutMode: action.payload }
        case 'UPDATE_FORM':
            return {
                ...state,
                [action.payload.field]: action.payload.value
            }

        case 'RESET_BOOKING':
            return { ...initialState, isLoading: false, settings: state.settings, tables: state.tables, menuItems: state.menuItems, categories: state.categories } // Keep loaded data

        default:
            return state
    }
}
