import fs from 'fs';
import path from 'path';
import { MongoClient, type Db } from 'mongodb';
import type {
  AuditLog,
  Batch,
  Brand,
  Category,
  CommissionConfig,
  InventoryMovement,
  Order,
  Product,
  ProductDocument,
  Promotion,
  Review,
  User,
  Vendor,
} from '../src/types/marketplace.ts';
import { hashPassword } from './auth.ts';

export interface StoredUser extends User {
  passwordHash: string;
}

export interface MarketplaceDatabase {
  users: StoredUser[];
  adminPassHash: string | null;
  vendors: Vendor[];
  brands: Brand[];
  categories: Category[];
  products: Product[];
  documents: ProductDocument[];
  batches: Batch[];
  movements: InventoryMovement[];
  orders: Order[];
  reviews: Review[];
  promotions: Promotion[];
  commissionConfig: CommissionConfig;
  auditLogs: AuditLog[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'vera_marketplace.json');

function addDaysIso(daysFromNow: number): string {
  const d = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function createInitialSeed(): MarketplaceDatabase {
  const nowIso = new Date().toISOString();

  const users: StoredUser[] = [
    {
      id: 'usr-customer-1',
      name: 'Nguyễn Minh Anh',
      email: 'khachhang@verabeauty.vn',
      phone: '0901234567',
      skinType: 'Da hỗn hợp',
      address: '128 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
      role: 'customer',
      status: 'active',
      passwordHash: hashPassword('Customer123!'),
      createdAt: nowIso,
    },
    {
      id: 'usr-vendor-1',
      name: 'Trần Thảo Vy',
      email: 'shop.atelier@verabeauty.vn',
      phone: '0912345678',
      skinType: 'Da nhạy cảm',
      address: '45 Lê Lợi, Quận 1, TP. Hồ Chí Minh',
      role: 'vendor',
      status: 'active',
      passwordHash: hashPassword('Vendor123!'),
      createdAt: nowIso,
    },
    {
      id: 'usr-vendor-2',
      name: 'Lê Hoàng Nam',
      email: 'shop.botanica@verabeauty.vn',
      phone: '0987654321',
      skinType: 'Mọi loại da',
      address: '210 Hai Bà Trưng, Quận 3, TP. Hồ Chí Minh',
      role: 'vendor',
      status: 'active',
      passwordHash: hashPassword('Vendor123!'),
      createdAt: nowIso,
    },
  ];

  const vendors: Vendor[] = [
    {
      id: 'vnd-atelier',
      ownerUserId: 'usr-vendor-1',
      name: 'Véra Official Atelier',
      slug: 'vera-official-atelier',
      logoUrl: '/src/assets/images/product_serum_niacinamide_1795521823722.jpg',
      description:
        'Gian hàng phân phối chính thức dược mỹ phẩm Hàn Quốc và Nhật Bản, kiểm soát nhiệt độ kho và truy xuất lô sản xuất theo chuẩn FEFO.',
      address: '45 Lê Lợi, Phường Bến Nghé, Quận 1, TP. HCM',
      contactPhone: '0912345678',
      contactEmail: 'shop.atelier@verabeauty.vn',
      tier: 'flagship',
      tierFeeMonthly: 2500000,
      status: 'approved',
      staff: [
        {
          id: 'stf-1',
          name: 'Phạm Quỳnh Chi',
          email: 'kho.atelier@verabeauty.vn',
          roleLabel: 'Thủ kho & Kiểm soát lô FEFO',
          addedAt: nowIso,
        },
      ],
      rating: 4.9,
      reviewCount: 128,
      createdAt: nowIso,
    },
    {
      id: 'vnd-botanica',
      ownerUserId: 'usr-vendor-2',
      name: 'Botanica Maison VN',
      slug: 'botanica-maison-vn',
      logoUrl: '/src/assets/images/product_hair_elixir_1795521824657.jpg',
      description:
        'Chuyên sản phẩm chăm sóc tóc và cơ thể chiết xuất thực vật từ Pháp và Việt Nam, đầy đủ phiếu công bố và COA từng lô.',
      address: '210 Hai Bà Trưng, Quận 3, TP. HCM',
      contactPhone: '0987654321',
      contactEmail: 'shop.botanica@verabeauty.vn',
      tier: 'pro',
      tierFeeMonthly: 1200000,
      status: 'approved',
      staff: [],
      rating: 4.8,
      reviewCount: 74,
      createdAt: nowIso,
    },
  ];

  const brands: Brand[] = [
    {
      id: 'brd-aethel',
      name: 'Aethel Lab',
      country: 'Hàn Quốc',
      description: 'Dược mỹ phẩm phục hồi hàng rào da từ Seoul.',
      status: 'active',
    },
    {
      id: 'brd-beauty',
      name: 'Beauty Brand',
      country: 'Hàn Quốc',
      description: 'Mỹ phẩm trang điểm thuần chay kết cấu nhẹ.',
      status: 'active',
    },
    {
      id: 'brd-kanso',
      name: 'Kanso Derm',
      country: 'Nhật Bản',
      description: 'Chống nắng và làm dịu da cho làn da nhạy cảm.',
      status: 'active',
    },
    {
      id: 'brd-lumiere',
      name: 'Lumière Botanique',
      country: 'Pháp',
      description: 'Tinh dầu dưỡng tóc và chăm sóc cơ thể chuẩn thực vật.',
      status: 'active',
    },
    {
      id: 'brd-thaomoc',
      name: 'Thảo Mộc Việt',
      country: 'Việt Nam',
      description: 'Chăm sóc cơ thể lành tính từ nguyên liệu bản địa.',
      status: 'active',
    },
  ];

  const categories: Category[] = [
    {
      id: 'cat-skincare',
      slug: 'skincare',
      name: 'Skincare',
      description: 'Tinh chất, kem dưỡng, làm sạch và chống nắng',
      commissionRate: 8,
    },
    {
      id: 'cat-makeup',
      slug: 'makeup',
      name: 'Makeup',
      description: 'Son môi, phấn nền, trang điểm tự nhiên',
      commissionRate: 10,
    },
    {
      id: 'cat-haircare',
      slug: 'haircare',
      name: 'Chăm sóc tóc',
      description: 'Dầu dưỡng tóc, tinh chất da đầu, phục hồi tóc',
      commissionRate: 8,
    },
    {
      id: 'cat-bodycare',
      slug: 'bodycare',
      name: 'Chăm sóc cơ thể',
      description: 'Sữa dưỡng thể, tẩy tế bào chết và làm sạch cơ thể',
      commissionRate: 7,
    },
  ];

  const products: Product[] = [
    {
      id: 'prd-serum-niacinamide',
      vendorId: 'vnd-atelier',
      brandId: 'brd-aethel',
      categorySlug: 'skincare',
      name: 'Tinh Chất Phục Hồi Niacinamide 10% & B5',
      description:
        'Công thức cân bằng bã nhờn, thu nhỏ lỗ chân lông và củng cố hàng rào bảo vệ da với Niacinamide tinh khiết 10% kết hợp Panthenol B5.',
      originCountry: 'Hàn Quốc',
      manufacturer: 'ABC Cosmetics Korea Co., Ltd.',
      distributor: 'Công ty TNHH Véra Atelier Việt Nam',
      ingredients: ['Niacinamide 10%', 'Panthenol B5', 'Hyaluronic Acid', 'Zinc PCA'],
      benefits: ['Kiềm dầu', 'Phục hồi hàng rào da', 'Dưỡng sáng'],
      skinTypes: ['Da dầu', 'Da hỗn hợp', 'Da nhạy cảm'],
      images: ['/src/assets/images/product_serum_niacinamide_1795521823722.jpg'],
      variants: [
        { sku: 'AE-NIA-30', name: 'Chai 30ml', price: 480000, promoPrice: 420000 },
        { sku: 'AE-NIA-50', name: 'Chai 50ml', price: 690000 },
      ],
      isSponsored: true,
      sponsoredFeeMonthly: 800000,
      reviewStatus: 'approved',
      ratingAvg: 4.9,
      reviewCount: 42,
      createdAt: nowIso,
    },
    {
      id: 'prd-sunscreen-fluid',
      vendorId: 'vnd-atelier',
      brandId: 'brd-kanso',
      categorySlug: 'skincare',
      name: 'Kem Chống Nắng Khoáng Chất SPF 50+ PA++++',
      description:
        'Kết cấu sữa mỏng nhẹ nâng tông tự nhiên, màng lọc Zinc Oxide an toàn cho da nhạy cảm và sau liệu trình treatment.',
      originCountry: 'Nhật Bản',
      manufacturer: 'Kanso Pharmaceutical Lab Osaka',
      distributor: 'Công ty TNHH Véra Atelier Việt Nam',
      ingredients: ['Zinc Oxide', 'Ceramide NP', 'Centella Asiatica', 'Glycerin'],
      benefits: ['Chống nắng phổ rộng', 'Làm dịu da', 'Không gây bí tắc'],
      skinTypes: ['Da nhạy cảm', 'Da khô', 'Da hỗn hợp'],
      images: ['/src/assets/images/product_sunscreen_fluid_1795521824274.jpg'],
      variants: [
        { sku: 'KD-SUN-50', name: 'Tuýp 50ml', price: 540000, promoPrice: 495000 },
      ],
      isSponsored: false,
      sponsoredFeeMonthly: 0,
      reviewStatus: 'approved',
      ratingAvg: 4.8,
      reviewCount: 31,
      createdAt: nowIso,
    },
    {
      id: 'prd-hair-elixir',
      vendorId: 'vnd-botanica',
      brandId: 'brd-lumiere',
      categorySlug: 'haircare',
      name: 'Dầu Dưỡng Tóc Phục Hồi Hư Tổn Oud & Olive',
      description:
        'Dầu ép lạnh từ quả ô liu hữu cơ vùng Provence và tinh dầu trầm hương giúp phục hồi ngọn tóc chẻ ngọn, giảm xơ rối tức thì.',
      originCountry: 'Pháp',
      manufacturer: 'Laboratoire Lumière Provence SAS',
      distributor: 'Công ty CP Botanica Maison Việt Nam',
      ingredients: ['Olive Squalane', 'Argan Oil', 'Vitamin E', 'Rosemary Extract'],
      benefits: ['Phục hồi hư tổn', 'Bóng mượt tự nhiên', 'Bảo vệ nhiệt'],
      skinTypes: ['Mọi loại da'],
      images: ['/src/assets/images/product_hair_elixir_1795521824657.jpg'],
      variants: [
        { sku: 'LB-HAIR-50', name: 'Chai thủy tinh 50ml', price: 620000 },
        { sku: 'LB-HAIR-100', name: 'Chai thủy tinh 100ml', price: 980000, promoPrice: 890000 },
      ],
      isSponsored: true,
      sponsoredFeeMonthly: 800000,
      reviewStatus: 'approved',
      ratingAvg: 4.9,
      reviewCount: 26,
      createdAt: nowIso,
    },
    {
      id: 'prd-velvet-lipstick',
      vendorId: 'vnd-atelier',
      brandId: 'brd-beauty',
      categorySlug: 'makeup',
      name: 'Son Lì Nhung Mịn Velvet Rose Balm',
      description:
        'Chất son lì mịn như nhung giàu bơ hạt mỡ và Hyaluronic vi phân, giữ môi ẩm mượt suốt 8 giờ không lộ vân môi.',
      originCountry: 'Hàn Quốc',
      manufacturer: 'ABC Cosmetics Korea Co., Ltd.',
      distributor: 'Công ty TNHH Véra Atelier Việt Nam',
      ingredients: ['Shea Butter', 'Hyaluronic Acid', 'Jojoba Oil', 'Vitamin E'],
      benefits: ['Lên màu chuẩn', 'Dưỡng ẩm môi', 'Thuần chay'],
      skinTypes: ['Mọi loại da'],
      images: ['/src/assets/images/product_velvet_lipstick_1795521823695.jpg'],
      variants: [
        { sku: 'BB-LIP-01', name: '#01 Hồng Đất Terracotta', price: 390000, promoPrice: 350000 },
        { sku: 'BB-LIP-02', name: '#02 Cánh Hồng Khô', price: 390000 },
      ],
      isSponsored: false,
      sponsoredFeeMonthly: 0,
      reviewStatus: 'approved',
      ratingAvg: 4.7,
      reviewCount: 19,
      createdAt: nowIso,
    },
    {
      id: 'prd-body-ceramide',
      vendorId: 'vnd-botanica',
      brandId: 'brd-thaomoc',
      categorySlug: 'bodycare',
      name: 'Sữa Dưỡng Thể Ceramide & Yến Mạch Dịu Nhẹ',
      description:
        'Phục hồi độ ẩm sâu cho làn da cơ thể khô ráp với phức hợp 3 loại Ceramide sinh học và chiết xuất yến mạch keo.',
      originCountry: 'Việt Nam',
      manufacturer: 'Nhà máy CGMP Thảo Mộc Việt Bình Dương',
      distributor: 'Công ty CP Botanica Maison Việt Nam',
      ingredients: ['Ceramide NP', 'Colloidal Oatmeal', 'Glycerin', 'Niacinamide'],
      benefits: ['Cấp ẩm 48 giờ', 'Làm dịu kích ứng', 'Thấm nhanh'],
      skinTypes: ['Da khô', 'Da nhạy cảm', 'Mọi loại da'],
      images: ['/src/assets/images/hero_cosmetics_editorial_1795521823557.jpg'],
      variants: [
        { sku: 'TMV-BODY-250', name: 'Chai 250ml', price: 310000, promoPrice: 279000 },
      ],
      isSponsored: false,
      sponsoredFeeMonthly: 0,
      reviewStatus: 'approved',
      ratingAvg: 4.8,
      reviewCount: 22,
      createdAt: nowIso,
    },
    {
      id: 'prd-night-retinol',
      vendorId: 'vnd-atelier',
      brandId: 'brd-aethel',
      categorySlug: 'skincare',
      name: 'Tinh Chất Tái Tạo Đêm Bakuchiol & Peptide',
      description:
        'Giải pháp thay thế Retinol dịu nhẹ từ Bakuchiol 1% và Matrixyl Peptide giúp làm mờ nếp nhăn, tăng độ đàn hồi da.',
      originCountry: 'Hàn Quốc',
      manufacturer: 'ABC Cosmetics Korea Co., Ltd.',
      distributor: 'Công ty TNHH Véra Atelier Việt Nam',
      ingredients: ['Bakuchiol 1%', 'Peptide Complex', 'Squalane', 'Ceramide NP'],
      benefits: ['Chống lão hóa', 'Tái tạo bề mặt da', 'Dịu nhẹ ban đêm'],
      skinTypes: ['Da khô', 'Da hỗn hợp', 'Da nhạy cảm'],
      images: ['/src/assets/images/hero_cosmetics_editorial_1795521823557.jpg'],
      variants: [
        { sku: 'AE-BAK-30', name: 'Chai 30ml', price: 760000 },
      ],
      isSponsored: false,
      sponsoredFeeMonthly: 0,
      reviewStatus: 'pending',
      ratingAvg: 0,
      reviewCount: 0,
      createdAt: nowIso,
    },
  ];

  const documents: ProductDocument[] = [
    {
      id: 'doc-1',
      vendorId: 'vnd-atelier',
      productId: 'prd-serum-niacinamide',
      batchId: 'bat-1',
      title: 'Phiếu công bố sản phẩm mỹ phẩm số 194822/26/CBMP-QLD',
      docType: 'cosmetic_declaration',
      fileUrl: '/src/assets/images/product_serum_niacinamide_1795521823722.jpg',
      issueDate: '2026-07-15',
      status: 'approved',
    },
    {
      id: 'doc-2',
      vendorId: 'vnd-atelier',
      productId: 'prd-serum-niacinamide',
      batchId: 'bat-2',
      title: 'Phiếu kiểm nghiệm chất lượng lô (COA) LOT-2026-001',
      docType: 'coa',
      fileUrl: '/src/assets/images/product_serum_niacinamide_1795521823722.jpg',
      issueDate: '2026-08-01',
      status: 'approved',
    },
    {
      id: 'doc-3',
      vendorId: 'vnd-atelier',
      productId: 'prd-sunscreen-fluid',
      batchId: 'bat-3',
      title: 'Giấy chứng nhận lưu hành tự do (CFS) — Osaka Lab',
      docType: 'cfs',
      fileUrl: '/src/assets/images/product_sunscreen_fluid_1795521824274.jpg',
      issueDate: '2026-04-10',
      status: 'approved',
    },
    {
      id: 'doc-4',
      vendorId: 'vnd-botanica',
      productId: 'prd-hair-elixir',
      batchId: 'bat-4',
      title: 'Phiếu công bố mỹ phẩm nhập khẩu Pháp — Lumière',
      docType: 'cosmetic_declaration',
      fileUrl: '/src/assets/images/product_hair_elixir_1795521824657.jpg',
      issueDate: '2026-09-01',
      status: 'approved',
    },
    {
      id: 'doc-5',
      vendorId: 'vnd-atelier',
      productId: 'prd-velvet-lipstick',
      batchId: 'bat-5',
      title: 'Chứng nhận kiểm nghiệm chì & kim loại nặng (COA)',
      docType: 'coa',
      fileUrl: '/src/assets/images/product_velvet_lipstick_1795521823695.jpg',
      issueDate: '2026-10-02',
      status: 'approved',
    },
    {
      id: 'doc-6',
      vendorId: 'vnd-botanica',
      productId: 'prd-body-ceramide',
      batchId: 'bat-6',
      title: 'Chứng nhận nhà máy đạt chuẩn cGMP ASEAN',
      docType: 'gmp',
      fileUrl: '/src/assets/images/hero_cosmetics_editorial_1795521823557.jpg',
      issueDate: '2026-07-05',
      status: 'approved',
    },
    {
      id: 'doc-7',
      vendorId: 'vnd-atelier',
      productId: 'prd-night-retinol',
      title: 'Phiếu công bố sản phẩm Bakuchiol & Peptide (Chờ duyệt)',
      docType: 'cosmetic_declaration',
      fileUrl: '/src/assets/images/hero_cosmetics_editorial_1795521823557.jpg',
      issueDate: '2026-11-18',
      status: 'pending',
    },
  ];

  // Note: Today is 2026-11-24. Create a realistic mix of near-expiry, long-expiry, and expired batches to prove FEFO!
  const batches: Batch[] = [
    {
      id: 'bat-1',
      productId: 'prd-serum-niacinamide',
      vendorId: 'vnd-atelier',
      sku: 'AE-NIA-30',
      batchCode: 'LOT-2026-000',
      manufactureDate: '2025-02-01',
      expiryDate: addDaysIso(42), // Expiring in 42 days -> FEFO picks this first & triggers warning!
      initialQty: 40,
      currentQty: 8,
      status: 'active',
      documentId: 'doc-1',
      notes: 'Lô nhập đợt 1 — ưu tiên xuất theo quy tắc FEFO',
      createdAt: nowIso,
    },
    {
      id: 'bat-2',
      productId: 'prd-serum-niacinamide',
      vendorId: 'vnd-atelier',
      sku: 'AE-NIA-30',
      batchCode: 'LOT-2026-001',
      manufactureDate: '2026-08-01',
      expiryDate: '2028-08-01',
      initialQty: 120,
      currentQty: 114,
      status: 'active',
      documentId: 'doc-2',
      notes: 'Lô mới sản xuất 08/2026',
      createdAt: nowIso,
    },
    {
      id: 'bat-2b',
      productId: 'prd-serum-niacinamide',
      vendorId: 'vnd-atelier',
      sku: 'AE-NIA-50',
      batchCode: 'LOT-2026-050',
      manufactureDate: '2026-08-15',
      expiryDate: '2028-08-15',
      initialQty: 60,
      currentQty: 55,
      status: 'active',
      documentId: 'doc-2',
      createdAt: nowIso,
    },
    {
      id: 'bat-3-exp',
      productId: 'prd-sunscreen-fluid',
      vendorId: 'vnd-atelier',
      sku: 'KD-SUN-50',
      batchCode: 'LOT-KD-2401',
      manufactureDate: '2024-01-10',
      expiryDate: addDaysIso(-12), // Already expired -> blocked from FEFO!
      initialQty: 30,
      currentQty: 4,
      status: 'expired',
      notes: 'Tự động ngừng bán do quá hạn sử dụng',
      createdAt: nowIso,
    },
    {
      id: 'bat-3',
      productId: 'prd-sunscreen-fluid',
      vendorId: 'vnd-atelier',
      sku: 'KD-SUN-50',
      batchCode: 'LOT-KD-2604',
      manufactureDate: '2026-04-15',
      expiryDate: '2028-04-15',
      initialQty: 90,
      currentQty: 84,
      status: 'active',
      documentId: 'doc-3',
      createdAt: nowIso,
    },
    {
      id: 'bat-4',
      productId: 'prd-hair-elixir',
      vendorId: 'vnd-botanica',
      sku: 'LB-HAIR-50',
      batchCode: 'LOT-LB-2609',
      manufactureDate: '2026-09-01',
      expiryDate: '2028-09-01',
      initialQty: 75,
      currentQty: 70,
      status: 'active',
      documentId: 'doc-4',
      createdAt: nowIso,
    },
    {
      id: 'bat-4b',
      productId: 'prd-hair-elixir',
      vendorId: 'vnd-botanica',
      sku: 'LB-HAIR-100',
      batchCode: 'LOT-LB-2610',
      manufactureDate: '2026-09-12',
      expiryDate: '2028-09-12',
      initialQty: 45,
      currentQty: 45,
      status: 'active',
      documentId: 'doc-4',
      createdAt: nowIso,
    },
    {
      id: 'bat-5',
      productId: 'prd-velvet-lipstick',
      vendorId: 'vnd-atelier',
      sku: 'BB-LIP-01',
      batchCode: 'LOT-BB-2611',
      manufactureDate: '2026-10-01',
      expiryDate: '2028-10-01',
      initialQty: 100,
      currentQty: 96,
      status: 'active',
      documentId: 'doc-5',
      createdAt: nowIso,
    },
    {
      id: 'bat-5b',
      productId: 'prd-velvet-lipstick',
      vendorId: 'vnd-atelier',
      sku: 'BB-LIP-02',
      batchCode: 'LOT-BB-2612',
      manufactureDate: '2026-10-01',
      expiryDate: '2028-10-01',
      initialQty: 80,
      currentQty: 80,
      status: 'active',
      documentId: 'doc-5',
      createdAt: nowIso,
    },
    {
      id: 'bat-6',
      productId: 'prd-body-ceramide',
      vendorId: 'vnd-botanica',
      sku: 'TMV-BODY-250',
      batchCode: 'LOT-TMV-2607',
      manufactureDate: '2026-07-01',
      expiryDate: '2028-07-01',
      initialQty: 110,
      currentQty: 108,
      status: 'active',
      documentId: 'doc-6',
      createdAt: nowIso,
    },
  ];

  const movements: InventoryMovement[] = [
    {
      id: 'mov-1',
      batchId: 'bat-1',
      productId: 'prd-serum-niacinamide',
      vendorId: 'vnd-atelier',
      sku: 'AE-NIA-30',
      type: 'import',
      deltaQty: 40,
      balanceAfter: 40,
      reason: 'Nhập kho lô đầu kỳ',
      actorId: 'usr-vendor-1',
      createdAt: nowIso,
    },
    {
      id: 'mov-2',
      batchId: 'bat-1',
      productId: 'prd-serum-niacinamide',
      vendorId: 'vnd-atelier',
      sku: 'AE-NIA-30',
      type: 'export_fefo',
      deltaQty: -2,
      balanceAfter: 8,
      reason: 'Xuất kho tự động FEFO cho đơn #VB-261101',
      referenceOrderId: 'ord-1',
      actorId: 'usr-vendor-1',
      createdAt: nowIso,
    },
  ];

  const orders: Order[] = [
    {
      id: 'ord-1',
      orderNumber: 'VB-261101',
      customerId: 'usr-customer-1',
      customerName: 'Nguyễn Minh Anh',
      customerPhone: '0901234567',
      shippingAddress: '128 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
      vendorId: 'vnd-atelier',
      vendorName: 'Véra Official Atelier',
      items: [
        {
          productId: 'prd-serum-niacinamide',
          productName: 'Tinh Chất Phục Hồi Niacinamide 10% & B5',
          sku: 'AE-NIA-30',
          variantName: 'Chai 30ml',
          quantity: 2,
          unitPrice: 420000,
          batchAllocations: [
            {
              batchId: 'bat-1',
              batchCode: 'LOT-2026-000',
              expiryDate: addDaysIso(42),
              quantity: 2,
            },
          ],
        },
      ],
      subtotal: 840000,
      discountAmount: 84000,
      voucherCode: 'VERA10',
      shippingFee: 0,
      totalAmount: 756000,
      commissionRate: 8,
      commissionAmount: 60480,
      vendorNetAmount: 695520,
      paymentMethod: 'bank_transfer',
      paymentStatus: 'paid',
      status: 'delivered',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'ord-2',
      orderNumber: 'VB-261102',
      customerId: 'usr-customer-1',
      customerName: 'Nguyễn Minh Anh',
      customerPhone: '0901234567',
      shippingAddress: '128 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
      vendorId: 'vnd-botanica',
      vendorName: 'Botanica Maison VN',
      items: [
        {
          productId: 'prd-hair-elixir',
          productName: 'Dầu Dưỡng Tóc Phục Hồi Hư Tổn Oud & Olive',
          sku: 'LB-HAIR-50',
          variantName: 'Chai thủy tinh 50ml',
          quantity: 1,
          unitPrice: 620000,
          batchAllocations: [],
        },
      ],
      subtotal: 620000,
      discountAmount: 0,
      shippingFee: 30000,
      totalAmount: 650000,
      commissionRate: 8,
      commissionAmount: 49600,
      vendorNetAmount: 600400,
      paymentMethod: 'cod',
      paymentStatus: 'unpaid',
      status: 'pending',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const reviews: Review[] = [
    {
      id: 'rev-1',
      productId: 'prd-serum-niacinamide',
      vendorId: 'vnd-atelier',
      orderId: 'ord-1',
      customerId: 'usr-customer-1',
      customerName: 'Nguyễn Minh Anh',
      rating: 5,
      shopRating: 5,
      comment:
        'Kiểm tra mã lô trên bao bì khớp 100% với phiếu công bố hiển thị trên sàn. Giao nhanh, đóng gói chắc chắn.',
      createdAt: nowIso,
    },
  ];

  const promotions: Promotion[] = [
    {
      id: 'prm-1',
      code: 'VERA10',
      title: 'Ưu đãi thành viên mới — Giảm 10% đơn từ 400.000đ',
      sponsorType: 'platform',
      discountType: 'percent',
      discountValue: 10,
      minOrderAmount: 400000,
      maxUses: 500,
      usedCount: 1,
      active: true,
      expiresAt: '2027-06-30',
    },
    {
      id: 'prm-2',
      code: 'ATELIER50K',
      title: 'Tài trợ bởi Véra Official Atelier — Giảm 50.000đ',
      sponsorType: 'vendor',
      vendorId: 'vnd-atelier',
      discountType: 'fixed',
      discountValue: 50000,
      minOrderAmount: 500000,
      maxUses: 200,
      usedCount: 0,
      active: true,
      expiresAt: '2027-03-31',
    },
  ];

  const commissionConfig: CommissionConfig = {
    defaultRate: 8,
    categoryRates: {
      skincare: 8,
      makeup: 10,
      haircare: 8,
      bodycare: 7,
    },
    tierFees: {
      standard: 0,
      pro: 1200000,
      flagship: 2500000,
    },
    sponsoredListingFee: 800000,
  };

  const auditLogs: AuditLog[] = [
    {
      id: 'aud-1',
      actorId: 'system',
      actorName: 'Hệ thống Véra Beauty',
      actorRole: 'admin',
      action: 'BATCH_EXPIRE_LOCK',
      targetType: 'batch',
      targetId: 'bat-3-exp',
      summary: 'Tự động khóa lô LOT-KD-2401 (Kem Chống Nắng Khoáng Chất) do đã quá hạn sử dụng.',
      createdAt: nowIso,
    },
  ];

  return {
    users,
    adminPassHash: null,
    vendors,
    brands,
    categories,
    products,
    documents,
    batches,
    movements,
    orders,
    reviews,
    promotions,
    commissionConfig,
    auditLogs,
  };
}

class MarketplaceStore {
  private dbCache: MarketplaceDatabase | null = null;
  private mongoClient: MongoClient | null = null;
  private mongoDb: Db | null = null;
  private storageMode: 'mongodb' | 'json' = 'json';

  async init(): Promise<void> {
    const uri = process.env.MONGODB_URI?.trim();
    if (uri) {
      try {
        this.mongoClient = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
        await this.mongoClient.connect();
        this.mongoDb = this.mongoClient.db('vera_beauty');
        this.storageMode = 'mongodb';
        const stateDoc = await this.mongoDb.collection<{ _id: string; payload: MarketplaceDatabase }>('marketplace_state').findOne({ _id: 'primary' });
        if (stateDoc?.payload) {
          this.dbCache = stateDoc.payload;
        } else {
          this.dbCache = createInitialSeed();
          await this.persist();
        }
        return;
      } catch (err) {
        console.warn('MongoDB unavailable, using persistent local store fallback:', err instanceof Error ? err.message : err);
        this.storageMode = 'json';
      }
    }

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        this.dbCache = JSON.parse(raw) as MarketplaceDatabase;
      } catch {
        this.dbCache = createInitialSeed();
        await this.persist();
      }
    } else {
      this.dbCache = createInitialSeed();
      await this.persist();
    }
  }

  getMode(): 'mongodb' | 'json' {
    return this.storageMode;
  }

  getState(): MarketplaceDatabase {
    if (!this.dbCache) {
      this.dbCache = createInitialSeed();
    }
    // Automatically mark any past-expiry active batches as expired on read
    const today = new Date().toISOString().slice(0, 10);
    let mutated = false;
    for (const batch of this.dbCache.batches) {
      if (batch.status === 'active' && batch.expiryDate <= today) {
        batch.status = 'expired';
        mutated = true;
      }
    }
    if (mutated) {
      void this.persist();
    }
    return this.dbCache;
  }

  async persist(): Promise<void> {
    if (!this.dbCache) return;
    if (this.storageMode === 'mongodb' && this.mongoDb) {
      await this.mongoDb
        .collection<{ _id: string; payload: MarketplaceDatabase }>('marketplace_state')
        .updateOne(
          { _id: 'primary' },
          { $set: { payload: this.dbCache } },
          { upsert: true }
        );
      return;
    }

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(this.dbCache, null, 2), 'utf8');
    fs.renameSync(tmpFile, DATA_FILE);
  }
}

export const store = new MarketplaceStore();
