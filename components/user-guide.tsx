"use client";

import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";

type Role = "sales" | "technical" | "admin";

const roleCopy: Record<Role, { label: string; intro: string; actions: Array<[string, string, string]> }> = {
  sales: {
    label: "Người dùng",
    intro: "Bạn dùng Trợ lý để tra cứu thông tin đã được xác minh, xem nguồn tham khảo và theo dõi các câu hỏi cần chuyên gia hỗ trợ.",
    actions: [["1", "Đặt câu hỏi", "Mô tả tình huống khách hàng càng cụ thể càng tốt."], ["2", "Kiểm tra căn cứ", "Đọc nguồn và mức căn cứ trước khi tư vấn khách hàng."], ["3", "Theo dõi kết quả", "Nếu chưa thể trả lời an toàn, hệ thống sẽ báo lý do và tạo yêu cầu cho chuyên gia."]],
  },
  technical: {
    label: "Chuyên gia",
    intro: "Ngoài việc dùng Trợ lý, bạn xử lý yêu cầu chuyên gia và biến câu trả lời đã xác nhận thành tri thức dùng lại.",
    actions: [["1", "Tiếp nhận yêu cầu", "Ưu tiên câu hỏi thiếu tài liệu hoặc cần xác nhận chuyên môn."], ["2", "Xác nhận nội dung", "Viết câu trả lời chính xác, có thể tái sử dụng."], ["3", "Bổ sung tri thức", "Xuất bản nội dung đã xác minh để câu hỏi tương tự được hỗ trợ tốt hơn."]],
  },
  admin: {
    label: "Quản trị viên",
    intro: "Bạn vận hành toàn bộ vòng lặp: cấu hình Agent, chính sách truy xuất, tri thức, người dùng và yêu cầu chuyên gia.",
    actions: [["1", "Thiết lập an toàn", "Kiểm tra Agent đang hoạt động và ngưỡng phản hồi phù hợp."], ["2", "Duy trì tri thức", "Đảm bảo tài liệu được xuất bản, xác minh và còn hiệu lực."], ["3", "Theo dõi vận hành", "Xem yêu cầu chuyên gia để nhận ra khoảng trống tri thức và cải thiện kho."]],
  },
};

const settingRows = [
  ["Cấu hình Agent", "Giọng điệu, vai trò và hướng dẫn bổ sung", "Thay đổi cách Agent diễn đạt; không được dùng để bỏ qua quy tắc an toàn."],
  ["Tri thức & tìm kiếm", "Nguồn, xếp hạng, ngưỡng phản hồi và chủ đề nhạy cảm", "Quyết định tài liệu nào được dùng và khi nào phải chuyển chuyên gia."],
  ["Nhà cung cấp AI", "Lưu cấu hình riêng và bật/tắt ngay trên từng Agent", "Gemini và Azure có thể cùng được lưu, nhưng chỉ một Agent được bật. Tắt cả hai vẫn cho phép tra cứu nguồn xác minh, nhưng không tạo phản hồi tổng hợp hoặc quét gộp bài."],
  ["Quản trị người dùng", "Tài khoản, vai trò và khôi phục bảo mật", "Quyết định ai được vận hành Kho tri thức, Yêu cầu chuyên gia và Cài đặt. Quản trị viên có thể đặt lại mật khẩu hoặc tắt 2FA của tài khoản đang hoạt động; các phiên cũ sẽ bị thu hồi."],
];

