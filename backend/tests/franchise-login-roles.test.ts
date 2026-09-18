import assert from 'node:assert/strict';
process.env.SUPABASE_URL='http://127.0.0.1:54321';process.env.SUPABASE_ANON_KEY='local-test-key';process.env.SUPABASE_SERVICE_ROLE_KEY='local-admin-key';
const {supabase,supabaseAdmin}=await import('../src/config/supabase.ts');
const {AuthService}=await import('../src/services/AuthService.ts');
const {FranchiseService}=await import('../src/services/FranchiseService.ts');
const users:any[]=[{id:'owner',email:'owner@internal.invalid',role:'franchise_owner',status:'active'},{id:'staff',email:'staff@internal.invalid',role:'franchise_staff',status:'active'},{id:'company',email:'company@example.invalid',role:'employee',status:'active'}];
const rows:Record<string,any[]>={profiles:users,franchise_users:[
 {user_id:'owner',franchise_id:'branch-a',login_email:'shared@example.invalid',membership_role:'owner',status:'active',franchises:{status:'Active'}},
 {user_id:'owner',franchise_id:'branch-b',login_email:'shared@example.invalid',membership_role:'owner',status:'active',franchises:{status:'Active'}},
 {user_id:'staff',franchise_id:'branch-a',login_email:'shared@example.invalid',membership_role:'staff',status:'active',franchises:{status:'Active'}}
],franchise_sales:[]};
let missingMappingKey = false;
class Query {
 filters:Array<(row:any)=>boolean>=[];one=false;max=Infinity;offset=0;inserted:any[]|null=null;
 updateValues:any=null;
 constructor(public table:string){}
 update(value:any){this.updateValues=value;return this;}
 select(){return this;}eq(key:string,value:any){this.filters.push(row=>row[key]===value);return this;}
 in(key:string,values:any[]){this.filters.push(row=>values.includes(row[key]));return this;}
 range(start:number,end:number){this.offset=start;this.max=end-start+1;return this;}order(){return this;}limit(max:number){this.max=max;return this;}maybeSingle(){this.one=true;return this;}single(){this.one=true;return this;}
 upsert(row:any){if(this.table==='franchise_users' && missingMappingKey)return Promise.resolve({data:null,error:{code:'42P10'}}) as any;const index=rows[this.table]!.findIndex(existing=>this.table==='profiles'?existing.id===row.id:existing.franchise_id===row.franchise_id && existing.user_id===row.user_id);if(index>=0)rows[this.table]![index]={...rows[this.table]![index],...row};else rows[this.table]!.push({...row,franchises:{status:'Active'}});return this;}
 insert(row:any){this.inserted=(Array.isArray(row)?row:[row]).map((value,index)=>({...value,id:`sale-new-${rows[this.table]!.length+index}`}));rows[this.table]!.push(...this.inserted);return this;}
 then(resolve:any,reject:any){if(this.updateValues){for(const row of rows[this.table]||[])if(this.filters.every(filter=>filter(row)))Object.assign(row,this.updateValues);}const result=(this.inserted || rows[this.table]||[]).filter(row=>this.filters.every(filter=>filter(row))).slice(this.offset,this.offset+this.max);return Promise.resolve({data:this.one?result[0]||null:result,error:null}).then(resolve,reject);}
}
(supabaseAdmin as any).from=(table:string)=>new Query(table);
(supabase.auth as any).signInWithPassword=async({email,password}:any)=>{
 const user=users.find(user=>user.email===email);const expected=user?.id==='owner'?'password1234':user?.id==='staff'?'password123':'company-password';
 return user && password===expected?{data:{user:{id:user.id},session:{}},error:null}:{data:{user:null},error:{message:'Invalid login credentials'}};
};
(supabase.auth as any).signOut=async()=>({error:null});
const auth=new AuthService({findById:async(id:string)=>users.find(user=>user.id===id)} as any,{} as any);
const staff=await auth.login('shared@example.invalid','password123','employee');assert.equal(staff.user.role,'franchise_staff');assert.equal(staff.user.email,'shared@example.invalid');
const owner=await auth.login('shared@example.invalid','password1234','hod');assert.equal(owner.user.role,'franchise_owner');
await assert.rejects(()=>auth.login('shared@example.invalid','password1234','employee'),/Invalid login/);
await assert.rejects(()=>auth.login('shared@example.invalid','password123','hod'),/Invalid login/);
assert.equal((await auth.login('company@example.invalid','company-password','employee')).user.role,'employee');
const service=new FranchiseService(supabaseAdmin,{} as any);
const ownerAccess=await service.access('owner');assert.deepEqual(ownerAccess.ids,['branch-a','branch-b']);assert.equal(ownerAccess.canManage,false);
const staffAccess=await service.access('staff');assert.deepEqual(staffAccess.ids,['branch-a']);assert.equal(staffAccess.canWrite,true);assert.equal(staffAccess.canManage,false);
await assert.rejects(()=>service.createSale(staffAccess,{franchise_id:'branch-b'}),/assigned branches/);
const sale=await service.createSale(staffAccess,{franchise_id:'branch-a',product:'Course',amount:1500,customer_name:'Test customer',sale_date:'2026-09-18'});assert.equal(sale.amount,1500);
assert.equal((await service.getSales(ownerAccess)).length,1);
await assert.rejects(()=>service.createSale(staffAccess,{franchise_id:'branch-a',product:'Unknown'}),/valid product/);
const bulk=await service.bulkCreateSales(staffAccess,[
 {franchise_id:'branch-a',product:'Course',amount:5000,customer_name:'CSV Customer',sale_date:'2026-09-18'},
 {franchise_id:'branch-b',product:'Course',amount:5000,customer_name:'Other Branch',sale_date:'2026-09-18'},
 {franchise_id:'branch-a',product:'Course',amount:-1,customer_name:'Bad Amount',sale_date:'2026-09-18'},
]);
assert.equal(bulk.inserted,1);assert.equal(bulk.sales.length,1);assert.deepEqual(bulk.failed.map(row=>row.row),[3,4]);
assert.equal(bulk.sales[0].customer_name,'CSV Customer');
await assert.rejects(()=>service.bulkCreateSales({...staffAccess,canWrite:false},[{}]),/not allowed/);
const resets:Array<{id:string,password:string}>=[];
(supabaseAdmin!.auth.admin as any).updateUserById=async(id:string,payload:any)=>{resets.push({id,password:payload.password});return {error:null,data:{user:{id}}};};
await (service as any).provisionLogins({id:'branch-a',email:'shared@example.invalid',owner_name:'Owner'});
assert.deepEqual(resets,[{id:'owner',password:'password1234'},{id:'staff',password:'password123'}]);
await (service as any).provisionLogins({id:'branch-c',email:'shared@example.invalid',owner_name:'Owner'});
assert.deepEqual((await service.access('owner')).ids,['branch-a','branch-b','branch-c']);
rows.franchise_users!.push({user_id:'company',franchise_id:'company-branch',membership_role:'owner'});
await assert.rejects(()=>(service as any).provisionLogins({id:'company-branch',email:'company@example.invalid',owner_name:'Company'}),/different account role/);
assert.equal(users.find(user=>user.id==='company').role,'employee');
console.log('Same-email Employee/HOD passwords, company login, multi-branch ownership, and scoped sales checks passed. No network calls or live writes performed.');

