import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// Load .env from project root
dotenv.config({ path: path.resolve('c:\\Users\\Ritha\\inthehaus-booking\\.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function deleteItems() {
    const itemsToDelete = [
        'Truffle soup',
        'cabonara',
        'carbonara',
        'ice americano',
        'Ice Americano'
    ]

    console.log("Searching for items to delete...")

    let idsToDelete = []

    for (const name of itemsToDelete) {
        const { data, error } = await supabase
            .from('menu_items')
            .select('id, name')
            .ilike('name', `%${name}%`)

        if (error) {
            console.error(`Error searching for ${name}:`, error)
            continue
        }

        if (data && data.length > 0) {
            console.log(`Found matches for "${name}":`, data.map(i => `${i.name} (${i.id})`))
            idsToDelete.push(...data.map(i => i.id))
        }
    }

    if (idsToDelete.length === 0) {
        console.log("No matching items found.")
        return
    }

    const { error: deleteError } = await supabase
        .from('menu_items')
        .delete()
        .in('id', idsToDelete)

    if (deleteError) {
        console.error("Deletion failed:", deleteError)
    } else {
        console.log(`Successfully deleted ${idsToDelete.length} items.`)
    }
}

deleteItems()
