import { useEffect, useState } from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../lib/format';
import type { User } from '../types/marketplace';

interface AuthModalProps {
  open: boolean;
  initialTab?: 'login' | 'register';
  onClose: () => void;
  onSuccess: (user: User, token: string) => void;
}

export function AuthModal({
  open,
  initialTab = 'login',
  onClose,
  onSuccess,
}: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'register'>(initialTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [skinType, setSkinType] = useState('Da hỗn hợp');
  const [address, setAddress] = useState('');
  const [openShop, setOpenShop] = useState(false);
  const [shopName, setShopName] = useState('');

  // First-run admin initialization (shown only if no admin account exists yet)
  const [requiresAdminClaim, setRequiresAdminClaim] = useState(false);
  const [showAdminSetup, setShowAdminSetup] = useState(false);
  const [adminSetupName, setAdminSetupName] = useState('Quản trị viên Sàn');
  const [adminSetupEmail, setAdminSetupEmail] = useState('admin@verabeauty.vn');
  const [adminSetupPassword, setAdminSetupPassword] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTab(initialTab);
    setError('');
    setShowAdminSetup(false);
  }, [initialTab, open]);

  useEffect(() => {
    if (open && tab === 'login') {
      apiFetch<{ requiresInitialClaim: boolean; defaultAdminEmail?: string }>('/api/auth/admin/status')
        .then((res) => {
          setRequiresAdminClaim(res.requiresInitialClaim);
          if (res.defaultAdminEmail) {
            setAdminSetupEmail(res.defaultAdminEmail);
          }
        })
        .catch(() => setRequiresAdminClaim(false));
    }
  }, [open, tab]);

  if (!open) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ user: User; token: string }>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      onSuccess(res.user, res.token);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ user: User; token: string }>('/api/auth/register', {
        method: 'POST',
        body: { name, email, password, phone, skinType, address, openShop, shopName },
      });
      onSuccess(res.user, res.token);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng ký thất bại.');
    } finally {
      setLoading(false);
    }
  };

  const handleInitialAdminClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ user: User; token: string }>('/api/auth/admin/claim', {
        method: 'POST',
        body: {
          name: adminSetupName,
          email: adminSetupEmail,
          password: adminSetupPassword,
        },
      });
      onSuccess(res.user, res.token);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Khởi tạo Quản trị viên thất bại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#090D16]/75 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Đăng nhập tài khoản"
    >
      <div className="w-full max-w-md bg-white border border-[#090D16] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[#090D16] text-white">
          <h2 className="font-editorial text-xl font-medium">
            Tài khoản Véra Beauty
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white transition-colors"
            aria-label="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 border border-[#CFD4DC] bg-[#F1F3F6]">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setError('');
              }}
              className={`py-2 text-xs font-medium transition-colors whitespace-nowrap ${tab === 'login' ? 'bg-[#090D16] text-white' : 'text-zinc-600 hover:text-[#090D16]'
                }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('register');
                setError('');
              }}
              className={`py-2 text-xs font-medium transition-colors whitespace-nowrap border-l border-[#CFD4DC] ${tab === 'register' ? 'bg-[#090D16] text-white' : 'text-zinc-600 hover:text-[#090D16]'
                }`}
            >
              Đăng ký
            </button>
          </div>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="mb-4 px-3 py-2.5 text-xs text-[#C81E3A] bg-red-50 border border-red-200">
              {error}
            </div>
          )}

          {tab === 'login' && !showAdminSetup && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#090D16] mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ten@verabeauty.vn"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#CFD4DC] focus:outline-none focus:border-[#090D16]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#090D16] mb-1">Mật khẩu</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#CFD4DC] focus:outline-none focus:border-[#090D16]"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[#C81E3A] hover:bg-[#A61730] text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                {loading ? 'Đang xử lý...' : 'Đăng nhập'}
              </button>

              {/* <p className="text-[11px] text-zinc-500 leading-relaxed">
                Đăng nhập chung bằng Email và Mật khẩu. Quyền Quản trị sàn sẽ tự động kích hoạt đối với tài khoản có vai trò Quản trị viên.
              </p> */}

              {/* <div className="pt-4 border-t border-[#CFD4DC] space-y-2">
                <p className="text-xs text-zinc-500">Điền nhanh tài khoản trải nghiệm:</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('khachhang@verabeauty.vn');
                      setPassword('Customer123!');
                    }}
                    className="py-2 px-3 text-xs border border-[#CFD4DC] text-[#090D16] hover:bg-[#F1F3F6] transition-colors whitespace-nowrap"
                  >
                    Khách hàng mẫu
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('shop.atelier@verabeauty.vn');
                      setPassword('Vendor123!');
                    }}
                    className="py-2 px-3 text-xs border border-[#CFD4DC] text-[#090D16] hover:bg-[#F1F3F6] transition-colors whitespace-nowrap"
                  >
                    Nhà bán hàng mẫu
                  </button>
                </div>
              </div> */}

              {requiresAdminClaim && (
                <div className="pt-3 border-t border-dashed border-[#CFD4DC]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminSetup(true);
                      setError('');
                    }}
                    className="w-full py-2 px-3 text-xs font-medium text-[#090D16] bg-[#F1F3F6] hover:bg-zinc-200 border border-[#CFD4DC] flex items-center justify-center gap-2 transition-colors"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[#C81E3A]" />
                    <span>Khởi tạo tài khoản Quản trị sàn lần đầu</span>
                  </button>
                </div>
              )}
            </form>
          )}

          {tab === 'login' && showAdminSetup && (
            <form onSubmit={handleInitialAdminClaim} className="space-y-4">
              <div className="p-3.5 bg-[#F1F3F6] border border-[#CFD4DC] text-xs text-zinc-600 space-y-1">
                <div className="flex items-center gap-2 font-medium text-[#090D16]">
                  <ShieldCheck className="w-4 h-4 text-[#C81E3A]" />
                  <span>Thiết lập tài khoản Quản trị sàn lần đầu</span>
                </div>
                <p>
                  Sau khi khởi tạo, bạn đăng nhập Quản trị sàn bằng Email và Mật khẩu giống như tài khoản khách hàng thông thường.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#090D16] mb-1">Tên hiển thị</label>
                <input
                  type="text"
                  required
                  value={adminSetupName}
                  onChange={(e) => setAdminSetupName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#CFD4DC] focus:outline-none focus:border-[#090D16]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#090D16] mb-1">Email Quản trị viên</label>
                <input
                  type="email"
                  required
                  value={adminSetupEmail}
                  onChange={(e) => setAdminSetupEmail(e.target.value)}
                  placeholder="admin@verabeauty.vn"
                  className="w-full px-3.5 py-2 text-sm border border-[#CFD4DC] focus:outline-none focus:border-[#090D16]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#090D16] mb-1">Mật khẩu Quản trị viên</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={adminSetupPassword}
                  onChange={(e) => setAdminSetupPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full px-3.5 py-2 text-sm border border-[#CFD4DC] focus:outline-none focus:border-[#090D16]"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminSetup(false);
                    setError('');
                  }}
                  className="px-4 py-2.5 text-xs font-medium border border-[#CFD4DC] text-[#090D16] hover:bg-[#F1F3F6]"
                >
                  Quay lại
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 bg-[#090D16] hover:bg-black text-white text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {loading ? 'Đang khởi tạo...' : 'Tạo tài khoản Quản trị'}
                </button>
              </div>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-[#090D16] mb-1">Họ và tên</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nguyễn Thảo My"
                  className="w-full px-3 py-2 text-sm border border-[#CFD4DC] focus:outline-none focus:border-[#090D16]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#090D16] mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@domain.vn"
                    className="w-full px-3 py-2 text-sm border border-[#CFD4DC] focus:outline-none focus:border-[#090D16]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#090D16] mb-1">Điện thoại</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0901234567"
                    className="w-full px-3 py-2 text-sm border border-[#CFD4DC] focus:outline-none focus:border-[#090D16]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#090D16] mb-1">Mật khẩu</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full px-3 py-2 text-sm border border-[#CFD4DC] focus:outline-none focus:border-[#090D16]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#090D16] mb-1">Loại da</label>
                  <select
                    value={skinType}
                    onChange={(e) => setSkinType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#CFD4DC] bg-white focus:outline-none focus:border-[#090D16]"
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
                <label className="block text-xs font-medium text-[#090D16] mb-1">Địa chỉ nhận hàng</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Số nhà, đường, quận/huyện, tỉnh/thành"
                  className="w-full px-3 py-2 text-sm border border-[#CFD4DC] focus:outline-none focus:border-[#090D16]"
                />
              </div>

              <label className="flex items-center gap-2.5 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={openShop}
                  onChange={(e) => setOpenShop(e.target.checked)}
                  className="border-[#CFD4DC] text-[#C81E3A] focus:ring-[#C81E3A]"
                />
                <span className="text-xs font-medium text-[#090D16]">
                  Đồng thời đăng ký mở gian hàng Nhà bán hàng
                </span>
              </label>

              {openShop && (
                <div>
                  <label className="block text-xs font-medium text-[#090D16] mb-1">Tên gian hàng dự kiến</label>
                  <input
                    type="text"
                    required={openShop}
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="VD: Glow Lab Vietnam"
                    className="w-full px-3 py-2 text-sm border border-[#CFD4DC] focus:outline-none focus:border-[#090D16]"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[#C81E3A] hover:bg-[#A61730] text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                {loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
