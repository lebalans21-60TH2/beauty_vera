import { useState } from 'react';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import { apiFetch, formatVnd } from '../lib/format';
import type { EnrichedProduct, Order, Promotion, User } from '../types/marketplace';
import { ResilientImage } from './ResilientImage';

export interface CartItem {
  product: EnrichedProduct;
  sku: string;
  variantName: string;
  unitPrice: number;
  quantity: number;
}

interface CartDrawerProps {
  open: boolean;
  items: CartItem[];
  user: User | null;
  token: string | null;
  promotions: Promotion[];
  onClose: () => void;
  onUpdateQty: (sku: string, delta: number) => void;
  onRemoveItem: (sku: string) => void;
  onClearCart: () => void;
  onRequireLogin: () => void;
  onOrderCreated: (orders: Order[]) => void;
}

export function CartDrawer({
  open,
  items,
  user,
  token,
  promotions,
  onClose,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onRequireLogin,
  onOrderCreated,
}: CartDrawerProps) {
  const [customerName, setCustomerName] = useState(user?.name ?? '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone ?? '');
  const [shippingAddress, setShippingAddress] = useState(user?.address ?? '');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'bank_transfer' | 'ewallet'>('cod');
  const [voucherCode, setVoucherCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const matchedPromo = promotions.find(
    (p) => p.code === voucherCode.trim().toUpperCase() && p.active && subtotal >= p.minOrderAmount
  );
  const discount = matchedPromo
    ? matchedPromo.discountType === 'percent'
      ? Math.round((subtotal * matchedPromo.discountValue) / 100)
      : Math.min(subtotal, matchedPromo.discountValue)
    : 0;
  const shippingFee = subtotal - discount >= 500000 || items.length === 0 ? 0 : 30000;
  const total = Math.max(0, subtotal - discount + shippingFee);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !token) {
      onRequireLogin();
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await apiFetch<{ orders: Order[] }>('/api/orders', {
        method: 'POST',
        token,
        body: {
          items: items.map((i) => ({
            productId: i.product.id,
            sku: i.sku,
            quantity: i.quantity,
          })),
          customerName: customerName || user.name,
          customerPhone: customerPhone || user.phone || '0901234567',
          shippingAddress: shippingAddress || user.address || 'TP. Hồ Chí Minh',
          paymentMethod,
          voucherCode: voucherCode.trim().toUpperCase(),
        },
      });
      onClearCart();
      onOrderCreated(res.orders);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đặt hàng thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#090D16]/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Giỏ hàng và thanh toán"
    >
      <div className="w-full max-w-lg bg-white h-full flex flex-col border-l border-[#090D16] shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 bg-[#090D16] text-white">
          <h2 className="font-editorial text-xl font-medium">
            Giỏ hàng ({items.reduce((s, i) => s + i.quantity, 0)})
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
            aria-label="Đóng giỏ hàng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {items.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <p className="text-sm font-medium text-[#090D16]">Giỏ hàng của bạn đang trống</p>
              <p className="text-xs text-zinc-500">
                Khám phá mỹ phẩm chính hãng với thông tin lô sản xuất minh bạch.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {items.map((item) => (
                  <div
                    key={item.sku}
                    className="flex gap-4 pb-4 border-b border-[#CFD4DC]"
                  >
                    <div className="w-20 h-20 overflow-hidden border border-[#CFD4DC] shrink-0 bg-[#F1F3F6]">
                      <ResilientImage
                        src={item.product.images[0]}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-xs text-zinc-500 truncate">{item.product.vendorName}</p>
                      <h3 className="text-sm font-semibold text-[#090D16] truncate">
                        {item.product.name}
                      </h3>
                      <p className="text-xs text-zinc-500">
                        {item.variantName} · <span className="font-mono">{item.sku}</span>
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center border border-[#CFD4DC]">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.sku, -1)}
                            className="p-1.5 text-[#090D16] hover:bg-[#F1F3F6]"
                            aria-label="Giảm số lượng"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2.5 text-xs font-mono font-medium tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.sku, 1)}
                            className="p-1.5 text-[#090D16] hover:bg-[#F1F3F6]"
                            aria-label="Tăng số lượng"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono font-semibold text-[#090D16] tabular-nums">
                            {formatVnd(item.unitPrice * item.quantity)}
                          </span>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.sku)}
                            className="p-1 text-zinc-400 hover:text-[#C81E3A]"
                            aria-label="Xóa sản phẩm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-[#090D16]">
                  Mã khuyến mãi (Voucher)
                </label>
                <input
                  type="text"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value)}
                  placeholder="Nhập VERA10 hoặc ATELIER50K"
                  className="w-full px-3.5 py-2 text-sm border border-[#CFD4DC] focus:outline-none focus:border-[#090D16]"
                />
                {promotions.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {promotions.slice(0, 3).map((pr) => (
                      <button
                        key={pr.id}
                        type="button"
                        onClick={() => setVoucherCode(pr.code)}
                        className="text-[11px] font-mono px-2.5 py-1 border border-[#CFD4DC] text-[#C81E3A] hover:bg-[#F1F3F6] whitespace-nowrap"
                      >
                        {pr.code}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <form id="checkout-form" onSubmit={handleCheckout} className="space-y-3 pt-2">
                <h3 className="text-sm font-semibold text-[#090D16]">Thông tin giao hàng</h3>
                {error && (
                  <div className="p-3 text-xs text-[#C81E3A] bg-red-50 border border-red-200">
                    {error}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Người nhận</label>
                    <input
                      type="text"
                      required
                      value={customerName || user?.name || ''}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Họ và tên"
                      className="w-full px-3 py-2 text-sm border border-[#CFD4DC] focus:outline-none focus:border-[#090D16]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Số điện thoại</label>
                    <input
                      type="tel"
                      required
                      value={customerPhone || user?.phone || ''}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="0901234567"
                      className="w-full px-3 py-2 text-sm border border-[#CFD4DC] focus:outline-none focus:border-[#090D16]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Địa chỉ nhận hàng</label>
                  <input
                    type="text"
                    required
                    value={shippingAddress || user?.address || ''}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    placeholder="Số nhà, đường, quận/huyện, tỉnh/thành"
                    className="w-full px-3 py-2 text-sm border border-[#CFD4DC] focus:outline-none focus:border-[#090D16]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Phương thức thanh toán</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(e.target.value as 'cod' | 'bank_transfer' | 'ewallet')
                    }
                    className="w-full px-3 py-2 text-sm border border-[#CFD4DC] bg-white focus:outline-none focus:border-[#090D16]"
                  >
                    <option value="cod">Thanh toán khi nhận hàng (COD)</option>
                    <option value="bank_transfer">Chuyển khoản ngân hàng (VietQR)</option>
                    <option value="ewallet">Ví điện tử</option>
                  </select>
                </div>
              </form>
            </>
          )}
        </div>

        {items.length > 0 && (
          <div className="p-6 bg-[#F1F3F6] border-t border-[#CFD4DC] space-y-3">
            <div className="space-y-1.5 text-xs text-zinc-600">
              <div className="flex justify-between">
                <span>Tạm tính</span>
                <span className="font-mono tabular-nums text-[#090D16]">{formatVnd(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-[#C81E3A] font-medium">
                  <span>Giảm giá ({matchedPromo?.code})</span>
                  <span className="font-mono tabular-nums">-{formatVnd(discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Phí vận chuyển (Miễn phí từ 500.000 ₫)</span>
                <span className="font-mono tabular-nums text-[#090D16]">
                  {shippingFee === 0 ? 'Miễn phí' : formatVnd(shippingFee)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#CFD4DC] text-base font-semibold text-[#090D16]">
                <span>Tổng thanh toán</span>
                <span className="font-mono tabular-nums">{formatVnd(total)}</span>
              </div>
            </div>

            <button
              type="submit"
              form="checkout-form"
              disabled={submitting}
              className="w-full py-3 px-4 bg-[#C81E3A] hover:bg-[#A61730] text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {!user
                ? 'Đăng nhập để đặt hàng'
                : submitting
                  ? 'Đang tạo đơn hàng...'
                  : 'Xác nhận đặt hàng'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
