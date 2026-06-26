import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testInsertRecipe() {
    console.log("Trying to insert recipe...")
    const { data, error } = await supabase
        .from('sop_recipes')
        .insert({
            name: 'Test Recipe',
            department: 'bar',
            base_glass_size_oz: 16,
            is_published: true,
            ingredients: [],
            steps: [],
            scaling_rules: { "8": 0.5, "12": 0.75, "16": 1, "22": 1.375 },
            sort_order: 0,
            advanced_details: {}
        })
        .select()
        .single();
    
    if (error) {
        console.error("Insert Recipe Error:", error)
    } else {
        console.log("Inserted Recipe:", data)
    }
}

testInsertRecipe()
