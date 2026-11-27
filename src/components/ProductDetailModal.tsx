import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FileText,
  Minus,
  Plus,
  Scale,
  Search,
  ShoppingBag,
  Star,
  Store,
  X,
} from 'lucide-react';
import {
  DOC_TYPE_LABEL,
  apiFetch,
  formatDateVi,
  formatVnd,
} from '../lib/format';
import type {
  Batch,
  EnrichedProduct,
  ProductDocument,
  Review,
  Vendor,
} from '../types/marketplace';
import { ResilientImage } from './ResilientImage';

interface ProductDetailModalProps {
  productId: string | null;
  allProducts?: EnrichedProduct[];
  onClose: () => void;
  onAddToCart: (item: {
    product: EnrichedProduct;
    sku: string;
    variantName: string;
    unitPrice: number;
    quantity: number;
  }) => void;
  onSelectVendor?: (vendorId: string) => void;
  onSelectProduct?: (productId: string) => void;
  isCompared?: boolean;
  onToggleCompare?: (productId: string) => void;
}

interface BatchWithDays extends Batch {
  daysUntilExpiry: number;
}

interface RecommendedEntry {
  product: EnrichedProduct;
  score: number;
  reason: string;
}

function getLowestVariantPrice(p: EnrichedProduct): number {
  if (!p.variants.length) return 0;
  return Math.min(...p.variants.map((v) => v.promoPrice ?? v.price));
}

function isBatchUnderThreeMonths(expiryIso: string | undefined, days: number | null): boolean {
  if (days !== null && days <= 90) return true;
  if (!expiryIso) return false;
  const now = new Date();
  const threeMonthsLater = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, now.getUTCDate())
  );
  const expiry = new Date(expiryIso.slice(0, 10) + 'T00:00:00Z');
  return !Number.isNaN(expiry.getTime()) && expiry < threeMonthsLater;
}

function normalizeVi(input: string): string {
  return input
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function findHighlightRanges(text: string, query: string): Array<[number, number]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  let normStr = '';
  const mapStart: number[] = [];
  const mapEnd: number[] = [];

  let i = 0;
  for (const ch of text) {
    const origStart = i;
    const origEnd = i + ch.length;
    i = origEnd;

    const clean = normalizeVi(ch);
    for (const nc of clean) {
      normStr += nc;
      mapStart.push(origStart);
      mapEnd.push(origEnd);
    }
  }

  const normPhrase = normalizeVi(trimmed).replace(/\s+/g, ' ');
  const tokens = Array.from(new Set(normPhrase.split(' ').filter((t) => t.length >= 2)));
  const needles = normPhrase.length >= 2 ? [normPhrase, ...tokens] : [normPhrase];

  const rawRanges: Array<[number, number]> = [];
  for (const needle of needles) {
    if (!needle) continue;
    let searchFrom = 0;
    while (searchFrom < normStr.length) {
      const idx = normStr.indexOf(needle, searchFrom);
      if (idx === -1) break;
      const start = mapStart[idx];
      const end = mapEnd[idx + needle.length - 1];
      if (start !== undefined && end !== undefined) {
        rawRanges.push([start, end]);
      }
      searchFrom = idx + needle.length;
    }
  }

  if (rawRanges.length === 0) return [];
  rawRanges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);

  const merged: Array<[number, number]> = [rawRanges[0]];
  for (let k = 1; k < rawRanges.length; k++) {
    const [s, e] = rawRanges[k];
    const last = merged[merged.length - 1];
    if (s <= last[1]) {
      last[1] = Math.max(last[1], e);
    } else {
      merged.push([s, e]);
    }
  }
  return merged;
}

function renderHighlightedText(text: string, query: string): ReactNode {
  const ranges = findHighlightRanges(text, query);
  if (ranges.length === 0) return text;

  const nodes: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], idx) => {
    if (start > cursor) {
      nodes.push(text.slice(cursor, start));
    }
    nodes.push(
      <mark
        key={`hl-${idx}-${start}`}
        className="bg-[#C81E3A]/15 text-[#C81E3A] font-semibold px-0.5"
      >
        {text.slice(start, end)}
      </mark>
    );
    cursor = end;
  });
  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }
  return nodes;
}

