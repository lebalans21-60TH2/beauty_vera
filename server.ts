import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { createServer as createViteServer } from 'vite';
import {
  hashPassword,
  safeMediaUrl,
  sanitizePlainObject,
  sanitizeString,
  signAuthToken,
  verifyAuthToken,
  verifyPassword,
} from './server/auth.ts';
import {
  allocateFefoForOrderItem,
  appendAuditLog,
  diffDaysFromToday,
  enrichProduct,
  getEligibleBatchesFefo,
  getTodayIsoDate,
  restoreStockOnReturn,
} from './server/fefo.ts';
import { store, type StoredUser } from './server/store.ts';
import type {
  Batch,
  Brand,
  InventoryMovement,
  Order,
  OrderItem,
  Product,
  ProductDocument,
  Promotion,
  Review,
  User,
  UserRole,
  Vendor,
  VendorTier,
} from './src/types/marketplace.ts';

dotenv.config();

interface AuthedRequest extends Request {
  authUser?: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
}

function stripPassword(u: StoredUser): User {
  const { passwordHash: _pw, ...rest } = u;
  return rest;
}

function configureCloudinary(): boolean {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    return true;
  }
  return false;
}

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

function authenticate(req: AuthedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Vui lòng đăng nhập để thực hiện thao tác này.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const payload = verifyAuthToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
    return;
  }

  if (payload.role === 'admin' && payload.userId === 'admin-root') {
    req.authUser = {
      id: 'admin-root',
      name: 'Quản trị viên Sàn',
      email: 'admin@verabeauty.vn',
      role: 'admin',
    };
    next();
    return;
  }

  const db = store.getState();
  const user = db.users.find((u) => u.id === payload.userId);
  if (!user) {
    res.status(401).json({ error: 'Tài khoản không tồn tại.' });
    return;
  }
  if (user.status === 'locked') {
    res.status(403).json({ error: 'Tài khoản của bạn hiện đang bị khóa.' });
    return;
  }

  req.authUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
  next();
}

function requireRole(...roles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser || !roles.includes(req.authUser.role)) {
      res.status(403).json({ error: 'Bạn không có quyền truy cập phân hệ này.' });
      return;
    }
    next();
  };
}