await assert.rejects(()=>service.register({...staffAccess,role:'ceo',canWrite:true},{}),/permission to add franchises/);

rows.franchise_users!.push({user_id:'another-owner',franchise_id:'branch-a',membership_role:'owner'});
const resetCount = resets.length;
await assert.rejects(()=>(service as any).provisionLogins({id:'branch-a',email:'shared@example.invalid',owner_name:'Owner'}),/multiple owner login accounts/);
assert.equal(resets.length,resetCount,'Conflicting memberships must not reset passwords');
for (const code of ['42P01','42703','PGRST204','PGRST205']) {
  assert.throws(()=>(service as any).check({error:{code,message:'missing schema'},data:null}),/database setup is incomplete/);
}
assert.throws(()=>(service as any).check({error:{code:'PGRST116'},data:null}),/lookup did not return exactly one/);
assert.throws(()=>(service as any).check({error:{code:'42501'},data:null}),/cannot access franchise records/);

// Reproduce the user's older schema: ON CONFLICT has no matching unique key.
missingMappingKey = true;
await (service as any).provisionLogins({id:'branch-b',email:'shared@example.invalid',owner_name:'Owner'});
assert.equal(rows.franchise_users!.filter(r=>r.franchise_id==='branch-b' && r.membership_role==='owner').length,1);
assert.equal(rows.franchise_users!.filter(r=>r.franchise_id==='branch-b' && r.membership_role==='staff').length,1);
users.push({id:'recovered-owner',email:'franchise.failed-branch.owner@mis-login.invalid',role:'franchise_owner',status:'active'});
users.push({id:'recovered-staff',email:'franchise.failed-branch.staff@mis-login.invalid',role:'franchise_staff',status:'active'});
(supabaseAdmin!.auth.admin as any).createUser=async()=>{throw new Error('Must reuse accounts created by failed attempts');};
await (service as any).provisionLogins({id:'failed-branch',email:'recovered@example.invalid',owner_name:'Recovered'});
await (service as any).provisionLogins({id:'failed-branch',email:'recovered@example.invalid',owner_name:'Recovered'});
assert.deepEqual(rows.franchise_users!.filter(r=>r.franchise_id==='failed-branch').map(r=>r.user_id).sort(),['recovered-owner','recovered-staff']);
assert.throws(()=>(service as any).check({error:{code:'42P10'},data:null}),/database_franchise_login_mapping_fix.sql/);
console.log('Missing unique-key recovery, existing-account recovery and repeated provisioning passed.');

