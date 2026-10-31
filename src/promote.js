// Nhận ra bình luận xin thăng chức -> được lên 1 bậc.
// Vd. "lên chức", "thăng chức cho em", "cho em làm tổ trưởng", "xin lên quản đốc".
import { normalize } from './filter.js';

// Tên chức vụ (không dấu): câu xin có nêu chức vụ cũng tính là xin thăng chức
const TITLES = ['giam doc', 'pho gd', 'quan doc', 'truong ca', 'to truong', 'tho dung may', 'tho chinh', 'cong nhan'];

// Cứ nhắc "lên chức" / "tăng chức" / "thăng chức" là được lên 1 bậc
const PROMOTE = /\b(len chuc|tang chuc|thang chuc|nang chuc)\b/;
// Dấu hiệu đây là lời xin / đề nghị (không phải câu kể)
const REQUEST = /\b(xin|cho (em|e|tui|toi|minh|anh|a|chi|c|tao|t|bon em|tui em)\b|muon (lam|len)|cho lam|cho len|de (em|e|tui) lam|(lam|len) .* (duoc khong|dc khong|dc ko|duoc ko|nha sep|di sep|nhe sep))\b/;
const REFUSE = /\b(khong|ko|k|hong|chua) (muon |can |thich )?(len|tang|thang|nang) chuc\b/;

// Gộp chữ kéo dài ("Choo", "Xinnnn", "vớiii") về một chữ để nhận đúng từ
const clean = (text) => ` ${normalize(text).replace(/[^a-z0-9 ]/g, ' ').replace(/([a-z])\1+/g, '$1').replace(/\s+/g, ' ')} `;

export function detectPromotion(text) {
  const t = clean(text);
  if (REFUSE.test(t)) return false;
  if (PROMOTE.test(t)) return true;
  return REQUEST.test(t) && TITLES.some((k) => t.includes(` ${k} `));
}

// Bình luận tiêu cực (chửi bậy, chê bai, than vãn) -> bị giảm chức. Góp ý kỹ thuật ("lag", "giật") không tính.
const NEGATIVE = [
  'lua dao', 'boc lot', 'bat cong', 'te qua', 'do te', 'chan qua', 'chan that', 'chan ghe', 'nhu cut', 'nhu shit',
  'nghi viec', 'bo viec', 'dinh cong', 'ghet', 'xam xi', 'vo van', 'nham nhi', 'tao lao', 'ao ma', 'lam mau',
  // không dùng từ trùng nghĩa vô hại khi bỏ dấu: ngu/ngủ, dien/điện, deo/đeo, xam/xám
  'dm', 'vl', 'vcl', 'vkl', 'clm', 'dek', 'dech', 'oc cho', 'ngu vl', 'ngu nhu',
  'luong beo', 'luong thap', 'tru luong', 'no luong', 'khong tra luong',
];
export function detectNegative(text) {
  const t = clean(text);
  return NEGATIVE.some((w) => t.includes(` ${w} `));
}

// Kêu mệt ("mệt quá", "mệt xỉu", không dấu "met qua") -> chuyển xuống làm lao công.
// Bỏ dấu thì "mét" cũng thành "met", nên chỉ tính chữ "mệt" có dấu hoặc cụm không dấu rõ nghĩa.
const TIRED = /\bmet (qua|moi|xiu|ghe|that|vl|lam|wa)\b/;
// Kêu cực ("làm cực quá", "cực khổ", "vất vả") cũng xuống làm lao công
const HARD = /\b(lam cuc|cuc qua|cuc kho|cuc ghe|cuc lam|cuc that|cuc wa|vat va)\b/;
// Trả về lý do ('mệt' / 'cực') hoặc null
export function detectTired(text) {
  if (/mệt/.test(String(text).toLowerCase().normalize('NFC')) || TIRED.test(clean(text))) return 'mệt';
  if (HARD.test(clean(text))) return 'cực';
  return null;
}

// Xin làm vị trí văn phòng: "cho em làm thư ký", "xin làm kế toán", "em muốn làm kế toán"
const OFFICE = [['thu ky', 'thu-ky'], ['ke toan', 'ke-toan']];
export function detectJobRequest(text) {
  const t = clean(text);
  if (!REQUEST.test(t) && !/\b(lam|len) (thu ky|ke toan) (nha|nhe|di|duoc|dc|voi)\b/.test(t)) return null;
  return OFFICE.find(([k]) => t.includes(` ${k} `))?.[1] ?? null;
}

// Nhắc "chấm công" -> bị trừ lương
export const detectTimesheet = (text) => clean(text).includes(' cham cong ');

// "Yêu sếp" -> được tăng lương và thăng chức
export function detectLoveBoss(text) {
  const t = clean(text);
  return /\b(yeu|thuong|love) (sep|ong chu)\b/.test(t) && !/\b(khong|ko|k|hong|chua|het) (yeu|thuong|love) (sep|ong chu)\b/.test(t);
}

