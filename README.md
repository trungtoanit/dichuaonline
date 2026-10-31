# Live Comment Studio

Phần mềm đọc bình luận TikTok LIVE theo thời gian thực và hiển thị chúng thành lớp đồ họa trên video livestream (qua OBS Browser Source).
Phần mềm chỉ **đọc** bình luận, không đăng bình luận thay người dùng.

```
TikTok LIVE ──► Node.js (tiktok-live-connector) ──► Bộ lọc + Hàng đợi + WebSocket ──┬─► Dashboard  /dashboard
                 kết nối, chuẩn hóa dữ liệu        chống spam, điều phối tự động      └─► Overlay    /overlay  (OBS)
```

## Chức năng MVP 1.0

| Chức năng | Trạng thái |
|---|---|
| Kết nối TikTok LIVE bằng username (hoặc dán link `tiktok.com/@ten/live`) | Có |
| Tự động nhận bình luận mới | Có |
| Hiển thị trên dashboard (avatar, @username, nội dung, lý do bị lọc) | Có |
| Hiển thị trên video LIVE qua OBS Browser Source, nền trong suốt | Có |
| Tự động xếp hàng bình luận | Có |
| Hiển thị 1–5 bình luận cùng lúc | Có |
| Tự biến mất sau 3–15 giây | Có |
| Chống spam (gửi quá nhanh, lặp ký tự, link, quá dài) và bình luận trùng | Có |
| Lọc từ khóa không phù hợp (không phân biệt dấu/hoa thường), chặn người dùng | Có |
| Tự kết nối lại khi mất mạng (tối đa 5 lần: 2s, 4s, 8s, 16s, 30s) | Có |
| Tùy chỉnh màu, cỡ chữ, độ rộng, vị trí, độ đậm nền, avatar (áp dụng ngay) | Có |
| Bình luận giả lập để thử khi chưa LIVE | Có |
| Tự kết nối khi mở / F5 dashboard (username mặc định `nguyen.trung.toan`) | Có |
| Overlay **Chùa**: cổng tam quan, đèn lồng, hồ sen; danh sách Phật tử (người vào phiên LIVE), lời chào khi có Phật tử mới | Có |
| Lưu lịch sử bình luận, AI trả lời | Giai đoạn sau |

## Hướng dẫn triển khai

### 1. Chuẩn bị môi trường

- **Node.js 22 trở lên**: tải bản LTS tại https://nodejs.org rồi cài như phần mềm bình thường. Kiểm tra bằng lệnh `node -v`.
- **OBS Studio**: https://obsproject.com
- Một trình duyệt (Chrome, Edge, Safari...) để mở dashboard.

### 2. Cài đặt và chạy

```bash
git clone https://github.com/trungtoanit/dichuaonline.git
cd dichuaonline
npm install
npm start
```

Màn hình sẽ in ra:

```
Dashboard: http://127.0.0.1:3000/dashboard
Overlay  : http://127.0.0.1:3000/overlay
```

Trên macOS có thể **bấm đúp `start.command`** trong Finder thay cho hai lệnh trên (tự cài thư viện lần đầu, tự tìm Node trong `~/.local/node` nếu máy chưa cài Node).

Giữ cửa sổ này mở suốt buổi LIVE (đóng là overlay ngừng nhận bình luận). Nhấn `Ctrl + C` để tắt.

### 3. Thử bằng bình luận giả lập (nên làm trước)

1. Mở `http://127.0.0.1:3000/dashboard`.
2. Bấm **Bình luận giả lập**. Bình luận giả sẽ chạy vào danh sách, một số bị lọc (trùng, link, spam) để bạn thấy bộ lọc hoạt động.
3. Xem khung **Xem trước overlay** (chọn Dọc 9:16 hoặc Ngang 16:9 cho giống khung hình bạn phát).
4. Chỉnh số bình luận, thời gian hiển thị, vị trí, màu... Overlay đổi ngay lập tức.
5. Bấm lại nút để tắt giả lập.

### 4. Đưa overlay lên OBS

