import { supabaseAdmin as db } from "../src/config/supabase.js";
const plans = await db.from("franchise_plans").select("*");
console.log("PLANS:", plans.data);
const products = await db.from("franchise_products").select("*");
console.log("PRODUCTS:", products.data);
