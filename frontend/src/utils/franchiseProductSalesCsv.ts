import { parseCsvTable } from './franchiseCsv';
import type { FranchiseRecord } from '../services/franchise.service';

export function parseProductSalesCsv(source: string, branches: FranchiseRecord[], products: string[], selectedBranch: string): Record<string,string>[] {
  const table=parseCsvTable(source);
  const headers=(table.shift() || []).map(value=>value.trim().toLowerCase());
  const required=['customer_name','product','amount','sale_date'];
  if(new Set(headers).size!==headers.length)throw new Error('Duplicate CSV column headings.');
  for(const field of required)if(!headers.includes(field))throw new Error(`Missing column: ${field}`);
  for(const field of headers)if(![...required,'franchise_code'].includes(field))throw new Error(`Unknown column: ${field}`);
  if(!table.length || table.length>500)throw new Error('Upload 1 to 500 product sales at a time.');
  return table.map((cells,index)=>{
    if(cells.length!==headers.length)throw new Error(`Row ${index+2}: column count does not match.`);
    const row:Record<string,string>=Object.fromEntries(headers.map((header,column)=>[header,cells[column]!.trim()]));
    for(const field of required)if(!row[field])throw new Error(`Row ${index+2}: ${field} is required.`);
    const branch=row.franchise_code ? branches.find(branch=>branch.code?.toLowerCase()===row.franchise_code!.toLowerCase()) : branches.find(branch=>branch.id===selectedBranch);
    if(!branch)throw new Error(`Row ${index+2}: choose an assigned branch or enter its franchise_code.`);
    const product=products.find(product=>product.toLowerCase()===row.product!.toLowerCase());
    if(!product)throw new Error(`Row ${index+2}: select a supported product from the sales form.`);
    const amount=row.amount!.replace(/[₹,\s]/g,'').replace(/^INR/i,'');
    if(!/^\d+(\.\d{1,2})?$/.test(amount) || !Number.isFinite(Number(amount)))throw new Error(`Row ${index+2}: invalid amount.`);
    const date=row.sale_date!;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date)throw new Error(`Row ${index+2}: use a valid YYYY-MM-DD date.`);
    return {franchise_id:branch.id,customer_name:row.customer_name!,product,amount,sale_date:date};
  });
}