export default function UserGuide() {
  const [viewerRole, setViewerRole] = useState<Role>("sales");
  const [guideRole, setGuideRole] = useState<Role>("sales");
  useEffect(() => {
    void fetch("/api/auth/me").then((response) => response.ok ? response.json() : null).then((body) => {
      const role = body?.user?.role as Role | undefined;
      if (role && roleCopy[role]) { setViewerRole(role); setGuideRole(role); }
    });
  }, []);
  const canManageKnowledge = viewerRole === "technical" || viewerRole === "admin";
  const canManageSettings = viewerRole === "admin";
  const current = roleCopy[guideRole];

  return <AppShell screen="guide">
    <main className="guide-page">
      <header className="guide-hero">
        <div><small>KHỞI ĐỘNG NHANH / HƯỚNG DẪN SỬ DỤNG</small><h1>Hiểu rõ trước khi phản hồi khách hàng.</h1><p>Trợ lý giúp bạn tìm căn cứ từ Kho kiến thức, minh bạch mức độ tin cậy và chuyển đúng việc cho chuyên gia khi chưa đủ an toàn.</p></div>
        <nav className="guide-anchors" aria-label="Mục lục hướng dẫn"><a href="#bat-dau">Bắt đầu</a><a href="#agent">Luồng Agent</a><a href="#tri-thuc">Kho tri thức</a><a href="#cai-dat">Cài đặt</a></nav>
      </header>

      <section className="guide-section guide-start" id="bat-dau">
        <div className="guide-section-heading"><small>01 / BẮT ĐẦU THEO VAI TRÒ</small><h2>Công việc của bạn trong vòng lặp tri thức</h2><p>Chọn vai trò để xem hướng dẫn phù hợp. Quyền thực tế vẫn được kiểm tra theo tài khoản khi bạn mở chức năng.</p></div>
        <div className="guide-role-picker" role="tablist" aria-label="Chọn vai trò hướng dẫn">{(Object.keys(roleCopy) as Role[]).map((role) => <button className={guideRole === role ? "active" : ""} key={role} role="tab" aria-selected={guideRole === role} onClick={() => setGuideRole(role)}>{roleCopy[role].label}</button>)}</div>
        <div className="guide-role-card"><div><span className="guide-kicker">DÀNH CHO {current.label.toUpperCase()}</span><h3>{current.intro}</h3></div><ol>{current.actions.map(([order, title, copy]) => <li key={order}><span>{order}</span><div><b>{title}</b><p>{copy}</p></div></li>)}</ol></div>
        <div className="guide-quick-actions"><a className="ops-button primary" href="/assistant">Mở Trợ lý</a>{canManageKnowledge && <a className="ops-button" href="/knowledge-base">Mở Kho tri thức</a>}{canManageKnowledge && <a className="ops-button" href="/unanswered">Mở Yêu cầu chuyên gia</a>}{canManageSettings && <a className="ops-button" href="/settings?tab=retrieval">Mở Cài đặt tri thức</a>}</div>
      </section>

      <section className="guide-section" id="agent">
        <div className="guide-section-heading"><small>02 / LUỒNG AGENT</small><h2>Một câu hỏi được xử lý như thế nào?</h2><p>Agent không tự đoán. Hệ thống chỉ trả lời khi nguồn và chính sách cho phép; các nhánh dưới đây là những kết quả bạn có thể gặp.</p></div>
        <div className="guide-flow" aria-label="Luồng xử lý câu hỏi"><article><span className="guide-flow-step">01</span><h3>Nhận câu hỏi</h3><p>Ghi nhận câu hỏi và ngữ cảnh hội thoại gần nhất để hiểu đúng yêu cầu.</p></article><article><span className="guide-flow-step">02</span><h3>Tìm nguồn</h3><p>Tìm trong các bài đã xuất bản, ưu tiên nguồn xác minh, còn hiệu lực và đúng chính sách.</p></article><article><span className="guide-flow-step">03</span><h3>Đánh giá căn cứ</h3><p>Hệ thống tổng hợp độ phù hợp, chất lượng nguồn và chính sách phản hồi.</p></article></div>
        <div className="guide-outcomes"><article className="guide-outcome grounded"><span>ĐỦ CĂN CỨ</span><h3>Phản hồi có nguồn</h3><p>Agent tổng hợp câu trả lời và hiển thị nguồn tham khảo cùng mức căn cứ để nhân viên tự quyết định cách tư vấn.</p></article><article className="guide-outcome suggestions"><span>AGENT TẠM KHÔNG SẴN SÀNG</span><h3>Gợi ý từ Kho kiến thức</h3><p>Nếu nguồn vẫn đủ điều kiện, hệ thống cung cấp các thông tin đã xác minh để tham khảo — không tự tạo câu trả lời suy đoán.</p></article><article className="guide-outcome escalation"><span>CHƯA AN TOÀN</span><h3>Tạo yêu cầu chuyên gia</h3><p>Không có tài liệu, mức căn cứ dưới ngưỡng, hoặc chính sách yêu cầu xác nhận: hệ thống nêu lý do thật và tạo yêu cầu xử lý.</p></article></div>
      </section>

      <section className="guide-section guide-evidence">
        <div className="guide-section-heading"><small>03 / ĐIỂM CĂN CỨ</small><h2>Điểm cao không có nghĩa là “đúng tuyệt đối”.</h2><p>Đây là mức độ hệ thống có căn cứ phù hợp để phản hồi, được đối chiếu với ngưỡng do quản trị viên cấu hình.</p></div>
        <div className="guide-evidence-grid"><article><b>Điểm được hình thành từ đâu?</b><p>Mức độ phù hợp của tài liệu, chất lượng/phiên bản nguồn, sự đa dạng nguồn và chính sách của từng bài.</p></article><article><b>Khi nào phải thận trọng hơn?</b><p>Chủ đề nhạy cảm dùng ngưỡng nghiêm ngặt hơn. Bài có chính sách “cần chuyên gia” luôn được chuyển xử lý.</p></article><article><b>Bạn nên làm gì?</b><p>Đọc nguồn trích dẫn, đối chiếu bối cảnh khách hàng và không dùng phản hồi làm cam kết khi chưa đủ căn cứ.</p></article></div>
      </section>

      <section className="guide-section" id="tri-thuc">
        <div className="guide-section-heading"><small>04 / KHO TRI THỨC & GỘP BÀI</small><h2>Biến câu trả lời được xác nhận thành giá trị dùng lại.</h2><p>Kho tri thức chỉ sử dụng bài đã xuất bản theo chính sách hiện hành. Gộp bài giúp giảm nội dung trùng lặp nhưng không tự động thay đổi tài liệu.</p></div>
        <div className="guide-merge-flow"><article><span>01</span><h3>Chọn phạm vi</h3><p>Lọc bài đã xuất bản theo nhóm dịch vụ, nguồn được xác minh và ngưỡng tương đồng.</p></article><article><span>02</span><h3>Agent đề xuất</h3><p>Agent hỗ trợ đối chiếu các cặp có khả năng trùng, sau bước lọc trước bằng truy xuất.</p></article><article><span>03</span><h3>Người dùng duyệt</h3><p>Chuyên gia hoặc quản trị viên xem bản nháp rồi mới phê duyệt xuất bản và lưu trữ nguồn.</p></article></div>
        <aside className="guide-note"><b>Lưu ý vận hành</b><p>Gộp bài cần Agent đang bật và sẵn sàng. Khi Agent tắt hoặc mất kết nối, hệ thống sẽ chặn quét gộp và giải thích lý do; dữ liệu bài viết không bị thay đổi.</p></aside>
      </section>

      <section className="guide-section" id="cai-dat">
        <div className="guide-section-heading"><small>05 / CÀI ĐẶT</small><h2>Mỗi tùy chỉnh thay đổi điều gì?</h2><p>Chỉ quản trị viên thay đổi cấu hình. Hãy điều chỉnh có chủ đích, kiểm tra kết quả sau khi lưu và không dùng cấu hình để nới lỏng nguyên tắc an toàn.</p></div>
        <div className="guide-settings-table" role="table" aria-label="Tác động của các cấu hình">{settingRows.map(([section, setting, impact]) => <div role="row" key={section}><div role="cell"><b>{section}</b></div><div role="cell"><span>{setting}</span></div><div role="cell"><p>{impact}</p></div></div>)}</div>
        {canManageSettings && <a className="ops-button primary" href="/settings?tab=retrieval">Đi tới Cài đặt hệ thống</a>}
      </section>

      <section className="guide-closing"><div><small>GHI NHỚ</small><h2>Minh bạch với điều bạn biết — và điều cần chuyên gia xác nhận.</h2><p>Hướng dẫn này phản ánh các chức năng hiện đang có trong ứng dụng. Cấu hình và quyền tài khoản quyết định thao tác bạn có thể thực hiện.</p></div><a className="ops-button" href="#bat-dau">Quay lại bắt đầu ↑</a></section>
    </main>
  </AppShell>;
}
