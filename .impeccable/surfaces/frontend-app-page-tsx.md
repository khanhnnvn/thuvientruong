---
version: 1
slug: "frontend-app-page-tsx"
primary_target: "frontend/app/page.tsx"
related_targets: ["frontend/app/dang-ky/page.tsx"]
---

## Direction contract

**THESIS:** Toàn bộ hệ thống là tấm bảng tin/thời khoá biểu lớp học phóng to — mỗi tính năng, mỗi trạng thái là một khối màu dứt khoát ghim trên bảng, thay vì một dashboard SaaS trắng-xanh vô hình. Từ chối kiểu bố cục "tiêu đề trái, ảnh app phải, 3 điểm nổi bật" mà mọi phần mềm quản lý đều dùng.

**OWN-WORLD:** Nền cork/kem ấm `#F3E9D6`, mực than `#2B2621`; bảng màu trạng thái/tính năng dứt khoát: xanh timetable `#3E7CB1`, cam `#E8963C`, gạch `#C1502E`, lá `#6B8F5C`. Chữ hiển thị: Outfit hoặc Plus Jakarta Sans (bo tròn, tự tin, không phải serif "sách"); chữ nội dung/bảng dữ liệu: DM Sans hoặc IBM Plex Sans. Thẻ/khối có góc bo nhẹ + đổ bóng mỏng như giấy ghim, đôi khi nghiêng nhẹ 1-2°. Bảng dữ liệu giữ đường kẻ lưới rõ như thời khoá biểu in, không phải bảng viền-ẩn tối giản. Một đơn vị nhịp baseline duy nhất chi phối mọi khoảng cách chữ.

**STORY:** Nhà trường vào trang chủ, thấy ngay sản phẩm "đang hoạt động" qua các khối ghim màu (mượn/trả, đặt trước, báo cáo) → tin đây là công cụ vận hành thật, không phải trang marketing rỗng → bấm "Đăng ký cho trường của bạn".

**FIRST VIEWPORT:** Bảng ghim toàn màn hình đầu: trái (7/12) tiêu đề + mô tả ngắn + CTA đăng ký + ô nhập mã trường; phải (5/12) cụm 2-3 thẻ ghim nghiêng nhẹ mô phỏng thông báo thật (ví dụ "Sách abc sắp đến hạn trả", "3 trường mới chờ duyệt"); dưới cùng dải 4 khối màu tính năng ngang hàng thời khoá biểu.

**FORM:** Grounded direction #3 trong danh sách tự xếp hạng (Bảng Tin Lớp Học / Thời khoá biểu lớp học), seed key `2863db8e`, đã nâng cấp bằng 3 raise nêu trong payload quyết định (nhịp baseline, hàng thời gian không xuống dòng, một điểm nhấn phóng to mỗi màn hình).

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
