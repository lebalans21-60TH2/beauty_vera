import type { BatchStatus, OrderStatus } from '../types/marketplace';

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + ' ₫';
}

export function formatDateVi(iso: string): string {
  if (!iso) return '—';
  const d = iso.slice(0, 10);
  const parts = d.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatDateTimeVi(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; tone: string }
> = {
  pending: { label: 'Chờ xác nhận', tone: 'text-amber-700' },
  confirmed: { label: 'Đã xác nhận (Đã xuất lô FEFO)', tone: 'text-[#090D16]' },
  packed: { label: 'Đang đóng gói', tone: 'text-[#090D16]' },
  shipped: { label: 'Đang giao hàng', tone: 'text-sky-700' },
  delivered: { label: 'Hoàn tất', tone: 'text-emerald-700' },
  cancelled: { label: 'Đã hủy', tone: 'text-red-700' },
  return_requested: { label: 'Yêu cầu trả hàng', tone: 'text-amber-700' },
  returned: { label: 'Đã hoàn trả', tone: 'text-[#6B665E]' },
};

export const BATCH_STATUS_META: Record<
  BatchStatus,
  { label: string; tone: string }
> = {
  active: { label: 'Đang bán', tone: 'text-emerald-700' },
  locked: { label: 'Đã khóa', tone: 'text-amber-700' },
  expired: { label: 'Hết hạn (Ngừng bán)', tone: 'text-red-700' },
};

export const DOC_TYPE_LABEL: Record<string, string> = {
  cosmetic_declaration: 'Phiếu công bố mỹ phẩm',
  coa: 'Phiếu kiểm nghiệm lô (COA)',
  cfs: 'Lưu hành tự do (CFS)',
  gmp: 'Chứng nhận cGMP',
};

export async function apiFetch<T>(
  url: string,
  options: {
    method?: string;
    token?: string | null;
    body?: unknown;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Lỗi kết nối (${res.status})`);
  }
  return data;
}
