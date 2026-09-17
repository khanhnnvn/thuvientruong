# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Sáu nhóm người dùng, mỗi trường học là một tenant độc lập:
- **super_admin** — quản trị toàn hệ thống (không thuộc trường nào), duyệt/từ chối/khoá đăng ký trường mới. Dùng khu vực riêng `/super-admin`.
- **admin** (Nhà trường) — quản trị viên của 1 trường, quản lý người dùng, cấu hình.
- **librarian** (Thủ thư) — vận hành hàng ngày: quản lý đầu sách/bản sao, cho mượn/nhận trả, xử lý đặt trước và phạt.
- **teacher** (Giáo viên) — tra cứu, mượn sách, đặt trước.
- **student** (Học sinh) — tra cứu, mượn sách, đặt trước, xem lịch sử mượn/phạt của mình.
- **parent** (Phụ huynh) — chỉ xem tình trạng mượn/phạt của con mình, không thao tác.

Bối cảnh: nhân viên thư viện dùng sản phẩm nhiều giờ/ngày trên desktop (bàn thủ thư); giáo viên/học sinh/phụ huynh dùng ngắn, thường xen giữa việc khác, có thể trên điện thoại.

## Product Purpose

Phần mềm quản lý thư viện cho trường học, mô hình SaaS đa trường (multi-tenant): một hệ thống phục vụ nhiều trường độc lập, mỗi trường có URL riêng dạng `/{slug}` (ví dụ `/truong_nguyensieu`), dữ liệu cách ly hoàn toàn giữa các trường. Trường mới tự đăng ký qua form công khai, chờ super_admin duyệt trước khi dùng được.

Thành công = thủ thư quản lý được toàn bộ vòng đời sách (nhập kho → cho mượn → nhận trả → xử lý quá hạn/phạt) nhanh và chính xác; học sinh/giáo viên tự tra cứu và đặt trước mà không cần hỏi thủ thư; phụ huynh nắm được tình trạng mượn của con.

## Positioning

Không phải phần mềm thư viện dùng chung 1 trường rồi cài riêng cho từng nơi — đây là 1 hệ thống lõi phục vụ nhiều trường cùng lúc qua tự đăng ký + duyệt tập trung, nên một trường mới có thể tự vào dùng trong vài phút thay vì cần triển khai riêng.

## Operating Context

- Đăng ký trường: form công khai `/dang-ky` → trạng thái `pending` → super_admin duyệt tại `/super-admin` → trường đăng nhập tại `/{slug}/login`.
- Vòng đời mượn/trả: thủ thư cho mượn (gán bản sao cụ thể cho người dùng, hạn mặc định 14 ngày) → có thể gia hạn 1 lần (+7 ngày, trừ khi có người đặt trước) → trả sách (tự sinh phạt nếu quá hạn) → phạt được thu/miễn tại quầy.
- Đặt trước: học sinh/giáo viên đặt khi hết bản sao sẵn có; khi có sách trả về, hệ thống tự chuyển đặt trước cũ nhất sang "sẵn sàng" + thông báo.
- Vai trò super_admin và vai trò trong-trường dùng 2 khu vực đăng nhập/route tách biệt hoàn toàn (`/super-admin` vs `/{slug}/...`).
- Triển khai: Next.js (frontend) + Go (backend) + PostgreSQL, chạy trên máy chủ riêng qua Cloudflare Tunnel tại `thuvien.vietsoftware.vn`.

## Capabilities and Constraints

- Bắt buộc dùng Next.js (App Router, TypeScript) + Tailwind CSS cho frontend, Go cho backend — không đổi stack trong lần thiết kế lại này.
- Toàn bộ giao diện bằng **tiếng Việt**.
- Cách ly dữ liệu đa khách hàng (tenant isolation) là ràng buộc kỹ thuật cứng — không được để giao diện gợi ý/rò rỉ dữ liệu giữa các trường.
- Slug trường nằm ngay trên URL (`/{slug}/...`), là một phần hiển thị thường trực trong giao diện (ví dụ trong sidebar) để người dùng luôn biết đang ở trường nào.
- Chưa xác định: có cần chế độ tối (dark mode) hay không — để mở, thiết kế lại có thể quyết định.

## Brand Commitments

Chưa có bộ nhận diện thương hiệu cố định nào cho sản phẩm này (xác nhận với người dùng: tự do thiết kế mới, không cần bám theo brand của domain mẹ vietsoftware.vn). Tên hiển thị hiện tại: "Thư viện Trường học" — có thể giữ hoặc điều chỉnh nhẹ trong quá trình thiết kế lại, miễn giữ đúng nghĩa.

## Evidence on Hand

Không có ảnh bìa sách, logo trường, hay nội dung thật nào được cung cấp — toàn bộ dữ liệu hiện có là dữ liệu demo tự sinh (trường "truong-demo", vài đầu sách mẫu). Thiết kế lại không được bịa thêm bằng chứng/logo trường thật; dùng placeholder trung tính cho ảnh bìa sách khi cần.

## Product Principles

1. Thủ thư là người dùng chính, dùng sản phẩm nhiều giờ mỗi ngày — ưu tiên tốc độ thao tác và mật độ thông tin hợp lý hơn là hiệu ứng thị giác cầu kỳ ở các màn hình vận hành.
2. Landing page và trang đăng ký trường là nơi thuyết phục nhà trường tin tưởng đăng ký — cần chuyên nghiệp, đáng tin cậy, rõ ràng về lợi ích.
3. Luôn hiển thị rõ đang ở trường nào (slug) và đang ở vai trò gì — tránh nhầm lẫn giữa các phiên đăng nhập khác nhau.
4. Trạng thái (mượn/quá hạn/đã trả, pending/approved/rejected/suspended...) phải nhận diện được ngay bằng màu sắc/nhãn nhất quán trên toàn hệ thống.
5. Giao diện phải dùng tốt trên cả desktop (bàn thủ thư) lẫn điện thoại (phụ huynh/học sinh tra cứu nhanh).

## Accessibility & Inclusion

Không có yêu cầu accessibility đặc thù nào được xác nhận riêng cho dự án này; áp dụng thực hành tốt tiêu chuẩn (tương phản đủ, điều hướng bàn phím, nhãn rõ ràng cho form).
