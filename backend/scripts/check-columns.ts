import { supabaseAdmin as db } from "../src/config/supabase.js";
const { data, error } = await db.from("franchises").select("location,plan,sales").limit(1);
console.log("COLUMNS CHECK:", { data, error });
