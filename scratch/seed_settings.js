import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'

const supabase = createClient(supabaseUrl, supabaseKey)

const DEFAULT_SETTINGS = [
    { key: 'qr_ordering_enabled', value: 'true' },
    { key: 'qr_gps_enabled', value: 'true' },
    { key: 'qr_latitude', value: '17.40722' },
    { key: 'qr_longitude', value: '104.78028' },
    { key: 'qr_radius', value: '50' }
]

async function seedSettings() {
    console.log('Seeding settings...');
    for (const setting of DEFAULT_SETTINGS) {
        const { data: existing } = await supabase
            .from('app_settings')
            .select('*')
            .eq('key', setting.key)
            .single()

        if (!existing) {
            console.log(`Inserting key: ${setting.key} = ${setting.value}`)
            const { error } = await supabase
                .from('app_settings')
                .insert(setting)
            if (error) console.error(`Error inserting ${setting.key}:`, error)
        } else {
            console.log(`Key ${setting.key} already exists with value: ${existing.value}`)
        }
    }
    console.log('Done.');
}

seedSettings()