function getRecommendedProducts(
  current: EnrichedProduct,
  candidates: EnrichedProduct[],
  limit = 3
): RecommendedEntry[] {
  const currentPrice = getLowestVariantPrice(current);
  const currentIngredients = new Set(current.ingredients.map((i) => i.trim().toLowerCase()));
  const currentBenefits = new Set(current.benefits.map((b) => b.trim().toLowerCase()));
  const currentSkinTypes = new Set(current.skinTypes.map((s) => s.trim().toLowerCase()));

  const scored: RecommendedEntry[] = [];

  for (const candidate of candidates) {
    if (candidate.id === current.id) continue;
    if (candidate.reviewStatus !== 'approved') continue;

    let score = 0;
    const reasons: string[] = [];

    if (candidate.categorySlug === current.categorySlug) {
      score += 5;
      reasons.push(`Cùng danh mục ${current.categoryName}`);
    }

    if (candidate.brandId === current.brandId) {
      score += 3;
      reasons.push(`Cùng thương hiệu ${current.brandName}`);
    }

    const matchedIngredients = candidate.ingredients.filter((ing) =>
      currentIngredients.has(ing.trim().toLowerCase())
    );
    if (matchedIngredients.length > 0) {
      score += matchedIngredients.length * 2;
      reasons.push(`Chung hoạt chất ${matchedIngredients[0]}`);
    }

    const matchedBenefits = candidate.benefits.filter((b) =>
      currentBenefits.has(b.trim().toLowerCase())
    );
    if (matchedBenefits.length > 0) {
      score += matchedBenefits.length * 2;
      reasons.push(`Cùng công dụng ${matchedBenefits[0].toLowerCase()}`);
    }

    const matchedSkinTypes = candidate.skinTypes.filter((s) =>
      currentSkinTypes.has(s.trim().toLowerCase())
    );
    if (matchedSkinTypes.length > 0) {
      const specificMatch = matchedSkinTypes.find((s) => s.toLowerCase() !== 'mọi loại da');
      score += specificMatch ? 2 : 1;
      if (specificMatch) {
        reasons.push(`Phù hợp ${specificMatch.toLowerCase()}`);
      }
    }

    const candidatePrice = getLowestVariantPrice(candidate);
    if (currentPrice > 0 && candidatePrice > 0) {
      const ratio = Math.abs(candidatePrice - currentPrice) / currentPrice;
      if (ratio <= 0.35) {
        score += 1;
      }
    }

    if (candidate.totalAvailableStock > 0) {
      score += 1;
    }

    scored.push({
      product: candidate,
      score,
      reason: reasons[0] ?? 'Sản phẩm chăm sóc cá nhân nổi bật',
    });
  }

  return scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.product.ratingAvg !== a.product.ratingAvg) {
        return b.product.ratingAvg - a.product.ratingAvg;
      }
      return b.product.reviewCount - a.product.reviewCount;
    })
    .slice(0, limit);
}

