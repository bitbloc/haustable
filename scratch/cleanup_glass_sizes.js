import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lxfavbzmebqqsffgyyph.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function cleanupGlassSizes() {
    const { data: allSizes, error } = await supabase
        .from('sop_glass_sizes')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching glass sizes:', error);
        return;
    }

    const seenSizes = new Set();
    const toDeleteIds = [];

    for (const item of allSizes) {
        if (seenSizes.has(item.size_oz)) {
            toDeleteIds.push(item.id);
        } else {
            seenSizes.add(item.size_oz);
        }
    }

    if (toDeleteIds.length === 0) {
        console.log('No duplicate glass sizes found in the database.');
        return;
    }

    console.log(`Found ${toDeleteIds.length} duplicate glass sizes to delete. IDs:`, toDeleteIds);

    const { data, error: delError } = await supabase
        .from('sop_glass_sizes')
        .delete()
        .in('id', toDeleteIds)
        .select();

    if (delError) {
        console.error('Error deleting duplicates:', delError);
    } else {
        console.log('Successfully deleted duplicates:', data);
    }
}

cleanupGlassSizes();
