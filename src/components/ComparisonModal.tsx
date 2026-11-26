import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Scale,
  ShoppingBag,
  Star,
  X,
} from 'lucide-react';
import { formatDateVi, formatVnd } from '../lib/format';
import type { EnrichedProduct } from '../types/marketplace';
import { ResilientImage } from './ResilientImage';

interface ComparisonModalProps {
  open: boolean;
  products: EnrichedProduct[];
  onClose: () => void;
  onRemoveProduct: (productId: string) => void;
  onClearAll: () => void;
  onOpenProductDetail: (productId: string) => void;
  onAddToCart: (item: {
    product: EnrichedProduct;
    sku: string;
    variantName: string;
    unitPrice: number;
    quantity: number;
  }) => void;
}

function getEffectivePrice(p: EnrichedProduct): number {
  const primary = p.variants[0];
  if (!primary) return 0;
  return primary.promoPrice ?? primary.price;
}

export function ComparisonModal({
  open,
  products,
  onClose,
  onRemoveProduct,
  onClearAll,
  onOpenProductDetail,
  onAddToCart,
}: ComparisonModalProps) {
  const [highlightOnlyDiffs, setHighlightOnlyDiffs] = useState(false);

  const ingredientCounts = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      const seen = new Set(p.ingredients.map((i) => i.trim().toLowerCase()));
      seen.forEach((ing) => map.set(ing, (map.get(ing) ?? 0) + 1));
    });
    return map;
  }, [products]);

  const lowestPriceAmongCompared = useMemo(() => {
    if (products.length < 2) return null;
    const prices = products.map(getEffectivePrice).filter((v) => v > 0);
    return prices.length > 0 ? Math.min(...prices) : null;
  }, [products]);

  const longestExpiryDays = useMemo(() => {
    if (products.length < 2) return null;
    const days = products
      .map((p) => p.daysUntilExpiry)
      .filter((d): d is number => d !== null && d > 0);
    return days.length > 0 ? Math.max(...days) : null;
  }, [products]);

  if (!open) return null;

  const isSameOrigin =
    products.length > 1 &&
    new Set(products.map((p) => p.originCountry.trim().toLowerCase())).size === 1;
  const isSameBrand =
    products.length > 1 && new Set(products.map((p) => p.brandId)).size === 1;
  const isSameManufacturer =
    products.length > 1 &&
    new Set(products.map((p) => p.manufacturer.trim().toLowerCase())).size === 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#090D16]/75 backdrop-blur-xs p-3 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Bảng so sánh thông số sản phẩm"
    >
      <div className="w-full max-w-6xl max-h-[92vh] bg-[#F1F3F6] border border-[#090D16] shadow-2xl overflow-hidden flex flex-col">
        {/* Top Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-[#090D16] text-white">
          <div className="flex items-center gap-3">
            <Scale className="w-5 h-5 text-[#C81E3A]" />
            <div>
              <h2 className="font-editorial text-xl font-medium leading-tight">
                Bảng đối chiếu thông số sản phẩm ({products.length}/3)
              </h2>
              <p className="text-xs font-mono text-zinc-400">
                So sánh thành phần, hạn sử dụng lô FEFO, nguồn gốc xuất xứ và giá bán
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {products.length >= 2 && (
              <label className="inline-flex items-center gap-2 text-xs font-mono text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={highlightOnlyDiffs}
                  onChange={(e) => setHighlightOnlyDiffs(e.target.checked)}
                  className="accent-[#C81E3A]"
                />
                <span>Ẩn mục giống nhau</span>
              </label>
            )}
            {products.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                className="px-3 py-1.5 text-xs font-mono border border-zinc-700 hover:border-white text-zinc-300 hover:text-white transition-colors"
              >
                Xóa danh sách
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white transition-colors"
              aria-label="Đóng bảng so sánh"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Comparison Table Content */}
        <div className="overflow-auto flex-1 p-4 md:p-6">
          {products.length === 0 ? (
            <div className="p-12 bg-white border border-[#CFD4DC] text-center space-y-2">
              <p className="text-sm font-medium text-[#090D16]">
                Chưa có sản phẩm nào trong danh sách so sánh.
              </p>
              <p className="text-xs text-zinc-500">
                Hãy chọn tối đa 3 sản phẩm từ thư viện để đối chiếu thông số trực tiếp.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-[#090D16] overflow-x-auto">
              <table className="w-full min-w-[760px] text-left border-collapse table-fixed">
                <colgroup>
                  <col className="w-48" />
                  {products.map((p) => (
                    <col key={`col-${p.id}`} />
                  ))}
                  {products.length < 3 && <col />}
                </colgroup>

                {/* Product Visual Header Row */}
                <thead>
                  <tr className="border-b border-[#090D16] bg-[#FAFBFD] align-top">
                    <th className="p-4 border-r border-[#CFD4DC] font-mono text-[11px] uppercase tracking-wider text-zinc-500 align-bottom">
                      Chỉ tiêu đối chiếu
                    </th>

                    {products.map((product) => (
                      <th
                        key={product.id}
                        className="p-4 border-r border-[#CFD4DC] font-normal align-top"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-zinc-500">
                            <span className="truncate uppercase">{product.categoryName}</span>
                            <button
                              type="button"
                              onClick={() => onRemoveProduct(product.id)}
                              className="inline-flex items-center gap-1 text-zinc-500 hover:text-[#C81E3A] transition-colors shrink-0"
                              aria-label={`Bỏ ${product.name} khỏi so sánh`}
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Bỏ</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenProductDetail(product.id);
                            }}
                            className="aspect-[4/3] w-full bg-[#F1F3F6] border border-[#CFD4DC] overflow-hidden block group"
                          >
                            <ResilientImage
                              src={product.images[0]}
                              alt={product.name}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                            />
                          </button>

                          <div className="space-y-1">
                            <p className="font-mono text-[11px] text-[#C81E3A] font-semibold uppercase tracking-wide truncate">
                              {product.brandName}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onOpenProductDetail(product.id);
                              }}
                              className="text-left block w-full"
                            >
                              <h3 className="font-editorial text-lg font-semibold text-[#090D16] hover:text-[#C81E3A] transition-colors leading-snug">
                                {product.name}
                              </h3>
                            </button>
                            <p className="text-xs text-zinc-500 inline-flex items-center gap-1.5 tabular-nums">
                              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                              <span>
                                {product.ratingAvg > 0
                                  ? `${product.ratingAvg}/5 (${product.reviewCount})`
                                  : 'Sản phẩm mới'}
                              </span>
                            </p>
                          </div>
                        </div>
                      </th>
                    ))}

                    {products.length < 3 && (
                      <th className="p-4 bg-[#F1F3F6]/60 font-normal align-middle text-center">
                        <div className="border border-dashed border-[#CFD4DC] p-6 space-y-2">
                          <p className="font-mono text-xs text-zinc-600">
                            Còn trống {3 - products.length} vị trí
                          </p>
                          <p className="text-xs text-zinc-500">
                            Đóng bảng để chọn thêm sản phẩm đối chiếu song song.
                          </p>
                          <button
                            type="button"
                            onClick={onClose}
                            className="mt-2 px-3 py-1.5 bg-[#090D16] hover:bg-[#C81E3A] text-white text-xs font-medium transition-colors"
                          >
                            + Chọn thêm sản phẩm
                          </button>
                        </div>
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#CFD4DC] text-xs">
                  {/* 1. Giá bán */}
                  <tr className="hover:bg-[#FAFBFD]">
                    <td className="p-4 border-r border-[#CFD4DC] font-mono text-[11px] uppercase tracking-wider text-zinc-500 bg-[#F1F3F6]/40 align-top">
                      Giá bán hiện hành
                    </td>
                    {products.map((product) => {
                      const primary = product.variants[0];
                      const activePrice = getEffectivePrice(product);
                      const isBestPrice =
                        lowestPriceAmongCompared !== null &&
                        activePrice === lowestPriceAmongCompared;

                      return (
                        <td
                          key={`price-${product.id}`}
                          className="p-4 border-r border-[#CFD4DC] align-top space-y-2"
                        >
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="font-mono text-lg font-semibold text-[#090D16] tabular-nums">
                              {formatVnd(activePrice)}
                            </span>
                            {primary?.promoPrice && (
                              <span className="font-mono text-xs text-zinc-400 line-through tabular-nums">
                                {formatVnd(primary.price)}
                              </span>
                            )}
                          </div>
                          {isBestPrice && (
                            <p className="font-mono text-[11px] font-semibold text-emerald-700">
                              Giá tốt nhất trong nhóm đối chiếu
                            </p>
                          )}
                          <div className="space-y-1 pt-1 border-t border-[#CFD4DC]/60">
                            {product.variants.map((v) => (
                              <div
                                key={v.sku}
                                className="flex items-center justify-between gap-2 text-[11px] text-zinc-600"
                              >
                                <span className="truncate">{v.name}</span>
                                <span className="font-mono tabular-nums text-[#090D16] shrink-0">
                                  {formatVnd(v.promoPrice ?? v.price)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                    {products.length < 3 && <td className="p-4 bg-[#F1F3F6]/40" />}
                  </tr>

                  {/* 2. Hạn sử dụng lô hiện tại (FEFO) */}
                  <tr className="hover:bg-[#FAFBFD]">
                    <td className="p-4 border-r border-[#CFD4DC] font-mono text-[11px] uppercase tracking-wider text-zinc-500 bg-[#F1F3F6]/40 align-top">
                      Hạn sử dụng lô hiện tại (FEFO)
                    </td>
                    {products.map((product) => {
                      const batch = product.activeBatch;
                      const isLongestShelfLife =
                        longestExpiryDays !== null &&
                        product.daysUntilExpiry === longestExpiryDays;

                      return (
                        <td
                          key={`batch-${product.id}`}
                          className="p-4 border-r border-[#CFD4DC] align-top space-y-2"
                        >
                          {batch ? (
                            <>
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono font-semibold text-[#090D16]">
                                  {batch.batchCode}
                                </span>
                                <span
                                  className={`font-mono text-[11px] font-semibold ${
                                    product.isExpiringSoon
                                      ? 'text-amber-700'
                                      : 'text-emerald-700'
                                  }`}
                                >
                                  {product.isExpiringSoon ? 'Sắp hết hạn' : 'Hợp lệ'}
                                </span>
                              </div>
                              <div className="space-y-1 text-[11px] font-mono">
                                <div className="flex justify-between gap-2">
                                  <span className="text-zinc-500">NSX:</span>
                                  <span className="tabular-nums text-[#090D16]">
                                    {formatDateVi(batch.manufactureDate)}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <span className="text-zinc-500">HSD:</span>
                                  <span
                                    className={`tabular-nums font-semibold ${
                                      product.isExpiringSoon ? 'text-amber-700' : 'text-[#090D16]'
                                    }`}
                                  >
                                    {formatDateVi(batch.expiryDate)}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <span className="text-zinc-500">Còn lại:</span>
                                  <span className="tabular-nums text-[#090D16]">
                                    {product.daysUntilExpiry !== null
                                      ? `${product.daysUntilExpiry} ngày`
                                      : '—'}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <span className="text-zinc-500">Tồn khả dụng:</span>
                                  <span className="tabular-nums text-[#090D16]">
                                    {product.totalAvailableStock} sp
                                  </span>
                                </div>
                              </div>
                              {product.isExpiringSoon && (
                                <p className="flex items-center gap-1 text-[11px] text-amber-800 bg-amber-50 border border-amber-300 px-2 py-1">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  <span>Lô xuất hiện tại dưới 90 ngày</span>
                                </p>
                              )}
                              {isLongestShelfLife && !product.isExpiringSoon && (
                                <p className="font-mono text-[11px] font-semibold text-emerald-700">
                                  Hạn sử dụng xa nhất trong nhóm
                                </p>
                              )}
                            </>
                          ) : (
                            <span className="text-red-700 font-medium">
                              Chưa có lô khả dụng
                            </span>
                          )}
                        </td>
                      );
                    })}
                    {products.length < 3 && <td className="p-4 bg-[#F1F3F6]/40" />}
                  </tr>

                  {/* 3. Thành phần hoạt chất */}
                  <tr className="hover:bg-[#FAFBFD]">
                    <td className="p-4 border-r border-[#CFD4DC] font-mono text-[11px] uppercase tracking-wider text-zinc-500 bg-[#F1F3F6]/40 align-top">
                      Thành phần hoạt chất
                      {products.length > 1 && (
                        <span className="block mt-1 normal-case tracking-normal font-sans text-[11px] text-zinc-500">
                          Hoạt chất trùng khớp được đánh dấu nổi bật
                        </span>
                      )}
                    </td>
                    {products.map((product) => (
                      <td
                        key={`ing-${product.id}`}
                        className="p-4 border-r border-[#CFD4DC] align-top"
                      >
                        <ul className="space-y-1.5">
                          {product.ingredients.map((ing) => {
                            const isShared =
                              products.length > 1 &&
                              (ingredientCounts.get(ing.trim().toLowerCase()) ?? 0) > 1;
                            return (
                              <li
                                key={ing}
                                className={`flex items-start gap-1.5 leading-snug ${
                                  isShared
                                    ? 'text-[#C81E3A] font-semibold'
                                    : 'text-[#090D16]'
                                }`}
                              >
                                <span aria-hidden="true">·</span>
                                <span>
                                  {ing}
                                  {isShared && (
                                    <span className="ml-1.5 font-mono text-[10px] font-normal text-zinc-500">
                                      (chung)
                                    </span>
                                  )}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </td>
                    ))}
                    {products.length < 3 && <td className="p-4 bg-[#F1F3F6]/40" />}
                  </tr>

                  {/* 4. Nguồn gốc & Nhà sản xuất */}
                  {(!highlightOnlyDiffs || !isSameOrigin) && (
                    <tr className="hover:bg-[#FAFBFD]">
                      <td className="p-4 border-r border-[#CFD4DC] font-mono text-[11px] uppercase tracking-wider text-zinc-500 bg-[#F1F3F6]/40 align-top">
                        Xuất xứ khai báo
                      </td>
                      {products.map((product) => (
                        <td
                          key={`origin-${product.id}`}
                          className="p-4 border-r border-[#CFD4DC] font-semibold text-[#090D16] align-top"
                        >
                          {product.originCountry}
                        </td>
                      ))}
                      {products.length < 3 && <td className="p-4 bg-[#F1F3F6]/40" />}
                    </tr>
                  )}

                  {(!highlightOnlyDiffs || !isSameBrand) && (
                    <tr className="hover:bg-[#FAFBFD]">
                      <td className="p-4 border-r border-[#CFD4DC] font-mono text-[11px] uppercase tracking-wider text-zinc-500 bg-[#F1F3F6]/40 align-top">
                        Thương hiệu & Gian hàng
                      </td>
                      {products.map((product) => (
                        <td
                          key={`brand-${product.id}`}
                          className="p-4 border-r border-[#CFD4DC] align-top space-y-1"
                        >
                          <div className="font-semibold text-[#090D16]">{product.brandName}</div>
                          <div className="text-zinc-600">{product.vendorName}</div>
                        </td>
                      ))}
                      {products.length < 3 && <td className="p-4 bg-[#F1F3F6]/40" />}
                    </tr>
                  )}

                  {(!highlightOnlyDiffs || !isSameManufacturer) && (
                    <tr className="hover:bg-[#FAFBFD]">
                      <td className="p-4 border-r border-[#CFD4DC] font-mono text-[11px] uppercase tracking-wider text-zinc-500 bg-[#F1F3F6]/40 align-top">
                        Nhà sản xuất & Phân phối
                      </td>
                      {products.map((product) => (
                        <td
                          key={`mfg-${product.id}`}
                          className="p-4 border-r border-[#CFD4DC] align-top space-y-1.5"
                        >
                          <div>
                            <span className="text-zinc-500 block text-[11px]">Nhà sản xuất:</span>
                            <span className="font-medium text-[#090D16]">
                              {product.manufacturer}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block text-[11px]">Đơn vị phân phối:</span>
                            <span className="font-medium text-[#090D16]">
                              {product.distributor}
                            </span>
                          </div>
                        </td>
                      ))}
                      {products.length < 3 && <td className="p-4 bg-[#F1F3F6]/40" />}
                    </tr>
                  )}

                  {/* 5. Chứng từ & Công dụng & Loại da */}
                  <tr className="hover:bg-[#FAFBFD]">
                    <td className="p-4 border-r border-[#CFD4DC] font-mono text-[11px] uppercase tracking-wider text-zinc-500 bg-[#F1F3F6]/40 align-top">
                      Kiểm duyệt & Chứng từ
                    </td>
                    {products.map((product) => (
                      <td
                        key={`docs-${product.id}`}
                        className="p-4 border-r border-[#CFD4DC] align-top space-y-1"
                      >
                        <div className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {product.reviewStatus === 'approved'
                              ? 'Đã kiểm duyệt'
                              : 'Chờ kiểm duyệt'}
                          </span>
                        </div>
                        <p className="font-mono text-[11px] text-zinc-600 tabular-nums">
                          {product.approvedDocuments.length} chứng từ hợp lệ
                        </p>
                      </td>
                    ))}
                    {products.length < 3 && <td className="p-4 bg-[#F1F3F6]/40" />}
                  </tr>

                  <tr className="hover:bg-[#FAFBFD]">
                    <td className="p-4 border-r border-[#CFD4DC] font-mono text-[11px] uppercase tracking-wider text-zinc-500 bg-[#F1F3F6]/40 align-top">
                      Công dụng & Loại da
                    </td>
                    {products.map((product) => (
                      <td
                        key={`ben-${product.id}`}
                        className="p-4 border-r border-[#CFD4DC] align-top space-y-2"
                      >
                        <p className="text-[#090D16] leading-relaxed">
                          {product.benefits.join(' · ')}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          Loại da: {product.skinTypes.join(', ')}
                        </p>
                      </td>
                    ))}
                    {products.length < 3 && <td className="p-4 bg-[#F1F3F6]/40" />}
                  </tr>

                  {/* Action Row */}
                  <tr className="bg-[#FAFBFD]">
                    <td className="p-4 border-r border-[#CFD4DC] font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                      Thao tác
                    </td>
                    {products.map((product) => {
                      const primary = product.variants[0];
                      const canAdd = Boolean(primary && product.totalAvailableStock > 0);
                      return (
                        <td
                          key={`act-${product.id}`}
                          className="p-4 border-r border-[#CFD4DC] align-top"
                        >
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              disabled={!canAdd}
                              onClick={() => {
                                if (!primary) return;
                                onAddToCart({
                                  product,
                                  sku: primary.sku,
                                  variantName: primary.name,
                                  unitPrice: primary.promoPrice ?? primary.price,
                                  quantity: 1,
                                });
                              }}
                              className="w-full py-2 px-3 bg-[#C81E3A] hover:bg-[#A61730] text-white text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
                            >
                              <ShoppingBag className="w-3.5 h-3.5" />
                              <span>{canAdd ? 'Thêm vào giỏ' : 'Hết lô khả dụng'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onOpenProductDetail(product.id);
                              }}
                              className="w-full py-2 px-3 border border-[#090D16] bg-white hover:bg-[#090D16] hover:text-white text-[#090D16] text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <span>Chi tiết hồ sơ lô</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      );
                    })}
                    {products.length < 3 && <td className="p-4 bg-[#F1F3F6]/40" />}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
