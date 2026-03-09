import { z } from 'zod';

export const itemSchema = z.object({
  shoeDescription: z.string().min(1, 'Shoe description is required'),
  primaryServiceId: z.string().min(1, 'Select a primary service'),
  addonServiceIds: z.array(z.string()),
});

export const transactionSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string().regex(/^09\d{9}$/, 'Enter a valid PH mobile number (09XXXXXXXXX)'),
  customerEmail: z
    .string()
    .min(1, 'Customer email is required')
    .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Invalid email format'),
  customerStreetName: z.string().optional(),
  customerBarangay: z.string().optional(),
  customerCity: z.string().optional(),
  customerProvince: z.string().optional(),
  customerCountry: z.string().optional(),
  pickupDate: z.string().min(1, 'Pickup date is required').refine(
    (v) => v >= new Date().toISOString().split('T')[0],
    'Pickup date cannot be in the past',
  ),
  promoId: z.string().optional(),
  note: z.string().optional(),
  paymentMethod: z.string().optional(),
  paymentAmount: z.string().optional(),
  paymentReference: z.string().optional(),
  staffId: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Add at least one item'),
});

export type TransactionFormData = z.infer<typeof transactionSchema>;