1. OBS → **Sources** (Nguồn) → **+** → **Browser** (Trình duyệt).
2. URL: `http://127.0.0.1:3000/overlay` (hoặc bấm **Sao chép URL cho OBS** trên dashboard).
3. Width/Height bằng khung hình phát:
   - TikTok dọc: **1080 × 1920**
   - Ngang: **1920 × 1080**
4. Bỏ chọn *Shutdown source when not visible* để không mất bình luận khi ẩn/hiện nguồn.
5. Kéo nguồn này lên **trên cùng** danh sách Sources (trên camera / màn hình).

Nền overlay trong suốt sẵn, không cần thêm CSS tùy chỉnh trong OBS.

### Overlay Chùa

| URL | Dùng khi |
|---|---|
| `http://127.0.0.1:3000/overlay/chua` | Khung chùa (mái, cột, đèn lồng, sân, hồ sen), **giữa trong suốt** để thấy camera. Đặt nguồn này **trên** camera. |
| `http://127.0.0.1:3000/overlay/chua?nen` | Cảnh chùa đầy đủ (trời, núi, tháp). Dùng làm **nền**: đặt **dưới** camera (camera đã tách nền / chroma key). |

Thiết kế cho khung dọc 1080×1920. Mỗi người vào xem LIVE là một **Phật tử** (avatar làm đầu, mặc áo tràng) đi qua đi lại trong sân chùa, thỉnh thoảng dừng chắp tay vái. Khi ai bình luận, lời bình luận hiện thành **bong bóng trên đầu** người đó (người đó đứng lại cho dễ đọc). Sân hiện tối đa 16 người: người mới vào sẽ thay người im lặng lâu nhất, người đang bình luận luôn được giữ chỗ. TikTok chỉ báo khi có người *vào* chứ không báo khi rời, nên đây là những người vào gần nhất. Nút **Xóa DS Phật tử** trên dashboard để làm mới sân.

### Overlay Nhà máy carton

`http://127.0.0.1:3000/overlay/nha-may`: xưởng sản xuất thùng carton với 7 máy đang chạy (máy tạo sóng, máy in offset, máy cán màng, máy in flexo, máy bồi, máy bế tự động, máy dán tự động) và khu thành phẩm. Mỗi người vào xem LIVE là một **công nhân**: mặt là avatar TikTok thật, đội mũ bảo hộ, mặc áo phản quang, đứng thao tác máy và thỉnh thoảng đi lại quanh máy. Ai bình luận sẽ vẫy tay, lời bình luận hiện thành bong bóng trên đầu. Tối đa 19 công nhân cùng lúc. Đây là cảnh đầy đủ (không trong suốt): đặt nguồn này **dưới** camera, hoặc đặt camera thu nhỏ ở một góc.

### Nhà máy: xuống ca, máy quay, Ông chủ, thăng chức

- **Xuống ca**: công nhân im lặng 10 phút (hoặc nhường chỗ khi nhà máy đủ người) sẽ đi tới **máy chấm công** quẹt thẻ, vẫy tay chào rồi ra **LỐI RA**.
- **Máy quay ảo** (tắt mặc định, khung cảnh tĩnh): thêm `?camera=on` vào URL để tự zoom lần lượt từng máy và lia tới người vừa bình luận.
- **Ông chủ**: khi chủ kênh (username mặc định) vào xem LIVE của chính mình, nhân vật **Ông chủ Toán** xuất hiện, đi tới từng công nhân để khen ngợi, khích lệ. Đặt ảnh ông chủ tại `public/ong-chu-toan.jpg` để dùng làm khuôn mặt (không có thì dùng avatar TikTok).
- **Thăng chức**: điểm chăm chỉ = bình luận (+10), mỗi lượt tim (+1, tối đa 30 mỗi lần), quà (+50/món), chia sẻ (+20), theo dõi (+30). Chức vụ: Học việc (0) → Công nhân (30) → Thợ đứng máy (100) → Tổ trưởng (250) → Trưởng ca (500) → Quản đốc (1000) → Phó giám đốc (2000) → Giám đốc nhà máy (4000). Mũ, đồng phục đổi theo chức vụ; thăng chức có pháo giấy và chúc mừng; **Bảng vinh danh** top 5 ở góc màn hình. Điểm lưu tại `data/ranks.json` nên giữ qua các buổi LIVE.

