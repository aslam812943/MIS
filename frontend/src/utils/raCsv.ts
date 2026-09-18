const fields = ['client_name', 'package', 'amount', 'payment_date', 'mobile_number', 'research_date', 'email_id', 'sw_code', 'pan', 'aadhaar_no', 'reference', 'kyc_fetch_date', 'kra_modify_date', 'kra_reference_number', 'kra_updation_status', 'kra_user', 'ckyc_number', 'remarks', 'subscription_start_date', 'subscription_end_date', 'branch_name', 'branch_id'];
const aliases: Record<string, string> = {
  name: 'client_name', client: 'client_name', package_name: 'package', fee_paid: 'amount', fees_paid: 'amount', amount_paid: 'amount', fee: 'amount', fees: 'amount',
  mobile: 'mobile_number', phone: 'mobile_number', phone_number: 'mobile_number', email: 'email_id', aadhaar: 'aadhaar_no', aadhar_no: 'aadhaar_no',
  coverage_start_date: 'subscription_start_date', coverage_end_date: 'subscription_end_date', paid_amount: 'amount', total_amount: 'amount', subscription_fee: 'amount',
  from: 'subscription_start_date', start_date: 'subscription_start_date', subscription_start: 'subscription_start_date', validity_from: 'subscription_start_date',
  to: 'subscription_end_date', end_date: 'subscription_end_date', subscription_end: 'subscription_end_date', validity_to: 'subscription_end_date',
  kra_status: 'kra_updation_status', kra_ref: 'kra_reference_number', kra_reference: 'kra_reference_number', branch: 'branch_name',
};

export const parseRaCsv = (text: string, onConflict?: (row: number, error: string) => void): Record<string, string>[] => {
  const rows: string[][] = [];
  let row: string[] = [], value = '', quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { value += '"'; index++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(value.trim()); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index++;
      row.push(value.trim());
      if (row.some(cell => cell !== '')) rows.push(row);
      row = []; value = '';
    } else value += char;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted cell.');
  row.push(value.trim());
  if (row.some(cell => cell !== '')) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0]!.map(header => {
    const key = header.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s/-]+/g, '_');
    return aliases[key] || key;
  });
  const unknown = headers.filter(header => !fields.includes(header));
  if (unknown.length) throw new Error(`Unrecognized CSV columns: ${unknown.join(', ')}. Use the Sample CSV headings; these columns would otherwise be lost.`);
  const missing = ['client_name', 'package'].filter(header => !headers.includes(header));
  if (missing.length) throw new Error(`Missing required CSV headers: ${missing.join(', ')}`);
  return rows.slice(1).map((cells, index) => {
    if (cells.length !== headers.length) throw new Error(`Row ${index + 2} has ${cells.length} cells; expected ${headers.length}. Quote values containing commas.`);
    const record: Record<string, string> = {};
    for (const [column, header] of headers.entries()) {
      const value = cells[column] || '';
      if (record[header] && value && record[header] !== value) {
        const sourceColumns = headers.flatMap((field, position) => field === header ? [`"${rows[0]![position]}" (column ${position + 1})`] : []);
        const error = `Conflicting CSV columns ${sourceColumns.join(' and ')} map to ${header} at row ${index + 2}. Choose which value to keep in the CSV, or skip this row. This is a column conflict, not an existing client.`;
        if (onConflict) onConflict(index + 2, error);
        else throw new Error(error);
      } else if (value || record[header] === undefined) record[header] = value;
    }
    return record;
  });
};
