import { useState, useEffect } from 'react'
import { fetchAndSortMenu } from '../utils/menuHelper'

export function useMenuData() {
    const [menuItems, setMenuItems] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true)
                const { menuItems, categories } = await fetchAndSortMenu()
                setMenuItems(menuItems)
                setCategories(categories)
            } catch (err) {
                console.error("Failed to load menu:", err)
                setError(err)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    return { menuItems, categories, loading, error }
}
