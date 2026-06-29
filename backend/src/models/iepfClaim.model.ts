export type IEPFClaimStatus = 'New' | 'Under Verification' | 'Documents Pending' | 'Approved' | 'Rejected' | 'Closed';
export type IEPFClaimType = 'Dividend' | 'Shares' | 'Both';

export interface IEPFClaim {
  id: string;
  claim_number: string;
  investor_name: string;
  client_id?: string | null;
  pan_number: string;
  claim_type: IEPFClaimType;
  amount: number;
  num_shares: number;
  claim_date: string;
  status: IEPFClaimStatus;
  expected_closure_date?: string | null;
  pending_reasons?: string[];
  closed_date?: string | null;
  resolution_remarks?: string | null;
  amount_released?: number;
  shares_released?: number;
  branch_id?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}