async function startServer() {
  await store.init();
  const hasCloudinary = configureCloudinary();
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use((req, _res, next) => {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizePlainObject(req.body);
    }
    next();
  });

  // Serve validated local uploads when Cloudinary is not configured
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Health & config status (never exposes secrets)
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      databaseMode: store.getMode(),
      mediaMode: hasCloudinary ? 'cloudinary' : 'local',
    });
  });

  // Media Upload Endpoint (Cloudinary SDK or secure local storage fallback)
  app.post('/api/upload', authenticate, async (req: AuthedRequest, res) => {
    try {
      const dataUrl = typeof req.body.dataUrl === 'string' ? req.body.dataUrl : '';
      const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
      if (!match) {
        res.status(400).json({ error: 'Định dạng ảnh không hợp lệ (chỉ hỗ trợ JPG, PNG, WebP).' });
        return;
      }

      const mime = match[1];
      const base64Data = match[2];
      const buf = Buffer.from(base64Data, 'base64');
      if (buf.length > 3 * 1024 * 1024) {
        res.status(400).json({ error: 'Kích thước ảnh vượt quá giới hạn 3MB.' });
        return;
      }

      if (hasCloudinary) {
        const result = await cloudinary.uploader.upload(dataUrl, {
          folder: 'vera-beauty',
          resource_type: 'image',
        });
        res.json({ url: result.secure_url, provider: 'cloudinary' });
        return;
      }

      const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
      const safeName = `img-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
      const resolvedPath = path.resolve(UPLOADS_DIR, safeName);
      if (!resolvedPath.startsWith(UPLOADS_DIR + path.sep)) {
        res.status(400).json({ error: 'Đường dẫn tệp không hợp lệ.' });
        return;
      }
      fs.writeFileSync(resolvedPath, buf);
      res.json({ url: `/uploads/${safeName}`, provider: 'local' });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Tải ảnh lên thất bại.',
      });
    }
  });

  // ===================== AUTH ROUTES =====================
  app.post('/api/auth/register', async (req, res) => {
    const name = sanitizeString(req.body.name, 100);
    const email = sanitizeString(req.body.email, 120).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const phone = sanitizeString(req.body.phone, 20);
    const skinType = sanitizeString(req.body.skinType, 60) || 'Mọi loại da';
    const address = sanitizeString(req.body.address, 250);
    const openShop = Boolean(req.body.openShop);
    const shopName = sanitizeString(req.body.shopName, 120);

    if (!name || !email || password.length < 6) {
      res.status(400).json({ error: 'Vui lòng nhập đầy đủ họ tên, email và mật khẩu (>= 6 ký tự).' });
      return;
    }

    const db = store.getState();
    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      res.status(409).json({ error: 'Email này đã được đăng ký.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const newUser: StoredUser = {
      id: `usr-${Date.now()}`,
      name,
      email,
      phone: phone || '0900000000',
      skinType,
      address,
      role: openShop ? 'vendor' : 'customer',
      status: 'active',
      passwordHash: hashPassword(password),
      createdAt: nowIso,
    };
    db.users.push(newUser);

    if (openShop && shopName) {
      const newVendor: Vendor = {
        id: `vnd-${Date.now()}`,
        ownerUserId: newUser.id,
        name: shopName,
        slug: shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        logoUrl: '/src/assets/images/hero_cosmetics_editorial_1795521823557.jpg',
        description: sanitizeString(req.body.shopDescription, 500) || 'Gian hàng mỹ phẩm đối tác Véra Beauty.',
        address: address || 'TP. Hồ Chí Minh',
        contactPhone: phone || '0900000000',
        contactEmail: email,
        tier: 'standard',
        tierFeeMonthly: db.commissionConfig.tierFees.standard,
        status: 'pending',
        staff: [],
        rating: 5,
        reviewCount: 0,
        createdAt: nowIso,
      };
      db.vendors.push(newVendor);
    }

    await store.persist();
    const token = signAuthToken(newUser.id, newUser.role);
    res.status(201).json({ token, user: stripPassword(newUser) });
  });

  app.post('/api/auth/login', async (req, res) => {
    const email = sanitizeString(req.body.email, 120).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      res.status(400).json({ error: 'Vui lòng nhập đầy đủ email và mật khẩu.' });
      return;
    }

    const db = store.getState();
    const envAdminEmail = (process.env.ADMIN_EMAIL?.trim() || 'admin@verabeauty.vn').toLowerCase();
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    const matchesEnvPasscode = (candidate: string): boolean => {
      if (!envPasscode) return false;
      const a = Buffer.from(candidate, 'utf8');
      const b = Buffer.from(envPasscode, 'utf8');
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    };

    let user = db.users.find((u) => u.email.toLowerCase() === email);

    if (user) {
      const validPassword =
        verifyPassword(password, user.passwordHash) ||
        (user.role === 'admin' && email === envAdminEmail && matchesEnvPasscode(password));

      if (!validPassword) {
        res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác.' });
        return;
      }
      if (user.status === 'locked') {
        res.status(403).json({ error: 'Tài khoản đã bị quản trị viên khóa.' });
        return;
      }

      const token = signAuthToken(user.id, user.role);
      res.json({ token, user: stripPassword(user) });
      return;
    }

    // Migrate or authenticate environment-configured / previously-claimed admin via standard email+password login
    const envAuthorized = email === envAdminEmail && matchesEnvPasscode(password);
    const legacyClaimAuthorized =
      email === 'admin@verabeauty.vn' &&
      Boolean(db.adminPassHash) &&
      verifyPassword(password, db.adminPassHash!);

    if (envAuthorized || legacyClaimAuthorized) {
      const adminUser: StoredUser = {
        id: 'usr-admin-1',
        name: 'Quản trị viên Sàn',
        email,
        phone: '',
        skinType: 'Mọi loại da',
        address: '',
        role: 'admin',
        status: 'active',
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
      };
      db.users.push(adminUser);
      await store.persist();
      const token = signAuthToken(adminUser.id, adminUser.role);
      res.json({ token, user: stripPassword(adminUser) });
      return;
    }

    res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác.' });
  });

  app.get('/api/auth/admin/status', (_req, res) => {
    const db = store.getState();
    const hasEnvPasscode = Boolean(process.env.ADMIN_PASSCODE?.trim());
    const hasClaimedHash = Boolean(db.adminPassHash);
    const hasAdminUser = db.users.some((u) => u.role === 'admin');
    const defaultAdminEmail = (process.env.ADMIN_EMAIL?.trim() || 'admin@verabeauty.vn').toLowerCase();
    res.json({
      requiresInitialClaim: !hasEnvPasscode && !hasClaimedHash && !hasAdminUser,
      defaultAdminEmail,
    });
  });

  app.post('/api/auth/admin/claim', async (req, res) => {
    const db = store.getState();
    const hasEnvPasscode = Boolean(process.env.ADMIN_PASSCODE?.trim());
    const hasAdminUser = db.users.some((u) => u.role === 'admin');
    if (hasEnvPasscode || db.adminPassHash || hasAdminUser) {
      res.status(403).json({ error: 'Tài khoản Quản trị viên đã được thiết lập trước đó.' });
      return;
    }

    const name = sanitizeString(req.body.name, 100) || 'Quản trị viên Sàn';
    const email = sanitizeString(req.body.email, 120).toLowerCase() || 'admin@verabeauty.vn';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Email Quản trị viên không hợp lệ.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Mật khẩu Quản trị viên phải có ít nhất 6 ký tự.' });
      return;
    }
    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      res.status(409).json({ error: 'Email này đã được sử dụng cho một tài khoản khác.' });
      return;
    }

    const adminHash = hashPassword(password);
    const adminUser: StoredUser = {
      id: `usr-admin-${Date.now()}`,
      name,
      email,
      phone: '',
      skinType: 'Mọi loại da',
      address: '',
      role: 'admin',
      status: 'active',
      passwordHash: adminHash,
      createdAt: new Date().toISOString(),
    };
    db.users.push(adminUser);
    db.adminPassHash = adminHash;

    appendAuditLog(db, {
      actorId: adminUser.id,
      actorName: adminUser.name,
      actorRole: 'admin',
      action: 'ADMIN_CLAIM',
      targetType: 'user',
      targetId: adminUser.id,
      summary: `Thiết lập tài khoản Quản trị sàn lần đầu (${adminUser.email}).`,
    });
    await store.persist();

    const token = signAuthToken(adminUser.id, adminUser.role);
    res.status(201).json({
      token,
      user: stripPassword(adminUser),
    });
  });

  app.get('/api/auth/me', authenticate, (req: AuthedRequest, res) => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Chưa đăng nhập.' });
      return;
    }
    if (req.authUser.role === 'admin' && req.authUser.id === 'admin-root') {
      res.json({
        user: {
          id: 'admin-root',
          name: 'Quản trị viên Sàn',
          email: 'admin@verabeauty.vn',
          phone: '',
          role: 'admin',
          status: 'active',
          createdAt: new Date().toISOString(),
        },
      });
      return;
    }
    const db = store.getState();
    const user = db.users.find((u) => u.id === req.authUser!.id);
    if (!user) {
      res.status(404).json({ error: 'Không tìm thấy người dùng.' });
      return;
    }
    res.json({ user: stripPassword(user) });
  });

  app.patch('/api/auth/profile', authenticate, async (req: AuthedRequest, res) => {
    if (!req.authUser || req.authUser.id === 'admin-root') {
      res.status(400).json({ error: 'Không thể cập nhật hồ sơ này.' });
      return;
    }
    const db = store.getState();
    const user = db.users.find((u) => u.id === req.authUser!.id);
    if (!user) {
      res.status(404).json({ error: 'Không tìm thấy người dùng.' });
      return;
    }
    if (typeof req.body.name === 'string' && req.body.name.trim()) {
      user.name = sanitizeString(req.body.name, 100);
    }
    if (typeof req.body.phone === 'string') {
      user.phone = sanitizeString(req.body.phone, 20);
    }
    if (typeof req.body.skinType === 'string') {
      user.skinType = sanitizeString(req.body.skinType, 60);
    }
    if (typeof req.body.address === 'string') {
      user.address = sanitizeString(req.body.address, 250);
    }
    await store.persist();
    res.json({ user: stripPassword(user) });
  });

  // ===================== PUBLIC STOREFRONT =====================
  app.get('/api/storefront/catalog', (req, res) => {
    const db = store.getState();
    const approvedVendorIds = new Set(
      db.vendors.filter((v) => v.status === 'approved').map((v) => v.id)
    );

    const q = sanitizeString(req.query.q, 120).toLowerCase();
    const category = sanitizeString(req.query.category, 40);
    const brandId = sanitizeString(req.query.brandId, 60);
    const skinType = sanitizeString(req.query.skinType, 60);
    const benefit = sanitizeString(req.query.benefit, 60);
    const ingredient = sanitizeString(req.query.ingredient, 60);
    const minPrice = Number(req.query.minPrice || 0);
    const maxPrice = Number(req.query.maxPrice || 0);

    let items = db.products
      .filter((p) => p.reviewStatus === 'approved' && approvedVendorIds.has(p.vendorId))
      .map((p) => enrichProduct(db, p));

    if (q) {
      items = items.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.brandName.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.ingredients.some((i) => i.toLowerCase().includes(q))
      );
    }
    if (category && category !== 'all') {
      items = items.filter((p) => p.categorySlug === category);
    }
    if (brandId && brandId !== 'all') {
      items = items.filter((p) => p.brandId === brandId);
    }
    if (skinType && skinType !== 'all') {
      items = items.filter((p) => p.skinTypes.includes(skinType) || p.skinTypes.includes('Mọi loại da'));
    }
    if (benefit && benefit !== 'all') {
      items = items.filter((p) => p.benefits.includes(benefit));
    }
    if (ingredient && ingredient !== 'all') {
      items = items.filter((p) =>
        p.ingredients.some((ing) => ing.toLowerCase().includes(ingredient.toLowerCase()))
      );
    }
    if (minPrice > 0) {
      items = items.filter((p) => {
        const lowest = Math.min(...p.variants.map((v) => v.promoPrice ?? v.price));
        return lowest >= minPrice;
      });
    }
    if (maxPrice > 0) {
      items = items.filter((p) => {
        const lowest = Math.min(...p.variants.map((v) => v.promoPrice ?? v.price));
        return lowest <= maxPrice;
      });
    }

    // Sponsored products surface first, then rating
    items.sort((a, b) => {
      if (a.isSponsored !== b.isSponsored) return a.isSponsored ? -1 : 1;
      return b.ratingAvg - a.ratingAvg;
    });

    res.json({
      products: items,
      categories: db.categories,
      brands: db.brands.filter((b) => b.status === 'active'),
      vendors: db.vendors.filter((v) => v.status === 'approved'),
      promotions: db.promotions.filter((pr) => pr.active && pr.expiresAt >= getTodayIsoDate()),
    });
  });

  app.get('/api/storefront/products/:id', (req, res) => {
    const db = store.getState();
    const product = db.products.find((p) => p.id === req.params.id);
    if (!product) {
      res.status(404).json({ error: 'Không tìm thấy sản phẩm.' });
      return;
    }
    const vendor = db.vendors.find((v) => v.id === product.vendorId);
    const enriched = enrichProduct(db, product);
    const eligibleBatches = getEligibleBatchesFefo(db.batches, product.id).map((b) => ({
      ...b,
      daysUntilExpiry: diffDaysFromToday(b.expiryDate),
    }));
    const reviews = db.reviews.filter((r) => r.productId === product.id);
    res.json({ product: enriched, vendor, eligibleBatches, reviews });
  });

  // ===================== CUSTOMER ORDERS & REVIEWS =====================
  app.get('/api/orders/mine', authenticate, (req: AuthedRequest, res) => {
    const db = store.getState();
    const orders = db.orders
      .filter((o) => o.customerId === req.authUser!.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ orders, reviews: db.reviews.filter((r) => r.customerId === req.authUser!.id) });
  });

  app.post('/api/orders', authenticate, async (req: AuthedRequest, res) => {
    const db = store.getState();
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
    const customerName = sanitizeString(req.body.customerName, 100) || req.authUser!.name;
    const customerPhone = sanitizeString(req.body.customerPhone, 20);
    const shippingAddress = sanitizeString(req.body.shippingAddress, 250);
    const paymentMethod = ['cod', 'bank_transfer', 'ewallet'].includes(req.body.paymentMethod)
      ? (req.body.paymentMethod as 'cod' | 'bank_transfer' | 'ewallet')
      : 'cod';
    const voucherCode = sanitizeString(req.body.voucherCode, 40).toUpperCase();

    if (rawItems.length === 0 || !customerPhone || !shippingAddress) {
      res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ giỏ hàng, số điện thoại và địa chỉ giao hàng.' });
      return;
    }

    // Group items by vendorId (multi-vendor checkout split per shop)
    const grouped = new Map<string, { product: Product; sku: string; variantName: string; price: number; qty: number }[]>();

    for (const entry of rawItems) {
      const productId = sanitizeString(entry.productId, 80);
      const sku = sanitizeString(entry.sku, 80);
      const qty = Math.max(1, Math.min(99, Math.floor(Number(entry.quantity || 1))));

      const product = db.products.find((p) => p.id === productId && p.reviewStatus === 'approved');
      if (!product) {
        res.status(400).json({ error: 'Có sản phẩm không hợp lệ hoặc chưa được duyệt.' });
        return;
      }
      const vendor = db.vendors.find((v) => v.id === product.vendorId && v.status === 'approved');
      if (!vendor) {
        res.status(400).json({ error: `Gian hàng của sản phẩm "${product.name}" hiện không khả dụng.` });
        return;
      }
      const variant = product.variants.find((v) => v.sku === sku);
      if (!variant) {
        res.status(400).json({ error: `Biến thể SKU ${sku} không tồn tại.` });
        return;
      }
      const available = getEligibleBatchesFefo(db.batches, product.id, sku).reduce(
        (sum, b) => sum + b.currentQty,
        0
      );
      if (available < qty) {
        res.status(400).json({
          error: `Sản phẩm "${product.name}" (${variant.name}) chỉ còn ${available} sản phẩm đạt chuẩn hạn sử dụng.`,
        });
        return;
      }

      const list = grouped.get(vendor.id) ?? [];
      list.push({
        product,
        sku,
        variantName: variant.name,
        price: variant.promoPrice ?? variant.price,
        qty,
      });
      grouped.set(vendor.id, list);
    }

    const promo = voucherCode
      ? db.promotions.find(
          (pr) =>
            pr.code === voucherCode &&
            pr.active &&
            pr.expiresAt >= getTodayIsoDate() &&
            pr.usedCount < pr.maxUses
        )
      : undefined;

    const createdOrders: Order[] = [];
    const nowIso = new Date().toISOString();

    for (const [vendorId, items] of grouped.entries()) {
      const vendor = db.vendors.find((v) => v.id === vendorId)!;
      const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);

      let discountAmount = 0;
      let appliedCode: string | undefined;
      if (promo && (!promo.vendorId || promo.vendorId === vendorId) && subtotal >= promo.minOrderAmount) {
        discountAmount =
          promo.discountType === 'percent'
            ? Math.round((subtotal * promo.discountValue) / 100)
            : Math.min(subtotal, promo.discountValue);
        appliedCode = promo.code;
        promo.usedCount += 1;
      }

      const shippingFee = subtotal - discountAmount >= 500000 ? 0 : 30000;
      const totalAmount = Math.max(0, subtotal - discountAmount + shippingFee);

      // Compute weighted category commission
      const firstCategory = items[0].product.categorySlug;
      const commissionRate =
        db.commissionConfig.categoryRates[firstCategory] ?? db.commissionConfig.defaultRate;
      const commissionAmount = Math.round(((subtotal - discountAmount) * commissionRate) / 100);
      const vendorNetAmount = Math.max(0, totalAmount - commissionAmount);

      const orderItems: OrderItem[] = items.map((i) => ({
        productId: i.product.id,
        productName: i.product.name,
        sku: i.sku,
        variantName: i.variantName,
        quantity: i.qty,
        unitPrice: i.price,
        batchAllocations: [],
      }));

      const order: Order = {
        id: `ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        orderNumber: `VB-${Math.floor(100000 + Math.random() * 900000)}`,
        customerId: req.authUser!.id,
        customerName,
        customerPhone,
        shippingAddress,
        vendorId,
        vendorName: vendor.name,
        items: orderItems,
        subtotal,
        discountAmount,
        voucherCode: appliedCode,
        shippingFee,
        totalAmount,
        commissionRate,
        commissionAmount,
        vendorNetAmount,
        paymentMethod,
        paymentStatus: paymentMethod === 'cod' ? 'unpaid' : 'paid',
        status: 'pending',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      db.orders.unshift(order);
      createdOrders.push(order);
    }

    await store.persist();
    res.status(201).json({ orders: createdOrders });
  });

  app.post('/api/orders/:id/cancel', authenticate, async (req: AuthedRequest, res) => {
    const db = store.getState();
    const order = db.orders.find((o) => o.id === req.params.id && o.customerId === req.authUser!.id);
    if (!order) {
      res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
      return;
    }
    if (order.status !== 'pending') {
      res.status(400).json({ error: 'Chỉ có thể hủy đơn khi đơn hàng đang chờ xác nhận.' });
      return;
    }
    order.status = 'cancelled';
    order.cancelReason = sanitizeString(req.body.reason, 250) || 'Khách hàng yêu cầu hủy đơn';
    order.updatedAt = new Date().toISOString();
    await store.persist();
    res.json({ order });
  });

  app.post('/api/orders/:id/return-request', authenticate, async (req: AuthedRequest, res) => {
    const db = store.getState();
    const order = db.orders.find((o) => o.id === req.params.id && o.customerId === req.authUser!.id);
    if (!order) {
      res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
      return;
    }
    if (order.status !== 'delivered') {
      res.status(400).json({ error: 'Chỉ có thể yêu cầu trả hàng cho đơn đã giao thành công.' });
      return;
    }
    const reason = sanitizeString(req.body.reason, 300);
    if (!reason) {
      res.status(400).json({ error: 'Vui lòng nhập lý do trả hàng.' });
      return;
    }
    order.status = 'return_requested';
    order.returnReason = reason;
    order.updatedAt = new Date().toISOString();
    await store.persist();
    res.json({ order });
  });

  app.post('/api/reviews', authenticate, async (req: AuthedRequest, res) => {
    const db = store.getState();
    const orderId = sanitizeString(req.body.orderId, 80);
    const productId = sanitizeString(req.body.productId, 80);
    const rating = Math.max(1, Math.min(5, Math.round(Number(req.body.rating || 5))));
    const shopRating = Math.max(1, Math.min(5, Math.round(Number(req.body.shopRating || 5))));
    const comment = sanitizeString(req.body.comment, 500);

    const order = db.orders.find(
      (o) => o.id === orderId && o.customerId === req.authUser!.id && o.status === 'delivered'
    );
    if (!order) {
      res.status(400).json({ error: 'Bạn chỉ có thể đánh giá sản phẩm từ đơn hàng đã hoàn tất.' });
      return;
    }
    if (!order.items.some((i) => i.productId === productId)) {
      res.status(400).json({ error: 'Sản phẩm không nằm trong đơn hàng này.' });
      return;
    }
    if (db.reviews.some((r) => r.orderId === orderId && r.productId === productId)) {
      res.status(409).json({ error: 'Bạn đã đánh giá sản phẩm này trong đơn hàng rồi.' });
      return;
    }

    const review: Review = {
      id: `rev-${Date.now()}`,
      productId,
      vendorId: order.vendorId,
      orderId,
      customerId: req.authUser!.id,
      customerName: req.authUser!.name,
      rating,
      shopRating,
      comment: comment || 'Sản phẩm đúng mô tả và hạn sử dụng rõ ràng.',
      createdAt: new Date().toISOString(),
    };
    db.reviews.unshift(review);

    // Recalculate averages
    const prod = db.products.find((p) => p.id === productId);
    if (prod) {
      const pRevs = db.reviews.filter((r) => r.productId === productId);
      prod.reviewCount = pRevs.length;
      prod.ratingAvg = Number(
        (pRevs.reduce((s, r) => s + r.rating, 0) / pRevs.length).toFixed(1)
      );
    }
    const vendor = db.vendors.find((v) => v.id === order.vendorId);
    if (vendor) {
      const vRevs = db.reviews.filter((r) => r.vendorId === vendor.id);
      vendor.reviewCount = vRevs.length;
      vendor.rating = Number(
        (vRevs.reduce((s, r) => s + r.shopRating, 0) / vRevs.length).toFixed(1)
      );
    }

    await store.persist();
    res.status(201).json({ review });
  });

  // ===================== VENDOR PORTAL ROUTES =====================
  app.post('/api/vendor/register-shop', authenticate, async (req: AuthedRequest, res) => {
    const db = store.getState();
    const existing = db.vendors.find((v) => v.ownerUserId === req.authUser!.id);
    if (existing) {
      res.status(409).json({ error: 'Tài khoản này đã có gian hàng đăng ký.' });
      return;
    }
    const name = sanitizeString(req.body.name, 120);
    const address = sanitizeString(req.body.address, 250);
    const contactPhone = sanitizeString(req.body.contactPhone, 20);
    const description = sanitizeString(req.body.description, 500);
    if (!name || !address || !contactPhone) {
      res.status(400).json({ error: 'Vui lòng nhập tên gian hàng, địa chỉ và số điện thoại liên hệ.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const vendor: Vendor = {
      id: `vnd-${Date.now()}`,
      ownerUserId: req.authUser!.id,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      logoUrl:
        safeMediaUrl(req.body.logoUrl) ||
        '/src/assets/images/hero_cosmetics_editorial_1795521823557.jpg',
      description: description || 'Gian hàng mỹ phẩm chính hãng trên Véra Beauty.',
      address,
      contactPhone,
      contactEmail: req.authUser!.email,
      tier: 'standard',
      tierFeeMonthly: db.commissionConfig.tierFees.standard,
      status: 'pending',
      staff: [],
      rating: 5,
      reviewCount: 0,
      createdAt: nowIso,
    };
    db.vendors.push(vendor);

    const user = db.users.find((u) => u.id === req.authUser!.id);
    if (user && user.role === 'customer') {
      user.role = 'vendor';
    }

    appendAuditLog(db, {
      actorId: req.authUser!.id,
      actorName: req.authUser!.name,
      actorRole: 'vendor',
      action: 'VENDOR_REGISTER',
      targetType: 'vendor',
      targetId: vendor.id,
      summary: `Đăng ký mở gian hàng mới "${vendor.name}" chờ kiểm duyệt.`,
    });

    await store.persist();
    const token = signAuthToken(req.authUser!.id, 'vendor');
    res.status(201).json({ vendor, token });
  });

  app.get('/api/vendor/dashboard', authenticate, requireRole('vendor'), (req: AuthedRequest, res) => {
    const db = store.getState();
    const vendor = db.vendors.find((v) => v.ownerUserId === req.authUser!.id);
    if (!vendor) {
      res.status(404).json({ error: 'Bạn chưa đăng ký gian hàng.' });
      return;
    }
    const products = db.products
      .filter((p) => p.vendorId === vendor.id)
      .map((p) => enrichProduct(db, p));
    const batches = db.batches
      .filter((b) => b.vendorId === vendor.id)
      .map((b) => ({
        ...b,
        daysUntilExpiry: diffDaysFromToday(b.expiryDate),
      }))
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    const movements = db.movements
      .filter((m) => m.vendorId === vendor.id)
      .slice(0, 100);
    const documents = db.documents.filter((d) => d.vendorId === vendor.id);
    const orders = db.orders
      .filter((o) => o.vendorId === vendor.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    res.json({
      vendor,
      products,
      batches,
      movements,
      documents,
      orders,
      brands: db.brands.filter((b) => b.status === 'active'),
      categories: db.categories,
      commissionConfig: db.commissionConfig,
    });
  });

  app.patch('/api/vendor/shop', authenticate, requireRole('vendor'), async (req: AuthedRequest, res) => {
    const db = store.getState();
    const vendor = db.vendors.find((v) => v.ownerUserId === req.authUser!.id);
    if (!vendor) {
      res.status(404).json({ error: 'Không tìm thấy gian hàng.' });
      return;
    }
    if (typeof req.body.name === 'string' && req.body.name.trim()) {
      vendor.name = sanitizeString(req.body.name, 120);
    }
    if (typeof req.body.description === 'string') {
      vendor.description = sanitizeString(req.body.description, 500);
    }
    if (typeof req.body.address === 'string') {
      vendor.address = sanitizeString(req.body.address, 250);
    }
    if (typeof req.body.contactPhone === 'string') {
      vendor.contactPhone = sanitizeString(req.body.contactPhone, 20);
    }
    if (typeof req.body.contactEmail === 'string') {
      vendor.contactEmail = sanitizeString(req.body.contactEmail, 120);
    }
    if (typeof req.body.logoUrl === 'string' && safeMediaUrl(req.body.logoUrl)) {
      vendor.logoUrl = safeMediaUrl(req.body.logoUrl);
    }
    if (req.body.tier && ['standard', 'pro', 'flagship'].includes(req.body.tier)) {
      const tier = req.body.tier as VendorTier;
      vendor.tier = tier;
      vendor.tierFeeMonthly = db.commissionConfig.tierFees[tier];
    }
    if (req.body.addStaff && typeof req.body.addStaff === 'object') {
      const sName = sanitizeString(req.body.addStaff.name, 80);
      const sEmail = sanitizeString(req.body.addStaff.email, 120);
      const sRole = sanitizeString(req.body.addStaff.roleLabel, 80) || 'Nhân viên kho';
      if (sName && sEmail) {
        vendor.staff.push({
          id: `stf-${Date.now()}`,
          name: sName,
          email: sEmail,
          roleLabel: sRole,
          addedAt: new Date().toISOString(),
        });
      }
    }
    if (typeof req.body.removeStaffId === 'string') {
      vendor.staff = vendor.staff.filter((s) => s.id !== req.body.removeStaffId);
    }

    await store.persist();
    res.json({ vendor });
  });

  app.post('/api/vendor/products', authenticate, requireRole('vendor'), async (req: AuthedRequest, res) => {
    const db = store.getState();
    const vendor = db.vendors.find((v) => v.ownerUserId === req.authUser!.id);
    if (!vendor) {
      res.status(404).json({ error: 'Không tìm thấy gian hàng.' });
      return;
    }
    if (vendor.status === 'locked') {
      res.status(403).json({ error: 'Gian hàng đang bị khóa.' });
      return;
    }

    const name = sanitizeString(req.body.name, 160);
    const brandId = sanitizeString(req.body.brandId, 60);
    const categorySlug = sanitizeString(req.body.categorySlug, 40) as Product['categorySlug'];
    const originCountry = sanitizeString(req.body.originCountry, 80);
    const manufacturer = sanitizeString(req.body.manufacturer, 140);
    const distributor = sanitizeString(req.body.distributor, 140) || vendor.name;

    if (!name || !brandId || !['skincare', 'makeup', 'haircare', 'bodycare'].includes(categorySlug)) {
      res.status(400).json({ error: 'Vui lòng nhập đầy đủ tên sản phẩm, thương hiệu và danh mục.' });
      return;
    }

    const rawVariants = Array.isArray(req.body.variants) ? req.body.variants : [];
    const variants = rawVariants
      .map((v: Record<string, unknown>) => ({
        sku: sanitizeString(v.sku, 40).toUpperCase(),
        name: sanitizeString(v.name, 80),
        price: Math.max(1000, Math.round(Number(v.price || 0))),
        promoPrice: v.promoPrice ? Math.max(1000, Math.round(Number(v.promoPrice))) : undefined,
      }))
      .filter((v: { sku: string; name: string; price: number }) => v.sku && v.name && v.price > 0);

    if (variants.length === 0) {
      res.status(400).json({ error: 'Sản phẩm cần tối thiểu 1 biến thể SKU hợp lệ.' });
      return;
    }

    const images = Array.isArray(req.body.images)
      ? req.body.images.map((u: unknown) => safeMediaUrl(u)).filter(Boolean)
      : [];
    if (images.length === 0) {
      images.push('/src/assets/images/product_serum_niacinamide_1795521823722.jpg');
    }

    const isSponsored = Boolean(req.body.isSponsored);
    const newProduct: Product = {
      id: `prd-${Date.now()}`,
      vendorId: vendor.id,
      brandId,
      categorySlug,
      name,
      description: sanitizeString(req.body.description, 1000),
      originCountry: originCountry || 'Hàn Quốc',
      manufacturer: manufacturer || 'Đang cập nhật',
      distributor,
      ingredients: Array.isArray(req.body.ingredients)
        ? req.body.ingredients.map((s: unknown) => sanitizeString(s, 60)).filter(Boolean)
        : [],
      benefits: Array.isArray(req.body.benefits)
        ? req.body.benefits.map((s: unknown) => sanitizeString(s, 60)).filter(Boolean)
        : [],
      skinTypes: Array.isArray(req.body.skinTypes)
        ? req.body.skinTypes.map((s: unknown) => sanitizeString(s, 60)).filter(Boolean)
        : ['Mọi loại da'],
      images,
      videoUrl: safeMediaUrl(req.body.videoUrl) || undefined,
      variants,
      isSponsored,
      sponsoredFeeMonthly: isSponsored ? db.commissionConfig.sponsoredListingFee : 0,
      reviewStatus: 'pending',
      ratingAvg: 0,
      reviewCount: 0,
      createdAt: new Date().toISOString(),
    };

    db.products.unshift(newProduct);
    appendAuditLog(db, {
      actorId: req.authUser!.id,
      actorName: req.authUser!.name,
      actorRole: 'vendor',
      action: 'PRODUCT_SUBMIT',
      targetType: 'product',
      targetId: newProduct.id,
      summary: `Shop "${vendor.name}" gửi kiểm duyệt sản phẩm "${newProduct.name}".`,
    });
    await store.persist();
    res.status(201).json({ product: enrichProduct(db, newProduct) });
  });

  app.patch('/api/vendor/products/:id', authenticate, requireRole('vendor'), async (req: AuthedRequest, res) => {
    const db = store.getState();
    const vendor = db.vendors.find((v) => v.ownerUserId === req.authUser!.id);
    const product = db.products.find((p) => p.id === req.params.id && p.vendorId === vendor?.id);
    if (!vendor || !product) {
      res.status(404).json({ error: 'Không tìm thấy sản phẩm thuộc gian hàng của bạn.' });
      return;
    }

    if (typeof req.body.name === 'string' && req.body.name.trim()) {
      product.name = sanitizeString(req.body.name, 160);
    }
    if (typeof req.body.description === 'string') {
      product.description = sanitizeString(req.body.description, 1000);
    }
    if (typeof req.body.originCountry === 'string') {
      product.originCountry = sanitizeString(req.body.originCountry, 80);
    }
    if (typeof req.body.manufacturer === 'string') {
      product.manufacturer = sanitizeString(req.body.manufacturer, 140);
    }
    if (typeof req.body.distributor === 'string') {
      product.distributor = sanitizeString(req.body.distributor, 140);
    }
    if (typeof req.body.isSponsored === 'boolean') {
      product.isSponsored = req.body.isSponsored;
      product.sponsoredFeeMonthly = req.body.isSponsored ? db.commissionConfig.sponsoredListingFee : 0;
    }
    if (Array.isArray(req.body.variants) && req.body.variants.length > 0) {
      product.variants = req.body.variants
        .map((v: Record<string, unknown>) => ({
          sku: sanitizeString(v.sku, 40).toUpperCase(),
          name: sanitizeString(v.name, 80),
          price: Math.max(1000, Math.round(Number(v.price || 0))),
          promoPrice: v.promoPrice ? Math.max(1000, Math.round(Number(v.promoPrice))) : undefined,
        }))
        .filter((v: { sku: string; name: string; price: number }) => v.sku && v.name && v.price > 0);
    }
    if (Array.isArray(req.body.images)) {
      const valid = req.body.images.map((u: unknown) => safeMediaUrl(u)).filter(Boolean);
      if (valid.length > 0) product.images = valid;
    }
    if (req.body.resubmitForReview) {
      product.reviewStatus = 'pending';
      product.reviewerNote = undefined;
    }

    await store.persist();
    res.json({ product: enrichProduct(db, product) });
  });

  app.delete('/api/vendor/products/:id', authenticate, requireRole('vendor'), async (req: AuthedRequest, res) => {
    const db = store.getState();
    const vendor = db.vendors.find((v) => v.ownerUserId === req.authUser!.id);
    const idx = db.products.findIndex((p) => p.id === req.params.id && p.vendorId === vendor?.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Không tìm thấy sản phẩm.' });
      return;
    }
    db.products.splice(idx, 1);
    await store.persist();
    res.json({ deleted: true });
  });

  app.post('/api/vendor/documents', authenticate, requireRole('vendor'), async (req: AuthedRequest, res) => {
    const db = store.getState();
    const vendor = db.vendors.find((v) => v.ownerUserId === req.authUser!.id);
    if (!vendor) {
      res.status(404).json({ error: 'Không tìm thấy gian hàng.' });
      return;
    }
    const productId = sanitizeString(req.body.productId, 80);
    const product = db.products.find((p) => p.id === productId && p.vendorId === vendor.id);
    if (!product) {
      res.status(404).json({ error: 'Sản phẩm không thuộc gian hàng của bạn.' });
      return;
    }
    const title = sanitizeString(req.body.title, 180);
    const docType = ['cosmetic_declaration', 'coa', 'cfs', 'gmp'].includes(req.body.docType)
      ? (req.body.docType as ProductDocument['docType'])
      : 'coa';
    const fileUrl = safeMediaUrl(req.body.fileUrl) || product.images[0];
    if (!title) {
      res.status(400).json({ error: 'Vui lòng nhập tiêu đề chứng từ.' });
      return;
    }

    const doc: ProductDocument = {
      id: `doc-${Date.now()}`,
      vendorId: vendor.id,
      productId: product.id,
      batchId: sanitizeString(req.body.batchId, 80) || undefined,
      title,
      docType,
      fileUrl,
      issueDate: sanitizeString(req.body.issueDate, 20) || getTodayIsoDate(),
      status: 'pending',
    };
    db.documents.unshift(doc);
    await store.persist();
    res.status(201).json({ document: doc });
  });

  // Batch Inbound & Adjustment (FEFO Engine Core)
  app.post('/api/vendor/batches', authenticate, requireRole('vendor'), async (req: AuthedRequest, res) => {
    const db = store.getState();
    const vendor = db.vendors.find((v) => v.ownerUserId === req.authUser!.id);
    if (!vendor) {
      res.status(404).json({ error: 'Không tìm thấy gian hàng.' });
      return;
    }
    const productId = sanitizeString(req.body.productId, 80);
    const sku = sanitizeString(req.body.sku, 40).toUpperCase();
    const batchCode = sanitizeString(req.body.batchCode, 60).toUpperCase();
    const manufactureDate = sanitizeString(req.body.manufactureDate, 20);
    const expiryDate = sanitizeString(req.body.expiryDate, 20);
    const initialQty = Math.max(1, Math.round(Number(req.body.initialQty || 0)));

    const product = db.products.find((p) => p.id === productId && p.vendorId === vendor.id);
    if (!product || !product.variants.some((v) => v.sku === sku)) {
      res.status(400).json({ error: 'Sản phẩm hoặc mã SKU không hợp lệ.' });
      return;
    }
    if (!batchCode || !manufactureDate || !expiryDate || expiryDate <= manufactureDate) {
      res.status(400).json({ error: 'Mã lô, ngày sản xuất hoặc hạn sử dụng không hợp lệ.' });
      return;
    }

    const today = getTodayIsoDate();
    const newBatch: Batch = {
      id: `bat-${Date.now()}`,
      productId,
      vendorId: vendor.id,
      sku,
      batchCode,
      manufactureDate,
      expiryDate,
      initialQty,
      currentQty: initialQty,
      status: expiryDate <= today ? 'expired' : 'active',
      documentId: sanitizeString(req.body.documentId, 80) || undefined,
      notes: sanitizeString(req.body.notes, 250) || undefined,
      createdAt: new Date().toISOString(),
    };
    db.batches.push(newBatch);

    const movement: InventoryMovement = {
      id: `mov-${Date.now()}`,
      batchId: newBatch.id,
      productId,
      vendorId: vendor.id,
      sku,
      type: 'import',
      deltaQty: initialQty,
      balanceAfter: initialQty,
      reason: `Nhập kho lô mới ${batchCode} (HSD: ${expiryDate})`,
      actorId: req.authUser!.id,
      createdAt: new Date().toISOString(),
    };
    db.movements.unshift(movement);

    await store.persist();
    res.status(201).json({ batch: { ...newBatch, daysUntilExpiry: diffDaysFromToday(newBatch.expiryDate) } });
  });

  app.patch('/api/vendor/batches/:id/adjust', authenticate, requireRole('vendor'), async (req: AuthedRequest, res) => {
    const db = store.getState();
    const vendor = db.vendors.find((v) => v.ownerUserId === req.authUser!.id);
    const batch = db.batches.find((b) => b.id === req.params.id && b.vendorId === vendor?.id);
    if (!vendor || !batch) {
      res.status(404).json({ error: 'Không tìm thấy lô hàng.' });
      return;
    }

    const reason = sanitizeString(req.body.reason, 250);
    if (!reason) {
      res.status(400).json({ error: 'Bắt buộc phải nhập lý do khi điều chỉnh tồn kho hoặc trạng thái lô.' });
      return;
    }

    if (typeof req.body.deltaQty === 'number' && req.body.deltaQty !== 0) {
      const delta = Math.round(req.body.deltaQty);
      const nextQty = batch.currentQty + delta;
      if (nextQty < 0) {
        res.status(400).json({ error: 'Số lượng tồn kho sau điều chỉnh không thể âm.' });
        return;
      }
      batch.currentQty = nextQty;
      db.movements.unshift({
        id: `mov-${Date.now()}`,
        batchId: batch.id,
        productId: batch.productId,
        vendorId: batch.vendorId,
        sku: batch.sku,
        type: 'adjustment',
        deltaQty: delta,
        balanceAfter: nextQty,
        reason,
        actorId: req.authUser!.id,
        createdAt: new Date().toISOString(),
      });
    }

    if (req.body.status && ['active', 'locked', 'expired'].includes(req.body.status)) {
      const today = getTodayIsoDate();
      if (req.body.status === 'active' && batch.expiryDate <= today) {
        res.status(400).json({ error: 'Không thể mở bán lại lô đã quá hạn sử dụng.' });
        return;
      }
      batch.status = req.body.status;
      appendAuditLog(db, {
        actorId: req.authUser!.id,
        actorName: req.authUser!.name,
        actorRole: 'vendor',
        action: 'BATCH_STATUS_UPDATE',
        targetType: 'batch',
        targetId: batch.id,
        summary: `Lô ${batch.batchCode} chuyển trạng thái "${batch.status}". Lý do: ${reason}`,
      });
    }

    await store.persist();
    res.json({ batch: { ...batch, daysUntilExpiry: diffDaysFromToday(batch.expiryDate) } });
  });

  app.patch('/api/vendor/orders/:id/status', authenticate, requireRole('vendor'), async (req: AuthedRequest, res) => {
    const db = store.getState();
    const vendor = db.vendors.find((v) => v.ownerUserId === req.authUser!.id);
    const order = db.orders.find((o) => o.id === req.params.id && o.vendorId === vendor?.id);
    if (!vendor || !order) {
      res.status(404).json({ error: 'Không tìm thấy đơn hàng thuộc gian hàng.' });
      return;
    }

    const nextStatus = req.body.status as Order['status'];
    const validStatuses: Order['status'][] = [
      'confirmed',
      'packed',
      'shipped',
      'delivered',
      'cancelled',
      'returned',
    ];
    if (!validStatuses.includes(nextStatus)) {
      res.status(400).json({ error: 'Trạng thái đơn hàng không hợp lệ.' });
      return;
    }

    // Confirming order executes automatic FEFO batch allocation!
    if (nextStatus === 'confirmed' && order.status === 'pending') {
      const tempResults: { item: OrderItem; allocations: OrderItem['batchAllocations'] }[] = [];
      for (const item of order.items) {
        const resAlloc = allocateFefoForOrderItem(db, {
          productId: item.productId,
          sku: item.sku,
          quantity: item.quantity,
          orderId: order.id,
          orderNumber: order.orderNumber,
          actorId: req.authUser!.id,
        });
        if (!resAlloc.ok) {
          res.status(400).json({ error: resAlloc.error });
          return;
        }
        tempResults.push({ item, allocations: resAlloc.allocations });
      }
      for (const pair of tempResults) {
        pair.item.batchAllocations = pair.allocations;
      }
      order.status = 'confirmed';
    } else if (nextStatus === 'cancelled') {
      if (['shipped', 'delivered', 'returned'].includes(order.status)) {
        res.status(400).json({ error: 'Không thể hủy đơn hàng đã bàn giao vận chuyển.' });
        return;
      }
      // Restore stock if order had already been confirmed & FEFO-allocated
      if (order.status === 'confirmed' || order.status === 'packed') {
        for (const item of order.items) {
          if (item.batchAllocations.length > 0) {
            restoreStockOnReturn(db, {
              productId: item.productId,
              sku: item.sku,
              allocations: item.batchAllocations,
              orderId: order.id,
              orderNumber: order.orderNumber,
              actorId: req.authUser!.id,
            });
          }
        }
      }
      order.status = 'cancelled';
      order.cancelReason = sanitizeString(req.body.reason, 250) || 'Nhà bán hàng từ chối đơn';
    } else if (nextStatus === 'returned' && order.status === 'return_requested') {
      for (const item of order.items) {
        restoreStockOnReturn(db, {
          productId: item.productId,
          sku: item.sku,
          allocations: item.batchAllocations,
          orderId: order.id,
          orderNumber: order.orderNumber,
          actorId: req.authUser!.id,
        });
      }
      order.status = 'returned';
      order.paymentStatus = 'refunded';
    } else {
      order.status = nextStatus;
      if (nextStatus === 'delivered') {
        order.paymentStatus = 'paid';
      }
    }

    order.updatedAt = new Date().toISOString();
    await store.persist();
    res.json({ order });
  });

  // ===================== ADMIN GOVERNANCE ROUTES =====================
  app.get('/api/admin/overview', authenticate, requireRole('admin'), (_req, res) => {
    const db = store.getState();
    const enrichedProducts = db.products.map((p) => enrichProduct(db, p));
    const batchesWithDays = db.batches.map((b) => ({
      ...b,
      daysUntilExpiry: diffDaysFromToday(b.expiryDate),
    }));

    const deliveredOrders = db.orders.filter((o) => o.status === 'delivered');
    const gmv = deliveredOrders.reduce((s, o) => s + o.totalAmount, 0);
    const commissionRevenue = deliveredOrders.reduce((s, o) => s + o.commissionAmount, 0);
    const tierSubscriptionRevenue = db.vendors
      .filter((v) => v.status === 'approved')
      .reduce((s, v) => s + v.tierFeeMonthly, 0);
    const sponsoredRevenue = db.products
      .filter((p) => p.reviewStatus === 'approved' && p.isSponsored)
      .reduce((s, p) => s + p.sponsoredFeeMonthly, 0);

    res.json({
      users: db.users.map(stripPassword),
      vendors: db.vendors,
      products: enrichedProducts,
      brands: db.brands,
      categories: db.categories,
      batches: batchesWithDays,
      documents: db.documents,
      orders: db.orders,
      promotions: db.promotions,
      commissionConfig: db.commissionConfig,
      auditLogs: db.auditLogs,
      report: {
        gmv,
        commissionRevenue,
        tierSubscriptionRevenue,
        sponsoredRevenue,
        totalPlatformRevenue: commissionRevenue + tierSubscriptionRevenue + sponsoredRevenue,
        totalOrders: db.orders.length,
        pendingVendors: db.vendors.filter((v) => v.status === 'pending').length,
        pendingProducts: db.products.filter((p) => p.reviewStatus === 'pending').length,
        pendingDocuments: db.documents.filter((d) => d.status === 'pending').length,
        expiringBatches: batchesWithDays.filter(
          (b) => b.status === 'active' && b.daysUntilExpiry <= 90
        ).length,
        expiredBatches: batchesWithDays.filter((b) => b.status === 'expired').length,
      },
    });
  });

  app.patch('/api/admin/users/:id/status', authenticate, requireRole('admin'), async (req: AuthedRequest, res) => {
    const db = store.getState();
    const user = db.users.find((u) => u.id === req.params.id);
    if (!user) {
      res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
      return;
    }
    if (user.id === req.authUser!.id || user.role === 'admin') {
      res.status(400).json({ error: 'Không thể khóa tài khoản Quản trị viên sàn.' });
      return;
    }
    const status = req.body.status === 'locked' ? 'locked' : 'active';
    user.status = status;
    appendAuditLog(db, {
      actorId: req.authUser!.id,
      actorName: req.authUser!.name,
      actorRole: 'admin',
      action: 'USER_STATUS',
      targetType: 'user',
      targetId: user.id,
      summary: `${status === 'locked' ? 'Khóa' : 'Mở khóa'} tài khoản ${user.email}.`,
    });
    await store.persist();
    res.json({ user: stripPassword(user) });
  });

  app.patch('/api/admin/vendors/:id/status', authenticate, requireRole('admin'), async (req: AuthedRequest, res) => {
    const db = store.getState();
    const vendor = db.vendors.find((v) => v.id === req.params.id);
    if (!vendor) {
      res.status(404).json({ error: 'Không tìm thấy gian hàng.' });
      return;
    }
    if (!['approved', 'locked', 'pending'].includes(req.body.status)) {
      res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
      return;
    }
    vendor.status = req.body.status;
    appendAuditLog(db, {
      actorId: req.authUser!.id,
      actorName: req.authUser!.name,
      actorRole: 'admin',
      action: 'VENDOR_STATUS',
      targetType: 'vendor',
      targetId: vendor.id,
      summary: `Chuyển trạng thái gian hàng "${vendor.name}" sang "${vendor.status}".`,
    });
    await store.persist();
    res.json({ vendor });
  });

  app.patch('/api/admin/products/:id/review', authenticate, requireRole('admin'), async (req: AuthedRequest, res) => {
    const db = store.getState();
    const product = db.products.find((p) => p.id === req.params.id);
    if (!product) {
      res.status(404).json({ error: 'Không tìm thấy sản phẩm.' });
      return;
    }
    if (!['approved', 'rejected', 'pending'].includes(req.body.reviewStatus)) {
      res.status(400).json({ error: 'Trạng thái duyệt không hợp lệ.' });
      return;
    }
    product.reviewStatus = req.body.reviewStatus;
    product.reviewerNote = sanitizeString(req.body.reviewerNote, 300) || undefined;
    appendAuditLog(db, {
      actorId: req.authUser!.id,
      actorName: req.authUser!.name,
      actorRole: 'admin',
      action: 'PRODUCT_REVIEW',
      targetType: 'product',
      targetId: product.id,
      summary: `Kiểm duyệt sản phẩm "${product.name}": ${product.reviewStatus}.`,
    });
    await store.persist();
    res.json({ product: enrichProduct(db, product) });
  });

  app.post('/api/admin/brands', authenticate, requireRole('admin'), async (req: AuthedRequest, res) => {
    const db = store.getState();
    const name = sanitizeString(req.body.name, 100);
    const country = sanitizeString(req.body.country, 80);
    if (!name || !country) {
      res.status(400).json({ error: 'Vui lòng nhập tên thương hiệu và quốc gia.' });
      return;
    }
    const brand: Brand = {
      id: `brd-${Date.now()}`,
      name,
      country,
      description: sanitizeString(req.body.description, 300),
      status: 'active',
    };
    db.brands.push(brand);
    appendAuditLog(db, {
      actorId: req.authUser!.id,
      actorName: req.authUser!.name,
      actorRole: 'admin',
      action: 'BRAND_CREATE',
      targetType: 'brand',
      targetId: brand.id,
      summary: `Thêm thương hiệu "${brand.name}" (${brand.country}).`,
    });
    await store.persist();
    res.status(201).json({ brand });
  });

  app.patch('/api/admin/categories/:id', authenticate, requireRole('admin'), async (req: AuthedRequest, res) => {
    const db = store.getState();
    const cat = db.categories.find((c) => c.id === req.params.id);
    if (!cat) {
      res.status(404).json({ error: 'Không tìm thấy danh mục.' });
      return;
    }
    if (typeof req.body.commissionRate === 'number') {
      const rate = Math.max(0, Math.min(40, Number(req.body.commissionRate)));
      cat.commissionRate = rate;
      db.commissionConfig.categoryRates[cat.slug] = rate;
    }
    if (typeof req.body.name === 'string' && req.body.name.trim()) {
      cat.name = sanitizeString(req.body.name, 80);
    }
    appendAuditLog(db, {
      actorId: req.authUser!.id,
      actorName: req.authUser!.name,
      actorRole: 'admin',
      action: 'CATEGORY_UPDATE',
      targetType: 'category',
      targetId: cat.id,
      summary: `Cập nhật danh mục "${cat.name}" (hoa hồng ${cat.commissionRate}%).`,
    });
    await store.persist();
    res.json({ category: cat });
  });

  app.patch('/api/admin/batches/:id/status', authenticate, requireRole('admin'), async (req: AuthedRequest, res) => {
    const db = store.getState();
    const batch = db.batches.find((b) => b.id === req.params.id);
    if (!batch) {
      res.status(404).json({ error: 'Không tìm thấy lô hàng.' });
      return;
    }
    if (!['active', 'locked', 'expired'].includes(req.body.status)) {
      res.status(400).json({ error: 'Trạng thái lô không hợp lệ.' });
      return;
    }
    batch.status = req.body.status;
    appendAuditLog(db, {
      actorId: req.authUser!.id,
      actorName: req.authUser!.name,
      actorRole: 'admin',
      action: 'ADMIN_BATCH_LOCK',
      targetType: 'batch',
      targetId: batch.id,
      summary: `Quản trị viên cập nhật lô ${batch.batchCode} sang "${batch.status}".`,
    });
    await store.persist();
    res.json({ batch });
  });

  app.patch('/api/admin/documents/:id/review', authenticate, requireRole('admin'), async (req: AuthedRequest, res) => {
    const db = store.getState();
    const doc = db.documents.find((d) => d.id === req.params.id);
    if (!doc) {
      res.status(404).json({ error: 'Không tìm thấy chứng từ.' });
      return;
    }
    if (!['approved', 'rejected'].includes(req.body.status)) {
      res.status(400).json({ error: 'Trạng thái chứng từ không hợp lệ.' });
      return;
    }
    doc.status = req.body.status;
    doc.reviewerNote = sanitizeString(req.body.reviewerNote, 250) || undefined;
    appendAuditLog(db, {
      actorId: req.authUser!.id,
      actorName: req.authUser!.name,
      actorRole: 'admin',
      action: 'DOCUMENT_REVIEW',
      targetType: 'document',
      targetId: doc.id,
      summary: `Kiểm tra chứng từ "${doc.title}": ${doc.status}.`,
    });
    await store.persist();
    res.json({ document: doc });
  });

  app.patch('/api/admin/orders/:id/payment', authenticate, requireRole('admin'), async (req: AuthedRequest, res) => {
    const db = store.getState();
    const order = db.orders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
      return;
    }
    if (!['unpaid', 'paid', 'refunded'].includes(req.body.paymentStatus)) {
      res.status(400).json({ error: 'Trạng thái thanh toán không hợp lệ.' });
      return;
    }
    order.paymentStatus = req.body.paymentStatus;
    order.updatedAt = new Date().toISOString();
    appendAuditLog(db, {
      actorId: req.authUser!.id,
      actorName: req.authUser!.name,
      actorRole: 'admin',
      action: 'PAYMENT_RECONCILE',
      targetType: 'order',
      targetId: order.id,
      summary: `Cập nhật thanh toán đơn #${order.orderNumber} sang "${order.paymentStatus}".`,
    });
    await store.persist();
    res.json({ order });
  });

  app.post('/api/admin/promotions', authenticate, requireRole('admin'), async (req: AuthedRequest, res) => {
    const db = store.getState();
    const code = sanitizeString(req.body.code, 30).toUpperCase();
    const title = sanitizeString(req.body.title, 140);
    if (!code || !title) {
      res.status(400).json({ error: 'Vui lòng nhập mã và tiêu đề khuyến mãi.' });
      return;
    }
    const promo: Promotion = {
      id: `prm-${Date.now()}`,
      code,
      title,
      sponsorType: req.body.sponsorType === 'vendor' ? 'vendor' : 'platform',
      vendorId: sanitizeString(req.body.vendorId, 80) || undefined,
      discountType: req.body.discountType === 'fixed' ? 'fixed' : 'percent',
      discountValue: Math.max(1, Math.round(Number(req.body.discountValue || 10))),
      minOrderAmount: Math.max(0, Math.round(Number(req.body.minOrderAmount || 0))),
      maxUses: Math.max(1, Math.round(Number(req.body.maxUses || 100))),
      usedCount: 0,
      active: true,
      expiresAt: sanitizeString(req.body.expiresAt, 20) || '2027-12-31',
    };
    db.promotions.unshift(promo);
    appendAuditLog(db, {
      actorId: req.authUser!.id,
      actorName: req.authUser!.name,
      actorRole: 'admin',
      action: 'PROMOTION_CREATE',
      targetType: 'promotion',
      targetId: promo.id,
      summary: `Tạo mã khuyến mãi ${promo.code} (${promo.title}).`,
    });
    await store.persist();
    res.status(201).json({ promotion: promo });
  });

  app.patch('/api/admin/promotions/:id', authenticate, requireRole('admin'), async (req: AuthedRequest, res) => {
    const db = store.getState();
    const promo = db.promotions.find((p) => p.id === req.params.id);
    if (!promo) {
      res.status(404).json({ error: 'Không tìm thấy khuyến mãi.' });
      return;
    }
    promo.active = Boolean(req.body.active);
    await store.persist();
    res.json({ promotion: promo });
  });

  app.patch('/api/admin/commission', authenticate, requireRole('admin'), async (req: AuthedRequest, res) => {
    const db = store.getState();
    if (typeof req.body.defaultRate === 'number') {
      db.commissionConfig.defaultRate = Math.max(0, Math.min(40, Number(req.body.defaultRate)));
    }
    if (typeof req.body.sponsoredListingFee === 'number') {
      db.commissionConfig.sponsoredListingFee = Math.max(0, Math.round(Number(req.body.sponsoredListingFee)));
    }
    if (req.body.tierFees && typeof req.body.tierFees === 'object') {
      for (const tier of ['standard', 'pro', 'flagship'] as const) {
        if (typeof req.body.tierFees[tier] === 'number') {
          db.commissionConfig.tierFees[tier] = Math.max(0, Math.round(Number(req.body.tierFees[tier])));
        }
      }
    }
    appendAuditLog(db, {
      actorId: req.authUser!.id,
      actorName: req.authUser!.name,
      actorRole: 'admin',
      action: 'COMMISSION_UPDATE',
      targetType: 'commission',
      targetId: 'global',
      summary: `Cập nhật cấu hình hoa hồng mặc định ${db.commissionConfig.defaultRate}% & phí quảng bá.`,
    });
    await store.persist();
    res.json({ commissionConfig: db.commissionConfig });
  });

  // Vite middleware (dev) or static dist serving (prod)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Véra Beauty marketplace running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