export function ProductDetailModal({
  productId,
  allProducts = [],
  onClose,
  onAddToCart,
  onSelectVendor,
  onSelectProduct,
  isCompared = false,
  onToggleCompare,
}: ProductDetailModalProps) {
  const [product, setProduct] = useState<EnrichedProduct | null>(null);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [batches, setBatches] = useState<BatchWithDays[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedSku, setSelectedSku] = useState<string>('');
  const [qty, setQty] = useState(1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [previewDoc, setPreviewDoc] = useState<ProductDocument | null>(null);
  const [selectedRatingFilter, setSelectedRatingFilter] = useState<number | null>(null);
  const [detailSearchQuery, setDetailSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    setQty(1);
    setActiveImageIndex(0);
    setPreviewDoc(null);
    setSelectedRatingFilter(null);
    setDetailSearchQuery('');
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    apiFetch<{
      product: EnrichedProduct;
      vendor: Vendor;
      eligibleBatches: BatchWithDays[];
      reviews: Review[];
    }>(`/api/storefront/products/${productId}`)
      .then((res) => {
        setProduct(res.product);
        setVendor(res.vendor);
        setBatches(res.eligibleBatches);
        setReviews(res.reviews);
        if (res.product.variants.length > 0) {
          setSelectedSku(res.product.variants[0].sku);
        }
      })
      .finally(() => setLoading(false));
  }, [productId]);

  const detailSearchResults = useMemo(() => {
    if (!product) {
      return {
        active: false,
        descriptionMatches: 0,
        matchedIngredients: [] as string[],
        matchedBenefits: [] as string[],
        matchedSkinTypes: [] as string[],
        totalMatches: 0,
        quickKeywords: [] as string[],
      };
    }

    const quickKeywords = Array.from(
      new Set([...product.ingredients.slice(0, 2), ...product.benefits.slice(0, 2)])
    );

    const q = detailSearchQuery.trim();
    if (!q) {
      return {
        active: false,
        descriptionMatches: 0,
        matchedIngredients: product.ingredients,
        matchedBenefits: product.benefits,
        matchedSkinTypes: product.skinTypes,
        totalMatches: 0,
        quickKeywords,
      };
    }

    const descriptionMatches = findHighlightRanges(product.description, q).length;
    const matchedIngredients = product.ingredients.filter(
      (ing) => findHighlightRanges(ing, q).length > 0
    );
    const matchedBenefits = product.benefits.filter(
      (b) => findHighlightRanges(b, q).length > 0
    );
    const matchedSkinTypes = product.skinTypes.filter(
      (st) => findHighlightRanges(st, q).length > 0
    );

    return {
      active: true,
      descriptionMatches,
      matchedIngredients,
      matchedBenefits,
      matchedSkinTypes,
      totalMatches:
        descriptionMatches +
        matchedIngredients.length +
        matchedBenefits.length +
        matchedSkinTypes.length,
      quickKeywords,
    };
  }, [product, detailSearchQuery]);

  const ratingSummary = useMemo(() => {
    const total = reviews.length;
    const avgProduct =
      total > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / total
        : product?.ratingAvg ?? 0;
    const avgShop =
      total > 0
        ? reviews.reduce((sum, r) => sum + r.shopRating, 0) / total
        : vendor?.rating ?? 0;

    const breakdown = [5, 4, 3, 2, 1].map((star) => {
      const count = reviews.filter((r) => Math.round(r.rating) === star).length;
      const percent = total > 0 ? Math.round((count / total) * 100) : 0;
      return { star, count, percent };
    });

    return {
      total,
      avgProduct,
      avgShop,
      breakdown,
    };
  }, [reviews, product?.ratingAvg, vendor?.rating]);

  const filteredReviews = useMemo(() => {
    if (selectedRatingFilter === null) return reviews;
    return reviews.filter((r) => Math.round(r.rating) === selectedRatingFilter);
  }, [reviews, selectedRatingFilter]);

  const recommendedProducts = useMemo(() => {
    if (!product || allProducts.length === 0) return [];
    return getRecommendedProducts(product, allProducts, 3);
  }, [product, allProducts]);

  if (!productId) return null;

  const activeVariant =
    product?.variants.find((v) => v.sku === selectedSku) ?? product?.variants[0];
  const skuBatches = batches.filter((b) => b.sku === activeVariant?.sku);
  const nextFefoBatch = skuBatches[0] ?? product?.activeBatch ?? null;
  const skuStock = skuBatches.reduce((sum, b) => sum + b.currentQty, 0);
  const nextBatchDays = nextFefoBatch
    ? 'daysUntilExpiry' in nextFefoBatch
      ? (nextFefoBatch as BatchWithDays).daysUntilExpiry
      : product?.daysUntilExpiry ?? null
    : null;
  const isPriorityExpiryWarning =
    Boolean(nextFefoBatch) && isBatchUnderThreeMonths(nextFefoBatch?.expiryDate, nextBatchDays);
  const queuedNextBatches = skuBatches.length > 1 ? skuBatches.slice(1) : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#090D16]/75 backdrop-blur-xs p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Chi tiết sản phẩm và minh bạch lô hàng"
    >
      <div className="w-full max-w-5xl max-h-[90vh] bg-[#F1F3F6] border border-[#090D16] shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 bg-[#090D16] text-white">
          <div className="text-xs font-mono text-zinc-400 flex items-center gap-2">
            <span>{product?.categoryName ?? 'Hồ sơ'}</span>
            <span aria-hidden="true">/</span>
            <span className="text-white font-medium truncate max-w-[36ch]">
              {product?.name ?? 'Đang tải...'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
            aria-label="Đóng chi tiết sản phẩm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div ref={scrollContainerRef} className="overflow-y-auto p-6 md:p-8 space-y-8">
          {loading || !product ? (
            <div className="py-16 text-center text-sm text-zinc-500">
              Đang tải thông tin sản phẩm và dữ liệu lô hàng FEFO...
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-5 space-y-4">
                  <div className="aspect-[4/3] bg-white border border-[#CFD4DC] overflow-hidden">
                    <ResilientImage
                      src={product.images[activeImageIndex] ?? product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {product.images.length > 1 && (
                    <div className="grid grid-cols-4 gap-3">
                      {product.images.map((img, i) => (
                        <button
                          key={`${img}-${i}`}
                          type="button"
                          onClick={() => setActiveImageIndex(i)}
                          className={`aspect-square bg-white border overflow-hidden transition-colors ${
                            activeImageIndex === i
                              ? 'border-[#C81E3A] ring-1 ring-[#C81E3A]'
                              : 'border-[#CFD4DC] hover:border-[#090D16]'
                          }`}
                          aria-label={`Xem ảnh ${i + 1}`}
                        >
                          <ResilientImage
                            src={img}
                            alt={`${product.name} ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {vendor && (
                    <div className="p-4 bg-white border border-[#CFD4DC] flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
                          <Store className="w-3.5 h-3.5" />
                          <span>Gian hàng phân phối</span>
                        </div>
                        <p className="text-sm font-semibold text-[#090D16] truncate">
                          {vendor.name}
                        </p>
                        <p className="text-xs text-zinc-500 mt-0.5 tabular-nums">
                          Đánh giá {vendor.rating}/5 · {vendor.reviewCount} nhận xét
                        </p>
                      </div>
                      {onSelectVendor && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onSelectVendor(vendor.id);
                          }}
                          className="px-3 py-2 text-xs font-medium border border-[#090D16] hover:bg-[#090D16] hover:text-white transition-colors whitespace-nowrap shrink-0"
                        >
                          Xem gian hàng
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-7 space-y-6">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 font-mono">
                      <span className="uppercase tracking-wider font-semibold text-[#C81E3A]">
                        {product.brandName}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{product.originCountry}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 tabular-nums text-[#090D16]">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        {product.ratingAvg > 0 ? product.ratingAvg : 'Mới'} ({product.reviewCount})
                      </span>
                    </div>

                    <h2 className="font-editorial text-3xl font-semibold text-[#090D16] leading-tight">
                      {product.name}
                    </h2>

                    <p className="text-sm text-zinc-600 leading-relaxed">
                      {detailSearchResults.active
                        ? renderHighlightedText(product.description, detailSearchQuery)
                        : product.description}
                    </p>
                  </div>

                  <div className="p-5 bg-white border border-[#CFD4DC] space-y-4">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-2xl font-semibold text-[#090D16] tabular-nums">
                        {formatVnd(activeVariant?.promoPrice ?? activeVariant?.price ?? 0)}
                      </span>
                      {activeVariant?.promoPrice && (
                        <span className="font-mono text-sm text-zinc-400 line-through tabular-nums">
                          {formatVnd(activeVariant.price)}
                        </span>
                      )}
                      <span className="ml-auto text-xs font-medium text-zinc-500 tabular-nums">
                        Khả dụng: <strong className="text-[#090D16]">{skuStock}</strong> sản phẩm
                      </span>
                    </div>

                    <div className="space-y-2">
                      <span className="block text-xs font-medium text-zinc-500">
                        Phân loại / Dung tích (SKU)
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {product.variants.map((v) => (
                          <button
                            key={v.sku}
                            type="button"
                            onClick={() => {
                              setSelectedSku(v.sku);
                              setQty(1);
                            }}
                            className={`px-3.5 py-2 text-xs font-mono font-medium border transition-colors whitespace-nowrap ${
                              selectedSku === v.sku
                                ? 'border-[#090D16] bg-[#090D16] text-white'
                                : 'border-[#CFD4DC] bg-white text-[#090D16] hover:border-[#090D16]'
                            }`}
                          >
                            {v.name} · {v.sku}
                          </button>
                        ))}
                      </div>
                    </div>

                    {isPriorityExpiryWarning && nextFefoBatch && (
                      <div
                        role="alert"
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-[#FFF1F2] border-l-4 border-l-[#C81E3A] border border-[#C81E3A]/40 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <AlertTriangle className="w-4 h-4 text-[#C81E3A] shrink-0" />
                          <span className="font-semibold text-[#C81E3A] truncate">
                            Cảnh báo ưu tiên FEFO: Lô {nextFefoBatch.batchCode} hạn dưới 3 tháng
                          </span>
                        </div>
                        <span className="font-mono font-semibold text-[#090D16] tabular-nums shrink-0">
                          {nextBatchDays !== null ? `Còn ${nextBatchDays} ngày` : formatDateVi(nextFefoBatch.expiryDate)}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-3 pt-2">
                      <div className="flex items-center border border-[#CFD4DC] bg-[#F1F3F6]">
                        <button
                          type="button"
                          onClick={() => setQty((q) => Math.max(1, q - 1))}
                          className="p-2.5 text-[#090D16] hover:bg-white transition-colors"
                          aria-label="Giảm số lượng"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="px-4 font-mono text-sm font-medium tabular-nums">{qty}</span>
                        <button
                          type="button"
                          onClick={() => setQty((q) => Math.min(Math.max(1, skuStock), q + 1))}
                          className="p-2.5 text-[#090D16] hover:bg-white transition-colors"
                          aria-label="Tăng số lượng"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={skuStock <= 0 || !activeVariant}
                        onClick={() => {
                          if (!activeVariant) return;
                          onAddToCart({
                            product,
                            sku: activeVariant.sku,
                            variantName: activeVariant.name,
                            unitPrice: activeVariant.promoPrice ?? activeVariant.price,
                            quantity: qty,
                          });
                          onClose();
                        }}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-5 bg-[#C81E3A] hover:bg-[#A61730] text-white text-sm font-medium transition-colors disabled:opacity-40 whitespace-nowrap"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>{skuStock > 0 ? 'Thêm vào giỏ hàng' : 'Tạm hết lô khả dụng'}</span>
                      </button>

                      {onToggleCompare && (
                        <button
                          type="button"
                          onClick={() => onToggleCompare(product.id)}
                          className={`inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-medium border transition-colors whitespace-nowrap ${
                            isCompared
                              ? 'border-[#090D16] bg-[#090D16] text-white'
                              : 'border-[#090D16] bg-white text-[#090D16] hover:bg-[#F1F3F6]'
                          }`}
                        >
                          <Scale className="w-4 h-4" />
                          <span>{isCompared ? 'Đã chọn so sánh' : 'So sánh'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Product Transparency Dossier */}
                  <div className="p-5 bg-white border border-[#090D16] space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#CFD4DC]">
                      <div>
                        <h3 className="text-sm font-semibold text-[#090D16]">
                          Thông tin minh bạch sản phẩm
                        </h3>
                        <p className="text-xs text-zinc-500">
                          Lô xuất bán ưu tiên theo nguyên tắc FEFO (Hạn gần nhất xuất trước)
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C81E3A]">
                        <CheckCircle2 className="w-4 h-4" />
                        {product.reviewStatus === 'approved' ? 'Đã kiểm duyệt' : 'Chờ kiểm duyệt'}
                      </span>
                    </div>

                    {isPriorityExpiryWarning && nextFefoBatch && (
                      <div
                        role="alert"
                        className="border-2 border-[#C81E3A] bg-gradient-to-r from-[#FFF1F2] via-[#FFF5F5] to-amber-50 p-4 space-y-2"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-[#C81E3A] text-white shrink-0">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                          <div className="flex-1 space-y-1.5 min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#C81E3A]">
                                Cảnh báo ưu tiên · Hạn sử dụng dưới 3 tháng
                              </span>
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#C81E3A] tabular-nums">
                                <Clock className="w-3.5 h-3.5" />
                                {nextBatchDays !== null ? `Còn ${nextBatchDays} ngày` : 'Cận hạn'}
                              </span>
                            </div>

                            <p className="text-xs text-[#090D16] leading-relaxed">
                              Lô xuất kho hiện tại{' '}
                              <strong className="font-mono text-[#C81E3A]">
                                {nextFefoBatch.batchCode}
                              </strong>{' '}
                              có hạn sử dụng đến ngày{' '}
                              <strong className="font-mono tabular-nums">
                                {formatDateVi(nextFefoBatch.expiryDate)}
                              </strong>{' '}
                              (dưới 3 tháng). Theo nguyên tắc minh bạch <strong>FEFO</strong>, hệ thống ưu tiên xuất lô này trước khi chuyển sang các lô tiếp theo.
                            </p>

                            {queuedNextBatches.length > 0 && (
                              <p className="text-[11px] font-mono text-zinc-700 pt-1 border-t border-[#C81E3A]/20">
                                Lô kế tiếp trong kho ({queuedNextBatches[0].batchCode}): HSD{' '}
                                {formatDateVi(queuedNextBatches[0].expiryDate)} · Tồn{' '}
                                {queuedNextBatches[0].currentQty} sp.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-xs">
                      <div>
                        <span className="text-zinc-500 block">Thương hiệu</span>
                        <span className="font-semibold text-[#090D16]">{product.brandName}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Nhà sản xuất</span>
                        <span className="font-semibold text-[#090D16]">{product.manufacturer}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Xuất xứ khai báo</span>
                        <span className="font-semibold text-[#090D16]">{product.originCountry}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Đơn vị phân phối</span>
                        <span className="font-semibold text-[#090D16]">{product.distributor}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Mã lô xuất bán (FEFO)</span>
                        <span className="font-mono font-semibold text-[#090D16]">
                          {nextFefoBatch?.batchCode ?? 'Chưa có lô'}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Trạng thái lô</span>
                        <span
                          className={`font-semibold ${
                            !nextFefoBatch
                              ? 'text-red-700'
                              : isPriorityExpiryWarning
                                ? 'text-[#C81E3A]'
                                : 'text-emerald-700'
                          }`}
                        >
                          {!nextFefoBatch
                            ? 'Không khả dụng'
                            : isPriorityExpiryWarning
                              ? 'Ưu tiên xuất (< 3 tháng)'
                              : 'Hợp lệ'}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Ngày sản xuất</span>
                        <span className="font-mono font-medium text-[#090D16] tabular-nums">
                          {nextFefoBatch ? formatDateVi(nextFefoBatch.manufactureDate) : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Hạn sử dụng</span>
                        <span
                          className={`font-mono font-semibold tabular-nums ${
                            isPriorityExpiryWarning ? 'text-[#C81E3A]' : 'text-[#090D16]'
                          }`}
                        >
                          {nextFefoBatch ? formatDateVi(nextFefoBatch.expiryDate) : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Tồn lô ưu tiên</span>
                        <span className="font-mono font-medium text-[#090D16] tabular-nums">
                          {nextFefoBatch ? `${nextFefoBatch.currentQty} sp` : '0 sp'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#CFD4DC] space-y-2">
                      <span className="text-xs font-medium text-zinc-500 block">
                        Chứng từ liên quan đã được duyệt ({product.approvedDocuments.length})
                      </span>
                      {product.approvedDocuments.length === 0 ? (
                        <p className="text-xs text-zinc-500">Chưa có chứng từ được duyệt.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {product.approvedDocuments.map((doc) => (
                            <button
                              key={doc.id}
                              type="button"
                              onClick={() => setPreviewDoc(doc)}
                              className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-xs bg-[#F1F3F6] hover:bg-zinc-200 border border-[#CFD4DC] transition-colors"
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                <FileText className="w-3.5 h-3.5 text-[#C81E3A] shrink-0" />
                                <span className="font-medium text-[#090D16] truncate">
                                  {doc.title}
                                </span>
                              </span>
                              <span className="text-zinc-500 whitespace-nowrap shrink-0">
                                {DOC_TYPE_LABEL[doc.docType] ?? doc.docType}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-zinc-500 italic">
                      Dữ liệu minh họa, không phải xác nhận pháp lý của sản phẩm thực tế.
                    </p>
                  </div>

                  {/* Smart Search for Ingredients, Benefits & Product Description */}
                  <div className="p-4 bg-white border border-[#090D16] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <label
                          htmlFor="product-detail-smart-search"
                          className="text-xs font-semibold text-[#090D16] block"
                        >
                          Tìm kiếm thông minh thành phần & công dụng
                        </label>
                        <p className="text-[11px] text-zinc-500">
                          Hỗ trợ tìm có dấu hoặc không dấu trực tiếp trong mô tả, bảng thành phần và công dụng
                        </p>
                      </div>
                      {detailSearchResults.active && (
                        <span className="font-mono text-[11px] text-[#C81E3A] font-semibold tabular-nums">
                          {detailSearchResults.totalMatches > 0
                            ? `${detailSearchResults.totalMatches} kết quả khớp`
                            : 'Không có kết quả khớp'}
                        </span>
                      )}
                    </div>

                    <div className="relative">
                      <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="product-detail-smart-search"
                        type="text"
                        value={detailSearchQuery}
                        onChange={(e) => setDetailSearchQuery(e.target.value)}
                        placeholder="Nhập hoạt chất hoặc công dụng (vd: Niacinamide, duong am, kiem dau...)"
                        className="w-full pl-9 pr-9 py-2 text-xs border border-[#CFD4DC] bg-[#F1F3F6] focus:bg-white focus:outline-none focus:border-[#090D16]"
                      />
                      {detailSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setDetailSearchQuery('')}
                          aria-label="Xóa từ khóa tìm kiếm"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-[#090D16]"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {detailSearchResults.quickKeywords.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="font-mono text-zinc-500 mr-1">Gợi ý nhanh:</span>
                        {detailSearchResults.quickKeywords.map((kw) => {
                          const isCurrent =
                            normalizeVi(detailSearchQuery.trim()) === normalizeVi(kw);
                          return (
                            <button
                              key={kw}
                              type="button"
                              onClick={() => setDetailSearchQuery(isCurrent ? '' : kw)}
                              className={`px-2 py-1 border font-mono transition-colors ${
                                isCurrent
                                  ? 'border-[#C81E3A] bg-[#C81E3A] text-white'
                                  : 'border-[#CFD4DC] bg-[#F1F3F6] text-[#090D16] hover:border-[#090D16]'
                              }`}
                            >
                              {kw}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {detailSearchResults.active && (
                      <div className="pt-2 border-t border-[#CFD4DC] space-y-2 text-xs">
                        <div className="flex flex-wrap gap-3 font-mono text-[11px] text-zinc-600 tabular-nums">
                          <span>
                            Mô tả:{' '}
                            <strong
                              className={
                                detailSearchResults.descriptionMatches > 0
                                  ? 'text-[#C81E3A]'
                                  : 'text-zinc-500'
                              }
                            >
                              {detailSearchResults.descriptionMatches}
                            </strong>
                          </span>
                          <span>·</span>
                          <span>
                            Thành phần:{' '}
                            <strong
                              className={
                                detailSearchResults.matchedIngredients.length > 0
                                  ? 'text-[#C81E3A]'
                                  : 'text-zinc-500'
                              }
                            >
                              {detailSearchResults.matchedIngredients.length}/{product.ingredients.length}
                            </strong>
                          </span>
                          <span>·</span>
                          <span>
                            Công dụng & Loại da:{' '}
                            <strong
                              className={
                                detailSearchResults.matchedBenefits.length +
                                  detailSearchResults.matchedSkinTypes.length >
                                0
                                  ? 'text-[#C81E3A]'
                                  : 'text-zinc-500'
                              }
                            >
                              {detailSearchResults.matchedBenefits.length +
                                detailSearchResults.matchedSkinTypes.length}
                            </strong>
                          </span>
                        </div>

                        {detailSearchResults.descriptionMatches > 0 && (
                          <div className="p-2.5 bg-[#F1F3F6] border border-[#CFD4DC] text-xs text-zinc-700 leading-relaxed">
                            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">
                              Đoạn khớp trong mô tả sản phẩm
                            </span>
                            {renderHighlightedText(product.description, detailSearchQuery)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div
                      className={`p-4 bg-white border space-y-2 transition-colors ${
                        detailSearchResults.active &&
                        detailSearchResults.matchedIngredients.length > 0
                          ? 'border-[#C81E3A]'
                          : 'border-[#CFD4DC]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#090D16]">Thành phần chính</span>
                        {detailSearchResults.active && (
                          <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                            {detailSearchResults.matchedIngredients.length}/
                            {product.ingredients.length} khớp
                          </span>
                        )}
                      </div>
                      {detailSearchResults.active &&
                      detailSearchResults.matchedIngredients.length === 0 ? (
                        <p className="text-zinc-500">
                          Không có thành phần nào khớp với từ khóa “{detailSearchQuery.trim()}”.
                        </p>
                      ) : (
                        <p className="text-zinc-600 leading-relaxed">
                          {(detailSearchResults.active
                            ? detailSearchResults.matchedIngredients
                            : product.ingredients
                          ).map((ing, idx) => (
                            <span key={ing}>
                              {idx > 0 && ' · '}
                              {detailSearchResults.active
                                ? renderHighlightedText(ing, detailSearchQuery)
                                : ing}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>

                    <div
                      className={`p-4 bg-white border space-y-2 transition-colors ${
                        detailSearchResults.active &&
                        detailSearchResults.matchedBenefits.length +
                          detailSearchResults.matchedSkinTypes.length >
                          0
                          ? 'border-[#C81E3A]'
                          : 'border-[#CFD4DC]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#090D16]">
                          Công dụng & Loại da phù hợp
                        </span>
                        {detailSearchResults.active && (
                          <span className="font-mono text-[11px] text-zinc-500 tabular-nums">
                            {detailSearchResults.matchedBenefits.length +
                              detailSearchResults.matchedSkinTypes.length}{' '}
                            khớp
                          </span>
                        )}
                      </div>
                      {detailSearchResults.active &&
                      detailSearchResults.matchedBenefits.length +
                        detailSearchResults.matchedSkinTypes.length ===
                        0 ? (
                        <p className="text-zinc-500">
                          Không có công dụng hoặc loại da khớp với từ khóa “
                          {detailSearchQuery.trim()}”.
                        </p>
                      ) : (
                        <p className="text-zinc-600 leading-relaxed">
                          {(detailSearchResults.active &&
                          detailSearchResults.matchedBenefits.length > 0
                            ? detailSearchResults.matchedBenefits
                            : !detailSearchResults.active
                              ? product.benefits
                              : []
                          ).map((benefit, idx) => (
                            <span key={benefit}>
                              {idx > 0 && ' · '}
                              {detailSearchResults.active
                                ? renderHighlightedText(benefit, detailSearchQuery)
                                : benefit}
                            </span>
                          ))}
                          {(!detailSearchResults.active ||
                            detailSearchResults.matchedSkinTypes.length > 0) && (
                            <>
                              {(!detailSearchResults.active ||
                                detailSearchResults.matchedBenefits.length > 0) &&
                                ' — '}
                              Phù hợp:{' '}
                              {(detailSearchResults.active
                                ? detailSearchResults.matchedSkinTypes
                                : product.skinTypes
                              ).map((st, idx) => (
                                <span key={st}>
                                  {idx > 0 && ', '}
                                  {detailSearchResults.active
                                    ? renderHighlightedText(st, detailSearchQuery)
                                    : st}
                                </span>
                              ))}
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {previewDoc && (
                <div className="p-5 bg-white border border-[#C81E3A] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[#C81E3A]">
                        {DOC_TYPE_LABEL[previewDoc.docType] ?? previewDoc.docType} · Đã duyệt ngày{' '}
                        {formatDateVi(previewDoc.issueDate)}
                      </p>
                      <h4 className="text-sm font-semibold text-[#090D16]">{previewDoc.title}</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(null)}
                      className="text-xs text-zinc-500 hover:text-[#090D16]"
                    >
                      Đóng xem trước
                    </button>
                  </div>
                  <div className="max-h-64 overflow-hidden border border-[#CFD4DC]">
                    <ResilientImage
                      src={previewDoc.fileUrl}
                      alt={previewDoc.title}
                      className="w-full h-56 object-contain bg-[#F1F3F6]"
                    />
                  </div>
                </div>
              )}

              <div className="pt-6 border-t border-[#CFD4DC] space-y-5">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-wider text-[#C81E3A]">
                      Phản hồi xác thực đơn hàng
                    </p>
                    <h3 className="font-editorial text-2xl font-semibold text-[#090D16]">
                      Đánh giá từ khách hàng đã mua ({reviews.length})
                    </h3>
                  </div>
                  {selectedRatingFilter !== null && (
                    <button
                      type="button"
                      onClick={() => setSelectedRatingFilter(null)}
                      className="text-xs font-mono text-[#C81E3A] hover:underline underline-offset-2"
                    >
                      Hiển thị tất cả đánh giá
                    </button>
                  )}
                </div>

                {/* Rating Summary Bar Chart */}
                <div className="bg-white border border-[#090D16] grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-[#CFD4DC]">
                  <div className="md:col-span-4 p-5 flex flex-col justify-center space-y-2 bg-[#FAFBFD]">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                      Tổng hợp điểm sản phẩm
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="font-editorial text-5xl font-semibold text-[#090D16] tabular-nums leading-none">
                        {ratingSummary.total > 0 ? ratingSummary.avgProduct.toFixed(1) : '—'}
                      </span>
                      <span className="font-mono text-sm text-zinc-500">/ 5.0</span>
                    </div>
                    <div className="flex items-center gap-1" aria-label="Xếp hạng sao trung bình">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={`w-4 h-4 ${
                            ratingSummary.total > 0 && n <= Math.round(ratingSummary.avgProduct)
                              ? 'fill-amber-500 text-amber-500'
                              : 'text-zinc-300'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-zinc-600 tabular-nums">
                      Dựa trên <strong>{ratingSummary.total}</strong> lượt đánh giá
                      {ratingSummary.total > 0 && (
                        <>
                          {' '}
                          · Điểm gian hàng:{' '}
                          <strong className="text-[#090D16]">
                            {ratingSummary.avgShop.toFixed(1)}/5
                          </strong>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="md:col-span-8 p-5 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pb-1">
                      <span>Phân bổ theo số sao (nhấn thanh để lọc)</span>
                      <span>Số lượng / Tỷ lệ</span>
                    </div>
                    <div className="space-y-1.5">
                      {ratingSummary.breakdown.map(({ star, count, percent }) => {
                        const isActive = selectedRatingFilter === star;
                        return (
                          <button
                            key={star}
                            type="button"
                            onClick={() =>
                              setSelectedRatingFilter((prev) => (prev === star ? null : star))
                            }
                            aria-pressed={isActive}
                            className={`w-full flex items-center gap-3 px-2 py-1 text-xs transition-colors ${
                              isActive
                                ? 'bg-[#FFF1F2] ring-1 ring-[#C81E3A]'
                                : 'hover:bg-[#F1F3F6]'
                            }`}
                          >
                            <span className="w-14 flex items-center gap-1 font-mono font-medium text-[#090D16] shrink-0 tabular-nums">
                              <span>{star}</span>
                              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            </span>

                            <div className="flex-1 h-2.5 bg-[#F1F3F6] border border-[#CFD4DC] overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  isActive ? 'bg-[#C81E3A]' : 'bg-[#090D16]'
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>

                            <span className="w-20 text-right font-mono text-[11px] text-zinc-600 tabular-nums shrink-0">
                              {count} ({percent}%)
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Star Filter Buttons */}
                {reviews.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedRatingFilter(null)}
                      className={`px-3 py-1.5 font-mono font-medium border transition-colors whitespace-nowrap tabular-nums ${
                        selectedRatingFilter === null
                          ? 'border-[#090D16] bg-[#090D16] text-white'
                          : 'border-[#CFD4DC] bg-white text-[#090D16] hover:border-[#090D16]'
                      }`}
                    >
                      Tất cả ({reviews.length})
                    </button>
                    {ratingSummary.breakdown.map(({ star, count }) => (
                      <button
                        key={`filter-star-${star}`}
                        type="button"
                        onClick={() =>
                          setSelectedRatingFilter((prev) => (prev === star ? null : star))
                        }
                        className={`inline-flex items-center gap-1 px-3 py-1.5 font-mono font-medium border transition-colors whitespace-nowrap tabular-nums ${
                          selectedRatingFilter === star
                            ? 'border-[#C81E3A] bg-[#C81E3A] text-white'
                            : 'border-[#CFD4DC] bg-white text-[#090D16] hover:border-[#090D16]'
                        }`}
                      >
                        <span>{star} sao</span>
                        <span>({count})</span>
                      </button>
                    ))}
                  </div>
                )}

                {reviews.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    Chưa có đánh giá nào cho sản phẩm này.
                  </p>
                ) : filteredReviews.length === 0 ? (
                  <div className="p-6 bg-white border border-[#CFD4DC] flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-zinc-600">
                      Chưa có đánh giá nào ở mức <strong>{selectedRatingFilter} sao</strong>.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectedRatingFilter(null)}
                      className="px-3.5 py-1.5 bg-[#090D16] hover:bg-[#C81E3A] text-white text-xs font-medium transition-colors"
                    >
                      Xem tất cả đánh giá
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredReviews.map((rev) => (
                      <div
                        key={rev.id}
                        className="p-4 bg-white border border-[#CFD4DC] space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#090D16]">{rev.customerName}</span>
                          <span className="font-mono text-zinc-500">{formatDateVi(rev.createdAt)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-amber-700">
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star
                                key={n}
                                className={`w-3.5 h-3.5 ${
                                  n <= Math.round(rev.rating)
                                    ? 'fill-amber-500 text-amber-500'
                                    : 'text-zinc-300'
                                }`}
                              />
                            ))}
                            <span className="ml-1 font-medium text-[#090D16]">
                              {rev.rating}/5
                            </span>
                          </span>
                          <span className="text-zinc-400">·</span>
                          <span className="text-[#090D16] tabular-nums">
                            Gian hàng: {rev.shopRating}/5
                          </span>
                        </div>
                        <p className="text-sm text-zinc-700">{rev.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {recommendedProducts.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.1 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="pt-6 border-t border-[#090D16] space-y-4"
                >
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-wider text-[#C81E3A]">
                        Gợi ý tương đồng công thức
                      </p>
                      <h3 className="font-editorial text-2xl font-semibold text-[#090D16]">
                        Sản phẩm gợi ý
                      </h3>
                    </div>
                    <p className="text-xs text-zinc-500">
                      Xếp hạng theo danh mục, hoạt chất, công dụng và loại da phù hợp
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 border-t border-l border-[#CFD4DC] bg-white">
                    {recommendedProducts.map(({ product: rec, reason }, idx) => {
                      const recVariant = rec.variants[0];
                      const recPrice = recVariant?.promoPrice ?? recVariant?.price ?? 0;
                      return (
                        <motion.article
                          key={rec.id}
                          initial={{ opacity: 0, y: 10 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, amount: 0.1 }}
                          transition={{
                            duration: 0.32,
                            ease: [0.16, 1, 0.3, 1],
                            delay: idx * 0.05,
                          }}
                          className="group border-r border-b border-[#CFD4DC] flex flex-col justify-between bg-white hover:bg-[#FAFBFD] transition-colors"
                        >
                          <div>
                            <div className="px-4 py-2.5 border-b border-[#CFD4DC] flex items-center justify-between gap-2 text-[11px] font-mono">
                              <span className="text-[#C81E3A] font-medium truncate">
                                {reason}
                              </span>
                              <span className="text-zinc-500 shrink-0">{rec.originCountry}</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => onSelectProduct?.(rec.id)}
                              className="aspect-[4/3] w-full bg-[#F1F3F6] overflow-hidden block border-b border-[#CFD4DC]"
                            >
                              <ResilientImage
                                src={rec.images[0]}
                                alt={rec.name}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                              />
                            </button>

                            <div className="p-4 space-y-1.5">
                              <div className="text-[11px] font-mono text-zinc-500 flex items-center justify-between gap-2">
                                <span className="truncate">{rec.brandName}</span>
                                <span className="tabular-nums text-[#090D16] inline-flex items-center gap-1 shrink-0">
                                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                  {rec.ratingAvg > 0 ? rec.ratingAvg : 'Mới'}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => onSelectProduct?.(rec.id)}
                                className="text-left block w-full"
                              >
                                <h4 className="font-editorial text-lg font-medium text-[#090D16] leading-snug group-hover:text-[#C81E3A] transition-colors line-clamp-2">
                                  {rec.name}
                                </h4>
                              </button>
                              <p className="text-[11px] font-mono text-zinc-500 truncate">
                                {rec.activeBatch
                                  ? `Lô ${rec.activeBatch.batchCode} · HSD ${formatDateVi(rec.activeBatch.expiryDate)}`
                                  : 'Chưa có lô khả dụng'}
                              </p>
                            </div>
                          </div>

                          <div className="px-4 pb-4 pt-2.5 border-t border-[#CFD4DC] flex items-center justify-between gap-2">
                            <span className="font-mono text-sm font-semibold text-[#090D16] tabular-nums">
                              {formatVnd(recPrice)}
                            </span>
                            <button
                              type="button"
                              onClick={() => onSelectProduct?.(rec.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-[#090D16] hover:bg-[#C81E3A] text-white transition-colors whitespace-nowrap"
                            >
                              <span>Xem lô</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </motion.article>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
