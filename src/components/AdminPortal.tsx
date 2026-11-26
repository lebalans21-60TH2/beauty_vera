import { useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Boxes,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  Percent,
  ShieldAlert,
  Store,
  Tag,
  Users,
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
  AuditLog,
  Batch,
  Brand,
  Category,
  CommissionConfig,
  EnrichedProduct,
  Order,
  ProductDocument,
  Promotion,
  User,
  Vendor,
} from '../types/marketplace';

interface AdminPortalProps {
  token: string;
}

interface BatchWithDays extends Batch {
  daysUntilExpiry: number;
}

interface AdminOverviewData {
  users: User[];
  vendors: Vendor[];
  products: EnrichedProduct[];
  brands: Brand[];
  categories: Category[];
  batches: BatchWithDays[];
  documents: ProductDocument[];
  orders: Order[];
  promotions: Promotion[];
  commissionConfig: CommissionConfig;
  auditLogs: AuditLog[];
  report: {
    gmv: number;
    commissionRevenue: number;
    tierSubscriptionRevenue: number;
    sponsoredRevenue: number;
    totalPlatformRevenue: number;
    totalOrders: number;
    pendingVendors: number;
    pendingProducts: number;
    pendingDocuments: number;
    expiringBatches: number;
    expiredBatches: number;
  };
}

type AdminSection =
  | 'report'
  | 'vendors'
  | 'products'
  | 'documents'
  | 'batches'
  | 'orders'
  | 'catalog'
  | 'promotions'
  | 'users';