### Đoàn khách hàng audit

Dashboard có panel **Đoàn khách hàng audit** (mặc định TIKI, MASAN, KINHDO, TUONGAN, BOXME; sửa được). Mỗi đoàn có nút **Tải logo** (PNG/JPG/WEBP/SVG, lưu vào `public/logos/`) và **Mời vào**. Đoàn 4 người (trưởng đoàn + 3 thành viên, thẻ đeo có logo công ty) đi kiểm tra 8 hạng mục, bảng checklist đánh ✅ dần, máy quay đi theo, cuối cùng công bố kết quả. Các đoàn cũng tự đến luân phiên mỗi 6 phút (đặt 0 để tắt). Hãy dùng file logo chính thức mà khách hàng cung cấp.

### Nhạc nền MP3

Panel **🎵 Nhạc nền** trên dashboard: **Tải MP3 lên** (chọn nhiều file, lưu ở `public/music/`), ⏮ ⏯ ⏭, phát bài bất kỳ, âm lượng, trộn bài, xoá bài. Nhạc phát ngay trong overlay nhà máy (bật **Turn on sound** cho nguồn Link trong LIVE Studio / *Control audio via OBS* trong OBS), hết bài tự chuyển bài. Muốn nhạc là một nguồn riêng: thêm nguồn Link `…/nhac`. Khung xem trước trên dashboard luôn tắt tiếng.

Chỉ dùng nhạc bạn có quyền phát (nhạc tự sáng tác, nhạc mua bản quyền, thư viện nhạc miễn phí bản quyền). Nhạc có bản quyền trên TikTok LIVE có thể bị tắt tiếng hoặc cảnh cáo.

### Nhà máy không bao giờ trống

Khi chưa có (hoặc ít) người xem, overlay nhà máy giả lập **5–10 công nhân**: lấy ngẫu nhiên từ `data/nhan-su.json` (chỉ họ tên + bộ phận, dạng `[{"name": "...", "role": "Tổ in"}]`) nếu có, không thì ghép tên tiếng Việt ngẫu nhiên (hư cấu). Người ảo **ra vào liên tục**: vào từ cửa, quẹt thẻ ở máy chấm công ("Vào ca! 💪"), đi tới máy làm việc 45 giây – 2,5 phút rồi quẹt thẻ xuống ca, ra cửa; người mới đến rải rác vài giây một lần. Ô "Công nhân đang ca" tính cả người xem thật lẫn người ảo. Người xem thật luôn được ưu tiên chỗ đứng.

### 5. Phát LIVE và kết nối bình luận

1. Bắt đầu LIVE trên TikTok (từ OBS bằng *Server URL + Stream Key* nếu tài khoản có quyền, hoặc qua TikTok LIVE Studio).
2. Mở dashboard: phần mềm **tự kết nối** username đã điền (mặc định `nguyen.trung.toan`). Muốn xem kênh khác thì nhập username → **Kết nối** (mặc định vẫn giữ nguyên).
3. Huy hiệu góc phải chuyển sang **LIVE @tenkenh** là đang nhận bình luận.

> **Nếu dùng TikTok LIVE Studio**: cần có nguồn kiểu Browser / Link / trang web để dán URL overlay. Nếu không có, dựng hình trong OBS (camera + overlay) → bấm **Start Virtual Camera** → trong LIVE Studio thêm nguồn camera và chọn **OBS Virtual Camera**. Chỉ mở dashboard **không** tự đưa bình luận vào video.
>
> **Dán overlay vào TikTok LIVE Studio (Add link)**: LIVE Studio không nhận địa chỉ `127.0.0.1`/`localhost`. Chạy đường hầm Cloudflare để có địa chỉ `https` công khai:
>
> ```bash
> ~/.local/bin/cloudflared tunnel --no-autoupdate --url http://127.0.0.1:3000
> ```
>
> Lấy dòng `https://….trycloudflare.com` in ra, dán `https://….trycloudflare.com/overlay/nha-may` vào **Add link**. Người truy cập qua đường hầm **chỉ xem** được overlay (dashboard, điều khiển và tải file bị chặn). Mỗi lần chạy lại lệnh, địa chỉ sẽ đổi.
>
> **Nếu LIVE trực tiếp từ điện thoại**: không ghép được overlay vào video. Overlay chỉ dùng được khi phát từ máy tính.

