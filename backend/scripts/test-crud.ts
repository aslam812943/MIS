import { supabaseAdmin as db } from "../src/config/supabase.js";
async function run() {
  const test = {
    name: "Aaravs Trading",
    owner_name: "Aarav Shah",
    city: "Mumbai",
    state: "Maharashtra",
    phone: "9876543210",
    email: "testmumbai@example.invalid",
    has_office: true,
    office_sqft: 750,
    registered_on: "2026-03-04",
    status: "Active",
    remarks: JSON.stringify({
      location: "Mumbai",
      plan: "Premier",
      sales: ["Trading & demat account", "Mutual fund", "Course"]
    })
  };
  const ins = await db.from("franchises").insert(test).select().single();
  console.log("INSERT RESULT:", ins.error || ins.data);
  if (ins.data) {
    const del = await db.from("franchises").telete().eq("id", ins.data.id);
    console.log("DELETE TEST POC:", del.error || "SUCCESS");
  }
}
run().catch(console.error);
