// Bình luận giả lập để kiểm thử overlay/bộ lọc khi chưa LIVE.
const USERS = ['minhanh88', 'thanhnguyen', 'hoanglong', 'thuytrang', 'quocbao', 'lanphuong', 'ducmanh', 'ngocha'];
const TEXTS = [
  'Shop ơi, sản phẩm này còn không?',
  'Giá bao nhiêu vậy shop?',
  'Cho mình xin tư vấn nhé!',
  'Size M còn không ạ?',
  'Ship về Đà Nẵng mất mấy ngày?',
  'Đẹp quá 😍',
  'Có màu đen không shop?',
  'Chốt 1 cái nha',
  'Xin chào cả nhà 👋',
  'Freeship không shop ơi?',
  // các dòng dưới để thử bộ lọc
  'Giá bao nhiêu vậy shop?',
  'aaaaaaaaaaaaaaa',
  'Vào link này mua rẻ hơn nè www.spam.xyz',
];

const JOINERS = ['taman.phat', 'dieuhien', 'minhtue99', 'thienphuc', 'anlac', 'baongoc', 'huecuong', 'thanhtinh'];

export function startDemo(onComment, onMember = () => {}, onActivity = () => {}, intervalMs = 1500) {
  let n = 0;
  const joinTimer = setInterval(() => {
    const username = Math.random() < 0.5 ? JOINERS[Math.floor(Math.random() * JOINERS.length)] : `phattu${Math.floor(Math.random() * 900 + 100)}`;
    onMember({ username, nickname: username, avatar: null, at: Date.now(), demo: true });
  }, 2300);
  const timer = setInterval(() => {
    const username = USERS[Math.floor(Math.random() * USERS.length)];
    onComment({
      id: `demo-${Date.now()}-${n++}`,
      username,
      nickname: username,
      avatar: null,
      text: TEXTS[Math.floor(Math.random() * TEXTS.length)],
      at: Date.now(),
      demo: true,
    });
  }, intervalMs);
  const likeTimer = setInterval(() => {
    const username = USERS[Math.floor(Math.random() * USERS.length)];
    const kind = Math.random() < 0.1 ? 'gift' : 'like';
    onActivity({ username, nickname: username, avatar: null, kind, count: kind === 'gift' ? 1 : 15, demo: true });
  }, 900);
  return () => {
    clearInterval(likeTimer);
    clearInterval(timer);
    clearInterval(joinTimer);
  };
}
