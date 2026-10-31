import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPromotion } from '../src/promote.js';

test('nhắc lên chức / thăng chức hoặc xin chức vụ là được lên 1 bậc', () => {
  for (const t of ['lên chức', 'Thăng chức cho em đi sếp', 'sếp ơi em muốn lên chức', 'nâng chức em với',
    'cho em làm tổ trưởng', 'Xin lên Quản Đốc ạ', 'em muốn làm phó giám đốc']) assert.equal(detectPromotion(t), true, t);
});

test('không coi câu kể / câu từ chối là lời xin', () => {
  for (const t of ['Tui đc làm tổ trưởng lun r kkk', '2 phó giám đốc bao hay sao đây', 'cho em vô làm',
    'xin chào cả nhà', 'em không muốn lên chức đâu']) assert.equal(detectPromotion(t), false, t);
});

import { detectNegative } from '../src/promote.js';

test('nhận ra bình luận tiêu cực, bỏ qua góp ý kỹ thuật', () => {
  assert.equal(detectNegative('công ty này bóc lột quá'), true);
  assert.equal(detectNegative('chán quá muốn nghỉ việc'), true);
  assert.equal(detectNegative('đm lương bèo'), true);
  assert.equal(detectNegative('hơi lag nha sếp'), false);
  assert.equal(detectNegative('Nguyễn Văn A chăm chỉ'), false);
  assert.equal(detectNegative('cho em làm tổ trưởng'), false);
  assert.equal(detectNegative('đi ngủ thôi, đeo khẩu trang, máy điện xám'), false);
});

import { detectTired } from '../src/promote.js';

test('kêu mệt thì nhận ra, chữ khác không nhầm', () => {
  for (const t of ['mệt quá', 'Hôm nay mệt xỉu', 'met moi qua', 'mệttt']) assert.equal(detectTired(t), 'mệt', t);
  for (const t of ['làm cực quá', 'cực khổ ghê', 'vất vả quá sếp']) assert.equal(detectTired(t), 'cực', t);
  for (const t of ['mét vuông', 'hàng mới về', 'xin chào', 'đẹp cực kỳ']) assert.equal(detectTired(t), null, t);
});

import { detectJobRequest } from '../src/promote.js';

test('xin làm thư ký / kế toán', () => {
  assert.equal(detectJobRequest('cho em làm thư ký với sếp'), 'thu-ky');
  assert.equal(detectJobRequest('Em muốn làm kế toán'), 'ke-toan');
  assert.equal(detectJobRequest('xin làm ke toan'), 'ke-toan');
  assert.equal(detectJobRequest('thư ký xinh quá'), null);
  assert.equal(detectJobRequest('cho em làm tổ trưởng'), null);
});

import { detectTimesheet, detectLoveBoss } from '../src/promote.js';

test('chấm công / yêu sếp', () => {
  assert.equal(detectTimesheet('sếp ơi chấm công chưa'), true);
  assert.equal(detectTimesheet('chăm chỉ làm việc'), false);
  assert.equal(detectLoveBoss('em yêu sếp Toán nhất'), true);
  assert.equal(detectLoveBoss('iu sep qua'), false); // "iu sếp" giờ là luật thư ký riêng
  assert.equal(detectLoveBoss('em không yêu sếp đâu'), false);
});

import { detectChairman } from '../src/promote.js';

test('nhắc chủ tịch', () => {
  assert.equal(detectChairman('cho em lên chủ tịch luôn'), true);
  assert.equal(detectChairman('thăng chức em lên chủ tịch đi'), true);
  assert.equal(detectChairman('chủ tịch tập đoàn đẹp trai quá'), true);
  assert.equal(detectChairman('chủ nhật đi chơi'), false);
});

import { detectMachineRequest, detectNoPay, detectCV } from '../src/promote.js';

test('xin làm máy theo tên máy', () => {
  assert.equal(detectMachineRequest('cho em làm máy in offset'), 'offset');
  assert.equal(detectMachineRequest('xin đứng máy bế'), 'be');
  assert.equal(detectMachineRequest('em qua máy dán nha sếp'), 'dan');
  assert.equal(detectMachineRequest('cho em đứng máy tạo sóng'), 'song');
  assert.equal(detectMachineRequest('cho tui làm khu thành phẩm'), 'thanhpham');
  assert.equal(detectMachineRequest('cho em làm cán màng'), 'canmang');
  assert.equal(detectMachineRequest('máy in flexo đẹp quá'), null);
  assert.equal(detectMachineRequest('cho em làm tổ trưởng'), null);
});

