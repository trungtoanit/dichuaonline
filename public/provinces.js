// 63 tỉnh thành (trước sáp nhập 2025) cho trò chơi "bản đồ quê": tên (giọng đọc dùng), label (tên ngắn ghi trên màn hình, nếu có)
// và cách người xem hay gõ.
// Dùng chung cho máy chủ (src/server.js) và overlay (public/overlay-que.html). Mã id khớp public/vn-map.js.
export const PROVINCES = [
  { id: 'VN-HN', name: 'Hà Nội', aliases: ['ha noi', 'hn', 'thu do'] },
  { id: 'VN-SG', name: 'Thành phố Hồ Chí Minh', label: 'HCM', aliases: ['ho chi minh', 'tp hcm', 'tphcm', 'hcm', 'sai gon', 'sg'] },
  { id: 'VN-HP', name: 'Hải Phòng', aliases: ['hai phong'] },
  { id: 'VN-DN', name: 'Đà Nẵng', aliases: ['da nang'] },
  { id: 'VN-CT', name: 'Cần Thơ', aliases: ['can tho'] },
  { id: 'VN-03', name: 'Hà Giang', aliases: ['ha giang'] },
  { id: 'VN-04', name: 'Cao Bằng', aliases: ['cao bang'] },
  { id: 'VN-02', name: 'Lào Cai', aliases: ['lao cai', 'sa pa', 'sapa'] },
  { id: 'VN-01', name: 'Lai Châu', aliases: ['lai chau'] },
  { id: 'VN-53', name: 'Bắc Kạn', aliases: ['bac kan', 'bac can'] },
  { id: 'VN-07', name: 'Tuyên Quang', aliases: ['tuyen quang'] },
  { id: 'VN-09', name: 'Lạng Sơn', aliases: ['lang son'] },
  { id: 'VN-06', name: 'Yên Bái', aliases: ['yen bai'] },
  { id: 'VN-71', name: 'Điện Biên', aliases: ['dien bien'] },
  { id: 'VN-69', name: 'Thái Nguyên', aliases: ['thai nguyen'] },
  { id: 'VN-54', name: 'Bắc Giang', aliases: ['bac giang'] },
  { id: 'VN-70', name: 'Vĩnh Phúc', aliases: ['vinh phuc'] },
  { id: 'VN-68', name: 'Phú Thọ', aliases: ['phu tho'] },
  { id: 'VN-13', name: 'Quảng Ninh', aliases: ['quang ninh', 'ha long'] },
  { id: 'VN-05', name: 'Sơn La', aliases: ['son la'] },
  { id: 'VN-56', name: 'Bắc Ninh', aliases: ['bac ninh'] },
  { id: 'VN-61', name: 'Hải Dương', aliases: ['hai duong'] },
  { id: 'VN-66', name: 'Hưng Yên', aliases: ['hung yen'] },
  { id: 'VN-14', name: 'Hòa Bình', aliases: ['hoa binh'] },
  { id: 'VN-63', name: 'Hà Nam', aliases: ['ha nam'] },
  { id: 'VN-20', name: 'Thái Bình', aliases: ['thai binh'] },
  { id: 'VN-67', name: 'Nam Định', aliases: ['nam dinh'] },
  { id: 'VN-18', name: 'Ninh Bình', aliases: ['ninh binh'] },
  { id: 'VN-21', name: 'Thanh Hóa', aliases: ['thanh hoa', 'xu thanh'] },
  { id: 'VN-22', name: 'Nghệ An', aliases: ['nghe an', 'xu nghe'] },
  { id: 'VN-23', name: 'Hà Tĩnh', aliases: ['ha tinh'] },
  { id: 'VN-24', name: 'Quảng Bình', aliases: ['quang binh'] },
  { id: 'VN-25', name: 'Quảng Trị', aliases: ['quang tri'] },
  { id: 'VN-26', name: 'Huế', aliases: ['thua thien hue', 'hue'] },
  { id: 'VN-27', name: 'Quảng Nam', aliases: ['quang nam', 'hoi an', 'xu quang'] },
  { id: 'VN-29', name: 'Quảng Ngãi', aliases: ['quang ngai'] },
  { id: 'VN-28', name: 'Kon Tum', aliases: ['kon tum'] },
  { id: 'VN-31', name: 'Bình Định', aliases: ['binh dinh', 'quy nhon'] },
  { id: 'VN-30', name: 'Gia Lai', aliases: ['gia lai', 'pleiku', 'pleku'] },
  { id: 'VN-32', name: 'Phú Yên', aliases: ['phu yen', 'tuy hoa'] },
  { id: 'VN-33', name: 'Đắk Lắk', aliases: ['dak lak', 'dac lac', 'daklak', 'buon ma thuot', 'buon me thuot', 'bmt'] },
  { id: 'VN-34', name: 'Khánh Hòa', aliases: ['khanh hoa', 'nha trang', 'cam ranh'] },
  { id: 'VN-72', name: 'Đắk Nông', aliases: ['dak nong', 'dac nong', 'daknong'] },
  { id: 'VN-58', name: 'Bình Phước', aliases: ['binh phuoc'] },
  { id: 'VN-35', name: 'Lâm Đồng', aliases: ['lam dong', 'da lat', 'bao loc'] },
  { id: 'VN-36', name: 'Ninh Thuận', aliases: ['ninh thuan', 'phan rang'] },
  { id: 'VN-37', name: 'Tây Ninh', aliases: ['tay ninh'] },
  { id: 'VN-57', name: 'Bình Dương', aliases: ['binh duong', 'thu dau mot'] },
  { id: 'VN-40', name: 'Bình Thuận', aliases: ['binh thuan', 'phan thiet', 'mui ne'] },
  { id: 'VN-39', name: 'Đồng Nai', aliases: ['dong nai', 'bien hoa'] },
  { id: 'VN-41', name: 'Long An', aliases: ['long an'] },
  { id: 'VN-45', name: 'Đồng Tháp', aliases: ['dong thap', 'sa dec', 'cao lanh'] },
  { id: 'VN-43', name: 'Bà Rịa – Vũng Tàu', aliases: ['ba ria vung tau', 'vung tau', 'ba ria', 'brvt', 'con dao'] },
  { id: 'VN-44', name: 'An Giang', aliases: ['an giang', 'chau doc', 'long xuyen'] },
  { id: 'VN-46', name: 'Tiền Giang', aliases: ['tien giang', 'my tho'] },
  { id: 'VN-49', name: 'Vĩnh Long', aliases: ['vinh long'] },
  { id: 'VN-50', name: 'Bến Tre', aliases: ['ben tre'] },
  { id: 'VN-47', name: 'Kiên Giang', aliases: ['kien giang', 'rach gia', 'phu quoc'] },
  { id: 'VN-51', name: 'Trà Vinh', aliases: ['tra vinh'] },
  { id: 'VN-73', name: 'Hậu Giang', aliases: ['hau giang', 'vi thanh'] },
  { id: 'VN-52', name: 'Sóc Trăng', aliases: ['soc trang'] },
  { id: 'VN-55', name: 'Bạc Liêu', aliases: ['bac lieu'] },
  { id: 'VN-59', name: 'Cà Mau', aliases: ['ca mau'] },
];

