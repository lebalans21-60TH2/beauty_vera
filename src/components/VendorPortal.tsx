import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  CheckCircle2,
  ClipboardList,
  FileText,
  Lock,
  PackagePlus,
  Plus,
  Store,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  BATCH_STATUS_META,
  DOC_TYPE_LABEL,
  ORDER_STATUS_META,
  apiFetch,
  formatDateTimeVi,
  formatDateVi,
  formatVnd,
} from '../lib/format';
import type {
  Batch,
  Brand,
  Category,
  CommissionConfig,
  EnrichedProduct,
  InventoryMovement,
  Order,
  ProductDocument,
  Vendor,
  VendorTier,
} from '../types/marketplace';
import { BatchRevenueLineChart, type BatchRevenueSeries } from './BatchRevenueLineChart';
import { ResilientImage } from './ResilientImage';

interface VendorPortalProps {
  token: string;
}

interface BatchWithDays extends Batch {
  daysUntilExpiry: number;
}

interface VendorDashboardData {
  vendor: Vendor;
  products: EnrichedProduct[];
  batches: BatchWithDays[];
  movements: InventoryMovement[];
  documents: ProductDocument[];
  orders: Order[];
  brands: Brand[];
  categories: Category[];
  commissionConfig: CommissionConfig;
}

