/**
 * Represents a Branch in the MIS system.
 */
export interface Branch {
  id: string;
  name: string;
  created_at?: string;
}

/**
 * Represents a Department in the MIS system.
 */
export interface Department {
  id: string;
  name: string;
  created_at?: string;
}

/**
 * Represents a Module in the MIS system.
 */
export interface Module {
  id: string;
  name: string;
  created_at?: string;
}
