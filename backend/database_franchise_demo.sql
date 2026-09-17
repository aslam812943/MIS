-- OPTIONAL fictional sample data. Run AFTER database_franchise.sql.
-- Adds two demo franchises, two plans, rules for all nine products, and
-- sample approved sales/earnings/expenses/partial payouts for the current month.
-- No login accounts or passwords are created: use Admin → Login access.
-- Rerunning preserves existing demo records and does not duplicate them.
BEGIN;
DO $$
DECLARE
 actor UUID; month_start DATE := date_trunc('month',CURRENT_DATE)::date;
 standard UUID := 'f1000000-0000-4000-8000-000000000001';
 premium UUID := 'f1000000-0000-4000-8000-000000000002';
 kochi UUID := 'f2000000-0000-4000-8000-000000000001';
 thrissur UUID := 'f2000000-0000-4000-8000-000000000002';
 item RECORD; product UUID; earning UUID; sale UUID; expense UUID; status_value TEXT;
BEGIN
 SELECT id INTO actor FROM profiles WHERE role='admin' AND status='active' ORDER BY created_at,id LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'Create an active administrator account before loading franchise samples.'; END IF;
 IF (SELECT count(*) FROM franchise_products) < 9 THEN RAISE EXCEPTION 'Run database_franchise.sql first.'; END IF;

 INSERT INTO franchise_plans(id,name,description,joining_fee,recurring_fee,billing_frequency,active) VALUES
 (standard,'Demo Standard','Fictional sample plan: franchise earns 40% of actual company revenue.',5000,500,'Monthly',true),
 (premium,'Demo Premium','Fictional sample plan: franchise earns 50% of actual company revenue.',10000,1000,'Monthly',true)
 ON CONFLICT(id) DO NOTHING;

 INSERT INTO franchises(id,code,name,owner_name,phone,email,state,city,area,address,postal_code,has_office,office_sqft,registered_on,status,remarks,created_by) VALUES
 (kochi,'DEMO-KOCHI','Demo Kochi Franchise','Anil Demo','0000000000','kochi.franchise@example.invalid','Kerala','Kochi','Demo locality','Fictional demo address, Kochi','682001',true,350,month_start,'Active','Fictional sample; replace with real information before business use.',actor),
 (thrissur,'DEMO-THRISSUR','Demo Thrissur Franchise','Maya Demo','0000000001','thrissur.franchise@example.invalid','Kerala','Thrissur','Demo locality','Fictional demo address, Thrissur','680001',false,NULL,month_start,'Active','Fictional sample; replace with real information before business use.',actor)
 ON CONFLICT(id) DO NOTHING;

 -- Use the original registration date when rerun in another month.
 INSERT INTO franchise_plan_assignments(franchise_id,plan_id,effective_from,created_by)
 SELECT id,CASE WHEN id=kochi THEN standard ELSE premium END,registered_on,actor
 FROM franchises WHERE id IN(kochi,thrissur)
 ON CONFLICT(franchise_id,effective_from) DO NOTHING;
 INSERT INTO franchise_commission_rules(plan_id,product_id,method,value,effective_from)
 SELECT assignments.plan_id,p.id,'Percentage',CASE WHEN assignments.plan_id=standard THEN 40 ELSE 50 END,assignments.effective_from
 FROM franchise_products p CROSS JOIN (
   SELECT plan_id,min(effective_from) AS effective_from FROM franchise_plan_assignments
   WHERE franchise_id IN(kochi,thrissur) AND plan_id IN(standard,premium) GROUP BY plan_id
 ) assignments
 ON CONFLICT(plan_id,product_id,effective_from) DO NOTHING;

 FOR item IN SELECT * FROM (VALUES
  (kochi,'COURSE',1000::numeric,100::numeric,150::numeric,200::numeric,'KOCHI',
   'f3000000-0000-4000-8000-000000000001'::uuid,'f4000000-0000-4000-8000-000000000001'::uuid,'f4000000-0000-4000-8000-000000000003'::uuid),
  (thrissur,'TRADING_DEMAT',2000::numeric,200::numeric,300::numeric,500::numeric,'THRISSUR',
   'f3000000-0000-4000-8000-000000000002'::uuid,'f4000000-0000-4000-8000-000000000002'::uuid,'f4000000-0000-4000-8000-000000000004'::uuid)
 ) AS examples(franchise,product_code,revenue,company_cost,franchise_cost,payout,label,sale_id,company_expense_id,franchise_expense_id)
 LOOP
  SELECT id INTO product FROM franchise_products WHERE code=item.product_code;
  sale:=item.sale_id;
  INSERT INTO sales(id,franchise_id,product_id,product_type,client_name,client_contact,sale_value,units,sale_date,status,order_reference,remarks,created_by)
  SELECT sale,item.franchise,product,sale_product_type,'Demo Customer '||item.label,NULL,
   CASE WHEN item.label='KOCHI' THEN 5000 ELSE 100000 END,1,CURRENT_DATE,'Pending','DEMO-'||item.label||'-ORDER-1','Fictional sample sale.',actor
  FROM franchise_products WHERE id=product
  ON CONFLICT(id) DO NOTHING;
  SELECT status INTO status_value FROM sales WHERE id=sale;
  IF status_value='Pending' THEN PERFORM decide_franchise_record('sales',sale,actor,'approve','Fictional demo completion',CURRENT_DATE); END IF;

  SELECT id INTO earning FROM franchise_earnings WHERE franchise_id=item.franchise AND reference='DEMO-'||item.label||'-EARN-1';
  IF earning IS NULL THEN
   earning:=submit_franchise_earning(jsonb_build_object('franchise_id',item.franchise,'sale_id',sale,'recognition_date',CURRENT_DATE,
    'earning_type','Demo product earnings','reference','DEMO-'||item.label||'-EARN-1','company_revenue',item.revenue,'use_rule',true),actor);
   PERFORM decide_franchise_record('earnings',earning,actor,'approve','Fictional demo earning');
  END IF;

  INSERT INTO franchise_expenses(id,franchise_id,owner,category,description,amount,expense_date,created_by) VALUES
   (item.company_expense_id,item.franchise,'Company','Demo processing','Fictional sample company operating cost.',item.company_cost,CURRENT_DATE,actor),
   (item.franchise_expense_id,item.franchise,'Franchise','Demo utilities','Fictional sample franchise operating cost.',item.franchise_cost,CURRENT_DATE,actor)
  ON CONFLICT(id) DO NOTHING;
  FOREACH expense IN ARRAY ARRAY[item.company_expense_id,item.franchise_expense_id] LOOP
   SELECT status INTO status_value FROM franchise_expenses WHERE id=expense;
   IF status_value='Submitted' THEN PERFORM decide_franchise_record('expenses',expense,actor,'approve','Fictional demo expense'); END IF;
  END LOOP;

  IF NOT EXISTS(SELECT 1 FROM franchise_payments WHERE franchise_id=item.franchise AND direction='Payout' AND reference='DEMO-'||item.label||'-PAY-1') THEN
   PERFORM record_franchise_payment(jsonb_build_object('franchise_id',item.franchise,'earning_id',earning,'direction','Payout',
    'amount',item.payout,'payment_date',CURRENT_DATE,'method','Demo bank entry','reference','DEMO-'||item.label||'-PAY-1'),actor);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM franchise_payments WHERE franchise_id=item.franchise AND direction='Receipt' AND reference='DEMO-'||item.label||'-RECEIPT-1') THEN
   PERFORM record_franchise_payment(jsonb_build_object('franchise_id',item.franchise,'earning_id',earning,'direction','Receipt',
    'amount',item.revenue,'payment_date',CURRENT_DATE,'method','Demo bank entry','reference','DEMO-'||item.label||'-RECEIPT-1'),actor);
  END IF;
 END LOOP;
END $$;
COMMIT;