test('chưa có lương / nộp CV', () => {
  assert.equal(detectNoPay('sếp ơi em chưa có lương'), true);
  assert.equal(detectNoPay('chưa được trả lương'), true);
  assert.equal(detectNoPay('lương cao quá'), false);
  assert.equal(detectCV('nộp CV ở đâu vậy'), true);
  assert.equal(detectCV('công ty có tuyển công nhân không'), true);
  assert.equal(detectCV('máy chạy nhanh ghê'), false);
  assert.equal(detectPromotion('tăng chức cho em'), true);
});

import { detectSalaryRequest } from '../src/promote.js';

test('xin mức lương cụ thể', () => {
  assert.equal(detectSalaryRequest('nâng 40tr cho\nemm'), 40);
  assert.equal(detectSalaryRequest('tăng lương lên 50 triệu đi sếp'), 50);
  assert.equal(detectSalaryRequest('cho em 30 củ'), 30);
  assert.equal(detectSalaryRequest('trừ lương 5tr'), null);
  assert.equal(detectSalaryRequest('máy này 40 triệu hả'), null);
});

import { detectRaise } from '../src/promote.js';

test('lên lương = tăng 1 hạng', () => {
  assert.equal(detectRaise('sếp ơi cho em lên lương'), true);
  assert.equal(detectRaise('tăng lương đi sếp'), true);
  assert.equal(detectRaise('không tăng lương à'), false);
  assert.equal(detectRaise('lương cao ghê'), false);
});

import { detectFlirt } from '../src/promote.js';

test('mê gái', () => {
  assert.equal(detectFlirt('thằng này mê gái lắm'), true);
  assert.equal(detectFlirt('mẹ em gái'), false);
});

import { detectHateBoss } from '../src/promote.js';

test('ghét sếp', () => {
  assert.equal(detectHateBoss('em ghét sếp quá'), true);
  assert.equal(detectHateBoss('ghet sep'), true);
  assert.equal(detectHateBoss('em không ghét sếp đâu'), false);
  assert.equal(detectHateBoss('yêu sếp'), false);
});

import { detectGuardWord } from '../src/promote.js';

test('nói bảo vệ', () => {
  assert.equal(detectGuardWord('anh bảo vệ đẹp trai'), true);
  assert.equal(detectGuardWord('bao ve'), true);
  assert.equal(detectGuardWord('bảo vẻ'), true);
});

import { detectDrinking } from '../src/promote.js';

test('đi nhậu', () => {
  assert.equal(detectDrinking('tối nay đi nhậu không anh em'), true);
  assert.equal(detectDrinking('di nhau'), true);
  assert.equal(detectDrinking('đi làm thôi'), false);
  assert.equal(detectDrinking('Nhậu không sếp'), true);
  assert.equal(detectDrinking('tối nay nhậu'), true);
  assert.equal(detectDrinking('gặp nhau nhé'), false);
});

import { detectBloodsucker } from '../src/promote.js';

test('hút máu', () => {
  assert.equal(detectBloodsucker('công ty hút máu'), true);
  assert.equal(detectBloodsucker('máu lửa quá'), false);
});

import { detectStrike } from '../src/promote.js';

test('đình công', () => {
  assert.equal(detectStrike('anh em đình công đi'), true);
  assert.equal(detectStrike('đình chỉ công tác'), false);
});

import { detectPraiseBoss } from '../src/promote.js';

test('khen sếp đẹp trai', () => {
  assert.equal(detectPraiseBoss('sếp đẹp trai quá'), true);
  assert.equal(detectPraiseBoss('sếp Toán dzai ghê'), true);
  assert.equal(detectPraiseBoss('sếp không đẹp trai'), false);
  assert.equal(detectPraiseBoss('máy đẹp quá'), false);
});

import { detectJoin } from '../src/promote.js';

test('xin vào làm', () => {
  assert.equal(detectJoin('cho em vào làm với'), true);
  assert.equal(detectJoin('xin vô làm'), true);
  assert.equal(detectJoin('em muốn vào làm ở đây'), true);
  assert.equal(detectJoin('vào làm thôi anh em'), false);
  assert.equal(detectJoin('cho em làm thư ký'), false);
});

import { detectDiligent } from '../src/promote.js';

test('chăm chỉ', () => {
  assert.equal(detectDiligent('em làm chăm chỉ lắm sếp'), true);
  assert.equal(detectDiligent('cham chi'), true);
  assert.equal(detectDiligent('không chăm chỉ gì hết'), false);
});

import { detectBossWife } from '../src/promote.js';

test('muốn làm vợ sếp', () => {
  assert.equal(detectBossWife('em muốn làm vợ sếp'), true);
  assert.equal(detectBossWife('cho em làm vo sep nha'), true);
  assert.equal(detectBossWife('bỏ sếp đi'), false);
});