export function VendorPortal({ token }: VendorPortalProps) {
  const [section, setSection] = useState<'batches' | 'orders' | 'products' | 'shop'>('batches');
  const [batchRevenueFilter, setBatchRevenueFilter] = useState<'all' | 'sold'>('all');
  const [selectedChartBatchId, setSelectedChartBatchId] = useState<string | null>(null);
  const [data, setData] = useState<VendorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Batch inbound form
  const [batchProductId, setBatchProductId] = useState('');
  const [batchSku, setBatchSku] = useState('');
  const [batchCode, setBatchCode] = useState('');
  const [mfgDate, setMfgDate] = useState('2026-10-01');
  const [expDate, setExpDate] = useState('2028-10-01');
  const [initialQty, setInitialQty] = useState(50);

  // Batch adjust modal
  const [adjustTarget, setAdjustTarget] = useState<BatchWithDays | null>(null);
  const [adjustDelta, setAdjustDelta] = useState(0);
  const [adjustStatus, setAdjustStatus] = useState<'active' | 'locked'>('active');
  const [adjustReason, setAdjustReason] = useState('');

  // New Product form
  const [showProductForm, setShowProductForm] = useState(false);
  const [pName, setPName] = useState('');
  const [pBrandId, setPBrandId] = useState('');
  const [pCat, setPCat] = useState<'skincare' | 'makeup' | 'haircare' | 'bodycare'>('skincare');
  const [pOrigin, setPOrigin] = useState('Hàn Quốc');
  const [pManufacturer, setPManufacturer] = useState('');
  const [pIngredients, setPIngredients] = useState('Niacinamide, Hyaluronic Acid');
  const [pBenefits, setPBenefits] = useState('Cấp ẩm, Phục hồi');
  const [pSkinTypes, setPSkinTypes] = useState('Mọi loại da, Da nhạy cảm');
  const [pDesc, setPDesc] = useState('');
  const [pSku, setPSku] = useState('');
  const [pVariantName, setPVariantName] = useState('30ml');
  const [pPrice, setPPrice] = useState(450000);
  const [pPromoPrice, setPPromoPrice] = useState<string>('');
  const [pImageUrl, setPImageUrl] = useState('/src/assets/images/product_serum_niacinamide_1795521823722.jpg');
  const [pVideoUrl, setPVideoUrl] = useState('');
  const [pSponsored, setPSponsored] = useState(false);

  // Document upload form
  const [docProductId, setDocProductId] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState<'cosmetic_declaration' | 'coa' | 'cfs' | 'gmp'>('coa');
  const [docDate, setDocDate] = useState('2026-11-20');

  // Shop form
  const [shopName, setShopName] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopDesc, setShopDesc] = useState('');
  const [shopLogo, setShopLogo] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffRole, setStaffRole] = useState('Nhân viên kho FEFO');

  const loadDashboard = () => {
    setLoading(true);
    apiFetch<VendorDashboardData>('/api/vendor/dashboard', { token })
      .then((res) => {
        setData(res);
        setShopName(res.vendor.name);
        setShopPhone(res.vendor.contactPhone);
        setShopAddress(res.vendor.address);
        setShopDesc(res.vendor.description);
        setShopLogo(res.vendor.logoUrl);
        if (res.products.length > 0 && !batchProductId) {
          setBatchProductId(res.products[0].id);
          setBatchSku(res.products[0].variants[0]?.sku ?? '');
          setDocProductId(res.products[0].id);
        }
        if (res.brands.length > 0 && !pBrandId) {
          setPBrandId(res.brands[0].id);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu shop.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboard();
  }, [token]);

  const handleImageFileUpload = async (
    file: File,
    onUrl: (url: string) => void
  ) => {
    setError('');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await apiFetch<{ url: string; provider: string }>('/api/upload', {
          method: 'POST',
          token,
          body: { dataUrl: reader.result },
        });
        onUrl(res.url);
        setNotice(`Đã tải ảnh lên (${res.provider === 'cloudinary' ? 'Cloudinary' : 'Lưu trữ máy chủ'}).`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Lỗi tải ảnh.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleInboundBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      await apiFetch('/api/vendor/batches', {
        method: 'POST',
        token,
        body: {
          productId: batchProductId,
          sku: batchSku,
          batchCode,
          manufactureDate: mfgDate,
          expiryDate: expDate,
          initialQty: Number(initialQty),
        },
      });
      setBatchCode('');
      setNotice('Đã nhập lô hàng mới vào kho FEFO.');
      loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi nhập lô.');
    }
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    setError('');
    try {
      await apiFetch(`/api/vendor/batches/${adjustTarget.id}/adjust`, {
        method: 'PATCH',
        token,
        body: {
          deltaQty: Number(adjustDelta),
          status: adjustStatus,
          reason: adjustReason,
        },
      });
      setAdjustTarget(null);
      setAdjustDelta(0);
      setAdjustReason('');
      setNotice('Đã cập nhật lô hàng và ghi nhận lịch sử kho.');
      loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi điều chỉnh lô.');
    }
  };

  const handleOrderTransition = async (orderId: string, status: Order['status']) => {
    setError('');
    setNotice('');
    try {
      const res = await apiFetch<{ order: Order }>(`/api/vendor/orders/${orderId}/status`, {
        method: 'PATCH',
        token,
        body: { status },
      });
      if (status === 'confirmed') {
        const allocText = res.order.items
          .flatMap((i) => i.batchAllocations.map((b) => `${b.batchCode} (×${b.quantity})`))
          .join(', ');
        setNotice(`Đã xác nhận đơn #${res.order.orderNumber} và xuất kho tự động FEFO: ${allocText}`);
      } else {
        setNotice(`Đã cập nhật trạng thái đơn #${res.order.orderNumber}.`);
      }
      loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể cập nhật đơn hàng.');
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/api/vendor/products', {
        method: 'POST',
        token,
        body: {
          name: pName,
          brandId: pBrandId,
          categorySlug: pCat,
          originCountry: pOrigin,
          manufacturer: pManufacturer,
          ingredients: pIngredients.split(',').map((s) => s.trim()).filter(Boolean),
          benefits: pBenefits.split(',').map((s) => s.trim()).filter(Boolean),
          skinTypes: pSkinTypes.split(',').map((s) => s.trim()).filter(Boolean),
          description: pDesc,
          images: [pImageUrl],
          videoUrl: pVideoUrl || undefined,
          isSponsored: pSponsored,
          variants: [
            {
              sku: pSku,
              name: pVariantName,
              price: Number(pPrice),
              promoPrice: pPromoPrice ? Number(pPromoPrice) : undefined,
            },
          ],
        },
      });
      setShowProductForm(false);
      setPName('');
      setPSku('');
      setNotice('Đã tạo sản phẩm và gửi Quản trị viên kiểm duyệt.');
      loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tạo sản phẩm.');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    setError('');
    try {
      await apiFetch(`/api/vendor/products/${productId}`, { method: 'DELETE', token });
      setNotice('Đã xóa sản phẩm.');
      loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi xóa sản phẩm.');
    }
  };

  const handleAttachDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/api/vendor/documents', {
        method: 'POST',
        token,
        body: {
          productId: docProductId,
          title: docTitle,
          docType,
          issueDate: docDate,
        },
      });
      setDocTitle('');
      setNotice('Đã gửi chứng từ chờ Quản trị viên kiểm tra.');
      loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải chứng từ.');
    }
  };

  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/api/vendor/shop', {
        method: 'PATCH',
        token,
        body: {
          name: shopName,
          contactPhone: shopPhone,
          address: shopAddress,
          description: shopDesc,
          logoUrl: shopLogo,
        },
      });
      setNotice('Đã cập nhật thông tin gian hàng.');
      loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi lưu gian hàng.');
    }
  };

  const handleUpgradeTier = async (tier: VendorTier) => {
    setError('');
    try {
      await apiFetch('/api/vendor/shop', {
        method: 'PATCH',
        token,
        body: { tier },
      });
      setNotice(`Đã chuyển gói dịch vụ gian hàng sang ${tier.toUpperCase()}.`);
      loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi nâng cấp gói.');
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/vendor/shop', {
        method: 'PATCH',
        token,
        body: {
          addStaff: { name: staffName, email: staffEmail, roleLabel: staffRole },
        },
      });
      setStaffName('');
      setStaffEmail('');
      loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi thêm nhân viên.');
    }
  };

  const batchRevenueSummary = useMemo(() => {
    if (!data) {
      return {
        rows: [],
        totalSoldQty: 0,
        totalGrossRevenue: 0,
        totalActualNetRevenue: 0,
        matchedBatchesCount: 0,
      };
    }

    const rows = data.batches.map((batch) => {
      const product = data.products.find((p) => p.id === batch.productId);
      const batchMovements = data.movements.filter((m) => m.batchId === batch.id);

      const exportedQty = batchMovements
        .filter((m) => m.type === 'export_fefo')
        .reduce((sum, m) => sum + Math.abs(m.deltaQty), 0);
      const returnedQty = batchMovements
        .filter((m) => m.type === 'return')
        .reduce((sum, m) => sum + m.deltaQty, 0);
      const adjustmentQty = batchMovements
        .filter((m) => m.type === 'adjustment')
        .reduce((sum, m) => sum + m.deltaQty, 0);

      const warehouseNetSoldQty = Math.max(0, exportedQty - returnedQty);

      let orderAllocatedQty = 0;
      let deliveredQty = 0;
      let inTransitQty = 0;
      let deliveredGrossRevenue = 0;
      let deliveredNetRevenue = 0;
      let pendingNetRevenue = 0;

      for (const ord of data.orders) {
        if (ord.status === 'cancelled' || ord.status === 'returned') continue;

        const orderItemsSubtotal =
          ord.subtotal > 0
            ? ord.subtotal
            : ord.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
        const orderNetMerchandise = Math.max(
          0,
          orderItemsSubtotal - ord.discountAmount - ord.commissionAmount
        );

        for (const item of ord.items) {
          for (const alloc of item.batchAllocations) {
            if (alloc.batchId !== batch.id) continue;

            orderAllocatedQty += alloc.quantity;
            const allocGross = item.unitPrice * alloc.quantity;
            const allocNet =
              orderItemsSubtotal > 0
                ? Math.round((allocGross / orderItemsSubtotal) * orderNetMerchandise)
                : 0;

            if (ord.status === 'delivered') {
              deliveredQty += alloc.quantity;
              deliveredGrossRevenue += allocGross;
              deliveredNetRevenue += allocNet;
            } else {
              inTransitQty += alloc.quantity;
              pendingNetRevenue += allocNet;
            }
          }
        }
      }

      const hasWarehouseMovements = exportedQty > 0 || returnedQty > 0;
      const reconciledSoldQty = hasWarehouseMovements
        ? Math.min(orderAllocatedQty, warehouseNetSoldQty)
        : orderAllocatedQty;

      const qtyDiff = warehouseNetSoldQty - orderAllocatedQty;
      const reconcileRatio =
        orderAllocatedQty > 0 ? Math.min(1, reconciledSoldQty / orderAllocatedQty) : 0;

      const actualReconciledRevenue = Math.round(deliveredNetRevenue * reconcileRatio);
      const isWarehouseMatched = qtyDiff === 0;

      return {
        batch,
        productName: product?.name ?? batch.productId,
        exportedQty,
        returnedQty,
        adjustmentQty,
        warehouseNetSoldQty,
        orderAllocatedQty,
        reconciledSoldQty,
        deliveredQty,
        inTransitQty,
        deliveredGrossRevenue,
        actualReconciledRevenue,
        pendingNetRevenue,
        qtyDiff,
        isWarehouseMatched,
      };
    });

    rows.sort((a, b) => {
      if (b.actualReconciledRevenue !== a.actualReconciledRevenue) {
        return b.actualReconciledRevenue - a.actualReconciledRevenue;
      }
      if (b.reconciledSoldQty !== a.reconciledSoldQty) {
        return b.reconciledSoldQty - a.reconciledSoldQty;
      }
      return a.batch.expiryDate.localeCompare(b.batch.expiryDate);
    });

    return {
      rows,
      totalSoldQty: rows.reduce((s, r) => s + r.reconciledSoldQty, 0),
      totalGrossRevenue: rows.reduce((s, r) => s + r.deliveredGrossRevenue, 0),
      totalActualNetRevenue: rows.reduce((s, r) => s + r.actualReconciledRevenue, 0),
      matchedBatchesCount: rows.filter((r) => r.isWarehouseMatched).length,
    };
  }, [data]);

  const batchRevenueTimeline = useMemo(() => {
    if (!data || batchRevenueSummary.rows.length === 0) {
      return { dates: [] as string[], series: [] as BatchRevenueSeries[] };
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const dateSet = new Set<string>([todayIso]);

    // Build baseline 7-day window ending today (or latest order date)
    let maxDateIso = todayIso;
    for (const ord of data.orders) {
      if (ord.status === 'cancelled' || ord.status === 'returned') continue;
      const ordDate = (ord.updatedAt || ord.createdAt).slice(0, 10);
      if (ordDate) {
        dateSet.add(ordDate);
        if (ordDate > maxDateIso) maxDateIso = ordDate;
      }
    }

    const anchorDate = new Date(maxDateIso + 'T00:00:00Z');
    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(anchorDate);
      d.setUTCDate(d.getUTCDate() - offset);
      dateSet.add(d.toISOString().slice(0, 10));
    }

    const dates = Array.from(dateSet).sort();

    // Map batchId -> date -> { revenue, qty }
    const dailyMap = new Map<string, Map<string, { revenue: number; qty: number }>>();
    const rowByBatchId = new Map(batchRevenueSummary.rows.map((r) => [r.batch.id, r]));

    for (const ord of data.orders) {
      if (ord.status !== 'delivered') continue;
      const ordDate = (ord.updatedAt || ord.createdAt).slice(0, 10);
      const orderItemsSubtotal =
        ord.subtotal > 0
          ? ord.subtotal
          : ord.items.reduce((s, it) => s + it.unitPrice * it.quantity, 0);
      const orderNetMerchandise = Math.max(
        0,
        orderItemsSubtotal - ord.discountAmount - ord.commissionAmount
      );

      for (const item of ord.items) {
        for (const alloc of item.batchAllocations) {
          const rowInfo = rowByBatchId.get(alloc.batchId);
          if (!rowInfo) continue;

          const reconcileRatio =
            rowInfo.orderAllocatedQty > 0
              ? Math.min(1, rowInfo.reconciledSoldQty / rowInfo.orderAllocatedQty)
              : 0;
          const allocGross = item.unitPrice * alloc.quantity;
          const allocNet =
            orderItemsSubtotal > 0
              ? Math.round((allocGross / orderItemsSubtotal) * orderNetMerchandise * reconcileRatio)
              : 0;
          const allocQty = Math.round(alloc.quantity * reconcileRatio);

          if (!dailyMap.has(alloc.batchId)) {
            dailyMap.set(alloc.batchId, new Map());
          }
          const byDate = dailyMap.get(alloc.batchId)!;
          const prev = byDate.get(ordDate) ?? { revenue: 0, qty: 0 };
          byDate.set(ordDate, {
            revenue: prev.revenue + allocNet,
            qty: prev.qty + allocQty,
          });
        }
      }
    }

    const targetRows =
      batchRevenueFilter === 'sold'
        ? batchRevenueSummary.rows.filter((r) => r.reconciledSoldQty > 0 || r.exportedQty > 0)
        : batchRevenueSummary.rows.slice(0, 6);

    const series: BatchRevenueSeries[] = targetRows.map((row) => {
      const byDate = dailyMap.get(row.batch.id);
      let cumulativeRevenue = 0;
      let cumulativeQty = 0;

      const dailyPoints = dates.map((date) => {
        const entry = byDate?.get(date) ?? { revenue: 0, qty: 0 };
        cumulativeRevenue += entry.revenue;
        cumulativeQty += entry.qty;
        return {
          date,
          dailyRevenue: entry.revenue,
          cumulativeRevenue,
          dailyQty: entry.qty,
          cumulativeQty,
        };
      });

      return {
        batchId: row.batch.id,
        batchCode: row.batch.batchCode,
        productName: row.productName,
        sku: row.batch.sku,
        totalActualRevenue: row.actualReconciledRevenue,
        totalSoldQty: row.reconciledSoldQty,
        dailyPoints,
      };
    });

    return { dates, series };
  }, [data, batchRevenueSummary, batchRevenueFilter]);

  if (loading && !data) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-16 text-center text-sm text-[#6B665E]">
        Đang tải không gian làm việc Nhà bán hàng...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center text-sm text-red-700">
        {error || 'Bạn chưa có gian hàng đối tác.'}
      </div>
    );
  }

  const expiringBatches = data.batches.filter(
    (b) => b.status === 'active' && b.daysUntilExpiry <= 90
  );
  const expiredBatches = data.batches.filter((b) => b.status === 'expired');
  const selectedProductForBatch = data.products.find((p) => p.id === batchProductId);
  const netRevenueTotal = data.orders
    .filter((o) => o.status === 'delivered')
    .reduce((s, o) => s + o.vendorNetAmount, 0);
  const visibleBatchRevenueRows =
    batchRevenueFilter === 'sold'
      ? batchRevenueSummary.rows.filter(
          (r) => r.reconciledSoldQty > 0 || r.exportedQty > 0
        )
      : batchRevenueSummary.rows;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sidebar Navigation (240px–280px proportional col-span-3) */}
        <aside className="lg:col-span-3 bg-white border border-zinc-200 rounded-xl p-5 space-y-6">
          <div className="space-y-2 pb-4 border-b border-zinc-200">
            <p className="text-xs text-[#6B665E]">Kênh Nhà bán hàng</p>
            <h2 className="font-editorial text-2xl font-semibold text-[#1A1917]">
              {data.vendor.name}
            </h2>
            <p className="text-xs font-medium text-[#C81E3A]">
              Trạng thái:{' '}
              {data.vendor.status === 'approved'
                ? 'Đã duyệt hoạt động'
                : data.vendor.status === 'pending'
                  ? 'Chờ Quản trị viên duyệt'
                  : 'Đang tạm khóa'}
            </p>
          </div>

          <nav className="space-y-1">
            {[
              { id: 'batches', label: 'Kho & Lô hàng (FEFO)', icon: Boxes },
              { id: 'orders', label: `Đơn hàng (${data.orders.length})`, icon: ClipboardList },
              { id: 'products', label: `Sản phẩm & Chứng từ (${data.products.length})`, icon: PackagePlus },
              { id: 'shop', label: 'Hồ sơ Gian hàng & Gói', icon: Store },
            ].map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id as typeof section)}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium rounded-lg transition-colors text-left whitespace-nowrap ${
                    active
                      ? 'bg-[#C81E3A] text-white'
                      : 'text-[#1A1917] hover:bg-[#FAF8F5]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Summary KPI block */}
          <div className="pt-4 border-t border-zinc-200 space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-[#6B665E]">Doanh thu thực nhận</span>
              <span className="font-mono font-semibold text-[#1A1917] tabular-nums">
                {formatVnd(netRevenueTotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B665E]">Lô sắp hết hạn (&le;90d)</span>
              <span className="font-mono font-semibold text-amber-700 tabular-nums">
                {expiringBatches.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6B665E]">Lô hết hạn đã khóa</span>
              <span className="font-mono font-semibold text-red-700 tabular-nums">
                {expiredBatches.length}
              </span>
            </div>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="lg:col-span-9 space-y-6">
          {notice && (
            <div className="px-4 py-3 text-xs text-[#C81E3A] bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{notice}</span>
            </div>
          )}
          {error && (
            <div className="px-4 py-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          {/* ================= C. BATCH & FEFO INVENTORY ================= */}
          {section === 'batches' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-editorial text-3xl font-semibold text-[#1A1917]">
                    Quản lý lô hàng & Kho FEFO
                  </h1>
                  <p className="text-xs text-[#6B665E]">
                    Quy tắc FEFO: Tự động ưu tiên xuất lô có hạn sử dụng gần nhất trước, tuyệt đối chặn lô hết hạn hoặc bị khóa.
                  </p>
                </div>
              </div>

              {(expiringBatches.length > 0 || expiredBatches.length > 0) && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">
                      Cảnh báo hạn sử dụng kho hàng: {expiringBatches.length} lô còn dưới 90 ngày ·{' '}
                      {expiredBatches.length} lô quá hạn đã tự động ngừng bán.
                    </p>
                    <p>
                      Các lô sắp hết hạn:{' '}
                      {expiringBatches
                        .map((b) => `${b.batchCode} (còn ${b.daysUntilExpiry} ngày)`)
                        .join(', ') || 'Không có'}
                    </p>
                  </div>
                </div>
              )}

              {/* Inbound Batch Form */}
              <form
                onSubmit={handleInboundBatch}
                className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4"
              >
                <h3 className="text-sm font-semibold text-[#1A1917]">Nhập kho theo lô hàng mới</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-[#6B665E] mb-1">Sản phẩm</label>
                    <select
                      value={batchProductId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setBatchProductId(id);
                        const prod = data.products.find((p) => p.id === id);
                        setBatchSku(prod?.variants[0]?.sku ?? '');
                      }}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg bg-white"
                    >
                      {data.products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[#6B665E] mb-1">Biến thể (SKU)</label>
                    <select
                      value={batchSku}
                      onChange={(e) => setBatchSku(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg bg-white font-mono"
                    >
                      {(selectedProductForBatch?.variants ?? []).map((v) => (
                        <option key={v.sku} value={v.sku}>
                          {v.sku} — {v.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[#6B665E] mb-1">Mã lô (Batch/Lot)</label>
                    <input
                      type="text"
                      required
                      value={batchCode}
                      onChange={(e) => setBatchCode(e.target.value)}
                      placeholder="VD: LOT-2026-009"
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#6B665E] mb-1">Ngày sản xuất</label>
                    <input
                      type="date"
                      required
                      value={mfgDate}
                      onChange={(e) => setMfgDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#6B665E] mb-1">Hạn sử dụng</label>
                    <input
                      type="date"
                      required
                      value={expDate}
                      onChange={(e) => setExpDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#6B665E] mb-1">Số lượng nhập</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={initialQty}
                      onChange={(e) => setInitialQty(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg font-mono tabular-nums"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#C81E3A] hover:bg-[#163A2C] text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nhập lô vào kho</span>
                  </button>
                </div>
              </form>

              {/* Batch Inventory Table */}
              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-zinc-200 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#1A1917]">
                    Bảng tồn kho theo lô (Xếp theo thứ tự xuất FEFO)
                  </h3>
                  <span className="text-xs text-[#6B665E] tabular-nums">
                    Tổng {data.batches.length} lô
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF8F5] text-[#6B665E] border-b border-zinc-200">
                      <tr>
                        <th className="py-2.5 px-4 font-medium">Mã lô / SKU</th>
                        <th className="py-2.5 px-4 font-medium">Sản phẩm</th>
                        <th className="py-2.5 px-4 font-medium">Ngày SX</th>
                        <th className="py-2.5 px-4 font-medium">Hạn sử dụng</th>
                        <th className="py-2.5 px-4 font-medium text-right">Tồn / Nhập</th>
                        <th className="py-2.5 px-4 font-medium">Trạng thái</th>
                        <th className="py-2.5 px-4 font-medium text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4DFD6]">
                      {data.batches.map((b) => {
                        const prod = data.products.find((p) => p.id === b.productId);
                        const meta = BATCH_STATUS_META[b.status];
                        return (
                          <tr key={b.id} className="hover:bg-[#FAF8F5]">
                            <td className="py-3 px-4 font-mono">
                              <div className="font-semibold text-[#1A1917]">{b.batchCode}</div>
                              <div className="text-[#6B665E]">{b.sku}</div>
                            </td>
                            <td className="py-3 px-4 max-w-[22ch] truncate text-[#1A1917]">
                              {prod?.name ?? b.productId}
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums text-[#6B665E]">
                              {formatDateVi(b.manufactureDate)}
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums">
                              <div className="text-[#1A1917]">{formatDateVi(b.expiryDate)}</div>
                              <div
                                className={
                                  b.daysUntilExpiry <= 0
                                    ? 'text-red-700'
                                    : b.daysUntilExpiry <= 90
                                      ? 'text-amber-700'
                                      : 'text-[#6B665E]'
                                }
                              >
                                {b.daysUntilExpiry <= 0
                                  ? `Quá hạn ${Math.abs(b.daysUntilExpiry)} ngày`
                                  : `Còn ${b.daysUntilExpiry} ngày`}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">
                              <strong className="text-[#1A1917]">{b.currentQty}</strong>
                              <span className="text-[#6B665E]"> / {b.initialQty}</span>
                            </td>
                            <td className={`py-3 px-4 font-medium ${meta.tone}`}>
                              {meta.label}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setAdjustTarget(b);
                                  setAdjustDelta(0);
                                  setAdjustStatus(b.status === 'locked' ? 'locked' : 'active');
                                  setAdjustReason('');
                                }}
                                className="px-2.5 py-1.5 text-xs border border-zinc-200 rounded-md hover:bg-white whitespace-nowrap"
                              >
                                Điều chỉnh / Khóa
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Batch Revenue Summary Table (Reconciled with Warehouse Data) */}
              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3 bg-[#FAF8F5]">
                  <div className="flex items-start gap-2.5">
                    <BarChart3 className="w-4 h-4 text-[#C81E3A] mt-0.5 shrink-0" />
                    <div>
                      <h3 className="text-sm font-semibold text-[#1A1917]">
                        Tóm tắt doanh thu theo từng lô sản phẩm (Đã đối soát kho)
                      </h3>
                      <p className="text-[11px] text-[#6B665E]">
                        Đối chiếu lượng xuất FEFO & hoàn trả trên sổ kho với đơn hàng đã giao sau khi trừ voucher và hoa hồng sàn.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center border border-zinc-200 rounded-lg bg-white text-xs overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setBatchRevenueFilter('all')}
                      className={`px-3 py-1.5 font-medium transition-colors ${
                        batchRevenueFilter === 'all'
                          ? 'bg-[#1A1917] text-white'
                          : 'text-[#6B665E] hover:text-[#1A1917]'
                      }`}
                    >
                      Tất cả lô ({batchRevenueSummary.rows.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchRevenueFilter('sold')}
                      className={`px-3 py-1.5 font-medium border-l border-zinc-200 transition-colors ${
                        batchRevenueFilter === 'sold'
                          ? 'bg-[#1A1917] text-white'
                          : 'text-[#6B665E] hover:text-[#1A1917]'
                      }`}
                    >
                      Đã phát sinh bán
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 border-b border-zinc-200 text-xs">
                  <div className="p-4">
                    <span className="text-[#6B665E] block">Tổng lượng đã bán (đối soát kho)</span>
                    <span className="font-mono text-lg font-semibold text-[#1A1917] tabular-nums">
                      {batchRevenueSummary.totalSoldQty} sản phẩm
                    </span>
                  </div>
                  <div className="p-4">
                    <span className="text-[#6B665E] block">Doanh thu gộp đã giao</span>
                    <span className="font-mono text-lg font-semibold text-[#1A1917] tabular-nums">
                      {formatVnd(batchRevenueSummary.totalGrossRevenue)}
                    </span>
                  </div>
                  <div className="p-4">
                    <span className="text-[#6B665E] block">Doanh thu thực tế sau đối soát kho</span>
                    <span className="font-mono text-lg font-semibold text-[#C81E3A] tabular-nums">
                      {formatVnd(batchRevenueSummary.totalActualNetRevenue)}
                    </span>
                  </div>
                </div>

                <BatchRevenueLineChart
                  dates={batchRevenueTimeline.dates}
                  series={batchRevenueTimeline.series}
                  highlightedBatchId={selectedChartBatchId}
                  onSelectBatch={setSelectedChartBatchId}
                />

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF8F5] text-[#6B665E] border-b border-zinc-200">
                      <tr>
                        <th className="py-2.5 px-4 font-medium">Mã lô</th>
                        <th className="py-2.5 px-4 font-medium">Sản phẩm / SKU</th>
                        <th className="py-2.5 px-4 font-medium text-right">Tổng lượng đã bán</th>
                        <th className="py-2.5 px-4 font-medium">Đối soát dữ liệu kho</th>
                        <th className="py-2.5 px-4 font-medium text-right">
                          Doanh thu thực tế sau đối soát
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4DFD6]">
                      {visibleBatchRevenueRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 px-4 text-center text-[#6B665E]">
                            Chưa có lô hàng nào phù hợp với bộ lọc hiện tại.
                          </td>
                        </tr>
                      ) : (
                        visibleBatchRevenueRows.map((row) => {
                          const isSelectedRow = selectedChartBatchId === row.batch.id;
                          return (
                          <tr
                            key={`rev-${row.batch.id}`}
                            onClick={() =>
                              setSelectedChartBatchId((prev) =>
                                prev === row.batch.id ? null : row.batch.id
                              )
                            }
                            title="Nhấn để xem riêng xu hướng lô này trên biểu đồ"
                            className={`cursor-pointer transition-colors ${
                              isSelectedRow ? 'bg-[#FFF1F2]' : 'hover:bg-[#FAF8F5]'
                            }`}
                          >
                            <td className="py-3 px-4 font-mono">
                              <div className="font-semibold text-[#1A1917] flex items-center gap-1.5">
                                <span>{row.batch.batchCode}</span>
                                {isSelectedRow && (
                                  <span className="text-[10px] font-sans text-[#C81E3A] font-semibold">
                                    (Đang lọc biểu đồ)
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[#6B665E]">
                                HSD {formatDateVi(row.batch.expiryDate)}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-medium text-[#1A1917] max-w-[24ch] truncate">
                                {row.productName}
                              </div>
                              <div className="font-mono text-[11px] text-[#6B665E]">
                                {row.batch.sku}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">
                              <div className="font-semibold text-[#1A1917]">
                                {row.reconciledSoldQty} sp
                              </div>
                              {(row.deliveredQty > 0 || row.inTransitQty > 0) && (
                                <div className="text-[11px] text-[#6B665E]">
                                  Đã giao: {row.deliveredQty}
                                  {row.inTransitQty > 0 ? ` · Đang giao: ${row.inTransitQty}` : ''}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-[11px]">
                              <div className="font-mono text-[#1A1917] tabular-nums">
                                Xuất FEFO: {row.exportedQty} · Hoàn: {row.returnedQty}
                                {row.adjustmentQty !== 0
                                  ? ` · Điều chỉnh: ${row.adjustmentQty > 0 ? `+${row.adjustmentQty}` : row.adjustmentQty}`
                                  : ''}
                              </div>
                              <div
                                className={`font-medium mt-0.5 ${
                                  row.isWarehouseMatched
                                    ? 'text-emerald-700'
                                    : 'text-amber-700'
                                }`}
                              >
                                {row.isWarehouseMatched
                                  ? row.reconciledSoldQty > 0
                                    ? 'Khớp sổ xuất kho & đơn hàng'
                                    : 'Sẵn sàng xuất kho'
                                  : `Chênh lệch ${Math.abs(row.qtyDiff)} sp giữa đơn & sổ kho`}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono tabular-nums">
                              <div className="font-semibold text-[#C81E3A] text-sm">
                                {formatVnd(row.actualReconciledRevenue)}
                              </div>
                              {row.pendingNetRevenue > 0 && (
                                <div className="text-[11px] text-[#6B665E]">
                                  Chờ quyết toán: {formatVnd(row.pendingNetRevenue)}
                                </div>
                              )}
                              {row.deliveredGrossRevenue > row.actualReconciledRevenue && (
                                <div className="text-[11px] text-[#6B665E]">
                                  Gộp: {formatVnd(row.deliveredGrossRevenue)}
                                </div>
                              )}
                            </td>
                          </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Inventory Movements History */}
              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-zinc-200">
                  <h3 className="text-sm font-semibold text-[#1A1917]">
                    Lịch sử nhập · xuất FEFO · hoàn trả · điều chỉnh
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF8F5] text-[#6B665E] border-b border-zinc-200">
                      <tr>
                        <th className="py-2.5 px-4 font-medium">Thời gian</th>
                        <th className="py-2.5 px-4 font-medium">Loại</th>
                        <th className="py-2.5 px-4 font-medium">SKU</th>
                        <th className="py-2.5 px-4 font-medium text-right">Biến động</th>
                        <th className="py-2.5 px-4 font-medium text-right">Tồn sau</th>
                        <th className="py-2.5 px-4 font-medium">Lý do</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4DFD6]">
                      {data.movements.slice(0, 15).map((m) => (
                        <tr key={m.id}>
                          <td className="py-2.5 px-4 font-mono text-[#6B665E] tabular-nums whitespace-nowrap">
                            {formatDateTimeVi(m.createdAt)}
                          </td>
                          <td className="py-2.5 px-4 font-medium text-[#1A1917] whitespace-nowrap">
                            {m.type === 'import'
                              ? 'Nhập kho'
                              : m.type === 'export_fefo'
                                ? 'Xuất FEFO'
                                : m.type === 'return'
                                  ? 'Hoàn trả'
                                  : 'Điều chỉnh'}
                          </td>
                          <td className="py-2.5 px-4 font-mono">{m.sku}</td>
                          <td
                            className={`py-2.5 px-4 text-right font-mono tabular-nums font-semibold ${
                              m.deltaQty >= 0 ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {m.deltaQty > 0 ? `+${m.deltaQty}` : m.deltaQty}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                            {m.balanceAfter}
                          </td>
                          <td className="py-2.5 px-4 text-[#6B665E]">{m.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= D. VENDOR ORDERS ================= */}
          {section === 'orders' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-editorial text-3xl font-semibold text-[#1A1917]">
                  Quản lý đơn hàng gian hàng
                </h1>
                <p className="text-xs text-[#6B665E]">
                  Khi xác nhận đơn, hệ thống tự động trừ tồn theo nguyên tắc FEFO và ghi nhận hoa hồng sàn.
                </p>
              </div>

              <div className="space-y-4">
                {data.orders.length === 0 ? (
                  <div className="p-10 text-center bg-white border border-zinc-200 rounded-xl text-sm text-[#6B665E]">
                    Chưa có đơn hàng nào phát sinh.
                  </div>
                ) : (
                  data.orders.map((ord) => {
                    const meta = ORDER_STATUS_META[ord.status];
                    return (
                      <div
                        key={ord.id}
                        className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-200">
                          <div className="text-xs space-x-2">
                            <span className="font-mono font-semibold text-[#1A1917]">
                              #{ord.orderNumber}
                            </span>
                            <span className="text-[#6B665E]">·</span>
                            <span className="font-medium">{ord.customerName}</span>
                            <span className="text-[#6B665E]">({ord.customerPhone})</span>
                            <span className="text-[#6B665E]">·</span>
                            <span className="text-[#6B665E]">{formatDateTimeVi(ord.createdAt)}</span>
                          </div>
                          <span className={`text-xs font-semibold ${meta.tone}`}>{meta.label}</span>
                        </div>

                        <div className="space-y-2">
                          {ord.items.map((item) => (
                            <div
                              key={item.sku}
                              className="flex flex-wrap items-center justify-between gap-3 text-xs"
                            >
                              <div>
                                <p className="font-semibold text-[#1A1917]">
                                  {item.productName} ({item.variantName}) × {item.quantity}
                                </p>
                                {item.batchAllocations.length > 0 && (
                                  <p className="font-mono text-[#C81E3A] mt-0.5">
                                    Xuất từ lô FEFO:{' '}
                                    {item.batchAllocations
                                      .map(
                                        (b) =>
                                          `${b.batchCode} (HSD ${formatDateVi(b.expiryDate)} · SL ${b.quantity})`
                                      )
                                      .join(', ')}
                                  </p>
                                )}
                              </div>
                              <span className="font-mono tabular-nums font-semibold">
                                {formatVnd(item.unitPrice * item.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-zinc-200 text-xs">
                          <div className="space-x-3 text-[#6B665E] tabular-nums">
                            <span>Tổng đơn: <strong className="text-[#1A1917]">{formatVnd(ord.totalAmount)}</strong></span>
                            <span>·</span>
                            <span>Hoa hồng ({ord.commissionRate}%): -{formatVnd(ord.commissionAmount)}</span>
                            <span>·</span>
                            <span className="text-[#C81E3A] font-semibold">
                              Thực nhận: {formatVnd(ord.vendorNetAmount)}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {ord.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOrderTransition(ord.id, 'confirmed')}
                                  className="px-3 py-1.5 bg-[#C81E3A] text-white font-medium rounded-lg hover:bg-[#163A2C]"
                                >
                                  Xác nhận & Xuất lô FEFO
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOrderTransition(ord.id, 'cancelled')}
                                  className="px-3 py-1.5 border border-red-200 text-red-700 rounded-lg hover:bg-red-50"
                                >
                                  Từ chối
                                </button>
                              </>
                            )}
                            {ord.status === 'confirmed' && (
                              <button
                                type="button"
                                onClick={() => handleOrderTransition(ord.id, 'packed')}
                                className="px-3 py-1.5 bg-[#C81E3A] text-white rounded-lg"
                              >
                                Đã đóng gói
                              </button>
                            )}
                            {ord.status === 'packed' && (
                              <button
                                type="button"
                                onClick={() => handleOrderTransition(ord.id, 'shipped')}
                                className="px-3 py-1.5 bg-[#C81E3A] text-white rounded-lg"
                              >
                                Bàn giao vận chuyển
                              </button>
                            )}
                            {ord.status === 'shipped' && (
                              <button
                                type="button"
                                onClick={() => handleOrderTransition(ord.id, 'delivered')}
                                className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg"
                              >
                                Xác nhận đã giao
                              </button>
                            )}
                            {ord.status === 'return_requested' && (
                              <button
                                type="button"
                                onClick={() => handleOrderTransition(ord.id, 'returned')}
                                className="px-3 py-1.5 bg-amber-700 text-white rounded-lg"
                              >
                                Duyệt hoàn trả & Nhập lại lô
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ================= B. PRODUCTS & DOCUMENTS ================= */}
          {section === 'products' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-editorial text-3xl font-semibold text-[#1A1917]">
                    Sản phẩm & Chứng từ minh bạch
                  </h1>
                  <p className="text-xs text-[#6B665E]">
                    Quản lý SKU, giá khuyến mãi, hình ảnh Cloudinary và gửi hồ sơ công bố mỹ phẩm chờ kiểm duyệt.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProductForm((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#C81E3A] text-white text-xs font-medium rounded-lg hover:bg-[#163A2C] whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>{showProductForm ? 'Đóng biểu mẫu' : 'Thêm sản phẩm mới'}</span>
                </button>
              </div>

              {showProductForm && (
                <form
                  onSubmit={handleCreateProduct}
                  className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4"
                >
                  <h3 className="text-sm font-semibold text-[#1A1917]">
                    Đăng ký sản phẩm mới (gửi kiểm duyệt)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[#6B665E] mb-1">Tên sản phẩm</label>
                      <input
                        type="text"
                        required
                        value={pName}
                        onChange={(e) => setPName(e.target.value)}
                        className="w-full px-3 py-2 border border-zinc-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[#6B665E] mb-1">Thương hiệu</label>
                      <select
                        value={pBrandId}
                        onChange={(e) => setPBrandId(e.target.value)}
                        className="w-full px-3 py-2 border border-zinc-200 rounded-lg bg-white"
                      >
                        {data.brands.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.country})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[#6B665E] mb-1">Danh mục</label>
                      <select
                        value={pCat}
                        onChange={(e) => setPCat(e.target.value as typeof pCat)}
                        className="w-full px-3 py-2 border border-zinc-200 rounded-lg bg-white"
                      >
                        <option value="skincare">Skincare</option>
                        <option value="makeup">Makeup</option>
                        <option value="haircare">Chăm sóc tóc</option>
                        <option value="bodycare">Chăm sóc cơ thể</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[#6B665E] mb-1">Xuất xứ & Nhà sản xuất</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={pOrigin}
                          onChange={(e) => setPOrigin(e.target.value)}
                          placeholder="Xuất xứ"
                          className="w-full px-3 py-2 border border-zinc-200 rounded-lg"
                        />
                        <input
                          type="text"
                          required
                          value={pManufacturer}
                          onChange={(e) => setPManufacturer(e.target.value)}
                          placeholder="Nhà sản xuất"
                          className="w-full px-3 py-2 border border-zinc-200 rounded-lg"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[#6B665E] mb-1">Mã SKU & Dung tích/Màu</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          value={pSku}
                          onChange={(e) => setPSku(e.target.value)}
                          placeholder="SKU-001"
                          className="w-full px-3 py-2 border border-zinc-200 rounded-lg font-mono uppercase"
                        />
                        <input
                          type="text"
                          required
                          value={pVariantName}
                          onChange={(e) => setPVariantName(e.target.value)}
                          placeholder="Chai 30ml"
                          className="w-full px-3 py-2 border border-zinc-200 rounded-lg"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[#6B665E] mb-1">Giá bán & Giá khuyến mãi (VNĐ)</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          required
                          value={pPrice}
                          onChange={(e) => setPPrice(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-zinc-200 rounded-lg font-mono"
                        />
                        <input
                          type="number"
                          value={pPromoPrice}
                          onChange={(e) => setPPromoPrice(e.target.value)}
                          placeholder="Giá KM (tùy chọn)"
                          className="w-full px-3 py-2 border border-zinc-200 rounded-lg font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[#6B665E] mb-1">Thành phần (cách nhau dấu phẩy)</label>
                      <input
                        type="text"
                        value={pIngredients}
                        onChange={(e) => setPIngredients(e.target.value)}
                        className="w-full px-3 py-2 border border-zinc-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[#6B665E] mb-1">Công dụng & Loại da</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={pBenefits}
                          onChange={(e) => setPBenefits(e.target.value)}
                          className="w-full px-3 py-2 border border-zinc-200 rounded-lg"
                        />
                        <input
                          type="text"
                          value={pSkinTypes}
                          onChange={(e) => setPSkinTypes(e.target.value)}
                          className="w-full px-3 py-2 border border-zinc-200 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[#6B665E] mb-1">Tải ảnh sản phẩm (Cloudinary / Máy chủ)</label>
                      <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-zinc-200 rounded-lg cursor-pointer hover:bg-[#FAF8F5]">
                        <Upload className="w-4 h-4 text-[#C81E3A]" />
                        <span className="truncate">{pImageUrl}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleImageFileUpload(f, setPImageUrl);
                          }}
                        />
                      </label>
                    </div>
                    <div>
                      <label className="block text-[#6B665E] mb-1">Video giới thiệu (URL tùy chọn)</label>
                      <input
                        type="url"
                        value={pVideoUrl}
                        onChange={(e) => setPVideoUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3 py-2 border border-zinc-200 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-[#6B665E] mb-1">Mô tả chi tiết</label>
                    <textarea
                      rows={2}
                      value={pDesc}
                      onChange={(e) => setPDesc(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pSponsored}
                      onChange={(e) => setPSponsored(e.target.checked)}
                    />
                    <span>
                      Đăng ký vị trí quảng bá nổi bật ({formatVnd(data.commissionConfig.sponsoredListingFee)}/tháng)
                    </span>
                  </label>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2 bg-[#C81E3A] text-white text-xs font-medium rounded-lg"
                    >
                      Gửi sản phẩm kiểm duyệt
                    </button>
                  </div>
                </form>
              )}

              {/* Product List */}
              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF8F5] text-[#6B665E] border-b border-zinc-200">
                      <tr>
                        <th className="py-2.5 px-4 font-medium">Sản phẩm</th>
                        <th className="py-2.5 px-4 font-medium">SKU / Giá</th>
                        <th className="py-2.5 px-4 font-medium text-right">Tồn khả dụng</th>
                        <th className="py-2.5 px-4 font-medium">Kiểm duyệt</th>
                        <th className="py-2.5 px-4 font-medium text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E4DFD6]">
                      {data.products.map((p) => (
                        <tr key={p.id}>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-lg overflow-hidden border border-zinc-200 shrink-0">
                                <ResilientImage
                                  src={p.images[0]}
                                  alt={p.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div>
                                <div className="font-semibold text-[#1A1917]">{p.name}</div>
                                <div className="text-[#6B665E]">
                                  {p.brandName} · {p.categoryName}
                                  {p.isSponsored ? ' · Đang quảng bá' : ''}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono">
                            {p.variants.map((v) => (
                              <div key={v.sku}>
                                {v.sku}: {formatVnd(v.promoPrice ?? v.price)}
                              </div>
                            ))}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                            {p.totalAvailableStock}
                          </td>
                          <td className="py-3 px-4 font-medium">
                            <span
                              className={
                                p.reviewStatus === 'approved'
                                  ? 'text-emerald-700'
                                  : p.reviewStatus === 'pending'
                                    ? 'text-amber-700'
                                    : 'text-red-700'
                              }
                            >
                              {p.reviewStatus === 'approved'
                                ? 'Đã duyệt'
                                : p.reviewStatus === 'pending'
                                  ? 'Chờ duyệt'
                                  : 'Bị từ chối'}
                            </span>
                            {p.reviewerNote && (
                              <div className="text-[11px] text-[#6B665E]">{p.reviewerNote}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(p.id)}
                              className="p-1.5 text-[#6B665E] hover:text-red-700"
                              aria-label="Xóa sản phẩm"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Attach Compliance Document */}
              <form
                onSubmit={handleAttachDocument}
                className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4"
              >
                <h3 className="text-sm font-semibold text-[#1A1917]">
                  Nộp chứng từ pháp lý / COA lô hàng
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <select
                    value={docProductId}
                    onChange={(e) => setDocProductId(e.target.value)}
                    className="px-3 py-2 border border-zinc-200 rounded-lg bg-white"
                  >
                    {data.products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as typeof docType)}
                    className="px-3 py-2 border border-zinc-200 rounded-lg bg-white"
                  >
                    <option value="cosmetic_declaration">Phiếu công bố mỹ phẩm</option>
                    <option value="coa">Phiếu kiểm nghiệm COA</option>
                    <option value="cfs">Lưu hành tự do (CFS)</option>
                    <option value="gmp">Chứng nhận cGMP</option>
                  </select>
                  <input
                    type="text"
                    required
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder="Số hiệu & tiêu đề chứng từ"
                    className="px-3 py-2 border border-zinc-200 rounded-lg"
                  />
                  <input
                    type="date"
                    value={docDate}
                    onChange={(e) => setDocDate(e.target.value)}
                    className="px-3 py-2 border border-zinc-200 rounded-lg font-mono"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#6B665E]">
                    Hiện có {data.documents.length} chứng từ đã nộp.
                  </span>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1A1917] text-white text-xs font-medium rounded-lg"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Gửi duyệt chứng từ</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ================= A. SHOP PROFILE & STAFF ================= */}
          {section === 'shop' && (
            <div className="space-y-6">
              <h1 className="font-editorial text-3xl font-semibold text-[#1A1917]">
                Thông tin Gian hàng, Gói dịch vụ & Nhân sự
              </h1>

              <form
                onSubmit={handleSaveShop}
                className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4 text-xs"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#6B665E] mb-1">Tên gian hàng</label>
                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[#6B665E] mb-1">Số điện thoại liên hệ</label>
                    <input
                      type="tel"
                      value={shopPhone}
                      onChange={(e) => setShopPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[#6B665E] mb-1">Địa chỉ kho / cửa hàng</label>
                  <input
                    type="text"
                    value={shopAddress}
                    onChange={(e) => setShopAddress(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[#6B665E] mb-1">Logo gian hàng (Upload)</label>
                  <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-zinc-200 rounded-lg cursor-pointer hover:bg-[#FAF8F5]">
                    <Upload className="w-4 h-4 text-[#C81E3A]" />
                    <span className="truncate">{shopLogo}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImageFileUpload(f, setShopLogo);
                      }}
                    />
                  </label>
                </div>
                <div>
                  <label className="block text-[#6B665E] mb-1">Mô tả gian hàng</label>
                  <textarea
                    rows={3}
                    value={shopDesc}
                    onChange={(e) => setShopDesc(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#C81E3A] text-white font-medium rounded-lg"
                >
                  Lưu thông tin gian hàng
                </button>
              </form>

              {/* Vendor Tier Upgrade */}
              <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
                <h3 className="text-sm font-semibold text-[#1A1917]">
                  Gói dịch vụ gian hàng nâng cao
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {(
                    [
                      {
                        id: 'standard',
                        title: 'Gói Cơ bản (Standard)',
                        desc: 'Đăng bán sản phẩm & quản lý lô FEFO chuẩn.',
                      },
                      {
                        id: 'pro',
                        title: 'Gói Nâng cao (Pro)',
                        desc: 'Ưu tiên kiểm duyệt nhanh & báo cáo tồn kho chuyên sâu.',
                      },
                      {
                        id: 'flagship',
                        title: 'Gói Flagship Official',
                        desc: 'Hiển thị trang gian hàng thương hiệu & hỗ trợ chiến dịch sàn.',
                      },
                    ] as const
                  ).map((tier) => {
                    const active = data.vendor.tier === tier.id;
                    const fee = data.commissionConfig.tierFees[tier.id];
                    return (
                      <div
                        key={tier.id}
                        className={`p-4 rounded-xl border space-y-2 ${
                          active ? 'border-[#C81E3A] bg-[#FAF8F5]' : 'border-zinc-200'
                        }`}
                      >
                        <div className="font-semibold text-[#1A1917]">{tier.title}</div>
                        <div className="font-mono text-base font-semibold text-[#C81E3A] tabular-nums">
                          {fee === 0 ? 'Miễn phí' : `${formatVnd(fee)}/tháng`}
                        </div>
                        <p className="text-[#6B665E]">{tier.desc}</p>
                        <button
                          type="button"
                          disabled={active}
                          onClick={() => handleUpgradeTier(tier.id)}
                          className={`w-full py-2 rounded-lg font-medium ${
                            active
                              ? 'bg-[#1E4D3B] text-white opacity-80'
                              : 'border border-zinc-200 hover:bg-white'
                          }`}
                        >
                          {active ? 'Đang sử dụng' : 'Chọn gói này'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Staff Management */}
              <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4 text-xs">
                <h3 className="text-sm font-semibold text-[#1A1917]">Nhân sự vận hành shop</h3>
                <form onSubmit={handleAddStaff} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    required
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    placeholder="Họ tên nhân viên"
                    className="px-3 py-2 border border-zinc-200 rounded-lg"
                  />
                  <input
                    type="email"
                    required
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    placeholder="Email nhân viên"
                    className="px-3 py-2 border border-zinc-200 rounded-lg"
                  />
                  <input
                    type="text"
                    value={staffRole}
                    onChange={(e) => setStaffRole(e.target.value)}
                    placeholder="Vai trò"
                    className="px-3 py-2 border border-zinc-200 rounded-lg"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#1A1917] text-white font-medium rounded-lg"
                  >
                    Thêm nhân viên
                  </button>
                </form>
                <div className="divide-y divide-[#E4DFD6]">
                  {data.vendor.staff.map((s) => (
                    <div key={s.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-[#1A1917]">{s.name}</span>
                        <span className="text-[#6B665E]"> · {s.email} · {s.roleLabel}</span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch('/api/vendor/shop', {
                            method: 'PATCH',
                            token,
                            body: { removeStaffId: s.id },
                          });
                          loadDashboard();
                        }}
                        className="text-red-700 hover:underline"
                      >
                        Gỡ
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Adjust / Lock Batch Modal */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleAdjustSubmit}
            className="w-full max-w-md bg-white border border-zinc-200 rounded-xl p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-editorial text-2xl font-semibold text-[#1A1917]">
                Điều chỉnh lô {adjustTarget.batchCode}
              </h3>
              <Lock className="w-4 h-4 text-[#6B665E]" />
            </div>
            <p className="text-[#6B665E]">
              Tồn hiện tại: <strong className="text-[#1A1917]">{adjustTarget.currentQty}</strong> ·
              HSD: {formatDateVi(adjustTarget.expiryDate)}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#6B665E] mb-1">Biến động số lượng (+/-)</label>
                <input
                  type="number"
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-[#6B665E] mb-1">Trạng thái bán</label>
                <select
                  value={adjustStatus}
                  onChange={(e) => setAdjustStatus(e.target.value as 'active' | 'locked')}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg bg-white"
                >
                  <option value="active">Đang mở bán</option>
                  <option value="locked">Khóa ngừng bán</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[#6B665E] mb-1">Lý do điều chỉnh (bắt buộc)</label>
              <input
                type="text"
                required
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="VD: Kiểm kê thực tế lệch / Hư hỏng vận chuyển / Ngừng bán cận date"
                className="w-full px-3 py-2 border border-[#E4DFD6] rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                className="px-4 py-2 border border-[#E4DFD6] rounded-lg"
              >
                Đóng
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#1E4D3B] text-white font-medium rounded-lg"
              >
                Xác nhận điều chỉnh
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