export function AdminPortal({ token }: AdminPortalProps) {
  const [section, setSection] = useState<AdminSection>('report');
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Brand form
  const [brandName, setBrandName] = useState('');
  const [brandCountry, setBrandCountry] = useState('');

  // Promo form
  const [promoCode, setPromoCode] = useState('');
  const [promoTitle, setPromoTitle] = useState('');
  const [promoValue, setPromoValue] = useState(15);
  const [promoType, setPromoType] = useState<'percent' | 'fixed'>('percent');

  // Commission form
  const [defaultRate, setDefaultRate] = useState(8);
  const [sponsoredFee, setSponsoredFee] = useState(800000);

  const loadOverview = () => {
    setLoading(true);
    apiFetch<AdminOverviewData>('/api/admin/overview', { token })
      .then((res) => {
        setData(res);
        setDefaultRate(res.commissionConfig.defaultRate);
        setSponsoredFee(res.commissionConfig.sponsoredListingFee);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Lỗi tải dữ liệu Quản trị viên.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOverview();
  }, [token]);

  const runAction = async (fn: () => Promise<void>, okMessage: string) => {
    setError('');
    setNotice('');
    try {
      await fn();
      setNotice(okMessage);
      loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác thất bại.');
    }
  };

  if (loading && !data) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-16 text-center text-sm text-[#6B665E]">
        Đang tải Bảng điều khiển Quản trị viên...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center text-sm text-red-700">
        {error || 'Không có quyền truy cập.'}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sidebar */}
        <aside className="lg:col-span-3 bg-white border border-zinc-200 rounded-xl p-5 space-y-5">
          <div className="pb-4 border-b border-zinc-200">
            <p className="text-xs text-[#6B665E]">Vận hành & Kiểm duyệt Sàn</p>
            <h2 className="font-editorial text-2xl font-semibold text-[#1A1917]">
              Quản trị Véra Beauty
            </h2>
          </div>

          <nav className="space-y-1">
            {[
              { id: 'report', label: 'Báo cáo doanh thu (Report)', icon: BarChart3 },
              {
                id: 'vendors',
                label: `Gian hàng (${data.report.pendingVendors} chờ duyệt)`,
                icon: Store,
              },
              {
                id: 'products',
                label: `Kiểm duyệt SP (${data.report.pendingProducts})`,
                icon: ShieldAlert,
              },
              {
                id: 'documents',
                label: `Chứng từ (${data.report.pendingDocuments} chờ)`,
                icon: FileCheck2,
              },
              {
                id: 'batches',
                label: `Giám sát lô & HSD (${data.report.expiringBatches})`,
                icon: Boxes,
              },
              { id: 'orders', label: 'Đơn hàng & Thanh toán', icon: ClipboardList },
              { id: 'catalog', label: 'Thương hiệu & Danh mục', icon: Tag },
              { id: 'promotions', label: 'Khuyến mãi & Hoa hồng', icon: Percent },
              { id: 'users', label: 'Tài khoản & Audit Log', icon: Users },
            ].map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id as AdminSection)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors text-left whitespace-nowrap ${
                    active ? 'bg-[#1A1917] text-white' : 'text-[#1A1917] hover:bg-[#FAF8F5]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
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

          {/* 1. REPORT */}
          {section === 'report' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-editorial text-3xl font-semibold text-[#1A1917]">
                  Báo cáo doanh thu & Vận hành sàn
                </h1>
                <p className="text-xs text-[#6B665E]">
                  Tổng hợp 3 nguồn thu chính: Hoa hồng đơn hàng, Gói gian hàng nâng cao và Phí quảng bá sản phẩm.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-1">
                  <span className="text-xs text-[#6B665E]">Tổng GMV hoàn tất</span>
                  <div className="font-mono text-lg font-semibold text-[#1A1917] tabular-nums">
                    {formatVnd(data.report.gmv)}
                  </div>
                </div>
                <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-1">
                  <span className="text-xs text-[#6B665E]">Thu phí hoa hồng</span>
                  <div className="font-mono text-lg font-semibold text-[#C81E3A] tabular-nums">
                    {formatVnd(data.report.commissionRevenue)}
                  </div>
                </div>
                <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-1">
                  <span className="text-xs text-[#6B665E]">Gói gian hàng / tháng</span>
                  <div className="font-mono text-lg font-semibold text-[#1A1917] tabular-nums">
                    {formatVnd(data.report.tierSubscriptionRevenue)}
                  </div>
                </div>
                <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-1">
                  <span className="text-xs text-[#6B665E]">Phí quảng bá / tháng</span>
                  <div className="font-mono text-lg font-semibold text-[#1A1917] tabular-nums">
                    {formatVnd(data.report.sponsoredRevenue)}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#1A1917]">
                    Tổng doanh thu nền tảng ước tính kỳ hiện tại
                  </h3>
                  <span className="font-mono text-xl font-semibold text-[#C81E3A] tabular-nums">
                    {formatVnd(data.report.totalPlatformRevenue)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-zinc-200 text-xs">
                  <div>
                    <span className="text-[#6B665E] block">Tổng đơn toàn sàn</span>
                    <strong className="font-mono tabular-nums">{data.report.totalOrders}</strong>
                  </div>
                  <div>
                    <span className="text-[#6B665E] block">Sản phẩm chờ duyệt</span>
                    <strong className="font-mono tabular-nums">{data.report.pendingProducts}</strong>
                  </div>
                  <div>
                    <span className="text-[#6B665E] block">Lô cận hạn (&le; 90 ngày)</span>
                    <strong className="font-mono text-amber-700 tabular-nums">
                      {data.report.expiringBatches}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#6B665E] block">Lô hết hạn đã khóa</span>
                    <strong className="font-mono text-red-700 tabular-nums">
                      {data.report.expiredBatches}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. VENDOR APPROVAL */}
          {section === 'vendors' && (
            <div className="space-y-4">
              <h1 className="font-editorial text-3xl font-semibold text-[#1A1917]">
                Kiểm duyệt & Quản lý Gian hàng
              </h1>
              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] text-[#6B665E] border-b border-zinc-200">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Gian hàng</th>
                      <th className="py-2.5 px-4 font-medium">Gói dịch vụ</th>
                      <th className="py-2.5 px-4 font-medium">Liên hệ</th>
                      <th className="py-2.5 px-4 font-medium">Trạng thái</th>
                      <th className="py-2.5 px-4 font-medium text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4DFD6]">
                    {data.vendors.map((v) => (
                      <tr key={v.id}>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#1A1917]">{v.name}</div>
                          <div className="text-[#6B665E]">{v.address}</div>
                        </td>
                        <td className="py-3 px-4 font-mono uppercase">
                          {v.tier} ({formatVnd(v.tierFeeMonthly)})
                        </td>
                        <td className="py-3 px-4">
                          <div>{v.contactPhone}</div>
                          <div className="text-[#6B665E]">{v.contactEmail}</div>
                        </td>
                        <td className="py-3 px-4 font-medium">
                          <span
                            className={
                              v.status === 'approved'
                                ? 'text-emerald-700'
                                : v.status === 'pending'
                                  ? 'text-amber-700'
                                  : 'text-red-700'
                            }
                          >
                            {v.status === 'approved'
                              ? 'Đang hoạt động'
                              : v.status === 'pending'
                                ? 'Chờ duyệt'
                                : 'Đang khóa'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                          {v.status !== 'approved' && (
                            <button
                              type="button"
                              onClick={() =>
                                runAction(
                                  () =>
                                    apiFetch(`/api/admin/vendors/${v.id}/status`, {
                                      method: 'PATCH',
                                      token,
                                      body: { status: 'approved' },
                                    }).then(() => undefined),
                                  `Đã duyệt gian hàng ${v.name}.`
                                )
                              }
                              className="px-2.5 py-1 bg-[#C81E3A] text-white rounded-md"
                            >
                              Duyệt / Mở khóa
                            </button>
                          )}
                          {v.status !== 'locked' && (
                            <button
                              type="button"
                              onClick={() =>
                                runAction(
                                  () =>
                                    apiFetch(`/api/admin/vendors/${v.id}/status`, {
                                      method: 'PATCH',
                                      token,
                                      body: { status: 'locked' },
                                    }).then(() => undefined),
                                  `Đã khóa gian hàng ${v.name}.`
                                )
                              }
                              className="px-2.5 py-1 border border-red-200 text-red-700 rounded-md"
                            >
                              Khóa shop
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. PRODUCT MODERATION */}
          {section === 'products' && (
            <div className="space-y-4">
              <h1 className="font-editorial text-3xl font-semibold text-[#1A1917]">
                Kiểm duyệt sản phẩm toàn sàn
              </h1>
              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] text-[#6B665E] border-b border-zinc-200">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Sản phẩm & Xuất xứ</th>
                      <th className="py-2.5 px-4 font-medium">Shop / Thương hiệu</th>
                      <th className="py-2.5 px-4 font-medium">Trạng thái</th>
                      <th className="py-2.5 px-4 font-medium text-right">Kiểm duyệt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4DFD6]">
                    {data.products.map((p) => (
                      <tr key={p.id}>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#1A1917]">{p.name}</div>
                          <div className="text-[#6B665E]">
                            {p.originCountry} · NSX: {p.manufacturer}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div>{p.vendorName}</div>
                          <div className="text-[#6B665E]">{p.brandName}</div>
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
                                : 'Từ chối'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                          {p.reviewStatus !== 'approved' && (
                            <button
                              type="button"
                              onClick={() =>
                                runAction(
                                  () =>
                                    apiFetch(`/api/admin/products/${p.id}/review`, {
                                      method: 'PATCH',
                                      token,
                                      body: { reviewStatus: 'approved' },
                                    }).then(() => undefined),
                                  `Đã duyệt hiển thị "${p.name}".`
                                )
                              }
                              className="px-2.5 py-1 bg-[#C81E3A] text-white rounded-md"
                            >
                              Duyệt bán
                            </button>
                          )}
                          {p.reviewStatus !== 'rejected' && (
                            <button
                              type="button"
                              onClick={() =>
                                runAction(
                                  () =>
                                    apiFetch(`/api/admin/products/${p.id}/review`, {
                                      method: 'PATCH',
                                      token,
                                      body: {
                                        reviewStatus: 'rejected',
                                        reviewerNote: 'Cần bổ sung chứng từ công bố mỹ phẩm hợp lệ.',
                                      },
                                    }).then(() => undefined),
                                  `Đã từ chối sản phẩm "${p.name}".`
                                )
                              }
                              className="px-2.5 py-1 border border-red-200 text-red-700 rounded-md"
                            >
                              Từ chối
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. DOCUMENTS */}
          {section === 'documents' && (
            <div className="space-y-4">
              <h1 className="font-editorial text-3xl font-semibold text-[#1A1917]">
                Kiểm tra chứng từ pháp lý & COA
              </h1>
              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] text-[#6B665E] border-b border-zinc-200">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Chứng từ</th>
                      <th className="py-2.5 px-4 font-medium">Loại / Ngày cấp</th>
                      <th className="py-2.5 px-4 font-medium">Trạng thái</th>
                      <th className="py-2.5 px-4 font-medium text-right">Xử lý</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4DFD6]">
                    {data.documents.map((doc) => {
                      const prod = data.products.find((p) => p.id === doc.productId);
                      return (
                        <tr key={doc.id}>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-[#1A1917]">{doc.title}</div>
                            <div className="text-[#6B665E]">Sản phẩm: {prod?.name ?? doc.productId}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div>{DOC_TYPE_LABEL[doc.docType] ?? doc.docType}</div>
                            <div className="font-mono text-[#6B665E]">{formatDateVi(doc.issueDate)}</div>
                          </td>
                          <td className="py-3 px-4 font-medium">
                            <span
                              className={
                                doc.status === 'approved'
                                  ? 'text-emerald-700'
                                  : doc.status === 'pending'
                                    ? 'text-amber-700'
                                    : 'text-red-700'
                              }
                            >
                              {doc.status === 'approved'
                                ? 'Hợp lệ (Đã duyệt)'
                                : doc.status === 'pending'
                                  ? 'Chờ kiểm tra'
                                  : 'Từ chối'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                            {doc.status !== 'approved' && (
                              <button
                                type="button"
                                onClick={() =>
                                  runAction(
                                    () =>
                                      apiFetch(`/api/admin/documents/${doc.id}/review`, {
                                        method: 'PATCH',
                                        token,
                                        body: { status: 'approved' },
                                      }).then(() => undefined),
                                    'Đã phê duyệt chứng từ.'
                                  )
                                }
                                className="px-2.5 py-1 bg-[#C81E3A] text-white rounded-md"
                              >
                                Duyệt
                              </button>
                            )}
                            {doc.status !== 'rejected' && (
                              <button
                                type="button"
                                onClick={() =>
                                  runAction(
                                    () =>
                                      apiFetch(`/api/admin/documents/${doc.id}/review`, {
                                        method: 'PATCH',
                                        token,
                                        body: { status: 'rejected' },
                                      }).then(() => undefined),
                                    'Đã từ chối chứng từ.'
                                  )
                                }
                                className="px-2.5 py-1 border border-red-200 text-red-700 rounded-md"
                              >
                                Từ chối
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. BATCH MONITORING */}
          {section === 'batches' && (
            <div className="space-y-4">
              <h1 className="font-editorial text-3xl font-semibold text-[#1A1917]">
                Giám sát lô hàng & Hạn sử dụng toàn sàn
              </h1>
              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] text-[#6B665E] border-b border-zinc-200">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Mã lô / SKU</th>
                      <th className="py-2.5 px-4 font-medium">Sản phẩm</th>
                      <th className="py-2.5 px-4 font-medium">HSD / Còn lại</th>
                      <th className="py-2.5 px-4 font-medium text-right">Tồn kho</th>
                      <th className="py-2.5 px-4 font-medium">Trạng thái</th>
                      <th className="py-2.5 px-4 font-medium text-right">Kiểm soát</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4DFD6]">
                    {data.batches.map((b) => {
                      const prod = data.products.find((p) => p.id === b.productId);
                      const meta = BATCH_STATUS_META[b.status];
                      return (
                        <tr key={b.id}>
                          <td className="py-3 px-4 font-mono">
                            <div className="font-semibold">{b.batchCode}</div>
                            <div className="text-[#6B665E]">{b.sku}</div>
                          </td>
                          <td className="py-3 px-4 max-w-[20ch] truncate">{prod?.name ?? b.productId}</td>
                          <td className="py-3 px-4 font-mono tabular-nums">
                            <div>{formatDateVi(b.expiryDate)}</div>
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
                                ? `Quá hạn ${Math.abs(b.daysUntilExpiry)}d`
                                : `Còn ${b.daysUntilExpiry}d`}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            {b.currentQty}
                          </td>
                          <td className={`py-3 px-4 font-medium ${meta.tone}`}>{meta.label}</td>
                          <td className="py-3 px-4 text-right space-x-2">
                            {b.status === 'active' ? (
                              <button
                                type="button"
                                onClick={() =>
                                  runAction(
                                    () =>
                                      apiFetch(`/api/admin/batches/${b.id}/status`, {
                                        method: 'PATCH',
                                        token,
                                        body: { status: 'locked' },
                                      }).then(() => undefined),
                                    `Đã khóa lô ${b.batchCode}.`
                                  )
                                }
                                className="px-2.5 py-1 border border-red-200 text-red-700 rounded-md"
                              >
                                Khóa lô
                              </button>
                            ) : (
                              b.daysUntilExpiry > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    runAction(
                                      () =>
                                        apiFetch(`/api/admin/batches/${b.id}/status`, {
                                          method: 'PATCH',
                                          token,
                                          body: { status: 'active' },
                                        }).then(() => undefined),
                                      `Đã mở khóa lô ${b.batchCode}.`
                                    )
                                  }
                                  className="px-2.5 py-1 bg-[#C81E3A] text-white rounded-md"
                                >
                                  Mở lại
                                </button>
                              )
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 6. ORDERS & PAYMENTS */}
          {section === 'orders' && (
            <div className="space-y-4">
              <h1 className="font-editorial text-3xl font-semibold text-[#1A1917]">
                Đơn hàng & Đối soát thanh toán toàn sàn
              </h1>
              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] text-[#6B665E] border-b border-zinc-200">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Mã đơn / Shop</th>
                      <th className="py-2.5 px-4 font-medium">Khách hàng</th>
                      <th className="py-2.5 px-4 font-medium text-right">Tổng tiền / Hoa hồng</th>
                      <th className="py-2.5 px-4 font-medium">Trạng thái đơn</th>
                      <th className="py-2.5 px-4 font-medium text-right">Thanh toán</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4DFD6]">
                    {data.orders.map((o) => {
                      const meta = ORDER_STATUS_META[o.status];
                      return (
                        <tr key={o.id}>
                          <td className="py-3 px-4">
                            <div className="font-mono font-semibold">#{o.orderNumber}</div>
                            <div className="text-[#6B665E]">{o.vendorName}</div>
                          </td>
                          <td className="py-3 px-4">{o.customerName}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">
                            <div className="font-semibold">{formatVnd(o.totalAmount)}</div>
                            <div className="text-[#C81E3A]">
                              HH: {formatVnd(o.commissionAmount)} ({o.commissionRate}%)
                            </div>
                          </td>
                          <td className={`py-3 px-4 font-medium ${meta.tone}`}>{meta.label}</td>
                          <td className="py-3 px-4 text-right">
                            <select
                              value={o.paymentStatus}
                              onChange={(e) =>
                                runAction(
                                  () =>
                                    apiFetch(`/api/admin/orders/${o.id}/payment`, {
                                      method: 'PATCH',
                                      token,
                                      body: { paymentStatus: e.target.value },
                                    }).then(() => undefined),
                                  `Đã cập nhật đối soát đơn #${o.orderNumber}.`
                                )
                              }
                              className="px-2 py-1 border border-zinc-200 rounded-md bg-white text-xs"
                            >
                              <option value="unpaid">Chưa thanh toán</option>
                              <option value="paid">Đã thanh toán</option>
                              <option value="refunded">Đã hoàn tiền</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 7. BRANDS & CATEGORIES */}
          {section === 'catalog' && (
            <div className="space-y-6">
              <h1 className="font-editorial text-3xl font-semibold text-[#1A1917]">
                Quản lý Thương hiệu & Danh mục
              </h1>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runAction(
                    () =>
                      apiFetch('/api/admin/brands', {
                        method: 'POST',
                        token,
                        body: { name: brandName, country: brandCountry },
                      }).then(() => {
                        setBrandName('');
                        setBrandCountry('');
                      }),
                    'Đã thêm thương hiệu mới.'
                  );
                }}
                className="bg-white border border-zinc-200 rounded-xl p-5 flex flex-wrap gap-3 items-end text-xs"
              >
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-[#6B665E] mb-1">Tên thương hiệu</label>
                  <input
                    type="text"
                    required
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="VD: Sulwhasoo"
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg"
                  />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-[#6B665E] mb-1">Quốc gia</label>
                  <input
                    type="text"
                    required
                    value={brandCountry}
                    onChange={(e) => setBrandCountry(e.target.value)}
                    placeholder="Hàn Quốc"
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#C81E3A] text-white font-medium rounded-lg"
                >
                  Thêm thương hiệu
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3 text-xs">
                  <h3 className="text-sm font-semibold text-[#1A1917]">Danh sách thương hiệu</h3>
                  <div className="divide-y divide-[#E4DFD6]">
                    {data.brands.map((b) => (
                      <div key={b.id} className="py-2 flex justify-between">
                        <span className="font-medium text-[#1A1917]">{b.name}</span>
                        <span className="text-[#6B665E]">{b.country}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3 text-xs">
                  <h3 className="text-sm font-semibold text-[#1A1917]">
                    Danh mục & Hoa hồng từng ngành
                  </h3>
                  <div className="divide-y divide-[#E4DFD6]">
                    {data.categories.map((c) => (
                      <div key={c.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium text-[#1A1917]">{c.name}</div>
                          <div className="text-[#6B665E]">{c.description}</div>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono shrink-0">
                          <input
                            type="number"
                            min={0}
                            max={40}
                            defaultValue={c.commissionRate}
                            onBlur={(e) => {
                              const nextRate = Number(e.target.value);
                              if (nextRate !== c.commissionRate) {
                                runAction(
                                  () =>
                                    apiFetch(`/api/admin/categories/${c.id}`, {
                                      method: 'PATCH',
                                      token,
                                      body: { commissionRate: nextRate },
                                    }).then(() => undefined),
                                  `Đã cập nhật hoa hồng danh mục ${c.name}.`
                                );
                              }
                            }}
                            className="w-14 px-2 py-1 border border-zinc-200 rounded-md text-right tabular-nums"
                          />
                          <span>%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 8. PROMOTIONS & COMMISSION */}
          {section === 'promotions' && (
            <div className="space-y-6">
              <h1 className="font-editorial text-3xl font-semibold text-[#1A1917]">
                Khuyến mãi & Cấu hình Hoa hồng
              </h1>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runAction(
                    () =>
                      apiFetch('/api/admin/commission', {
                        method: 'PATCH',
                        token,
                        body: {
                          defaultRate: Number(defaultRate),
                          sponsoredListingFee: Number(sponsoredFee),
                        },
                      }).then(() => undefined),
                    'Đã cập nhật cấu hình hoa hồng và phí quảng bá.'
                  );
                }}
                className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4 text-xs"
              >
                <h3 className="text-sm font-semibold text-[#1A1917]">Cấu hình phí sàn</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[#6B665E] mb-1">Hoa hồng mặc định (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={40}
                      value={defaultRate}
                      onChange={(e) => setDefaultRate(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-lg font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[#6B665E] mb-1">Phí quảng bá sản phẩm nổi bật (VNĐ/tháng)</label>
                    <input
                      type="number"
                      min={0}
                      value={sponsoredFee}
                      onChange={(e) => setSponsoredFee(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-lg font-mono"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1A1917] text-white font-medium rounded-lg"
                >
                  Lưu cấu hình hoa hồng
                </button>
              </form>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runAction(
                    () =>
                      apiFetch('/api/admin/promotions', {
                        method: 'POST',
                        token,
                        body: {
                          code: promoCode,
                          title: promoTitle,
                          discountType: promoType,
                          discountValue: Number(promoValue),
                          minOrderAmount: 300000,
                        },
                      }).then(() => {
                        setPromoCode('');
                        setPromoTitle('');
                      }),
                    'Đã phát hành mã khuyến mãi mới.'
                  );
                }}
                className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3 text-xs"
              >
                <h3 className="text-sm font-semibold text-[#1A1917]">Tạo chiến dịch Voucher mới</h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    required
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Mã (VD: BEAUTY15)"
                    className="px-3 py-2 border border-zinc-200 rounded-lg font-mono uppercase"
                  />
                  <input
                    type="text"
                    required
                    value={promoTitle}
                    onChange={(e) => setPromoTitle(e.target.value)}
                    placeholder="Mô tả chiến dịch"
                    className="px-3 py-2 border border-zinc-200 rounded-lg sm:col-span-2"
                  />
                  <div className="flex gap-2">
                    <select
                      value={promoType}
                      onChange={(e) => setPromoType(e.target.value as 'percent' | 'fixed')}
                      className="px-2 py-2 border border-zinc-200 rounded-lg bg-white"
                    >
                      <option value="percent">%</option>
                      <option value="fixed">VNĐ</option>
                    </select>
                    <input
                      type="number"
                      required
                      value={promoValue}
                      onChange={(e) => setPromoValue(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-lg font-mono"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#C81E3A] text-white font-medium rounded-lg"
                >
                  Phát hành Voucher
                </button>
              </form>

              <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-[#E4DFD6] text-xs">
                {data.promotions.map((pr) => (
                  <div key={pr.id} className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <span className="font-mono font-semibold text-[#C81E3A]">{pr.code}</span>
                      <span className="text-[#6B665E]"> · {pr.title}</span>
                      <div className="text-[#6B665E] mt-0.5 tabular-nums">
                        Đã dùng {pr.usedCount}/{pr.maxUses} · HSD {formatDateVi(pr.expiresAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        runAction(
                          () =>
                            apiFetch(`/api/admin/promotions/${pr.id}`, {
                              method: 'PATCH',
                              token,
                              body: { active: !pr.active },
                            }).then(() => undefined),
                          'Đã cập nhật trạng thái voucher.'
                        )
                      }
                      className={`px-3 py-1 rounded-md border ${
                        pr.active
                          ? 'border-emerald-200 text-emerald-700'
                          : 'border-zinc-200 text-[#6B665E]'
                      }`}
                    >
                      {pr.active ? 'Đang kích hoạt' : 'Đã tạm dừng'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 9. USERS & AUDIT LOGS */}
          {section === 'users' && (
            <div className="space-y-6">
              <h1 className="font-editorial text-3xl font-semibold text-[#1A1917]">
                Quản lý Tài khoản & Nhật ký hệ thống (Audit Log)
              </h1>

              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-200 text-sm font-semibold">
                  Tài khoản người dùng ({data.users.length})
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] text-[#6B665E] border-b border-zinc-200">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">Họ tên / Email</th>
                      <th className="py-2.5 px-4 font-medium">Vai trò</th>
                      <th className="py-2.5 px-4 font-medium">Trạng thái</th>
                      <th className="py-2.5 px-4 font-medium text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4DFD6]">
                    {data.users.map((u) => (
                      <tr key={u.id}>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#1A1917]">{u.name}</div>
                          <div className="text-[#6B665E]">{u.email}</div>
                        </td>
                        <td className="py-3 px-4 uppercase font-mono">{u.role}</td>
                        <td className="py-3 px-4">
                          <span className={u.status === 'active' ? 'text-emerald-700' : 'text-red-700'}>
                            {u.status === 'active' ? 'Hoạt động' : 'Bị khóa'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              runAction(
                                () =>
                                  apiFetch(`/api/admin/users/${u.id}/status`, {
                                    method: 'PATCH',
                                    token,
                                    body: { status: u.status === 'active' ? 'locked' : 'active' },
                                  }).then(() => undefined),
                                `Đã ${u.status === 'active' ? 'khóa' : 'mở khóa'} tài khoản ${u.email}.`
                              )
                            }
                            className="px-2.5 py-1 border border-zinc-200 rounded-md"
                          >
                            {u.status === 'active' ? 'Khóa' : 'Mở khóa'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-200 flex items-center gap-2 text-sm font-semibold">
                  <Activity className="w-4 h-4 text-[#1E4D3B]" />
                  <span>Nhật ký thao tác quan trọng (Audit Log)</span>
                </div>
                <div className="divide-y divide-[#E4DFD6] text-xs">
                  {data.auditLogs.map((log) => (
                    <div key={log.id} className="px-5 py-3 flex flex-wrap justify-between gap-2">
                      <div>
                        <span className="font-mono font-semibold text-[#1E4D3B]">{log.action}</span>
                        <span className="text-[#6B665E]"> · {log.actorName} — </span>
                        <span className="text-[#1A1917]">{log.summary}</span>
                      </div>
                      <span className="font-mono text-[#6B665E] tabular-nums">
                        {formatDateTimeVi(log.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