// Admin must count actual customer sales, never configured product checkboxes.
rows.franchises = [
 {id:'kochi',city:'Kochi',owner_name:'Arun',name:'Kochi',remarks:JSON.stringify({sales:[]}),status:'Active'},
 {id:'aslam',city:'Kollam',owner_name:'Aslam',name:'Kollam',remarks:JSON.stringify({sales:['Trading & demat account','Unlisted shares']}),status:'Active'},
];
rows.franchise_sales = [
 {id:'kochi1',franchise_id:'kochi',product:'Course',customer_name:'One',amount:5000,sale_date:'2026-09-18'},
 {id:'kochi2',franchise_id:'kochi',product:'Trading & demat account',customer_name:'Two',amount:1500,sale_date:'2026-09-18'},
 {id:'kochi3',franchise_id:'kochi',product:'Mutual fund',customer_name:'Three',amount:10000,sale_date:'2026-09-18'},
];
const adminAccess = {...staffAccess,role:'admin',external:false,ids:null};
const directory = await service.getDirectory(adminAccess);
assert.equal(directory.find(f=>f.id==='kochi').saleCount,3);
assert.equal(directory.find(f=>f.id==='kochi').saleRevenue,16500);
assert.equal(directory.find(f=>f.id==='aslam').saleCount,0);
assert.equal(directory.find(f=>f.id==='aslam').saleRevenue,0);
assert.equal(directory.find(f=>f.id==='aslam').sales.length,2,'Preserve configured products without counting them as sales');
const overview = await service.getOverview(adminAccess);
assert.equal(overview.kpis.productsSold,3);assert.equal(overview.kpis.saleRevenue,16500);
assert.equal(overview.productSalesMix.find(p=>p.product==='Unlisted shares'),undefined);
rows.franchise_sales.push(...Array.from({length:1005},(_,i)=>({id:`more${i}`,franchise_id:'kochi',product:'Course',amount:0.01,sale_date:'2026-09-19'})));
const full = await service.getOverview(adminAccess);
assert.equal(full.kpis.productsSold,1008);assert.equal(full.kpis.saleRevenue,16510.05);
const productSummary = await service.getProductsSummary(adminAccess);
assert.equal(productSummary.summary.find(p=>p.product==='Course')?.sold,1006);
const scoped = await service.getOverview({...staffAccess,ids:['aslam']});
assert.equal(scoped.kpis.productsSold,0);assert.equal(scoped.kpis.saleRevenue,0);
console.log('Actual-sales calculations: Kochi 3 / INR 16500, Aslam zero, repeat sales, pagination, exact cents and branch scope passed.');
