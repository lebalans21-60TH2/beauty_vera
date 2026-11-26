import { useEffect, useState } from 'react';
import { Package, Star, Store, User as UserIcon } from 'lucide-react';
import {
  ORDER_STATUS_META,
  apiFetch,
  formatDateTimeVi,
  formatDateVi,
  formatVnd,
} from '../lib/format';
import type { Order, Review, User } from '../types/marketplace';

interface CustomerAccountViewProps {
  user: User;
  token: string;
  onUserUpdated: (user: User, newToken?: string) => void;
  onOpenVendorPortal: () => void;
}

export function CustomerAccountView({
  user,
  token,
  onUserUpdated,
  onOpenVendorPortal,
}: CustomerAccountViewProps) {
  const [tab, setTab] = useState<'orders' | 'profile' | 'open-shop'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [skinType, setSkinType] = useState(user.skinType ?? 'Mọi loại da');
  const [address, setAddress] = useState(user.address ?? '');

  const [reviewTarget, setReviewTarget] = useState<{
    orderId: string;
    productId: string;
    productName: string;
  } | null>(null);
  const [rating, setRating] = useState(5);
  const [shopRating, setShopRating] = useState(5);
  const [comment, setComment] = useState('');

  const [returnOrderId, setReturnOrderId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState('');

  const [shopName, setShopName] = useState('');
  const [shopAddress, setShopAddress] = useState(user.address ?? '');
  const [shopPhone, setShopPhone] = useState(user.phone ?? '');
  const [shopDesc, setShopDesc] = useState('');

  const loadOrders = () => {
    setLoading(true);
    apiFetch<{ orders: Order[]; reviews: Review[] }>('/api/orders/mine', { token })
      .then((res) => {
        setOrders(res.orders);
        setReviews(res.reviews);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Lỗi tải đơn hàng'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();
  }, [token]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice('');
    setError('');
    try {
      const res = await apiFetch<{ user: User }>('/api/auth/profile', {
        method: 'PATCH',
        token,
        body: { name, phone, skinType, address },
      });
      onUserUpdated(res.user);
      setNotice('Đã cập nhật hồ sơ khách hàng.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi cập nhật hồ sơ.');
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    setError('');
    try {
      await apiFetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        token,
        body: { reason: 'Khách hàng thay đổi nhu cầu' },
      });
      setNotice('Đã hủy đơn hàng.');
      loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể hủy đơn.');
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnOrderId) return;
    try {
      await apiFetch(`/api/orders/${returnOrderId}/return-request`, {
        method: 'POST',
        token,
        body: { reason: returnReason },
      });
      setReturnOrderId(null);
      setReturnReason('');
      setNotice('Đã gửi yêu cầu trả hàng đến gian hàng.');
      loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi gửi yêu cầu trả hàng.');
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTarget) return;
    try {
      await apiFetch('/api/reviews', {
        method: 'POST',
        token,
        body: {
          orderId: reviewTarget.orderId,
          productId: reviewTarget.productId,
          rating,
          shopRating,
          comment,
        },
      });
      setReviewTarget(null);
      setComment('');
      setNotice('Cảm ơn bạn đã đánh giá sản phẩm và gian hàng!');
      loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi gửi đánh giá.');
    }
  };

  const handleOpenShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiFetch<{ token: string }>('/api/vendor/register-shop', {
        method: 'POST',
        token,
        body: {
          name: shopName,
          address: shopAddress,
          contactPhone: shopPhone,
          description: shopDesc,
        },
      });
      onUserUpdated({ ...user, role: 'vendor' }, res.token);
      onOpenVendorPortal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đăng ký mở gian hàng.');
    }
  };

  return (
    <section className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-zinc-200">
        <div>
          <p className="text-xs font-medium text-[#C81E3A]">Hồ sơ & Đơn hàng cá nhân</p>
          <h1 className="font-editorial text-3xl font-semibold text-zinc-950">
            Xin chào, {user.name}
          </h1>
        </div>

        <div className="flex items-center gap-1 p-1 bg-zinc-100 rounded-xl">
          <button
            type="button"
            onClick={() => setTab('orders')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              tab === 'orders' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-600'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Đơn hàng của tôi ({orders.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('profile')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              tab === 'profile' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-600'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Hồ sơ da & Địa chỉ</span>
          </button>
          {user.role === 'customer' && (
            <button
              type="button"
              onClick={() => setTab('open-shop')}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                tab === 'open-shop' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-600'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Đăng ký mở shop</span>
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="px-4 py-3 text-xs text-blue-900 bg-blue-50 border border-blue-200 rounded-xl">
          {notice}
        </div>
      )}
      {error && (
        <div className="px-4 py-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl">
          {error}
        </div>
      )}

      {tab === 'orders' && (
        <div className="space-y-4">
          {loading ? (
            <div className="py-12 text-center text-sm text-zinc-500">Đang tải đơn hàng...</div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center bg-white border border-zinc-200 rounded-2xl text-sm text-zinc-500">
              Bạn chưa có đơn hàng nào. Hãy chọn sản phẩm và đặt hàng ngay!
            </div>
          ) : (
            orders.map((order) => {
              const statusMeta = ORDER_STATUS_META[order.status];
              return (
                <div
                  key={order.id}
                  className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-200">
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="font-mono font-semibold text-zinc-950">
                        #{order.orderNumber}
                      </span>
                      <span className="text-zinc-400">·</span>
                      <span className="font-medium text-zinc-950">{order.vendorName}</span>
                      <span className="text-zinc-400">·</span>
                      <span className="text-zinc-500">{formatDateTimeVi(order.createdAt)}</span>
                    </div>
                    <span className={`text-xs font-semibold ${statusMeta.tone}`}>
                      {statusMeta.label}
                    </span>
                  </div>

                  <div className="divide-y divide-zinc-200">
                    {order.items.map((item) => {
                      const alreadyReviewed = reviews.some(
                        (r) => r.orderId === order.id && r.productId === item.productId
                      );
                      return (
                        <div
                          key={item.sku}
                          className="py-3 flex flex-wrap items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-zinc-950">
                              {item.productName}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {item.variantName} · <span className="font-mono">{item.sku}</span> · SL:{' '}
                              <span className="tabular-nums">{item.quantity}</span>
                            </p>
                            {item.batchAllocations.length > 0 && (
                              <p className="text-xs text-[#C81E3A] font-mono">
                                Lô xuất kho (FEFO):{' '}
                                {item.batchAllocations
                                  .map(
                                    (b) =>
                                      `${b.batchCode} (HSD ${formatDateVi(b.expiryDate)} × ${b.quantity})`
                                  )
                                  .join(', ')}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-zinc-950 tabular-nums">
                              {formatVnd(item.unitPrice * item.quantity)}
                            </span>
                            {order.status === 'delivered' && !alreadyReviewed && (
                              <button
                                type="button"
                                onClick={() =>
                                  setReviewTarget({
                                    orderId: order.id,
                                    productId: item.productId,
                                    productName: item.productName,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-[#C81E3A] text-[#C81E3A] rounded-xl hover:bg-blue-50"
                              >
                                <Star className="w-3.5 h-3.5" />
                                <span>Đánh giá</span>
                              </button>
                            )}
                            {alreadyReviewed && (
                              <span className="text-xs text-zinc-500">Đã đánh giá</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-zinc-200">
                    <div className="text-xs text-zinc-500">
                      Giao đến: {order.shippingAddress} · Thanh toán:{' '}
                      {order.paymentMethod === 'cod'
                        ? 'COD'
                        : order.paymentMethod === 'bank_transfer'
                          ? 'Chuyển khoản'
                          : 'Ví điện tử'}
                    </div>
                    <div className="flex items-center gap-3">
                      {order.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleCancelOrder(order.id)}
                          className="px-3 py-1.5 text-xs font-medium text-red-700 border border-red-200 rounded-xl hover:bg-red-50"
                        >
                          Hủy đơn hàng
                        </button>
                      )}
                      {order.status === 'delivered' && (
                        <button
                          type="button"
                          onClick={() => setReturnOrderId(order.id)}
                          className="px-3 py-1.5 text-xs font-medium text-zinc-900 border border-zinc-200 rounded-xl hover:bg-zinc-50"
                        >
                          Yêu cầu trả hàng
                        </button>
                      )}
                      <span className="text-base font-semibold text-zinc-950 tabular-nums">
                        Tổng: {formatVnd(order.totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'profile' && (
        <form
          onSubmit={handleSaveProfile}
          className="max-w-xl bg-white border border-zinc-200 rounded-2xl p-6 space-y-4"
        >
          <h2 className="font-editorial text-2xl font-semibold text-zinc-950">
            Thông tin hồ sơ khách hàng
          </h2>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Họ và tên</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-zinc-200 rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Điện thoại</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-zinc-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Loại da cá nhân</label>
              <select
                value={skinType}
                onChange={(e) => setSkinType(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-zinc-200 rounded-xl bg-white"
              >
                <option value="Mọi loại da">Mọi loại da</option>
                <option value="Da dầu">Da dầu</option>
                <option value="Da khô">Da khô</option>
                <option value="Da hỗn hợp">Da hỗn hợp</option>
                <option value="Da nhạy cảm">Da nhạy cảm</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1">Địa chỉ mặc định</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-zinc-200 rounded-xl"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#C81E3A] hover:bg-blue-800 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Lưu thay đổi
          </button>
        </form>
      )}

      {tab === 'open-shop' && (
        <form
          onSubmit={handleOpenShop}
          className="max-w-xl bg-white border border-zinc-200 rounded-2xl p-6 space-y-4"
        >
          <h2 className="font-editorial text-2xl font-semibold text-zinc-950">
            Đăng ký mở gian hàng đối tác
          </h2>
          <p className="text-xs text-zinc-500">
            Sau khi đăng ký, Quản trị viên sẽ kiểm duyệt thông tin gian hàng trước khi sản phẩm của bạn hiển thị công khai trên sàn.
          </p>
          <div>
            <label className="block text-xs font-medium text-zinc-900 mb-1">Tên gian hàng</label>
            <input
              type="text"
              required
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="VD: Pure Derm Official"
              className="w-full px-3.5 py-2 text-sm border border-zinc-200 rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-900 mb-1">Số điện thoại shop</label>
              <input
                type="tel"
                required
                value={shopPhone}
                onChange={(e) => setShopPhone(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-zinc-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-900 mb-1">Địa chỉ kho / cửa hàng</label>
              <input
                type="text"
                required
                value={shopAddress}
                onChange={(e) => setShopAddress(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-zinc-200 rounded-xl"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-900 mb-1">Mô tả giới thiệu</label>
            <textarea
              rows={3}
              value={shopDesc}
              onChange={(e) => setShopDesc(e.target.value)}
              placeholder="Giới thiệu nguồn hàng, thương hiệu phân phối và cam kết minh bạch..."
              className="w-full px-3.5 py-2 text-sm border border-zinc-200 rounded-xl"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#C81E3A] hover:bg-blue-800 text-white text-sm font-medium rounded-xl transition-colors"
          >
            Gửi hồ sơ mở gian hàng
          </button>
        </form>
      )}

      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleReviewSubmit}
            className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl p-6 space-y-4"
          >
            <h3 className="font-editorial text-2xl font-semibold text-zinc-950">
              Đánh giá sản phẩm & gian hàng
            </h3>
            <p className="text-xs text-zinc-500">{reviewTarget.productName}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Chất lượng sản phẩm</label>
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-white"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} sao
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Dịch vụ gian hàng</label>
                <select
                  value={shopRating}
                  onChange={(e) => setShopRating(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl bg-white"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} sao
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Nhận xét chi tiết</label>
              <textarea
                rows={3}
                required
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Chia sẻ trải nghiệm thực tế về sản phẩm và mã lô nhận được..."
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewTarget(null)}
                className="px-4 py-2 text-xs border border-zinc-200 rounded-xl"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs bg-[#1D4ED8] text-white rounded-xl"
              >
                Gửi đánh giá
              </button>
            </div>
          </form>
        </div>
      )}

      {returnOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleReturnSubmit}
            className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl p-6 space-y-4"
          >
            <h3 className="font-editorial text-2xl font-semibold text-zinc-950">
              Yêu cầu hoàn trả hàng
            </h3>
            <div>
              <label className="block text-xs font-medium mb-1">Lý do hoàn trả</label>
              <textarea
                rows={3}
                required
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="VD: Sản phẩm bị móp vỏ, sai dung tích hoặc kích ứng..."
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReturnOrderId(null)}
                className="px-4 py-2 text-xs border border-zinc-200 rounded-xl"
              >
                Đóng
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs bg-[#1D4ED8] text-white rounded-xl"
              >
                Gửi yêu cầu
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