export const PROVINCE_BY_ID = new Map(PROVINCES.map((p) => [p.id, p]));

// Bỏ dấu, đ→d, chữ thường, chỉ giữ chữ/số cách nhau một dấu cách
export function normalizeVi(text) {
  return ` ${String(text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

// Mỗi cách gõ có cả dạng viết liền ("nghe an" → "nghean")
const MATCHERS = PROVINCES.flatMap((p) =>
  [...new Set(p.aliases.flatMap((a) => [a, a.replace(/ /g, '')]))].map((a) => ({ id: p.id, key: ` ${a} ` })),
).sort((a, b) => b.key.length - a.key.length);

// Tìm tỉnh trong bình luận. Nhiều tỉnh: ưu tiên tỉnh đứng ngay sau chữ "quê", không thì tỉnh nhắc đến đầu tiên.
export function detectProvince(text) {
  const s = normalizeVi(text);
  const hits = [];
  for (const m of MATCHERS) {
    let i = s.indexOf(m.key);
    while (i >= 0) {
      const end = i + m.key.length - 1;
      // tên dài đã khớp ở chỗ này thì bỏ tên ngắn nằm bên trong ("ba ria vung tau" chứ không phải "vung tau")
      if (!hits.some((h) => i < h.end && end > h.start)) hits.push({ id: m.id, start: i, end });
      i = s.indexOf(m.key, i + 1);
    }
  }
  if (!hits.length) return null;
  hits.sort((a, b) => a.start - b.start);
  const afterQue = hits.find((h) => /(^| )que( (toi|minh|em|anh|chi|tao|o|la|me|nha))* $/.test(s.slice(0, h.start + 1)));
  return (afterQue ?? hits[0]).id;
}
