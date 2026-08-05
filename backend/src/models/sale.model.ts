export type ProductType =
  | 'Trading and Demat'
  | 'Mutual Fund'
  | 'Unlisted Shares'
  | 'Child Demat'
  | 'Child Mutual Fund'
  | 'IEPF'
  | 'SW Global';

export type SaleStatus = 'Pending' | 'Completed' | 'Cancelled';

export interface Sale {
  id: string;
  client_name: string;
  client_contact?: string | null;
  product_type: ProductType;
  sale_value: number;
  units?: number | null;
  sale_date: string;
  status: SaleStatus;
  remarks?: string | null;
  branch_id?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}
