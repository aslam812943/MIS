-- Run after database.sql, database_sales.sql and database_franchise.sql
-- in a disposable local database. All sample data is rolled back.
BEGIN;
DO $$
DECLARE actor UUID := '00000000-0000-0000-0000-000000000001'; plan UUID; product UUID;
 f UUID; f2 UUID; s UUID; earning UUID; payment UUID; e2 UUID; before_count INT; expected_failure BOOLEAN;
 data JSONB; snapshot JSONB;
BEGIN
 INSERT INTO auth.users(id) VALUES(actor);
 INSERT INTO profiles(id,email,role,status) VALUES(actor,'test@example.invalid','admin','active');
 INSERT INTO franchise_plans(name) VALUES('Test Standard') RETURNING id INTO plan;
 SELECT id INTO product FROM franchise_products WHERE code='COURSE';
 IF (SELECT count(*) FROM franchise_products)<>9 THEN RAISE EXCEPTION 'Expected nine products'; END IF;
 data:=jsonb_build_object('name','Test Franchise','owner_name','Owner','phone','9876543210','email','owner@example.invalid','state','Kerala','city','Kochi','has_office',false,'registered_on','2026-08-01','status','Active');
 f:=register_franchise(data,plan,actor);
 f2:=register_franchise(data || '{"name":"Other Franchise"}'::jsonb,plan,actor);
 IF NOT EXISTS(SELECT 1 FROM franchise_plan_assignments WHERE franchise_id=f AND plan_id=plan) THEN RAISE EXCEPTION 'Initial plan missing'; END IF;

 SELECT count(*) INTO before_count FROM franchises;
 expected_failure:=false;
 BEGIN
  PERFORM register_franchise(data,gen_random_uuid(),actor);
 EXCEPTION WHEN raise_exception THEN expected_failure:=true; END;
 IF NOT expected_failure OR (SELECT count(*) FROM franchises)<>before_count THEN RAISE EXCEPTION 'Registration must be atomic'; END IF;

 expected_failure:=false;
 BEGIN
  UPDATE franchises SET has_office=true,office_sqft=0 WHERE id=f;
 EXCEPTION WHEN check_violation THEN expected_failure:=true; END;
 IF NOT expected_failure THEN RAISE EXCEPTION 'Office area validation missing'; END IF;

 INSERT INTO franchise_commission_rules(plan_id,product_id,method,value,effective_from) VALUES(plan,product,'Percentage',40,'2026-08-01');
 INSERT INTO sales(franchise_id,product_id,product_type,client_name,sale_value,units,sale_date,status,order_reference,created_by)
 VALUES(f,product,'Course','Customer',100000,1,'2026-09-01','Pending','ORDER-1',actor) RETURNING id INTO s;
 data:=jsonb_build_object('franchise_id',f,'sale_id',s,'recognition_date','2026-09-02','earning_type','Course fee','reference','EARN-1','company_revenue',1000,'use_rule',true);
 expected_failure:=false;
 BEGIN PERFORM submit_franchise_earning(data,actor); EXCEPTION WHEN raise_exception THEN expected_failure:=true; END;
 IF NOT expected_failure THEN RAISE EXCEPTION 'Pending sale must not generate earnings'; END IF;

 PERFORM decide_franchise_record('sales',s,actor,'approve',NULL,'2026-09-02');
 expected_failure:=false;
 BEGIN PERFORM decide_franchise_record('sales',s,actor,'approve',NULL,'2026-09-02'); EXCEPTION WHEN raise_exception THEN expected_failure:=true; END;
 IF NOT expected_failure THEN RAISE EXCEPTION 'Duplicate sale approval allowed'; END IF;

 expected_failure:=false;
 BEGIN PERFORM submit_franchise_earning(data || jsonb_build_object('franchise_id',f2),actor); EXCEPTION WHEN raise_exception THEN expected_failure:=true; END;
 IF NOT expected_failure THEN RAISE EXCEPTION 'Cross-franchise earning allowed'; END IF;
 expected_failure:=false;
 BEGIN PERFORM submit_franchise_earning(data || '{"recognition_date":"2026-09-01"}'::jsonb,actor); EXCEPTION WHEN raise_exception THEN expected_failure:=true; END;
 IF NOT expected_failure THEN RAISE EXCEPTION 'Revenue before completion allowed'; END IF;

 earning:=submit_franchise_earning(data,actor);
 SELECT rule_snapshot INTO snapshot FROM franchise_earnings WHERE id=earning;
 IF (SELECT franchise_amount FROM franchise_earnings WHERE id=earning)<>400 THEN RAISE EXCEPTION 'Percentage must use company revenue, not investment'; END IF;
 INSERT INTO franchise_commission_rules(plan_id,product_id,method,value,effective_from) VALUES(plan,product,'Percentage',50,'2026-09-03');
 IF (SELECT rule_snapshot FROM franchise_earnings WHERE id=earning)<>snapshot THEN RAISE EXCEPTION 'Historical snapshot changed'; END IF;
 expected_failure:=false;
 BEGIN PERFORM submit_franchise_earning(data,actor); EXCEPTION WHEN unique_violation THEN expected_failure:=true; END;
 IF NOT expected_failure THEN RAISE EXCEPTION 'Duplicate earnings allowed'; END IF;

 data:=jsonb_build_object('franchise_id',f,'earning_id',earning,'direction','Payout','amount',200,'payment_date','2026-09-04','method','Bank','reference','PAY-1');
 expected_failure:=false;
 BEGIN PERFORM record_franchise_payment(data,actor); EXCEPTION WHEN raise_exception THEN expected_failure:=true; END;
 IF NOT expected_failure THEN RAISE EXCEPTION 'Unapproved payment allowed'; END IF;
 PERFORM decide_franchise_record('earnings',earning,actor,'approve',NULL);
 payment:=record_franchise_payment(data,actor);
 expected_failure:=false;
 BEGIN PERFORM record_franchise_payment(data || '{"amount":201,"reference":"PAY-2"}'::jsonb,actor); EXCEPTION WHEN raise_exception THEN expected_failure:=true; END;
 IF NOT expected_failure THEN RAISE EXCEPTION 'Overpayment allowed'; END IF;
 expected_failure:=false;
 BEGIN PERFORM decide_franchise_record('earnings',earning,actor,'reverse','Correction required'); EXCEPTION WHEN raise_exception THEN expected_failure:=true; END;
 IF NOT expected_failure THEN RAISE EXCEPTION 'Paid earning reversal allowed'; END IF;
 PERFORM reverse_franchise_payment(payment,actor,'Incorrect ledger entry');
 IF (SELECT status FROM franchise_payments WHERE id=payment)<>'Reversed' THEN RAISE EXCEPTION 'Payment reversal missing'; END IF;
 PERFORM decide_franchise_record('earnings',earning,actor,'reverse','Correcting earning');
 IF (SELECT status FROM franchise_earnings WHERE id=earning)<>'Reversed' THEN RAISE EXCEPTION 'Earning reversal missing'; END IF;

 e2:=submit_franchise_earning(jsonb_build_object('franchise_id',f,'sale_id',s,'recognition_date','2026-09-04','earning_type','Recurring fee','reference','EARN-2','company_revenue',1000,'use_rule',true),actor);
 IF (SELECT franchise_amount FROM franchise_earnings WHERE id=e2)<>500 THEN RAISE EXCEPTION 'Effective commission rule not selected'; END IF;
 PERFORM decide_franchise_record('earnings',e2,actor,'approve',NULL);
 PERFORM record_franchise_payment(jsonb_build_object('franchise_id',f,'earning_id',e2,'direction','Receipt','amount',1000,'payment_date','2026-09-04','method','Bank','reference','RECEIPT-1'),actor);
 expected_failure:=false;
 BEGIN
  PERFORM record_franchise_payment(jsonb_build_object('franchise_id',f,'earning_id',e2,'direction','Receipt','amount',1,'payment_date','2026-09-04','method','Bank','reference','RECEIPT-2'),actor);
 EXCEPTION WHEN raise_exception THEN expected_failure:=true; END;
 IF NOT expected_failure THEN RAISE EXCEPTION 'Excess company receipt allowed'; END IF;

 IF has_table_privilege('authenticated','franchises','SELECT') OR has_function_privilege('authenticated','record_franchise_payment(jsonb,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Direct client access allowed'; END IF;
 IF NOT has_table_privilege('service_role','franchises','INSERT') OR NOT has_function_privilege('service_role','record_franchise_payment(jsonb,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Backend permissions missing'; END IF;
 RAISE NOTICE 'Franchise SQL workflow checks passed.';
END $$;
ROLLBACK;
