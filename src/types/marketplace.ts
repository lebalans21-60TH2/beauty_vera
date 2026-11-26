export type UserRole = 'customer' | 'vendor' | 'admin';

export type VendorTier = 'standard' | 'pro' | 'flagship';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  skinType?: string;
  address?: string;
  role: UserRole;
  status: 'active' | 'locked';
  createdAt: string;
}

export interface VendorStaff {
  id: string;
  name: string;
  email: string;
  roleLabel: string;
  addedAt: string;
}

export interface Vendor {
  id: string;
  ownerUserId: string;
  name: string;
  slug: string;
  logoUrl: string;
  description: string;
  address: string;
  contactPhone: string;
  contactEmail: string;
  tier: VendorTier;
  tierFeeMonthly: number;
  status: 'pending' | 'approved' | 'locked';
  staff: VendorStaff[];
  rating: number;
  reviewCount: number;
  createdAt: string;
}

export interface Brand {
  id: string;
  name: string;
  country: string;
  description: string;
  status: 'active' | 'inactive';
}

export interface Category {
  id: string;
  slug: 'skincare' | 'makeup' | 'haircare' | 'bodycare';
  name: string;
  description: string;
  commissionRate: number;
}

export interface ProductVariant {
  sku: string;
  name: string;
  price: number;
  promoPrice?: number;
}

export interface ProductDocument {
  id: string;
  vendorId: string;
  productId: string;
  batchId?: string;
  title: string;
  docType: 'cosmetic_declaration' | 'coa' | 'cfs' | 'gmp';
  fileUrl: string;
  issueDate: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewerNote?: string;
}

export interface Product {
  id: string;
  vendorId: string;
  brandId: string;
  categorySlug: 'skincare' | 'makeup' | 'haircare' | 'bodycare';
  name: string;
  description: string;
  originCountry: string;
  manufacturer: string;
  distributor: string;
  ingredients: string[];
  benefits: string[];
  skinTypes: string[];
  images: string[];
  videoUrl?: string;
  variants: ProductVariant[];
  isSponsored: boolean;
  sponsoredFeeMonthly: number;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  reviewerNote?: string;
  ratingAvg: number;
  reviewCount: number;
  createdAt: string;
}

export type BatchStatus = 'active' | 'locked' | 'expired';

export interface Batch {
  id: string;
  productId: string;
  vendorId: string;
  sku: string;
  batchCode: string;
  manufactureDate: string;
  expiryDate: string;
  initialQty: number;
  currentQty: number;
  status: BatchStatus;
  documentId?: string;
  notes?: string;
  createdAt: string;
}

export interface InventoryMovement {
  id: string;
  batchId: string;
  productId: string;
  vendorId: string;
  sku: string;
  type: 'import' | 'export_fefo' | 'return' | 'adjustment';
  deltaQty: number;
  balanceAfter: number;
  reason: string;
  referenceOrderId?: string;
  actorId: string;
  createdAt: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'return_requested'
  | 'returned';

export interface BatchAllocation {
  batchId: string;
  batchCode: string;
  expiryDate: string;
  quantity: number;
}

export interface OrderItem {
  productId: string;
  productName: string;
  sku: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
  batchAllocations: BatchAllocation[];
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  shippingAddress: string;
  vendorId: string;
  vendorName: string;
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  voucherCode?: string;
  shippingFee: number;
  totalAmount: number;
  commissionRate: number;
  commissionAmount: number;
  vendorNetAmount: number;
  paymentMethod: 'cod' | 'bank_transfer' | 'ewallet';
  paymentStatus: 'unpaid' | 'paid' | 'refunded';
  status: OrderStatus;
  cancelReason?: string;
  returnReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  productId: string;
  vendorId: string;
  orderId: string;
  customerId: string;
  customerName: string;
  rating: number;
  shopRating: number;
  comment: string;
  createdAt: string;
}

export interface Promotion {
  id: string;
  code: string;
  title: string;
  sponsorType: 'platform' | 'vendor';
  vendorId?: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxUses: number;
  usedCount: number;
  active: boolean;
  expiresAt: string;
}

export interface CommissionConfig {
  defaultRate: number;
  categoryRates: Record<string, number>;
  tierFees: Record<VendorTier, number>;
  sponsoredListingFee: number;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  createdAt: string;
}

export interface EnrichedProduct extends Product {
  brandName: string;
  vendorName: string;
  vendorRating: number;
  vendorStatus: Vendor['status'];
  categoryName: string;
  activeBatch: Batch | null;
  totalAvailableStock: number;
  isExpiringSoon: boolean;
  daysUntilExpiry: number | null;
  approvedDocuments: ProductDocument[];
}
