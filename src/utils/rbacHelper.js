/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · macrostructure: Workbench · theme: Atelier (Thai Modern OKLCH) */

// Core Backoffice Hub Module Keys
export const ADMIN_MODULES = [
    { key: 'overview', label: 'Overview', path: '/admin', match: (p) => p === '/admin' },
    { key: 'tables', label: 'Floor & Tables', path: '/admin/tables', match: (p) => p.startsWith('/admin/tables') || p.startsWith('/admin/editor') },
    { key: 'bookings', label: 'Bookings & Orders', path: '/admin/bookings', match: (p) => p.startsWith('/admin/bookings') },
    { key: 'hausmade', label: 'HAUSMADE Retail', path: '/admin/hausmade', match: (p) => p.startsWith('/admin/hausmade') },
    { key: 'menu', label: 'Menu & Lab', path: '/admin/menu', match: (p) => p.startsWith('/admin/menu') || p.startsWith('/admin/costing') || p.startsWith('/admin/lab') || p.startsWith('/admin/sop') },
    { key: 'financial', label: 'Financial & Insights', path: '/admin/financial', match: (p) => p === '/admin/financial' },
    { key: 'tax', label: 'Tax & Invoices', path: '/admin/tax', match: (p) => p.startsWith('/admin/tax') },
    { key: 'marketing', label: 'Marketing & Loyalty', path: '/admin/marketing', match: (p) => p.startsWith('/admin/marketing') || p.startsWith('/admin/promotions') || p.startsWith('/admin/rewards') || p.startsWith('/admin/members') || p.startsWith('/admin/arcade') || p.startsWith('/admin/songs') || p.startsWith('/admin/stamps') },
    { key: 'settings', label: 'Settings', path: '/admin/settings', match: (p) => p.startsWith('/admin/settings') }
]

// Default Role Permissions Preset
export const ROLE_PERMISSIONS = {
    owner: ['overview', 'tables', 'bookings', 'hausmade', 'menu', 'financial', 'tax', 'marketing', 'settings'],
    admin: ['overview', 'tables', 'bookings', 'hausmade', 'menu', 'financial', 'tax', 'marketing', 'settings'],
    manager: ['overview', 'tables', 'bookings', 'hausmade', 'menu', 'marketing'],
    staff: ['tables', 'bookings', 'hausmade'],
    cashier: ['tables', 'bookings', 'overview', 'hausmade'],
    kitchen: ['menu', 'bookings'],
    custom: [],
    customer: []
}

/**
 * Checks if a profile has access to a specific module key
 * @param {object} profile - User profile object containing role and optional permissions
 * @param {string} moduleKey - One of the 8 module keys
 * @returns {boolean}
 */
export function hasModuleAccess(profile, moduleKey) {
    if (!profile) return false
    const role = (profile.role || '').toLowerCase()
    
    // Owner & Admin have unrestricted master access
    if (role === 'owner' || role === 'admin') return true

    // Check custom permissions array on profile if set
    if (Array.isArray(profile.admin_permissions) && profile.admin_permissions.length > 0) {
        if (profile.admin_permissions.includes('*')) return true
        return profile.admin_permissions.includes(moduleKey)
    }

    // Fallback to role presets
    const allowed = ROLE_PERMISSIONS[role] || []
    return allowed.includes(moduleKey)
}

/**
 * Checks if a profile has access to the current route pathname
 * @param {object} profile
 * @param {string} pathname
 * @returns {boolean}
 */
export function hasRouteAccess(profile, pathname) {
    if (!profile) return false
    const role = (profile.role || '').toLowerCase()
    if (role === 'owner' || role === 'admin') return true

    // Find the module corresponding to the pathname
    const mod = ADMIN_MODULES.find(m => m.match(pathname))
    if (!mod) return true // Unrestricted sub-route or fallback

    return hasModuleAccess(profile, mod.key)
}

/**
 * Gets all allowed module items for the profile
 * @param {object} profile
 * @returns {Array}
 */
export function getAllowedModules(profile) {
    if (!profile) return []
    const role = (profile.role || '').toLowerCase()
    if (role === 'owner' || role === 'admin') return ADMIN_MODULES

    return ADMIN_MODULES.filter(mod => hasModuleAccess(profile, mod.key))
}
