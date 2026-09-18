import { supabaseAdmin as db } from "../src/config/supabase.js";
const f = await db.from("franchises").select("*").limit(5);
console.log("FRANCHISES RESULT:", f);
