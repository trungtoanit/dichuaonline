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
| Tự kết nối khi mở / F5 dashboard (username mặc định `huyntrang140806`, nhớ kênh dùng gần nhất) | Có |
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

### 5. Phát LIVE và kết nối bình luận

1. Bắt đầu LIVE trên TikTok (từ OBS bằng *Server URL + Stream Key* nếu tài khoản có quyền, hoặc qua TikTok LIVE Studio).
2. Mở dashboard: phần mềm **tự kết nối** username đã điền (mặc định `huyntrang140806`). Muốn đổi kênh thì nhập username khác → **Kết nối**, lần sau sẽ nhớ kênh này.
3. Huy hiệu góc phải chuyển sang **LIVE @tenkenh** là đang nhận bình luận.

> **Nếu dùng TikTok LIVE Studio**: cần có nguồn kiểu Browser / Link / trang web để dán URL overlay. Nếu không có, dựng hình trong OBS (camera + overlay) → bấm **Start Virtual Camera** → trong LIVE Studio thêm nguồn camera và chọn **OBS Virtual Camera**. Chỉ mở dashboard **không** tự đưa bình luận vào video.
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
