import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  LayoutGrid,
  LogOut,
  Scale,
  Search,
  ShoppingBag,
  Star,
  Store,
  Table2,
  X,
} from 'lucide-react';
import { AdminPortal } from './components/AdminPortal';
import { AuthModal } from './components/AuthModal';
import { CartDrawer, type CartItem } from './components/CartDrawer';
import { ComparisonModal } from './components/ComparisonModal';
import { CustomerAccountView } from './components/CustomerAccountView';
import { MultiSelectFilterGroup } from './components/MultiSelectFilterGroup';
import { ProductDetailModal } from './components/ProductDetailModal';
import { ResilientImage } from './components/ResilientImage';
import { VendorPortal } from './components/VendorPortal';
import { apiFetch, formatDateVi, formatVnd } from './lib/format';
import type {
  Brand,
  Category,
  EnrichedProduct,
  Order,
  Promotion,
  User,
  Vendor,
} from './types/marketplace';

type AppView = 'storefront' | 'vendors' | 'account' | 'vendor-portal' | 'admin-portal';

function getInitialViewFromHash(): AppView {
  if (typeof window === 'undefined') return 'storefront';
  const raw = window.location.hash.replace(/^#\/?/, '');
  if (
    raw === 'vendors' ||
    raw === 'account' ||
    raw === 'vendor-portal' ||
    raw === 'admin-portal'
  ) {
    return raw;
  }
  return 'storefront';
}

export default function App() {
  const [view, setView] = useState<AppView>(getInitialViewFromHash);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [restoringSession, setRestoringSession] = useState(true);

  // Catalog state
  const [products, setProducts] = useState<EnrichedProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // Interactive Hero Spotlight & View Mode
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [catalogMode, setCatalogMode] = useState<'specimen' | 'ledger'>('specimen');

  // Multi-select Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedSkinTypes, setSelectedSkinTypes] = useState<string[]>([]);
  const [selectedBenefits, setSelectedBenefits] = useState<string[]>([]);
  const [benefitMatchMode, setBenefitMatchMode] = useState<'any' | 'all'>('any');
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [ingredientMatchMode, setIngredientMatchMode] = useState<'any' | 'all'>('any');
  const [selectedPriceRanges, setSelectedPriceRanges] = useState<string[]>([]);
  const [selectedVendorFilter, setSelectedVendorFilter] = useState<string>('all');

  // Interactive overlays
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [authModal, setAuthModal] = useState<{
    open: boolean;
    tab: 'login' | 'register';
  }>({ open: false, tab: 'login' });
  const [toast, setToast] = useState<string>('');

  const loadCatalog = () => {
    setLoadingCatalog(true);
    apiFetch<{
      products: EnrichedProduct[];
      categories: Category[];
      brands: Brand[];
      vendors: Vendor[];
      promotions: Promotion[];
    }>('/api/storefront/catalog')
      .then((res) => {
        setProducts(res.products);
        setCategories(res.categories);
        setBrands(res.brands);
        setVendors(res.vendors);
        setPromotions(res.promotions);
      })
      .finally(() => setLoadingCatalog(false));
  };

  useEffect(() => {
    loadCatalog();
    apiFetch<{ user: User; token: string }>('/api/auth/me')
      .then((res) => {
        setUser(res.user);
        setToken(res.token);
        setView((prev) => {
          if (prev === 'admin-portal' && res.user.role !== 'admin') return 'storefront';
          if (prev === 'vendor-portal' && res.user.role !== 'vendor') return 'storefront';
          return prev;
        });
      })
      .catch(() => {
        setView((prev) =>
          prev === 'account' || prev === 'vendor-portal' || prev === 'admin-portal'
            ? 'storefront'
            : prev
        );
      })
      .finally(() => {
        setRestoringSession(false);
      });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nextHash = `#/${view}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash);
    }
  }, [view]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? '' : prev));
    }, 4500);
  };

  const toggleCompareProduct = (productId: string) => {
    setCompareIds((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      }
      if (prev.length >= 3) {
        showToast('Chỉ có thể chọn tối đa 3 sản phẩm để đối chiếu cùng lúc.');
        return prev;
      }
      return [...prev, productId];
    });
  };

  const comparedProducts = useMemo(
    () =>
      compareIds
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is EnrichedProduct => Boolean(p)),
    [compareIds, products]
  );

  const toggleFilterValue = (
    setter: Dispatch<SetStateAction<string[]>>,
    value: string
  ) => {
    setter((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedCategories([]);
    setSelectedBrands([]);
    setSelectedSkinTypes([]);
    setSelectedBenefits([]);
    setSelectedIngredients([]);
    setSelectedPriceRanges([]);
    setSelectedVendorFilter('all');
  };

  const uniqueBenefits = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      new Set(p.benefits).forEach((b) => map.set(b, (map.get(b) ?? 0) + 1));
    });
    return Array.from(map.entries()).map(([value, count]) => ({ value, label: value, count }));
  }, [products]);

  const uniqueIngredients = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => {
      new Set(p.ingredients).forEach((i) => map.set(i, (map.get(i) ?? 0) + 1));
    });
    return Array.from(map.entries()).map(([value, count]) => ({ value, label: value, count }));
  }, [products]);

  const skinTypeOptions = useMemo(() => {
    const labels = ['Da dầu', 'Da khô', 'Da hỗn hợp', 'Da nhạy cảm', 'Mọi loại da'];
    return labels.map((st) => ({
      value: st,
      label: st,
      count: products.filter(
        (p) => p.skinTypes.includes(st) || p.skinTypes.includes('Mọi loại da')
      ).length,
    }));
  }, [products]);

  const priceRangeOptions = useMemo(() => {
    const getLowest = (p: EnrichedProduct) =>
      Math.min(...p.variants.map((v) => v.promoPrice ?? v.price));
    return [
      {
        value: 'under500',
        label: 'Dưới 500.000 ₫',
        count: products.filter((p) => getLowest(p) < 500000).length,
      },
      {
        value: '500to800',
        label: '500.000 – 800.000 ₫',
        count: products.filter((p) => {
          const lp = getLowest(p);
          return lp >= 500000 && lp <= 800000;
        }).length,
      },
      {
        value: 'over800',
        label: 'Trên 800.000 ₫',
        count: products.filter((p) => getLowest(p) > 800000).length,
      },
    ];
  }, [products]);

  const spotlightProducts = useMemo(() => products.slice(0, 3), [products]);
  const activeSpotlight = spotlightProducts[spotlightIndex] ?? products[0] ?? null;

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    selectedBrands.length > 0 ||
    selectedSkinTypes.length > 0 ||
    selectedBenefits.length > 0 ||
    selectedIngredients.length > 0 ||
    selectedPriceRanges.length > 0 ||
    selectedVendorFilter !== 'all' ||
    searchQuery.trim().length > 0;

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategories.length > 0 && !selectedCategories.includes(p.categorySlug)) {
        return false;
      }
      if (selectedBrands.length > 0 && !selectedBrands.includes(p.brandId)) {
        return false;
      }
      if (selectedVendorFilter !== 'all' && p.vendorId !== selectedVendorFilter) {
        return false;
      }
      if (selectedSkinTypes.length > 0) {
        const matchesSkin =
          p.skinTypes.includes('Mọi loại da') ||
          selectedSkinTypes.some((st) => p.skinTypes.includes(st));
        if (!matchesSkin) return false;
      }
      if (selectedBenefits.length > 0) {
        const matchesBenefits =
          benefitMatchMode === 'all'
            ? selectedBenefits.every((b) => p.benefits.includes(b))
            : selectedBenefits.some((b) => p.benefits.includes(b));
        if (!matchesBenefits) return false;
      }
      if (selectedIngredients.length > 0) {
        const matchesIng = (sel: string) =>
          p.ingredients.some((i) => i.toLowerCase().includes(sel.toLowerCase()));
        const matchesIngredients =
          ingredientMatchMode === 'all'
            ? selectedIngredients.every(matchesIng)
            : selectedIngredients.some(matchesIng);
        if (!matchesIngredients) return false;
      }

      if (selectedPriceRanges.length > 0) {
        const lowestPrice = Math.min(...p.variants.map((v) => v.promoPrice ?? v.price));
        const matchesPrice = selectedPriceRanges.some((range) => {
          if (range === 'under500') return lowestPrice < 500000;
          if (range === '500to800') return lowestPrice >= 500000 && lowestPrice <= 800000;
          if (range === 'over800') return lowestPrice > 800000;
          return false;
        });
        if (!matchesPrice) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hay = `${p.name} ${p.brandName} ${p.categoryName} ${p.ingredients.join(' ')} ${p.benefits.join(' ')} ${p.vendorName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    products,
    selectedCategories,
    selectedBrands,
    selectedVendorFilter,
    selectedSkinTypes,
    selectedBenefits,
    benefitMatchMode,
    selectedIngredients,
    ingredientMatchMode,
    selectedPriceRanges,
    searchQuery,
  ]);

  const handleAddToCart = (incoming: CartItem) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.sku === incoming.sku);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + incoming.quantity };
        return copy;
      }
      return [...prev, incoming];
    });
    showToast(`Đã thêm "${incoming.product.name}" vào giỏ hàng.`);
  };

  const handleAuthSuccess = (authedUser: User, newToken: string) => {
    setUser(authedUser);
    setToken(newToken);
    if (authedUser.role === 'admin') {
      setView('admin-portal');
    } else if (authedUser.role === 'vendor') {
      setView('vendor-portal');
    } else {
      setView('storefront');
    }
    showToast(`Đăng nhập thành công (${authedUser.name}).`);
  };

  const handlePartnerNav = () => {
    if (!user) {
      setAuthModal({ open: true, tab: 'login' });
      return;
    }
    if (user.role === 'admin') {
      setView('admin-portal');
    } else if (user.role === 'vendor') {
      setView('vendor-portal');
    } else {
      setView('account');
      showToast('Bạn có thể đăng ký mở gian hàng trong mục Hồ sơ & Tài khoản.');
    }
  };

  const handleAdminPortalEntry = () => {
    if (!user) {
      setAuthModal({ open: true, tab: 'login' });
      showToast('Vui lòng đăng nhập bằng tài khoản có vai trò Quản trị sàn.');
      return;
    }
    if (user.role === 'admin') {
      setView('admin-portal');
      return;
    }
    showToast('Tài khoản thường không có chức năng quản trị sàn.');
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST', token });
    } catch {
      // Ignore network error during logout cleanup
    }
    setUser(null);
    setToken(null);
    setView('storefront');
    showToast('Đã đăng xuất.');
  };

  const totalCartItems = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen flex flex-col bg-[#F1F3F6] text-[#090D16]">
      {/* Top Bar Contract: Strictly 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-[#F1F3F6]/95 backdrop-blur-md border-b border-[#090D16]">
        <div className="max-w-[1440px] mx-auto px-6 py-4 flex items-center justify-between gap-8">
          {/* Zone 1: Single-element Brand Wordmark */}
          <button
            type="button"
            onClick={() => {
              setView('storefront');
              setSelectedVendorFilter('all');
            }}
            className="font-editorial text-2xl font-semibold tracking-tight text-[#090D16] whitespace-nowrap shrink-0"
          >
            VÉRA BEAUTY
          </button>

          {/* Zone 2: 5 concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-600">
            <button
              type="button"
              onClick={() => setView('storefront')}
              className={`hover:text-[#090D16] transition-colors whitespace-nowrap shrink-0 ${
                view === 'storefront'
                  ? 'text-[#090D16] underline underline-offset-8 decoration-2 decoration-[#C81E3A]'
                  : ''
              }`}
            >
              Sản phẩm
            </button>
            <button
              type="button"
              onClick={() => setView('vendors')}
              className={`hover:text-[#090D16] transition-colors whitespace-nowrap shrink-0 ${
                view === 'vendors'
                  ? 'text-[#090D16] underline underline-offset-8 decoration-2 decoration-[#C81E3A]'
                  : ''
              }`}
            >
              Gian hàng
            </button>
            <button
              type="button"
              onClick={() => {
                if (!user) {
                  setAuthModal({ open: true, tab: 'login' });
                } else {
                  setView('account');
                }
              }}
              className={`hover:text-[#090D16] transition-colors whitespace-nowrap shrink-0 ${
                view === 'account'
                  ? 'text-[#090D16] underline underline-offset-8 decoration-2 decoration-[#C81E3A]'
                  : ''
              }`}
            >
              Đơn hàng
            </button>
            <button
              type="button"
              onClick={handlePartnerNav}
              className={`hover:text-[#090D16] transition-colors whitespace-nowrap shrink-0 ${
                view === 'vendor-portal' || view === 'admin-portal'
                  ? 'text-[#090D16] underline underline-offset-8 decoration-2 decoration-[#C81E3A]'
                  : ''
              }`}
            >
              {user?.role === 'admin'
                ? 'Quản trị sàn'
                : user?.role === 'vendor'
                  ? 'Kênh người bán'
                  : 'Kênh đối tác'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (user) {
                  setView('account');
                } else {
                  setAuthModal({ open: true, tab: 'login' });
                }
              }}
              className="hover:text-[#090D16] transition-colors whitespace-nowrap shrink-0 max-w-[14ch] truncate"
            >
              {user ? user.name : 'Đăng nhập'}
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#090D16] hover:bg-[#C81E3A] text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 tabular-nums"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Giỏ hàng ({totalCartItems})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Subtle Toast Banner */}
      {toast && (
        <div className="bg-[#090D16] text-white border-b border-zinc-800">
          <div className="max-w-[1440px] mx-auto px-6 py-2.5 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-[#C81E3A]" />
              {toast}
            </span>
            <button
              type="button"
              onClick={() => setToast('')}
              className="text-zinc-400 hover:text-white"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Main Content Router */}
      <div className="flex-1">
        {restoringSession &&
          (view === 'vendor-portal' || view === 'admin-portal' || view === 'account') && (
            <div className="max-w-[1440px] mx-auto px-6 py-20 text-center text-sm text-zinc-500">
              Đang khôi phục phiên đăng nhập...
            </div>
          )}

        {view === 'vendor-portal' && user?.role === 'vendor' && token && (
          <VendorPortal token={token} />
        )}

        {view === 'admin-portal' && user?.role === 'admin' && token && (
          <AdminPortal token={token} />
        )}

        {view === 'account' && user && token && (
          <CustomerAccountView
            user={user}
            token={token}
            onUserUpdated={(updatedUser, newTok) => {
              setUser(updatedUser);
              if (newTok) setToken(newTok);
            }}
            onOpenVendorPortal={() => setView('vendor-portal')}
          />
        )}

        {view === 'vendors' && (
          <section className="max-w-[1440px] mx-auto px-6 py-12 space-y-8">
            <div className="border-b border-[#090D16] pb-6 space-y-2">
              <p className="text-xs font-mono uppercase tracking-widest text-[#C81E3A]">
                Đối tác kiểm duyệt
              </p>
              <h1 className="font-editorial text-4xl font-semibold text-[#090D16]">
                Gian hàng chính hãng trên Véra Beauty
              </h1>
              <p className="text-sm text-zinc-600 max-w-2xl">
                Mỗi gian hàng đều phải trải qua bước xác minh hồ sơ pháp lý và tuân thủ quản lý tồn kho theo từng lô sản xuất.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 border border-[#090D16] bg-white divide-y md:divide-y-0 md:divide-x divide-[#CFD4DC]">
              {vendors.map((v, idx) => (
                <motion.div
                  key={v.id}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.12 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: idx * 0.06 }}
                  className="p-8 flex flex-col sm:flex-row gap-6 items-start"
                >
                  <div className="w-28 h-28 overflow-hidden border border-[#CFD4DC] shrink-0">
                    <ResilientImage
                      src={v.logoUrl}
                      alt={v.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-editorial text-2xl font-semibold text-[#090D16]">
                        {v.name}
                      </h2>
                      <span className="text-xs uppercase font-mono text-[#C81E3A] font-semibold">
                        {v.tier}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 leading-relaxed">{v.description}</p>
                    <div className="text-xs text-zinc-500 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[#090D16] font-medium tabular-nums">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        {v.rating}/5 ({v.reviewCount})
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{v.address}</span>
                    </div>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedVendorFilter(v.id);
                          setView('storefront');
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#090D16] hover:bg-[#C81E3A] text-white text-xs font-medium transition-colors"
                      >
                        <span>Xem sản phẩm của shop</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {view === 'storefront' && (
          <>
            {/* SECTION 1: FULL-BLEED ARCHITECTURAL SPLIT STAGE (Interactive Specimen Spotlight) */}
            <section className="border-b border-[#090D16]">
              <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-12 items-stretch">
                {/* Left 5 cols: Midnight Editorial Manifesto + Interactive Specimen Switcher */}
                <div className="lg:col-span-5 bg-[#090D16] text-white p-8 md:p-12 flex flex-col justify-between gap-10 border-b lg:border-b-0 lg:border-r border-[#090D16]">
                  <div className="space-y-5">
                    <div className="flex items-center justify-between text-xs font-mono text-zinc-400 border-b border-zinc-800 pb-3">
                      <span>Hồ sơ lưu trữ mỹ phẩm · 2026</span>
                      <span className="text-[#C81E3A] font-medium">Chuẩn xuất kho FEFO</span>
                    </div>

                    <h1
                      className="font-editorial font-medium text-white leading-[1.06]"
                      style={{ fontSize: 'clamp(2.35rem, 3.8vw, 3.6rem)' }}
                    >
                      Đẹp từ{' '}
                      <em className="italic font-normal text-zinc-300">sự minh bạch</em>{' '}
                      của từng lô sản xuất
                    </h1>

                    <p className="text-sm text-zinc-300 leading-relaxed max-w-md">
                      Tra cứu trực tiếp mã lô, ngày sản xuất, hạn sử dụng và phiếu công bố trước khi đặt mua từ nhiều gian hàng được kiểm duyệt.
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <a
                        href="#catalog-workspace"
                        onClick={(e) => {
                          e.preventDefault();
                          document
                            .getElementById('catalog-workspace')
                            ?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="inline-flex items-center gap-2 px-5 py-3 bg-[#C81E3A] hover:bg-[#A61730] text-white text-xs font-medium tracking-wide transition-colors whitespace-nowrap"
                      >
                        <span>Tra cứu danh mục</span>
                        <ArrowRight className="w-4 h-4" />
                      </a>
                      {!user && (
                        <button
                          type="button"
                          onClick={() => setAuthModal({ open: true, tab: 'register' })}
                          className="px-5 py-3 border border-zinc-700 hover:border-white text-xs font-medium text-white transition-colors whitespace-nowrap"
                        >
                          Đăng ký mở gian hàng
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Interactive Spotlight Selector inside Hero */}
                  {spotlightProducts.length > 0 && (
                    <div className="space-y-3 pt-6 border-t border-zinc-800">
                      <span className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                        Tiêu điểm minh bạch lô hàng
                      </span>
                      <div className="divide-y divide-zinc-800 border-y border-zinc-800">
                        {spotlightProducts.map((sp, idx) => {
                          const isActive = idx === spotlightIndex;
                          return (
                            <button
                              key={sp.id}
                              type="button"
                              onClick={() => setSpotlightIndex(idx)}
                              className={`w-full py-2.5 px-2 flex items-center justify-between gap-3 text-left text-xs transition-colors ${
                                isActive ? 'text-white bg-white/5' : 'text-zinc-400 hover:text-white'
                              }`}
                            >
                              <span className="flex items-center gap-3 min-w-0">
                                <span className="font-mono text-[#C81E3A] shrink-0">
                                  0{idx + 1}
                                </span>
                                <span className="font-medium truncate">{sp.name}</span>
                              </span>
                              <span className="font-mono text-[11px] text-zinc-400 shrink-0">
                                {sp.activeBatch?.batchCode ?? '—'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right 7 cols: Full-Bleed Specimen Photography + Live Archival Batch Spec Bar */}
                <div className="lg:col-span-7 flex flex-col justify-between bg-white">
                  <div className="relative flex-1 min-h-[300px] lg:min-h-[420px] overflow-hidden bg-[#E5E8EE]">
                    <ResilientImage
                      src={
                        activeSpotlight
                          ? activeSpotlight.images[0]
                          : '/src/assets/images/hero_cosmetics_editorial_1795521823557.jpg'
                      }
                      alt={activeSpotlight?.name ?? 'Mỹ phẩm chính hãng Véra Beauty'}
                      className="w-full h-full object-cover transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#090D16]/70 via-transparent to-transparent pointer-events-none" />
                    {activeSpotlight && (
                      <div className="absolute bottom-5 left-6 right-6 flex flex-wrap items-end justify-between gap-4 text-white">
                        <div>
                          <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-300">
                            {activeSpotlight.brandName} · {activeSpotlight.originCountry}
                          </p>
                          <p className="font-editorial text-2xl font-medium">
                            {activeSpotlight.name}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedProductId(activeSpotlight.id)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-[#090D16] hover:bg-[#C81E3A] hover:text-white text-xs font-medium transition-colors whitespace-nowrap"
                        >
                          <span>Mở hồ sơ lô</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Archival Spec Sheet Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#CFD4DC] border-t border-[#090D16] bg-white text-xs">
                    <div className="p-4">
                      <span className="block font-mono text-[11px] text-zinc-500">Mã lô FEFO</span>
                      <span className="font-mono font-semibold text-[#090D16]">
                        {activeSpotlight?.activeBatch?.batchCode ?? 'LOT-2026-001'}
                      </span>
                    </div>
                    <div className="p-4">
                      <span className="block font-mono text-[11px] text-zinc-500">Hạn sử dụng</span>
                      <span className="font-mono font-semibold text-[#090D16] tabular-nums">
                        {activeSpotlight?.activeBatch
                          ? formatDateVi(activeSpotlight.activeBatch.expiryDate)
                          : '01/08/2028'}
                      </span>
                    </div>
                    <div className="p-4">
                      <span className="block font-mono text-[11px] text-zinc-500">Chứng từ duyệt</span>
                      <span className="font-mono font-semibold text-[#090D16] tabular-nums">
                        {activeSpotlight?.approvedDocuments.length ?? 2} hồ sơ hợp lệ
                      </span>
                    </div>
                    <div className="p-4">
                      <span className="block font-mono text-[11px] text-zinc-500">Gian hàng</span>
                      <span className="font-semibold text-[#090D16] truncate block">
                        {activeSpotlight?.vendorName ?? 'Véra Official Atelier'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 2: ARCHITECTURAL SPLIT WORKSPACE (Sticky Left Filter Rail + Dual-Mode Catalog) */}
            <section id="catalog-workspace" className="border-b border-[#090D16] bg-[#F1F3F6]">
              <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-12 items-start">
                {/* Left Sticky Architectural Filter Rail */}
                <aside className="lg:col-span-3 lg:sticky lg:top-[65px] lg:max-h-[calc(100vh-65px)] lg:overflow-y-auto bg-white border-b lg:border-b-0 lg:border-r border-[#090D16] p-6 space-y-5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="block font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                        Tìm kiếm nhanh
                      </label>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={resetAllFilters}
                          className="text-[11px] font-mono text-[#C81E3A] hover:underline underline-offset-2"
                        >
                          Đặt lại tất cả
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tên SP, hãng, hoạt chất..."
                        className="w-full pl-9 pr-3 py-2 text-xs border border-[#CFD4DC] bg-[#F1F3F6] focus:bg-white focus:outline-none focus:border-[#090D16]"
                      />
                    </div>
                  </div>

                  {/* Multi-Select Filter Groups */}
                  <div className="space-y-4">
                    <MultiSelectFilterGroup
                      label="Danh mục"
                      defaultOpen={true}
                      options={categories.map((cat) => ({
                        value: cat.slug,
                        label: cat.name,
                        count: products.filter((p) => p.categorySlug === cat.slug).length,
                      }))}
                      selected={selectedCategories}
                      onToggle={(val) => toggleFilterValue(setSelectedCategories, val)}
                      onClear={() => setSelectedCategories([])}
                    />

                    <MultiSelectFilterGroup
                      label="Công dụng"
                      defaultOpen={true}
                      searchable={true}
                      searchPlaceholder="Tìm công dụng..."
                      options={uniqueBenefits}
                      selected={selectedBenefits}
                      onToggle={(val) => toggleFilterValue(setSelectedBenefits, val)}
                      onClear={() => setSelectedBenefits([])}
                      matchMode={benefitMatchMode}
                      onMatchModeChange={setBenefitMatchMode}
                    />

                    <MultiSelectFilterGroup
                      label="Thành phần hoạt chất"
                      defaultOpen={true}
                      searchable={true}
                      searchPlaceholder="Tìm hoạt chất..."
                      options={uniqueIngredients}
                      selected={selectedIngredients}
                      onToggle={(val) => toggleFilterValue(setSelectedIngredients, val)}
                      onClear={() => setSelectedIngredients([])}
                      matchMode={ingredientMatchMode}
                      onMatchModeChange={setIngredientMatchMode}
                    />

                    <MultiSelectFilterGroup
                      label="Loại da phù hợp"
                      defaultOpen={false}
                      options={skinTypeOptions}
                      selected={selectedSkinTypes}
                      onToggle={(val) => toggleFilterValue(setSelectedSkinTypes, val)}
                      onClear={() => setSelectedSkinTypes([])}
                    />

                    <MultiSelectFilterGroup
                      label="Thương hiệu"
                      defaultOpen={false}
                      searchable={true}
                      searchPlaceholder="Tìm thương hiệu..."
                      options={brands.map((b) => ({
                        value: b.id,
                        label: b.name,
                        count: products.filter((p) => p.brandId === b.id).length,
                      }))}
                      selected={selectedBrands}
                      onToggle={(val) => toggleFilterValue(setSelectedBrands, val)}
                      onClear={() => setSelectedBrands([])}
                    />

                    <MultiSelectFilterGroup
                      label="Khoảng giá"
                      defaultOpen={false}
                      options={priceRangeOptions}
                      selected={selectedPriceRanges}
                      onToggle={(val) => toggleFilterValue(setSelectedPriceRanges, val)}
                      onClear={() => setSelectedPriceRanges([])}
                    />

                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="w-full py-2 text-xs border border-[#090D16] text-[#090D16] hover:bg-[#090D16] hover:text-white transition-colors font-medium"
                      >
                        Đặt lại tất cả bộ lọc
                      </button>
                    )}
                  </div>
                </aside>

                {/* Right 9 cols: Header Bar + Active Filter Chips + Dual Mode Specimen Grid / Batch Ledger */}
                <div className="lg:col-span-9 p-6 md:p-8 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#CFD4DC]">
                    <div>
                      <h2 className="font-editorial text-3xl font-semibold text-[#090D16]">
                        Thư viện sản phẩm ({filteredProducts.length})
                      </h2>
                      <p className="text-xs text-zinc-600">
                        {selectedVendorFilter !== 'all'
                          ? 'Đang lọc theo 1 gian hàng đối tác · '
                          : ''}
                        Chọn nhiều thuộc tính cùng lúc để tra cứu chính xác công thức và mã lô FEFO.
                      </p>
                    </div>

                    {/* View Mode & Compare Actions */}
                    <div className="flex flex-wrap items-center gap-3">
                      {compareIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setCompareOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#C81E3A] hover:bg-[#A61730] text-white transition-colors whitespace-nowrap tabular-nums"
                        >
                          <Scale className="w-3.5 h-3.5" />
                          <span>So sánh ({compareIds.length}/3)</span>
                        </button>
                      )}

                      <div className="flex items-center border border-[#090D16] bg-white">
                        <button
                          type="button"
                          onClick={() => setCatalogMode('specimen')}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                            catalogMode === 'specimen'
                              ? 'bg-[#090D16] text-white'
                              : 'text-[#090D16] hover:bg-[#F1F3F6]'
                          }`}
                        >
                          <LayoutGrid className="w-3.5 h-3.5" />
                          <span>Trưng bày</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCatalogMode('ledger')}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border-l border-[#090D16] transition-colors whitespace-nowrap ${
                            catalogMode === 'ledger'
                              ? 'bg-[#090D16] text-white'
                              : 'text-[#090D16] hover:bg-[#F1F3F6]'
                          }`}
                        >
                          <Table2 className="w-3.5 h-3.5" />
                          <span>Bảng tra cứu lô</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {hasActiveFilters && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500 mr-1">
                        Đang lọc:
                      </span>
                      {selectedVendorFilter !== 'all' && (
                        <button
                          type="button"
                          onClick={() => setSelectedVendorFilter('all')}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#090D16] text-[#090D16] hover:border-[#C81E3A] hover:text-[#C81E3A] transition-colors"
                        >
                          <span>
                            Gian hàng:{' '}
                            {vendors.find((v) => v.id === selectedVendorFilter)?.name ??
                              selectedVendorFilter}
                          </span>
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      {selectedCategories.map((slug) => (
                        <button
                          key={`cat-${slug}`}
                          type="button"
                          onClick={() => toggleFilterValue(setSelectedCategories, slug)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#090D16] text-[#090D16] hover:border-[#C81E3A] hover:text-[#C81E3A] transition-colors"
                        >
                          <span>
                            Danh mục:{' '}
                            {categories.find((c) => c.slug === slug)?.name ?? slug}
                          </span>
                          <X className="w-3 h-3" />
                        </button>
                      ))}
                      {selectedBenefits.map((benefit) => (
                        <button
                          key={`ben-${benefit}`}
                          type="button"
                          onClick={() => toggleFilterValue(setSelectedBenefits, benefit)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#C81E3A] text-[#090D16] hover:text-[#C81E3A] transition-colors"
                        >
                          <span>Công dụng: {benefit}</span>
                          <X className="w-3 h-3" />
                        </button>
                      ))}
                      {selectedIngredients.map((ing) => (
                        <button
                          key={`ing-${ing}`}
                          type="button"
                          onClick={() => toggleFilterValue(setSelectedIngredients, ing)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#C81E3A] text-[#090D16] hover:text-[#C81E3A] transition-colors"
                        >
                          <span>Hoạt chất: {ing}</span>
                          <X className="w-3 h-3" />
                        </button>
                      ))}
                      {selectedSkinTypes.map((st) => (
                        <button
                          key={`skin-${st}`}
                          type="button"
                          onClick={() => toggleFilterValue(setSelectedSkinTypes, st)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#090D16] text-[#090D16] hover:border-[#C81E3A] hover:text-[#C81E3A] transition-colors"
                        >
                          <span>Loại da: {st}</span>
                          <X className="w-3 h-3" />
                        </button>
                      ))}
                      {selectedBrands.map((bId) => (
                        <button
                          key={`brand-${bId}`}
                          type="button"
                          onClick={() => toggleFilterValue(setSelectedBrands, bId)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#090D16] text-[#090D16] hover:border-[#C81E3A] hover:text-[#C81E3A] transition-colors"
                        >
                          <span>
                            Hãng: {brands.find((b) => b.id === bId)?.name ?? bId}
                          </span>
                          <X className="w-3 h-3" />
                        </button>
                      ))}
                      {selectedPriceRanges.map((pr) => (
                        <button
                          key={`price-${pr}`}
                          type="button"
                          onClick={() => toggleFilterValue(setSelectedPriceRanges, pr)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#090D16] text-[#090D16] hover:border-[#C81E3A] hover:text-[#C81E3A] transition-colors"
                        >
                          <span>
                            Giá:{' '}
                            {priceRangeOptions.find((o) => o.value === pr)?.label ?? pr}
                          </span>
                          <X className="w-3 h-3" />
                        </button>
                      ))}
                      {searchQuery.trim() && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#090D16] text-[#090D16] hover:border-[#C81E3A] hover:text-[#C81E3A] transition-colors"
                        >
                          <span>Từ khóa: “{searchQuery.trim()}”</span>
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={resetAllFilters}
                        className="px-2 py-1 font-mono text-[11px] text-[#C81E3A] hover:underline underline-offset-2"
                      >
                        Xóa tất cả
                      </button>
                    </div>
                  )}

                  {loadingCatalog ? (
                    <div className="py-16 text-center text-sm text-zinc-500">
                      Đang tải danh mục sản phẩm và dữ liệu lô hàng...
                    </div>
                  ) : filteredProducts.length === 0 ? (
                    <div className="p-12 text-center bg-white border border-[#CFD4DC]">
                      <p className="text-sm font-medium text-[#090D16]">
                        Không tìm thấy sản phẩm khớp với bộ lọc hiện tại
                      </p>
                    </div>
                  ) : catalogMode === 'specimen' ? (
                    /* MODE A: Sharp Archival Specimen Plates Grid */
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 border-t border-l border-[#CFD4DC] bg-white">
                      {filteredProducts.map((product, index) => {
                        const primaryVariant = product.variants[0];
                        const displayPrice =
                          primaryVariant?.promoPrice ?? primaryVariant?.price ?? 0;
                        const plateNo = String(index + 1).padStart(2, '0');
                        return (
                          <motion.article
                            key={product.id}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, amount: 0.1 }}
                            transition={{
                              duration: 0.38,
                              ease: [0.16, 1, 0.3, 1],
                              delay: Math.min((index % 3) * 0.06, 0.18),
                            }}
                            className="group border-r border-b border-[#CFD4DC] flex flex-col justify-between bg-white hover:bg-[#FAFBFD] transition-colors"
                          >
                            <div>
                              {/* Top Archival Plate Bar */}
                              <div className="px-5 py-3 border-b border-[#CFD4DC] flex items-center justify-between gap-2 text-[11px] font-mono text-zinc-500">
                                <span>
                                  N° {plateNo} · {product.categoryName.toUpperCase()}
                                </span>
                                <span className={product.isSponsored ? 'text-[#C81E3A] font-semibold' : ''}>
                                  {product.isSponsored ? 'NỔI BẬT' : product.originCountry}
                                </span>
                              </div>

                              {/* 4:3 Specimen Image */}
                              <button
                                type="button"
                                onClick={() => setSelectedProductId(product.id)}
                                className="aspect-[4/3] w-full bg-[#F1F3F6] overflow-hidden block border-b border-[#CFD4DC]"
                              >
                                <ResilientImage
                                  src={product.images[0]}
                                  alt={product.name}
                                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                />
                              </button>

                              <div className="p-5 space-y-2">
                                <div className="text-xs font-mono text-zinc-500 flex items-center justify-between gap-2">
                                  <span className="truncate">{product.brandName}</span>
                                  <span className="tabular-nums text-[#090D16]">
                                    {product.ratingAvg > 0 ? `${product.ratingAvg}/5` : 'Mới'}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setSelectedProductId(product.id)}
                                  className="text-left block"
                                >
                                  <h3 className="font-editorial text-xl font-medium text-[#090D16] leading-snug group-hover:text-[#C81E3A] transition-colors">
                                    {product.name}
                                  </h3>
                                </button>

                                <p className="text-xs text-zinc-500 truncate">
                                  {product.vendorName}
                                </p>
                              </div>
                            </div>

                            {/* Bottom Batch Telemetry & Purchase Action */}
                            <div className="px-5 pb-5 pt-3 border-t border-[#CFD4DC] space-y-3">
                              <div className="text-[11px] font-mono">
                                {product.activeBatch ? (
                                  <div
                                    className={`flex items-center gap-1.5 ${
                                      product.isExpiringSoon ? 'text-amber-700' : 'text-[#090D16]'
                                    }`}
                                  >
                                    {product.isExpiringSoon && (
                                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                    )}
                                    <span className="truncate">
                                      Lô {product.activeBatch.batchCode} · HSD{' '}
                                      {formatDateVi(product.activeBatch.expiryDate)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-red-700">Chưa có lô khả dụng</span>
                                )}
                              </div>

                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <span className="font-mono text-[15px] font-semibold text-[#090D16] tabular-nums">
                                    {formatVnd(displayPrice)}
                                  </span>
                                  {primaryVariant?.promoPrice && (
                                    <span className="ml-2 font-mono text-xs text-zinc-400 line-through tabular-nums">
                                      {formatVnd(primaryVariant.price)}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => toggleCompareProduct(product.id)}
                                    title={
                                      compareIds.includes(product.id)
                                        ? 'Bỏ khỏi bảng so sánh'
                                        : 'Thêm vào bảng so sánh (tối đa 3)'
                                    }
                                    className={`inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium border transition-colors whitespace-nowrap ${
                                      compareIds.includes(product.id)
                                        ? 'border-[#C81E3A] bg-[#C81E3A]/10 text-[#C81E3A]'
                                        : 'border-[#CFD4DC] bg-white text-[#090D16] hover:border-[#090D16]'
                                    }`}
                                  >
                                    {compareIds.includes(product.id) ? (
                                      <Check className="w-3.5 h-3.5" />
                                    ) : (
                                      <Scale className="w-3.5 h-3.5" />
                                    )}
                                    <span>
                                      {compareIds.includes(product.id) ? 'Đã chọn' : 'So sánh'}
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setSelectedProductId(product.id)}
                                    className="px-3 py-2 text-xs font-medium bg-[#090D16] hover:bg-[#C81E3A] text-white transition-colors whitespace-nowrap"
                                  >
                                    Xem lô
                                  </button>
                                </div>
                              </div>
                            </div>
                          </motion.article>
                        );
                      })}
                    </div>
                  ) : (
                    /* MODE B: Laboratory Batch Traceability Ledger Matrix */
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.1 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="bg-white border border-[#090D16] overflow-x-auto"
                    >
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#090D16] text-white font-mono">
                          <tr>
                            <th className="py-3 px-4 font-medium">Sản phẩm & Hãng</th>
                            <th className="py-3 px-4 font-medium">Xuất xứ</th>
                            <th className="py-3 px-4 font-medium">Mã lô FEFO</th>
                            <th className="py-3 px-4 font-medium">Hạn sử dụng</th>
                            <th className="py-3 px-4 font-medium text-right">Chứng từ</th>
                            <th className="py-3 px-4 font-medium text-right">Giá bán</th>
                            <th className="py-3 px-4 font-medium text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#CFD4DC]">
                          {filteredProducts.map((product) => {
                            const primaryVariant = product.variants[0];
                            const displayPrice =
                              primaryVariant?.promoPrice ?? primaryVariant?.price ?? 0;
                            return (
                              <tr key={product.id} className="hover:bg-[#F1F3F6]">
                                <td className="py-3.5 px-4">
                                  <div className="font-semibold text-[#090D16]">{product.name}</div>
                                  <div className="text-zinc-500">
                                    {product.brandName} · {product.vendorName}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4">{product.originCountry}</td>
                                <td className="py-3.5 px-4 font-mono font-semibold">
                                  {product.activeBatch?.batchCode ?? '—'}
                                </td>
                                <td className="py-3.5 px-4 font-mono tabular-nums">
                                  {product.activeBatch ? (
                                    <span
                                      className={
                                        product.isExpiringSoon ? 'text-amber-700 font-semibold' : ''
                                      }
                                    >
                                      {formatDateVi(product.activeBatch.expiryDate)}
                                    </span>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                                  {product.approvedDocuments.length} duyệt
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums">
                                  {formatVnd(displayPrice)}
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => toggleCompareProduct(product.id)}
                                      className={`px-2.5 py-1.5 text-xs font-medium border transition-colors whitespace-nowrap ${
                                        compareIds.includes(product.id)
                                          ? 'border-[#C81E3A] bg-[#C81E3A]/10 text-[#C81E3A]'
                                          : 'border-[#CFD4DC] bg-white text-[#090D16] hover:border-[#090D16]'
                                      }`}
                                    >
                                      {compareIds.includes(product.id) ? 'Đã chọn' : '+ So sánh'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedProductId(product.id)}
                                      className="px-3 py-1.5 bg-[#090D16] hover:bg-[#C81E3A] text-white font-medium whitespace-nowrap"
                                    >
                                      Kiểm tra lô
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </motion.div>
                  )}
                </div>
              </div>
            </section>

            {/* SECTION 3: CURATED PARTNER HOUSES & GOVERNANCE ACCESS */}
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white border-b border-[#090D16]"
            >
              <div className="max-w-[1440px] mx-auto grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-[#090D16]">
                <div className="md:col-span-7 p-8 md:p-12 space-y-3">
                  <p className="font-mono text-xs uppercase tracking-widest text-[#C81E3A]">
                    Hệ sinh thái vận hành
                  </p>
                  <h2 className="font-editorial text-3xl font-semibold text-[#090D16]">
                    Dành cho Thương hiệu, Nhà phân phối và Quản trị vận hành
                  </h2>
                  <p className="text-sm text-zinc-600 max-w-2xl leading-relaxed">
                    Quản lý tồn kho theo từng lô sản xuất, tự động ưu tiên xuất kho FEFO khi xác nhận đơn hàng, lưu vết điều chỉnh kho và kiểm duyệt chứng từ công bố tập trung.
                  </p>
                </div>
                <div className="md:col-span-5 p-8 md:p-12 flex flex-col justify-center gap-3 bg-[#F1F3F6]">
                  <button
                    type="button"
                    onClick={() => setAuthModal({ open: true, tab: 'register' })}
                    className="w-full py-3 px-5 bg-[#C81E3A] hover:bg-[#A61730] text-white text-xs font-medium transition-colors text-center"
                  >
                    Đăng ký mở gian hàng Nhà bán hàng
                  </button>
                  <button
                    type="button"
                    onClick={handleAdminPortalEntry}
                    className="w-full py-3 px-5 border border-[#090D16] bg-white hover:bg-[#090D16] hover:text-white text-xs font-medium text-[#090D16] transition-colors text-center"
                  >
                    Truy cập Cổng Quản trị viên Sàn
                  </button>
                </div>
              </div>
            </motion.section>
          </>
        )}
      </div>

      {/* Clean Editorial Footer */}
      <footer className="bg-[#090D16] text-zinc-400">
        <div className="max-w-[1440px] mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="space-y-1">
            <span className="font-editorial text-lg font-medium text-white block">
              VÉRA BEAUTY
            </span>
            <span>© 2026 Véra Beauty Marketplace. Nền tảng thương mại mỹ phẩm minh bạch lô hàng.</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <button
              type="button"
              onClick={() => setView('vendors')}
              className="hover:text-white flex items-center gap-1.5"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Đối tác gian hàng</span>
            </button>
            <button
              type="button"
              onClick={handleAdminPortalEntry}
              className="hover:text-white"
            >
              Quản trị viên
            </button>
            {user && (
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1 text-red-400 hover:text-red-300"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Đăng xuất ({user.name})</span>
              </button>
            )}
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {view === 'storefront' && comparedProducts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-4xl bg-[#090D16] text-white border border-zinc-700 shadow-2xl p-3 md:p-4"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="grid grid-cols-3 gap-2 flex-1 min-w-0">
                {[0, 1, 2].map((slotIndex) => {
                  const item = comparedProducts[slotIndex];
                  if (!item) {
                    return (
                      <div
                        key={`empty-slot-${slotIndex}`}
                        className="border border-dashed border-zinc-700 px-3 py-2 flex items-center justify-center text-[11px] font-mono text-zinc-500"
                      >
                        Vị trí 0{slotIndex + 1}
                      </div>
                    );
                  }
                  return (
                    <div
                      key={item.id}
                      className="border border-zinc-700 bg-white/5 px-2.5 py-2 flex items-center gap-2 min-w-0"
                    >
                      <div className="w-8 h-8 shrink-0 overflow-hidden bg-zinc-900 border border-zinc-700">
                        <ResilientImage
                          src={item.images[0]}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-white truncate">{item.name}</p>
                        <p className="text-[10px] font-mono text-zinc-400 truncate">
                          {item.activeBatch?.batchCode ?? 'Chưa có lô'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleCompareProduct(item.id)}
                        className="text-zinc-400 hover:text-white shrink-0"
                        aria-label={`Bỏ ${item.name} khỏi so sánh`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setCompareIds([])}
                  className="px-3 py-2 text-xs font-mono text-zinc-400 hover:text-white border border-zinc-700 transition-colors"
                >
                  Xóa hết
                </button>
                <button
                  type="button"
                  onClick={() => setCompareOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#C81E3A] hover:bg-[#A61730] text-white text-xs font-medium transition-colors whitespace-nowrap tabular-nums"
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>So sánh ngay ({comparedProducts.length}/3)</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ProductDetailModal
        productId={selectedProductId}
        allProducts={products}
        onClose={() => setSelectedProductId(null)}
        onAddToCart={handleAddToCart}
        onSelectVendor={(vendorId) => {
          setSelectedVendorFilter(vendorId);
          setView('storefront');
        }}
        onSelectProduct={(nextId) => setSelectedProductId(nextId)}
        isCompared={Boolean(selectedProductId && compareIds.includes(selectedProductId))}
        onToggleCompare={toggleCompareProduct}
      />

      <ComparisonModal
        open={compareOpen}
        products={comparedProducts}
        onClose={() => setCompareOpen(false)}
        onRemoveProduct={(id) => setCompareIds((prev) => prev.filter((item) => item !== id))}
        onClearAll={() => {
          setCompareIds([]);
          setCompareOpen(false);
        }}
        onOpenProductDetail={(id) => setSelectedProductId(id)}
        onAddToCart={handleAddToCart}
      />

      <CartDrawer
        open={cartOpen}
        items={cart}
        user={user}
        token={token}
        promotions={promotions}
        onClose={() => setCartOpen(false)}
        onUpdateQty={(sku, delta) => {
          setCart((prev) =>
            prev
              .map((i) => (i.sku === sku ? { ...i, quantity: i.quantity + delta } : i))
              .filter((i) => i.quantity > 0)
          );
        }}
        onRemoveItem={(sku) => setCart((prev) => prev.filter((i) => i.sku !== sku))}
        onClearCart={() => setCart([])}
        onRequireLogin={() => {
          setCartOpen(false);
          setAuthModal({ open: true, tab: 'login' });
        }}
        onOrderCreated={(created: Order[]) => {
          showToast(
            `Đặt thành công ${created.length} đơn hàng (${created.map((o) => '#' + o.orderNumber).join(', ')}).`
          );
          setView('account');
          loadCatalog();
        }}
      />

      <AuthModal
        open={authModal.open}
        initialTab={authModal.tab}
        onClose={() => setAuthModal((prev) => ({ ...prev, open: false }))}
        onSuccess={handleAuthSuccess}
      />
    </div>
    </MotionConfig>
  );
}
