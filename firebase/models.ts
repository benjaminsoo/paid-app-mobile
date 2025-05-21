/**
 * Type definitions for Firestore data models
 */

/**
 * Debt model representing money owed to a user
 */
export interface Debt {
  id?: string;               // Auto-generated Firestore ID
  debtorName: string;        // Name of the person who owes money
  amount: number;            // Amount owed in dollars
  description?: string;      // Optional description of what the debt is for
  phoneNumber?: string;      // Optional phone number for contact/reminders
  createdAt: string;         // ISO string timestamp when debt was created
  updatedAt: string;         // ISO string timestamp when debt was last updated
  isPaid: boolean;           // Whether the debt has been paid
  paidAt?: string;           // ISO string timestamp when debt was paid (if paid)
  userId: string;            // ID of the user who is owed money
  groupId?: string;          // Optional reference to parent debt group
  
  // Recurring debt fields
  isRecurring?: boolean;     // Whether this is a recurring debt
  recurringId?: string;      // Reference to the recurring template (if this is an instance)
  recurringInstanceIndex?: number; // Which instance of the recurring series this is
}

/**
 * RecurringFrequency type for recurring debts
 */
export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

/**
 * RecurringDebt model for storing recurring debt templates
 */
export interface RecurringDebt {
  id?: string;               // Auto-generated Firestore ID
  userId: string;            // ID of the user who is owed money
  debtorName: string;        // Name of the person who owes money
  amount: number;            // Amount owed in dollars
  description?: string;      // Optional description of what the debt is for
  phoneNumber?: string;      // Optional phone number for contact/reminders
  groupId?: string;          // Optional reference to parent debt group
  createdAt: string;         // ISO string timestamp when debt was created
  updatedAt: string;         // ISO string timestamp when debt was last updated

  // Recurring specific fields
  frequency: RecurringFrequency; // How often the debt recurs
  startDate: string;         // ISO string timestamp when recurring starts
  endDate?: string;          // ISO string timestamp when recurring ends (optional)
  dayOfMonth?: number;       // Day of month for monthly/quarterly/yearly frequency
  dayOfWeek?: number;        // Day of week for weekly/biweekly frequency (0-6, Sunday is 0)
  lastGeneratedDate: string; // ISO string timestamp when last instance was generated
  nextGenerationDate: string; // ISO string timestamp when next instance should be generated
  isActive: boolean;         // Whether the recurring series is active
  generatedDebtIds: string[]; // References to all generated debt instances
}

/**
 * RecurringOptions for UI
 */
export interface RecurringOptions {
  isRecurring: boolean;
  frequency: RecurringFrequency;
  startDate: Date;
  endDate: Date | null;
  dayOfMonth?: number;
  dayOfWeek?: number;
}

/**
 * DebtGroup model representing a collection of related debts
 */
export interface DebtGroup {
  id?: string;               // Auto-generated Firestore ID
  name: string;              // Group name (e.g., "Beach Trip", "Apartment Utilities")
  description?: string;      // Optional description
  createdAt: string;         // ISO string timestamp when group was created
  updatedAt: string;         // ISO string timestamp when last updated
  isCompleted: boolean;      // Whether all debts in the group are paid
  totalAmount: number;       // Sum of all debts in the group
  paidAmount: number;        // Sum of paid debts in the group
  debtIds: string[];         // Array of IDs of debts that belong to this group
  userId: string;            // ID of the user who is owed money
  
  // Recurring group fields
  isRecurring?: boolean;
  recurringId?: string;      // Reference to the recurring template (if this is an instance)
  recurringInstanceIndex?: number; // Which instance of the recurring series this is
  
  // Recurring template fields (if this group is a recurring template)
  frequency?: RecurringFrequency;
  startDate?: string;
  endDate?: string;
  dayOfMonth?: number;
  dayOfWeek?: number;
  lastGeneratedDate?: string;
  nextGenerationDate?: string;
  isActive?: boolean;
  generatedGroupIds?: string[];
}

/**
 * User model
 */
export interface User {
  id?: string;               // Firestore UID
  email: string;             // User's email
  username: string;          // Username
  createdAt: string;         // ISO string timestamp when user was created
  profile?: {
    name?: string;
    backgroundImageUrl?: string;
    location?: string;
    preferredPaymentMethod?: string; // Preferred payment method type (e.g., 'venmo', 'paypal')
  };
  profileImageUrl?: string;
  paymentMethods?: PaymentMethod[];
}

/**
 * Payment method model
 */
export interface PaymentMethod {
  type: string;              // Type of payment method (e.g., 'venmo', 'paypal')
  value: string;             // Username or identifier for the payment method
  valueType?: string;        // Optional additional type information
} 