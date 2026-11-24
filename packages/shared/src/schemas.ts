import { z } from 'zod';
import { StagesSchema, type Stage } from './stages';

/*
 * Validation rules shared by the web app (instant form feedback) and the API
 * (the real enforcement). Each "...InputSchema" describes what a client may send;
 * the plain interfaces describe what the API stores/returns.
 */

const optText = (max: number) => z.string().trim().max(max).optional();
const optEmail = z.union([z.literal(''), z.email('Enter a valid email')]).optional();
const optUrl = z.union([z.literal(''), z.url('Enter a full link, e.g. https://example.com')]).optional();
const isoDate = z.iso.date('Use a date like 2026-11-24');
const cents = z.number().int('Must be whole cents').nonnegative('Must be 0 or more').max(100_000_000_00);

// ---------- Business ----------
export const ROLES = ['owner', 'member'] as const;
export type Role = (typeof ROLES)[number];
export const PLANS = ['free', 'premium'] as const;
export type Plan = (typeof PLANS)[number];

export const SocialLinksSchema = z.object({
  instagram: optUrl,
  etsy: optUrl,
  other: optUrl,
});

export const BusinessUpdateSchema = z
  .object({
    name: optText(80),
    tagline: optText(160),
    website: optUrl,
    logoKey: optText(300),
    currency: z.string().regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code like USD').optional(),
    timezone: optText(64),
    socialLinks: SocialLinksSchema.optional(),
    stages: StagesSchema.optional(),
  })
  .strict();
export type BusinessUpdate = z.infer<typeof BusinessUpdateSchema>;

export interface Business {
  businessId: string;
  name?: string;
  tagline?: string;
  website?: string;
  logoKey?: string;
  currency: string;
  timezone: string;
  socialLinks?: z.infer<typeof SocialLinksSchema>;
  stages: Stage[];
  plan: Plan;
  planStatus?: string;
  billingCustomerId?: string;
  slug?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  userId: string;
  email: string;
  name?: string;
  businessId: string;
  role: Role;
  createdAt: string;
}

export interface Me {
  user: User;
  business: Business;
}

// ---------- Clients ----------
export const ClientInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120),
    email: optEmail,
    phone: optText(40),
    notes: optText(2000),
  })
  .strict();
export type ClientInput = z.infer<typeof ClientInputSchema>;

export interface Client extends ClientInput {
  businessId: string;
  clientId: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Commissions ----------
export const SOURCES = ['manual', 'email', 'form'] as const;
export type Source = (typeof SOURCES)[number];

export const FileRefSchema = z.object({
  key: z.string().min(1).max(300),
  name: z.string().min(1).max(200),
  contentType: z.string().max(100),
  size: z.number().int().nonnegative(),
});
export type FileRef = z.infer<typeof FileRefSchema>;

export const CommissionInputSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(160),
    clientId: optText(40),
    description: optText(5000),
    stageId: optText(40),
    priceCents: cents.optional(),
    depositCents: cents.optional(),
    dueDate: z.union([z.literal(''), isoDate]).optional(),
    tags: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
    notes: optText(10000),
    files: z.array(FileRefSchema).max(50).optional(),
  })
  .strict();
export type CommissionInput = z.infer<typeof CommissionInputSchema>;

/** PATCH accepts any subset of the create fields; null clears a price. */
export const CommissionPatchSchema = CommissionInputSchema.partial().extend({
  priceCents: cents.nullable().optional(),
  depositCents: cents.nullable().optional(),
});
export type CommissionPatch = z.infer<typeof CommissionPatchSchema>;

export interface Commission {
  businessId: string;
  commissionId: string;
  title: string;
  clientId?: string;
  description?: string;
  stageId: string;
  priceCents?: number;
  depositCents?: number;
  dueDate?: string;
  tags: string[];
  notes?: string;
  files: FileRef[];
  source: Source;
  sourceMessageId?: string;
  /** Running total of payments recorded against this job (maintained by the API). */
  paidCents: number;
  stageChangedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Payments ----------
export const PAYMENT_METHODS = ['cash', 'card', 'venmo', 'paypal', 'zelle', 'stripe', 'check', 'bank', 'other'] as const;
export const PAYMENT_TYPES = ['deposit', 'partial', 'final'] as const;

export const PaymentInputSchema = z
  .object({
    commissionId: z.string().min(1, 'Pick a commission').max(40),
    amountCents: cents.min(1, 'Amount must be more than 0'),
    date: isoDate,
    method: z.enum(PAYMENT_METHODS),
    type: z.enum(PAYMENT_TYPES),
    note: optText(500),
  })
  .strict();
export type PaymentInput = z.infer<typeof PaymentInputSchema>;

export interface Payment extends PaymentInput {
  businessId: string;
  paymentId: string;
  externalRef?: string;
  createdAt: string;
}

// ---------- Expenses ----------
export const EXPENSE_CATEGORIES = ['materials', 'tools', 'shipping', 'fees', 'software', 'other'] as const;

export const ExpenseInputSchema = z
  .object({
    amountCents: cents.min(1, 'Amount must be more than 0'),
    date: isoDate,
    category: z.enum(EXPENSE_CATEGORIES),
    vendor: optText(120),
    note: optText(500),
    commissionId: optText(40),
    receiptKey: optText(300),
  })
  .strict();
export type ExpenseInput = z.infer<typeof ExpenseInputSchema>;

export interface Expense extends ExpenseInput {
  businessId: string;
  expenseId: string;
  externalRef?: string;
  createdAt: string;
}

// ---------- Activity ----------
export interface Activity {
  commissionId: string;
  ts: string;
  type: 'created' | 'stage' | 'payment' | 'expense' | 'note' | 'updated';
  message: string;
}

// ---------- Uploads ----------
export const UploadRequestSchema = z
  .object({
    fileName: z.string().trim().min(1).max(200),
    contentType: z.string().regex(/^(image\/(png|jpe?g|gif|webp|heic)|application\/pdf)$/, 'Only images and PDFs are allowed'),
    size: z.number().int().positive().max(15 * 1024 * 1024, 'Files must be 15 MB or smaller'),
    purpose: z.enum(['commission', 'receipt', 'logo']),
  })
  .strict();
export type UploadRequest = z.infer<typeof UploadRequestSchema>;

// ---------- Dashboard ----------
export interface DashboardSummary {
  today: string;
  openJobs: number;
  openJobsNewThisMonth: number;
  requests: number;
  oldestRequestDays: number | null;
  expensesThisMonthCents: number;
  expensesLastMonthCents: number;
  expensesAllTimeCents: number;
  revenueThisMonthCents: number;
  revenueLastMonthCents: number;
  paymentsThisMonth: number;
  stageCounts: { stageId: string; count: number }[];
  totalCommissions: number;
  latest: { commissionId: string; title: string; clientName?: string }[];
  upcoming: { commissionId: string; title: string; dueDate: string; stageId: string }[];
}
