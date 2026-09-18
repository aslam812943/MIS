import { supabaseAdmin as db } from "../src/config/supabase.js";
async function run() {
  const plans = ["Starter", "Growth", "Premier"];
  for (const p of plans) {
    const ex = await db.from("franchise_plans").select("id").eq("name", p).maybeSingle();
    if (!ex.data) {
      const ins = await db.from("franchise_plans").insert({ name: p, active: true }).select();
      console.log("Plan created:", p, ins.data);
    } else {
      console.log("Plan exists:", p);
    }
  }
  const allPlans = await db.from("franchise_plans").select("*");
  console.log("All Plans:", allPlans.data);
}
run().catch(console.error);
