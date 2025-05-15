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
  createdAt: string;         // ISO string timestamp when debt was created
  updatedAt: string;         // ISO string timestamp when debt was last updated
  isPaid: boolean;           // Whether the debt has been paid
  paidAt?: string;           // ISO string timestamp when debt was paid (if paid)
  userId: string;            // ID of the user who is owed money
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