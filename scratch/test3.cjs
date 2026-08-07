const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const env = fs.readFileSync(".env", "utf8");
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/VITE_SUPABASE_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);
async function test() {
    const { data, error } = await supabase.from('profiles').select('id, phone').limit(1);
    console.log(error || data);
}
test();