// "Iu sếp" (viết kiểu teen) -> cho làm Thư ký (khác "yêu sếp" là thăng chức + tăng lương)
export function detectIuBoss(text) {
  const t = clean(text);
  return /\biu (sep|ong chu)\b/.test(t) && !/\b(khong|ko|k|hong|chua|het) iu (sep|ong chu)\b/.test(t);
}

// Nhắc "chủ tịch" -> cho ra làm bảo vệ
export const detectChairman = (text) => clean(text).includes(' chu tich ');

// Xin làm máy: "cho em làm máy in offset", "xin đứng máy bế", "em qua máy dán nha".
// Trùng tên máy nào thì cho làm máy đó. Từ dễ trùng nghĩa (sóng/sống, bế/bé, dán/dân, bồi/bởi) phải đi kèm chữ "máy".
const MACHINE_NAMES = [
  ['thanh pham', 'thanhpham'], ['can mang', 'canmang'], ['flexo', 'flexo'], ['ofset', 'offset'],
  ['tao song', 'song'], ['may song', 'song'], ['may be', 'be'], ['may dan', 'dan'], ['may boi', 'boi'],
];
const MACHINE_ASK = /\b(dung may|lam may|vao may|qua may|sang may|chuyen (qua|sang|ve)|ve may|xuong may|lam (o )?khu|ve khu|qua khu)\b/;
export function detectMachineRequest(text) {
  const t = clean(text).replace(/\bmay in /g, 'may ').replace(/\bmay (ofset|flexo)\b/g, '$1');
  if (!REQUEST.test(t) && !MACHINE_ASK.test(t)) return null;
  return MACHINE_NAMES.find(([k]) => t.includes(` ${k} `))?.[1] ?? null;
}

// Than "chưa có lương" / "chưa được trả lương" -> bị đuổi việc
export const detectNoPay = (text) => /\b(chua|khong|ko|k|hong) (co|nhan|duoc|thay)? ?(tra )?luong\b/.test(clean(text));

// Hỏi nộp CV / xin việc / tuyển dụng -> mời nộp ở Tuấn Tú
export const detectCV = (text) => /\b((nop|gui|dua|nap) (cv|ho so|don)|xin viec|tim viec|tuyen dung|co tuyen|tuyen (nguoi|nhan vien|cong nhan|tho)|can (nguoi|tuyen))\b/.test(clean(text));

// Xin mức lương cụ thể: "nâng 40tr cho em", "tăng lương lên 50 triệu", "cho em 30 củ" -> số triệu
export function detectSalaryRequest(text) {
  const t = clean(text);
  if (!/\b(nang|tang|len|xin|cho|muon|dc|duoc)\b/.test(t) || /\b(tru|giam|cat|phat)\b/.test(t)) return null;
  const m = t.match(/\b(\d{1,4}) ?(tr|trieu|cu|chai)\b/);
  return m ? Number(m[1]) : null;
}

// "lên lương", "tăng lương", "nâng lương" (không nêu số) -> tăng 1 hạng lương (+3–6 triệu)
export function detectRaise(text) {
  const t = clean(text);
  return /\b(len|tang|nang) luong\b/.test(t) && !/\b(khong|ko|k|hong|chua|dung) (muon |can |duoc |dc )?(len|tang|nang) luong\b/.test(t);
}

// "Mê gái" -> cho ra làm bảo vệ
export const detectFlirt = (text) => /\bme gai\b/.test(clean(text));

// "Ghét sếp" -> ra làm bảo vệ hoặc lao công
export function detectHateBoss(text) {
  const t = clean(text);
  return /\b(ghet|chan|gian) (sep|ong chu)\b/.test(t) && !/\b(khong|ko|k|hong|het|dau co) (ghet|chan|gian) (sep|ong chu)\b/.test(t);
}

// Nhắc "bảo vệ" -> trừ lương 1 triệu
export const detectGuardWord = (text) => clean(text).includes(' bao ve ');

// "Đi nhậu" -> cho làm lao công
// Có chữ "nhậu" (đúng dấu, để không nhầm "nhau" như "gặp nhau"), hoặc viết không dấu kiểu "di nhau", "lai rai"
export const detectDrinking = (text) => /nhậu/.test(String(text).toLowerCase().normalize('NFC'))
  || /\b(di nhau|nhau nhet|lai rai|nhau khong|nhau ko|nhau di)\b/.test(clean(text));

// "Hút máu" -> cho ra làm bảo vệ
export const detectBloodsucker = (text) => /\bhut mau\b/.test(clean(text));

// "Đình công" -> đuổi việc
export const detectStrike = (text) => /\b(dinh cong|bai cong|lan cong)\b/.test(clean(text));

