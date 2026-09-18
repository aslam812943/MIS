import { supabaseAdmin as db } from "../src/config/supabase.js";
await db.from("franchises").delete().eq("email", "testmumbai@example.invalid");
console.log("Deleted");
