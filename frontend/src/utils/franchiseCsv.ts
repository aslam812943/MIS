export const franchiseCsvFields = [
  'name','owner_name','phone','email','state','city','area','address','postal_code',
  'has_office','office_sqft','registered_on',
];
export function parseCsvTable(source: string): string[][] {
  const table:string[][]=[];let row:string[]=[];let cell='';let quoted=false;
  const text=source.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') {if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||!cell)quoted=!quoted;else throw new Error('Invalid CSV quoting.');}
    else if(c===','&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){row.push(cell);if(row.some(x=>x.trim()))table.push(row);row=[];cell='';if(c==='\r'&&text[i+1]==='\n')i++;}
    else cell+=c;
  }
  if(quoted)throw new Error('CSV contains an unclosed quoted field.');
  row.push(cell);if(row.some(x=>x.trim()))table.push(row);
  return table;
}
export function parseFranchiseCsv(source: string): Record<string, unknown>[] {
  const table = parseCsvTable(source);
  const headers=(table.shift()||[]).map(x=>x.trim().toLowerCase());
  const required=['name','owner_name','phone','email','state','city','has_office','registered_on'];
  if(new Set(headers).size!==headers.length)throw new Error('CSV contains duplicate headers.');
  for(const h of required)if(!headers.includes(h))throw new Error(`Missing CSV column: ${h}`);
  for(const h of headers)if(!franchiseCsvFields.includes(h) && h !== 'plan_name')throw new Error(`Unknown CSV column: ${h}`);
  if(!table.length||table.length>100)throw new Error('Import 1 to 100 franchises at a time.');
  return table.map((values,index)=>{
    if(values.length!==headers.length)throw new Error(`Row ${index+2}: column count does not match the header.`);
    if(values.some(x=>x.includes('SAMPLE - replace before importing')))throw new Error('Replace the sample cells with actual franchise details first.');
    const data=Object.fromEntries(headers.map((h,i)=>[h,values[i]!.trim()])) as Record<string,unknown>;
    for(const h of required)if(!data[h])throw new Error(`Row ${index+2}: ${h} is required.`);
    const office=String(data.has_office).toLowerCase();
    if(!['yes','no','true','false','1','0'].includes(office))throw new Error(`Row ${index+2}: has_office must be Yes or No.`);
    data.has_office=['yes','true','1'].includes(office);
    if(data.has_office&&(!/^\d+(\.\d{1,2})?$/.test(String(data.office_sqft))||Number(data.office_sqft)<=0))throw new Error(`Row ${index+2}: enter a positive office_sqft.`);
    data.office_sqft=data.has_office?Number(data.office_sqft):null;
    data.status='Active';return data;
  });
}

export const salesCsvFields = ['client_name', 'client_contact', 'product', 'sale_date', 'units', 'sale_value', 'order_reference', 'remarks'];
export function parseSalesCsv(source: string): Record<string, unknown>[] {
  const table = parseCsvTable(source);
  const headers = (table.shift() || []).map(x => x.trim().toLowerCase());
  if (new Set(headers).size !== headers.length) throw new Error('Duplicate CSV headers.');
  for (const h of ['client_name', 'product', 'sale_date', 'units', 'sale_value']) if (!headers.includes(h)) throw new Error(`Missing CSV column: ${h}`);
  for (const h of headers) if (!salesCsvFields.includes(h)) throw new Error(`Unknown CSV column: ${h}`);
  if (!table.length || table.length > 100) throw new Error('Upload 1 to 100 sales at a time.');
  return table.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`Row ${index + 2}: incorrect column count.`);
    const row: Record<string, unknown> = Object.fromEntries(headers.map((h, i) => [h, values[i].trim()]));
    for (const h of ['client_name', 'product', 'sale_date', 'units', 'sale_value']) if (!row[h]) throw new Error(`Row ${index + 2}: ${h} is required.`);
    const date = String(row.sale_date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) throw new Error(`Row ${index + 2}: use a valid YYYY-MM-DD date.`);
    for (const h of ['units', 'sale_value']) {
      if (!/^\d+(\.\d{1,2})?$/.test(String(row[h])) || !Number.isFinite(Number(row[h]))) throw new Error(`Row ${index + 2}: invalid ${h}.`);
      row[h] = Number(row[h]);
    }
    if (Number(row.units) <= 0) throw new Error(`Row ${index + 2}: quantity must be positive.`);
    if (row.client_contact && !/^\+?\d{10,15}$/.test(String(row.client_contact))) throw new Error(`Row ${index + 2}: invalid customer phone.`);
    return row;
  });
}