### 6. Kiểm thử trước buổi LIVE thật

- [ ] LIVE thử trên tài khoản phụ, nhờ vài người bình luận.
- [ ] So sánh dashboard và video LIVE: hai màn hình có đồng bộ không, độ trễ bao nhiêu giây.
- [ ] Gửi cùng một câu nhiều lần, gửi link, gửi từ khóa cấm → phải bị lọc.
- [ ] Tắt Wi-Fi 10 giây rồi bật lại → dashboard báo "Đang kết nối lại" rồi tự nhận bình luận tiếp.
- [ ] Khởi động lại `npm start` giữa buổi → OBS tự kết nối lại, không cần làm mới nguồn.

## Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| "@ten hiện không LIVE" / "Failed to retrieve Room ID" | Kiểm tra username đúng chưa và kênh **đang** LIVE. Chờ 1–2 phút sau khi bắt đầu LIVE rồi thử lại. |
| Kết nối được nhưng không có bình luận | Thử lại sau vài phút. Có thể do giới hạn của máy chủ ký (sign server), xem mục Euler Stream bên dưới. |
| OBS không hiện gì | Kiểm tra `npm start` còn chạy, URL đúng, nguồn Browser nằm trên cùng, kích thước nguồn đúng khung hình. |
| Chữ quá nhỏ / to | Chỉnh **Cỡ chữ** và **Độ rộng khung** trên dashboard. |

### Euler Stream API key (tùy chọn)

`tiktok-live-connector` dùng máy chủ ký của Euler Stream. Bản miễn phí có giới hạn lượt dùng. Nếu kết nối hay lỗi, tạo key tại https://www.eulerstream.com rồi chạy:

```bash
EULER_API_KEY=key_cua_ban npm start
```

## Cấu hình máy chủ

| Biến môi trường | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `3000` | Cổng web |
| `HOST` | `127.0.0.1` | Chỉ máy này truy cập được. Đặt `0.0.0.0` nếu OBS chạy trên máy khác trong mạng LAN. Dashboard **không có mật khẩu**, nên chỉ làm vậy trong mạng tin cậy. |
| `EULER_API_KEY` | (trống) | Key Euler Stream, xem ở trên |

Cài đặt hiển thị và bộ lọc được lưu tại `data/settings.json`.

## Lưu ý quan trọng

TikTok **không** cung cấp API công khai để đọc bình luận LIVE. `tiktok-live-connector` là thư viện **không chính thức**, có thể ngừng hoạt động khi TikTok thay đổi hệ thống, và không bảo đảm chạy được ở mọi tài khoản/khu vực. Hãy xem việc kết nối thực tế là hạng mục **bắt buộc phải thử** trước mỗi đợt triển khai, và tự kiểm tra điều khoản sử dụng của TikTok.

## Cấu trúc mã nguồn

```
src/
  server.js         Express + WebSocket, nối các phần lại với nhau
  tiktok.js         Kết nối TikTok LIVE, chuẩn hóa bình luận, tự kết nối lại
  filter.js         Lọc từ khóa, người dùng, link, spam, trùng lặp
  display-queue.js  Hàng đợi: tối đa N bình luận, tự biến mất sau X giây
  settings.js       Cài đặt mặc định, kiểm tra giới hạn, lưu file
  demo.js           Bình luận giả lập
public/
  dashboard.*       Màn hình quản lý
  overlay.html      Lớp hiển thị cho OBS (nền trong suốt)
test/               Kiểm thử bộ lọc và hàng đợi (npm test)
```
