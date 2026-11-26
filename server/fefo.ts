import type {
  AuditLog,
  Batch,
  BatchAllocation,
  EnrichedProduct,
  InventoryMovement,
  Product,
  UserRole,
} from '../src/types/marketplace.ts';
import type { MarketplaceDatabase } from './store.ts';

export function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function diffDaysFromToday(isoDate: string): number {
  const today = new Date(getTodayIsoDate() + 'T00:00:00Z').getTime();
  const target = new Date(isoDate + 'T00:00:00Z').getTime();
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

export function getEligibleBatchesFefo(
  batches: Batch[],
  productId: string,
  sku?: string
): Batch[] {
  const today = getTodayIsoDate();
  return batches
    .filter(
      (b) =>
        b.productId === productId &&
        (!sku || b.sku === sku) &&
        b.status === 'active' &&
        b.expiryDate > today &&
        b.currentQty > 0
    )
    .sort((a, b) => {
      const expCmp = a.expiryDate.localeCompare(b.expiryDate);
      if (expCmp !== 0) return expCmp;
      return a.manufactureDate.localeCompare(b.manufactureDate);
    });
}

export function allocateFefoForOrderItem(
  db: MarketplaceDatabase,
  params: {
    productId: string;
    sku: string;
    quantity: number;
    orderId: string;
    orderNumber: string;
    actorId: string;
  }
): { ok: true; allocations: BatchAllocation[] } | { ok: false; error: string } {
  const eligible = getEligibleBatchesFefo(db.batches, params.productId, params.sku);
  const totalAvailable = eligible.reduce((sum, b) => sum + b.currentQty, 0);

  if (totalAvailable < params.quantity) {
    return {
      ok: false,
      error: `SKU ${params.sku} chỉ còn ${totalAvailable} sản phẩm khả dụng (không tính lô hết hạn hoặc bị khóa), không đủ xuất ${params.quantity}.`,
    };
  }

  let remaining = params.quantity;
  const allocations: BatchAllocation[] = [];
  const nowIso = new Date().toISOString();

  for (const batch of eligible) {
    if (remaining <= 0) break;
    const take = Math.min(batch.currentQty, remaining);
    batch.currentQty -= take;
    remaining -= take;

    allocations.push({
      batchId: batch.id,
      batchCode: batch.batchCode,
      expiryDate: batch.expiryDate,
      quantity: take,
    });

    const mov: InventoryMovement = {
      id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      batchId: batch.id,
      productId: params.productId,
      vendorId: batch.vendorId,
      sku: params.sku,
      type: 'export_fefo',
      deltaQty: -take,
      balanceAfter: batch.currentQty,
      reason: `Xuất kho FEFO cho đơn #${params.orderNumber} (HSD ${batch.expiryDate})`,
      referenceOrderId: params.orderId,
      actorId: params.actorId,
      createdAt: nowIso,
    };
    db.movements.unshift(mov);
  }

  return { ok: true, allocations };
}

export function restoreStockOnReturn(
  db: MarketplaceDatabase,
  params: {
    productId: string;
    sku: string;
    allocations: BatchAllocation[];
    orderId: string;
    orderNumber: string;
    actorId: string;
  }
): void {
  const today = getTodayIsoDate();
  const nowIso = new Date().toISOString();

  for (const alloc of params.allocations) {
    const batch = db.batches.find((b) => b.id === alloc.batchId);
    if (!batch) continue;
    // Only restore into sellable stock if batch has not expired
    if (batch.expiryDate > today && batch.status !== 'expired') {
      batch.currentQty += alloc.quantity;
      db.movements.unshift({
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        batchId: batch.id,
        productId: params.productId,
        vendorId: batch.vendorId,
        sku: params.sku,
        type: 'return',
        deltaQty: alloc.quantity,
        balanceAfter: batch.currentQty,
        reason: `Hoàn nhập kho từ đơn trả hàng #${params.orderNumber}`,
        referenceOrderId: params.orderId,
        actorId: params.actorId,
        createdAt: nowIso,
      });
    }
  }
}

export function enrichProduct(db: MarketplaceDatabase, product: Product): EnrichedProduct {
  const brand = db.brands.find((b) => b.id === product.brandId);
  const vendor = db.vendors.find((v) => v.id === product.vendorId);
  const category = db.categories.find((c) => c.slug === product.categorySlug);
  const eligible = getEligibleBatchesFefo(db.batches, product.id);
  const activeBatch = eligible[0] ?? null;
  const totalAvailableStock = eligible.reduce((sum, b) => sum + b.currentQty, 0);
  const daysUntilExpiry = activeBatch ? diffDaysFromToday(activeBatch.expiryDate) : null;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 90;
  const approvedDocuments = db.documents.filter(
    (d) => d.productId === product.id && d.status === 'approved'
  );

  return {
    ...product,
    brandName: brand?.name ?? 'Đang cập nhật',
    vendorName: vendor?.name ?? 'Gian hàng đối tác',
    vendorRating: vendor?.rating ?? 5,
    vendorStatus: vendor?.status ?? 'pending',
    categoryName: category?.name ?? product.categorySlug,
    activeBatch,
    totalAvailableStock,
    isExpiringSoon,
    daysUntilExpiry,
    approvedDocuments,
  };
}

export function appendAuditLog(
  db: MarketplaceDatabase,
  entry: {
    actorId: string;
    actorName: string;
    actorRole: UserRole;
    action: string;
    targetType: string;
    targetId: string;
    summary: string;
  }
): void {
  const log: AuditLog = {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ...entry,
    createdAt: new Date().toISOString(),
  };
  db.auditLogs.unshift(log);
  if (db.auditLogs.length > 300) {
    db.auditLogs.length = 300;
  }
}