// Khen sếp đẹp trai -> cho làm thư ký
export function detectPraiseBoss(text) {
  const t = clean(text);
  if (!/\b(sep|ong chu)\b/.test(t) || /\b(khong|ko|k|hong|chang|xau)\b/.test(t)) return false;
  return /\b(dep trai|dep zai|dzai|dz|dep qua|dep vl|dep ghe|qua dep|dep nhat|bao dep|handsome|dep)\b/.test(t);
}

// Xin vào làm: "cho em vào làm", "xin vô làm", "muốn vào làm" -> kêu nộp CV
export const detectJoin = (text) => /\b((cho|xin|muon|de|nhan) ((em|e|tui|toi|minh|anh|a|chi|c|t|tao|con|chau) )?(xin )?(vao|vo) lam|nhan (em|e|tui|toi|minh|anh|chi|t) (vao|vo|lam)|tuyen (em|e|tui|toi|minh|anh|chi|t) )/.test(clean(text));

// "Chăm chỉ" -> tăng lương 1–3 triệu
export function detectDiligent(text) {
  const t = clean(text);
  return /\bcham chi\b/.test(t) && !/\b(khong|ko|k|hong|chang|chua|it|kem) (co |duoc |dc )?cham chi\b/.test(t);
}

// Muốn làm vợ sếp -> cho làm thư ký
export const detectBossWife = (text) => /\b(vo|bo) (sep|ong chu)\b/.test(clean(text)) && /vợ|\bvo (sep|ong chu)\b/.test(String(text).toLowerCase().normalize('NFC'));

// "Cố gắng" -> tăng lương ngẫu nhiên 1–3 triệu
export function detectEffort(text) {
  const t = clean(text);
  return /\bco gang\b/.test(t) && !/\b(khong|ko|k|hong|chang|chua) (chiu )?co gang\b/.test(t);
}

// Muốn từ chức -> cho làm lao công
export function detectResign(text) {
  const t = clean(text);
  return /\btu chuc\b/.test(t) && !/\b(khong|ko|k|hong|chua|dung|dau co) (muon |can |thich )?tu chuc\b/.test(t);
}

// Lười / làm biếng -> cho ra làm bảo vệ. Không dấu thì "luoi" trùng "lưới", "lưỡi" nên chỉ tính cụm rõ nghĩa
export function detectLazy(text) {
  const t = clean(text);
  if (/\b(khong|ko|k|hong|chang|het) (lam )?(luoi|bieng)\b/.test(t)) return false;
  return /lười/.test(String(text).toLowerCase().normalize('NFC')) || /\b(luoi bieng|luoi qua|luoi lam|luoi ghe|lam bieng)\b/.test(t);
}

// Xin nghỉ thai sản / đi đẻ
export const detectMaternity = (text) => /\b(thai san|nghi de|di de|sap de|xin de|chuyen da)\b/.test(clean(text));

// "Ứng lương" -> cho đi làm Đòi nợ (đi đòi nợ khách hàng cho sếp)
export const detectAdvance = (text) => /\bung (truoc )?luong\b/.test(clean(text));

// "Giảm lương" -> trừ 30% lương
export const detectPayCut = (text) => /\bgiam luong\b/.test(clean(text));

// Có chữ "nghỉ" (đúng dấu, để không nhầm "nghĩ"/"nghi ngờ") hoặc "nghi viec" -> đuổi ra khỏi cổng (xuống ca).
// "Nghỉ đẻ / thai sản" do luật thai sản xử lý trước.
export const detectQuit = (text) => /nghỉ/.test(String(text).toLowerCase().normalize('NFC')) || /\bnghi viec\b/.test(clean(text));

// Chào sếp -> sếp chào lại (hiện bảng chào)
export function detectGreetBoss(text) {
  const t = clean(text);
  return /\b(chao|hello|helo|hi|hai|xin chao) (sep|ong chu|anh toan|sep toan)\b/.test(t);
}

// "Làm việc khác" -> chuyển sang đứng máy khác
export const detectSwitchMachine = (text) => /\b(lam|cho lam|doi|chuyen) (viec|cong viec|may) khac\b/.test(clean(text));

// Chửi tục ("đéo", "đếch", "éo") -> đuổi ra khỏi cổng. Chỉ bắt chữ có dấu để không nhầm "đeo", "đèo".
export const detectCurse = (text) => /(^|[^\p{L}])(đéo|đếch|éo)(?![\p{L}])/u.test(String(text).toLowerCase().normalize('NFC'));

// Đòi "trả lương" -> cho đi làm Bảo vệ ("chưa trả lương" vẫn là luật đuổi việc, xử lý trước)
export const detectPayDemand = (text) => /\btra (tien )?luong\b/.test(clean(text));

// "Giảm giờ làm" -> trừ lương 1–2 triệu
export const detectLessHours = (text) => /\b(giam|bot|it) gio lam\b/.test(clean(text));