import { detectEffort } from '../src/promote.js';

test('cố gắng', () => {
  assert.equal(detectEffort('em sẽ cố gắng hơn'), true);
  assert.equal(detectEffort('không chịu cố gắng'), false);
});

import { detectResign } from '../src/promote.js';

test('từ chức', () => {
  assert.equal(detectResign('em xin từ chức'), true);
  assert.equal(detectResign('không muốn từ chức đâu'), false);
  assert.equal(detectResign('thăng chức cho em'), false);
});

import { detectLazy } from '../src/promote.js';

test('lười', () => {
  assert.equal(detectLazy('hôm nay lười quá'), true);
  assert.equal(detectLazy('lam bieng qua'), true);
  assert.equal(detectLazy('lưới cá'), false);
  assert.equal(detectLazy('em không lười đâu'), false);
});

import { detectMaternity } from '../src/promote.js';

test('nghỉ thai sản', () => {
  assert.equal(detectMaternity('sếp cho em nghỉ thai sản'), true);
  assert.equal(detectMaternity('em sắp đẻ rồi sếp ơi'), true);
  assert.equal(detectMaternity('chuyển dạ rồi'), true);
  assert.equal(detectMaternity('đẹp trai quá'), false);
  assert.equal(detectMaternity('đi đâu đó'), false);
});

import { detectAdvance } from '../src/promote.js';

test('ứng lương', () => {
  assert.equal(detectAdvance('Em hết tiền rồi ứng lương sếp ơi'), true);
  assert.equal(detectAdvance('cho em ung luong'), true);
  assert.equal(detectAdvance('ứng trước lương nha sếp'), true);
  assert.equal(detectAdvance('ủng hộ sếp'), false);
  assert.equal(detectAdvance('tăng lương'), false);
});

import { detectPayCut } from '../src/promote.js';

test('giảm lương', () => {
  assert.equal(detectPayCut('sếp giảm lương nó đi'), true);
  assert.equal(detectPayCut('giam luong'), true);
  assert.equal(detectPayCut('tăng lương'), false);
});

import { detectQuit } from '../src/promote.js';

test('nghỉ việc', () => {
  assert.equal(detectQuit('em xin nghỉ việc'), true);
  assert.equal(detectQuit('nghi viec luon'), true);
  assert.equal(detectQuit('cho em nghỉ'), true);
  assert.equal(detectQuit('Nghỉ thôi'), true);
  assert.equal(detectQuit('em nghĩ là được'), false);
  assert.equal(detectQuit('nghi ngờ quá'), false);
});

import { detectIuBoss } from '../src/promote.js';

test('iu sếp', () => {
  assert.equal(detectIuBoss('iu sếp nhiều'), true);
  assert.equal(detectIuBoss('Iuuu sếppp'), true);
  assert.equal(detectIuBoss('yêu sếp'), false);
  assert.equal(detectIuBoss('ko iu sếp'), false);
});

import { detectGreetBoss } from '../src/promote.js';

test('chào sếp', () => {
  assert.equal(detectGreetBoss('em chào sếp Toán'), true);
  assert.equal(detectGreetBoss('Hello sếp'), true);
  assert.equal(detectGreetBoss('chào mọi người'), false);
});

import { detectSwitchMachine } from '../src/promote.js';

test('làm việc khác', () => {
  assert.equal(detectSwitchMachine('cho em làm việc khác đi sếp'), true);
  assert.equal(detectSwitchMachine('đổi máy khác'), true);
  assert.equal(detectSwitchMachine('làm việc chăm chỉ'), false);
});

import { detectCurse } from '../src/promote.js';

test('chửi tục', () => {
  assert.equal(detectCurse('đéo thích'), true);
  assert.equal(detectCurse('Đếch quan tâm'), true);
  assert.equal(detectCurse('éo biết'), true);
  assert.equal(detectCurse('đeo khẩu trang'), false);
  assert.equal(detectCurse('qua đèo'), false);
  assert.equal(detectCurse('kéo dài'), false);
});

import { detectPayDemand } from '../src/promote.js';

test('trả lương', () => {
  assert.equal(detectPayDemand('sếp trả lương đi'), true);
  assert.equal(detectPayDemand('tra luong'), true);
  assert.equal(detectPayDemand('tăng lương'), false);
});

import { detectLessHours } from '../src/promote.js';

test('giảm giờ làm', () => {
  assert.equal(detectLessHours('sếp giảm giờ làm đi'), true);
  assert.equal(detectLessHours('bớt giờ làm'), true);
  assert.equal(detectLessHours('tăng giờ làm'), false);
});
