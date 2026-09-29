"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  IconScoreAnalytics,
  IconSafetyShield,
  IconGoldenRules,
  IconRoleSales,
  IconRoleTechnical,
  IconRoleAdmin,
  IconDataProtection,
  IconTipLight,
  IconPillarAssistant,
  IconPillarRetrieval,
  IconPillarProviders,
  IconPillarSecurity,
} from "@/components/ui/guide-icons";

type Role = "sales" | "technical" | "admin";

interface RoleDetails {
  label: string;
  badge: string;
  tagline: string;
  description: string;
  steps: Array<{
    number: string;
    title: string;
    description: string;
    tip: string;
  }>;
}

const roleData: Record<Role, RoleDetails> = {
  sales: {
    label: "Nhân viên hỗ trợ & Tư vấn",
    badge: "Người dùng nghiệp vụ",
    tagline: "Tra cứu chuẩn xác, phản hồi tự tin dựa trên tri thức đã kiểm duyệt",
    description:
      "Bạn sử dụng Trợ lý AI để nhanh chóng tìm câu trả lời có căn cứ xác thực từ kho bài viết nội bộ, xem rõ nguồn trích dẫn và theo dõi tiến độ các câu hỏi được chuyển giao chuyên gia.",
    steps: [
      {
        number: "01",
        title: "Đặt câu hỏi cụ thể theo tình huống",
        description:
          "Nhập câu hỏi kèm bối cảnh thực tế của khách hàng (gói dịch vụ, lỗi phát sinh, hệ thống đang dùng) để Trợ lý đối soát chính xác nhất.",
        tip: "Mẹo: Đặt câu hỏi rõ ràng giúp tăng độ khớp ngữ nghĩa với kho tài liệu.",
      },
      {
        number: "02",
        title: "Kiểm tra nguồn trích dẫn & Điểm căn cứ",
        description:
          "Đọc kỹ phần trích dẫn nguồn kèm theo câu trả lời. Chỉ sử dụng thông tin khi điểm căn cứ đạt mức tin cậy và khớp với trường hợp khách hàng.",
        tip: "Mẹo: Bấm vào số trích dẫn [1], [2] để mở popover đối chiếu trực tiếp đoạn văn bản gốc.",
      },
      {
        number: "03",
        title: "Theo dõi khi hệ thống chuyển tiếp chuyên gia",
        description:
          "Nếu câu hỏi chưa có tài liệu hoặc thuộc chính sách nhạy cảm, Trợ lý sẽ nêu rõ lý do và tự động tạo yêu cầu chuyển chuyên gia xử lý.",
        tip: "Mẹo: Bạn có thể vào mục 'Yêu cầu chuyên gia' để theo dõi khi nào chuyên gia phản hồi.",
      },
    ],
  },
  technical: {
    label: "Chuyên gia kỹ thuật & Thẩm định",
    badge: "Chuyên gia nghiệp vụ",
    tagline: "Giải quyết ca khó, đóng gói kinh nghiệm thành tri thức tái sử dụng",
    description:
      "Ngoài việc sử dụng Trợ lý, bạn là người tiếp nhận các câu hỏi mà AI chưa đủ căn cứ tự tin phản hồi, thẩm định câu trả lời chuyên sâu và đưa vào kho tri thức để nhân bản năng lực cho toàn đội ngũ.",
    steps: [
      {
        number: "01",
        title: "Tiếp nhận & Phân loại yêu cầu tồn đọng",
        description:
          "Truy cập Hàng đợi chuyên gia, ưu tiên các câu hỏi có mức độ khẩn cấp, câu hỏi chưa có tài liệu trong kho hoặc có chính sách bắt buộc chuyên gia xác nhận.",
        tip: "Mẹo: Xem lý do phân loại để biết hệ thống thiếu tài liệu hay do điểm tin cậy thấp.",
      },
      {
        number: "02",
        title: "Soạn câu trả lời chuẩn & Thẩm định",
        description:
          "Viết câu trả lời chi tiết, chuẩn xác về mặt kỹ thuật, có cấu trúc rõ ràng để có thể tái sử dụng lâu dài cho các trường hợp tương tự sau này.",
        tip: "Mẹo: Đối chiếu với các đoạn trích gợi ý trước khi hoàn tất phản hồi.",
      },
      {
        number: "03",
        title: "Đóng gói & Xuất bản bài viết vào Kho tri thức",
        description:
          "Chuyển câu trả lời đã thẩm định thành một bài viết hoàn chỉnh trong Kho kiến thức. Chọn nhóm dịch vụ và chính sách phản hồi phù hợp để AI học và dùng lại ngay.",
        tip: "Mẹo: Sử dụng tính năng Gộp bài viết tương tự để gom các nội dung phân tán làm một.",
      },
    ],
  },
  admin: {
    label: "Quản trị viên hệ thống",
    badge: "Toàn quyền vận hành",
    tagline: "Thiết lập ranh giới an toàn, kiểm soát toàn bộ vòng lặp AI & Tri thức",
    description:
      "Bạn là người định hình quy chuẩn vận hành của toàn bộ hệ thống: kiểm soát nhà cung cấp AI, thiết lập ngưỡng an toàn chống bịa đặt, quản lý kho bài viết và phân quyền bảo mật tài khoản.",
    steps: [
      {
        number: "01",
        title: "Thiết lập ngưỡng an toàn & Ngăn ngừa bịa đặt",
        description:
          "Cấu hình ngưỡng điểm căn cứ tối thiểu (Confidence Threshold) và danh sách chủ đề nhạy cảm bắt buộc chuyển người thật, bảo đảm AI không bao giờ tự suy đoán.",
        tip: "Mẹo: Đặt ngưỡng 70% - 80% để cân bằng giữa tốc độ tự động hóa và độ chính xác.",
      },
      {
        number: "02",
        title: "Quản lý nhà cung cấp AI & Giám sát chi phí/sức khỏe",
        description:
          "Lưu cấu hình và bật tắt linh hoạt giữa Gemini và Azure OpenAI. Hệ thống áp dụng cơ chế 1 nhà cung cấp active tại một thời điểm để bảo đảm tính ổn định tuyệt đối.",
        tip: "Mẹo: Khi tắt cả 2 AI, hệ thống tự động rơi về chế độ gợi ý tri thức an toàn.",
      },
      {
        number: "03",
        title: "Phân quyền người dùng & Khôi phục bảo mật 2FA",
        description:
          "Quản lý tài khoản đội ngũ, phân chia vai trò (Sales, Technical, Admin), giám sát trạng thái 2FA và có quyền đặt lại mật khẩu hoặc thu hồi phiên làm việc khi cần.",
        tip: "Mẹo: Mỗi lần quản trị viên đặt lại 2FA, toàn bộ phiên cũ của tài khoản sẽ bị thu hồi ngay lập tức.",
      },
    ],
  },
};

const settingSpecs = [
  {
    id: "assistant",
    category: "Cấu hình Trợ lý AI",
    badge: "Persona & Prompting",
    color: "blue",
    badgeVariant: "info" as const,
    Icon: IconPillarAssistant,
    focus: "Giọng điệu, vai trò và hướng dẫn bổ sung",
    impact:
      "Điều chỉnh phong cách giao tiếp chuyên nghiệp, cách xưng hô và các lưu ý đặc thù của doanh nghiệp. Lưu ý: Không thể dùng cấu hình này để ép AI bỏ qua quy tắc đối soát an toàn.",
  },
  {
    id: "retrieval",
    category: "Tri thức & Tìm kiếm (RAG)",
    badge: "Retrieval & Policy",
    color: "emerald",
    badgeVariant: "success" as const,
    Icon: IconPillarRetrieval,
    focus: "Kho nguồn, xếp hạng đoạn trích, ngưỡng phản hồi và từ khóa nhạy cảm",
    impact:
      "Quyết định bài viết nào đủ điều kiện trích xuất, mức điểm tương đồng tối thiểu để AI được phép trả lời, và những chủ đề nào phải lập tức chuyển giao cho chuyên gia.",
  },
  {
    id: "providers",
    category: "Nhà cung cấp AI (LLM Provider)",
    badge: "Dual-Engine Switching",
    color: "purple",
    badgeVariant: "brand" as const,
    Icon: IconPillarProviders,
    focus: "Lưu cấu hình riêng biệt và bật/tắt an toàn cho từng Engine",
    impact:
      "Hỗ trợ cả Google Gemini và Azure OpenAI. Cả hai có thể cùng lưu cấu hình, nhưng tại một thời điểm chỉ một Engine được hoạt động. Tắt cả hai hệ thống vẫn tra cứu tài liệu bình thường.",
  },
  {
    id: "users",
    category: "Quản trị người dùng & Bảo mật",
    badge: "RBAC & 2FA Security",
    color: "amber",
    badgeVariant: "warning" as const,
    Icon: IconPillarSecurity,
    focus: "Phân cấp tài khoản, phân quyền thao tác và thu hồi phiên",
    impact:
      "Phân quyền chính xác: Sales (chỉ xem & tra cứu), Technical (xử lý ticket, sửa kho tri thức), Admin (toàn quyền hệ thống). Quản trị viên có thể đặt lại mật khẩu và cưỡng chế thu hồi phiên.",
  },
];

export function GuideScreen() {
  const [viewerRole, setViewerRole] = useState<Role>("sales");
  const [activeRoleTab, setActiveRoleTab] = useState<Role>("sales");

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const role = data?.user?.role as Role | undefined;
        if (role && roleData[role]) {
          setViewerRole(role);
          setActiveRoleTab(role);
        }
      });
  }, []);

  const canManageKnowledge = viewerRole === "technical" || viewerRole === "admin";
  const canManageSettings = viewerRole === "admin";
  const currentRole = roleData[activeRoleTab];

  return (
    <AppShell screen="guide">
      <div className="bento-guide-container">
        {/* ====================================================================
            HERO BANNER CAO CẤP
            ==================================================================== */}
        <header className="bento-guide-hero">
          <div className="bento-guide-hero-content">
            <div className="bento-eyebrow">
              <span className="bento-pulse-dot" /> CẨM NANG & NGUYÊN TẮC VẬN HÀNH
            </div>
            <h1 className="bento-guide-hero-title">
              Hiểu rõ căn cứ trước khi phản hồi.
            </h1>
            <p className="bento-guide-hero-subtitle">
              Trợ lý phản hồi hoạt động dựa trên cơ chế <strong>Grounding đối soát tri thức</strong>:
              chỉ trả lời khi có tài liệu nội bộ đã xác minh, minh bạch mức độ tin cậy và tự động
              chuyển đúng việc cho chuyên gia khi chưa đủ an toàn.
            </p>

            <div className="bento-guide-stat-pills">
              <div className="bento-guide-pill">
                <strong>0%</strong> Bịa đặt tri thức (Anti-hallucination)
              </div>
              <div className="bento-guide-pill">
                <strong>100%</strong> Câu trả lời kèm trích dẫn gốc
              </div>
              <div className="bento-guide-pill">
                <strong>3 Tầng</strong> Bảo vệ chuyển tiếp chuyên gia
              </div>
            </div>
          </div>

          <nav className="bento-guide-quicknav" aria-label="Mục lục hướng dẫn">
            <span className="bento-quicknav-title">MỤC LỤC NHANH</span>
            <a href="#vai-tro" className="bento-quicknav-link">
              <span className="bento-quicknav-num">01</span>
              <span>Quy trình theo Vai trò</span>
            </a>
            <a href="#luong-ai" className="bento-quicknav-link">
              <span className="bento-quicknav-num">02</span>
              <span>Luồng AI Grounding</span>
            </a>
            <a href="#thang-diem" className="bento-quicknav-link">
              <span className="bento-quicknav-num">03</span>
              <span>Thang điểm Căn cứ</span>
            </a>
            <a href="#vong-doi-tri-thuc" className="bento-quicknav-link">
              <span className="bento-quicknav-num">04</span>
              <span>Hợp nhất & Vòng đời tri thức</span>
            </a>
            <a href="#cai-dat" className="bento-quicknav-link">
              <span className="bento-quicknav-num">05</span>
              <span>Danh mục Cài đặt hệ thống</span>
            </a>
          </nav>
        </header>

        {/* ====================================================================
            SECTION 1: BẢNG ĐIỀU HƯỚNG THEO VAI TRÒ
            ==================================================================== */}
        <section className="bento-guide-section" id="vai-tro">
          <div className="bento-section-head">
            <span className="bento-section-step">PHẦN 01</span>
            <h2 className="bento-section-title">Vòng lặp trách nhiệm theo vai trò tài khoản</h2>
            <p className="bento-section-desc">
              Hệ thống được thiết kế theo vòng tròn khép kín: Nhân viên tra cứu → Chuyên gia giải quyết ca khó → Tri thức mới được xuất bản dùng lại cho toàn công ty.
            </p>
          </div>

          {/* Role Tabs */}
          <div className="bento-role-tabs" role="tablist" aria-label="Chọn vai trò">
            {(Object.keys(roleData) as Role[]).map((rKey) => {
              const r = roleData[rKey];
              const isActive = activeRoleTab === rKey;
              return (
                <button
                  key={rKey}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`bento-role-tab ${isActive ? "active" : ""}`}
                  onClick={() => setActiveRoleTab(rKey)}
                >
                  <span className="bento-role-tab-icon">
                    {rKey === "sales" ? (
                      <IconRoleSales size={18} />
                    ) : rKey === "technical" ? (
                      <IconRoleTechnical size={18} />
                    ) : (
                      <IconRoleAdmin size={18} />
                    )}
                  </span>
                  <div className="bento-role-tab-text">
                    <strong>{r.label}</strong>
                    <small>{r.badge}</small>
                  </div>
                  {viewerRole === rKey && (
                    <Badge variant="success" size="sm" className="bento-role-current-tag">
                      Bạn đang ở vai trò này
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Role Content Card */}
          <div className="bento-role-showcase">
            <div className="bento-role-intro-bar">
              <div>
                <span className="bento-role-kicker">{currentRole.badge.toUpperCase()}</span>
                <h3 className="bento-role-headline">{currentRole.tagline}</h3>
                <p className="bento-role-summary">{currentRole.description}</p>
              </div>
            </div>

            <div className="bento-role-steps-grid">
              {currentRole.steps.map((st) => (
                <div className="bento-role-step-card" key={st.number}>
                  <div className="bento-step-header">
                    <span className="bento-step-pill">{st.number}</span>
                    <h4 className="bento-step-heading">{st.title}</h4>
                  </div>
                  <p className="bento-step-body">{st.description}</p>
                  <div className="bento-step-tip">{st.tip}</div>
                </div>
              ))}
            </div>

            {/* Quick Actions cho vai trò */}
            <div className="bento-role-actions-bar">
              <span className="bento-actions-label">Truy cập nhanh chức năng nghiệp vụ:</span>
              <div className="bento-actions-cluster">
                <a className="ui-btn ui-btn-primary ui-btn-md" href="/assistant">
                  Mở Trợ lý thông minh →
                </a>
                {canManageKnowledge && (
                  <a className="ui-btn ui-btn-outline ui-btn-md" href="/knowledge-base">
                    Mở Kho tri thức nội bộ
                  </a>
                )}
                {canManageKnowledge && (
                  <a className="ui-btn ui-btn-outline ui-btn-md" href="/unanswered">
                    Mở Hàng đợi chuyên gia
                  </a>
                )}
                {canManageSettings && (
                  <a className="ui-btn ui-btn-secondary ui-btn-md" href="/settings?tab=retrieval">
                    Mở Cài đặt hệ thống
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ====================================================================
            SECTION 2: ANIMATED FLOW — HÀNH TRÌNH MỘT CÂU HỎI
            ==================================================================== */}
        <section className="bento-guide-section" id="luong-ai">
          <div className="bento-section-head">
            <span className="bento-section-step">PHẦN 02</span>
            <h2 className="bento-section-title">Trợ lý xử lý câu hỏi như thế nào?</h2>
            <p className="bento-section-desc">
              AI không tự do đoán mò thông tin. Mọi câu hỏi đều phải trải qua chu trình kiểm chứng 3 bước độc lập dưới đây:
            </p>
          </div>

          {/* Animated Pipeline Diagram */}
          <div className="bento-pipeline-flow">
            {/* Step 1 */}
            <div className="bento-pipeline-node">
              <div className="bento-node-indicator">
                <span className="bento-node-num">01</span>
                <span className="bento-pulse-ring" />
              </div>
              <div className="bento-node-card">
                <span className="bento-node-tag">TIẾP NHẬN & PHÂN TÍCH</span>
                <h4 className="bento-node-title">Bóc tách câu hỏi & Ngữ cảnh</h4>
                <p className="bento-node-text">
                  Ghi nhận câu hỏi của nhân viên, bóc tách thực thể nghiệp vụ (domain, DNS, cPanel, thanh toán) và gắn kèm ngữ cảnh hội thoại gần nhất để hiểu đúng bản chất vấn đề.
                </p>
              </div>
            </div>

            {/* Connector 1 */}
            <div className="bento-flow-connector" aria-hidden="true">
              <div className="bento-flow-line">
                <span className="bento-flow-particle" />
              </div>
            </div>

            {/* Step 2 */}
            <div className="bento-pipeline-node">
              <div className="bento-node-indicator">
                <span className="bento-node-num">02</span>
                <span className="bento-pulse-ring" />
              </div>
              <div className="bento-node-card">
                <span className="bento-node-tag">ĐỐI SOÁT TRI THỨC</span>
                <h4 className="bento-node-title">Truy xuất RAG từ Kho đã duyệt</h4>
                <p className="bento-node-text">
                  Tìm kiếm theo ngữ nghĩa kết hợp đối chiếu từ khóa trong các bài viết đã xuất bản. Chỉ lấy các bài viết còn hiệu lực và được gắn cờ thẩm định.
                </p>
              </div>
            </div>

            {/* Connector 2 */}
            <div className="bento-flow-connector" aria-hidden="true">
              <div className="bento-flow-line">
                <span className="bento-flow-particle delay" />
              </div>
            </div>

            {/* Step 3 */}
            <div className="bento-pipeline-node">
              <div className="bento-node-indicator">
                <span className="bento-node-num">03</span>
                <span className="bento-pulse-ring" />
              </div>
              <div className="bento-node-card">
                <span className="bento-node-tag">KIỂM ĐỊNH AN TOÀN</span>
                <h4 className="bento-node-title">Đánh giá Điểm & Phân nhánh</h4>
                <p className="bento-node-text">
                  Đối chiếu điểm tương đồng với Ngưỡng tin cậy (Threshold) được Quản trị viên cấu hình. Kiểm tra chính sách bài viết xem có thuộc diện bắt buộc chuyên gia hay không.
                </p>
              </div>
            </div>
          </div>

          {/* 3 Kịch bản đầu ra thực tế — Lưới Bento 3 Card song song đồng nhất với Phần 1 và Phần 3 */}
          <div className="bento-outcomes-section-header">
            <h3 className="bento-outcomes-sub-title">Trợ lý phân nhánh kết quả như thế nào?</h3>
            <p className="bento-outcomes-sub-desc">
              Dựa trên kết quả đối soát tri thức và ngưỡng an toàn, hệ thống sẽ trả về một trong ba trạng thái minh bạch dưới đây:
            </p>
          </div>

          <div className="bento-outcomes-grid">
            {/* Kịch bản 1: Đủ căn cứ xác thực */}
            <div className="bento-outcome-card outcome-grounded">
              <div className="bento-outcome-card-top">
                <div className="bento-outcome-pill">KỊCH BẢN 01</div>
                <Badge variant="success" size="md">
                  ✓ ĐỦ CĂN CỨ
                </Badge>
              </div>

              <div className="bento-outcome-card-heading">
                <h4 className="bento-outcome-title">Phản hồi có trích dẫn nguồn</h4>
                <div className="bento-outcome-condition success">
                  Điểm căn cứ ≥ Ngưỡng cấu hình (≥ 75%)
                </div>
              </div>

              <p className="bento-outcome-text">
                Agent phân tích các đoạn trích từ tài liệu có sẵn, viết câu trả lời mạch lạc và đính kèm số trích dẫn <code>[1]</code>, <code>[2]</code> để nhân viên đối chiếu đoạn văn bản nguồn, người duyệt và ngày cập nhật.
              </p>

              <div className="bento-outcome-mock success-mock">
                <div className="bento-outcome-mock-badge">
                  Độ tin cậy: 95% • Đã đối soát 2 nguồn
                </div>
                <p className="bento-outcome-mock-text">
                  Để trỏ tên miền về hosting cPanel , bạn cấu hình bản ghi <strong>A Record</strong> về IP hosting và <strong>CNAME</strong> cho www. Thời gian cập nhật DNS từ 15 phút đến 2 giờ. <span className="bento-mock-cite">[1]</span>
                </p>
              </div>

              <div className="bento-outcome-footer-tip">
                <IconTipLight className="bento-inline-tip-icon" /> <strong>An toàn:</strong> Nhân viên bấm vào số trích dẫn để đọc tài liệu gốc đã được phê duyệt.
              </div>
            </div>

            {/* Kịch bản 2: Gợi ý tri thức an toàn */}
            <div className="bento-outcome-card outcome-suggestions">
              <div className="bento-outcome-card-top">
                <div className="bento-outcome-pill">KỊCH BẢN 02</div>
                <Badge variant="brand" size="md">
                  GỢI Ý KHO TRI THỨC
                </Badge>
              </div>

              <div className="bento-outcome-card-heading">
                <h4 className="bento-outcome-title">Gợi ý đoạn trích nguyên bản</h4>
                <div className="bento-outcome-condition info">
                  Khi AI Engine tạm ngưng / Chế độ an toàn
                </div>
              </div>

              <p className="bento-outcome-text">
                Nếu quản trị viên tạm tắt cả 2 engine AI (hoặc khi mất kết nối mạng), hệ thống bảo vệ an toàn bằng cách hiển thị trực tiếp các bài viết và đoạn trích đã xác minh để nhân viên tự đọc, tuyệt đối không tự bịa đặt câu chữ.
              </p>

              <div className="bento-outcome-mock info-mock">
                <div className="bento-outcome-mock-badge info">
                  Chế độ căn cứ an toàn (Kho tri thức)
                </div>
                <p className="bento-outcome-mock-text">
                  <strong>Đoạn trích phù hợp:</strong> “Tài liệu KB-DNS-01: Hướng dẫn cấu hình DNS . Mục 2: Cặp bản ghi A và CNAME chuẩn cho dịch vụ Cloud Hosting.”
                </p>
              </div>

              <div className="bento-outcome-footer-tip">
                <IconTipLight className="bento-inline-tip-icon" /> <strong>An toàn:</strong> Cung cấp đoạn văn bản nguyên gốc đã kiểm duyệt, không dùng AI suy đoán.
              </div>
            </div>

            {/* Kịch bản 3: Chuyển giao chuyên gia */}
            <div className="bento-outcome-card outcome-escalation">
              <div className="bento-outcome-card-top">
                <div className="bento-outcome-pill">KỊCH BẢN 03</div>
                <Badge variant="warning" size="md">
                  CHUYỂN CHUYÊN GIA
                </Badge>
              </div>

              <div className="bento-outcome-card-heading">
                <h4 className="bento-outcome-title">Từ chối suy đoán & Tạo Ticket</h4>
                <div className="bento-outcome-condition warning">
                  Điểm dưới ngưỡng / Cờ Chuyên gia
                </div>
              </div>

              <p className="bento-outcome-text">
                Khi điểm tương đồng dưới ngưỡng, câu hỏi thuộc chủ đề nhạy cảm (như bảo mật, thanh toán), hoặc bài viết có chính sách <strong>Cần chuyên gia xác nhận</strong>, hệ thống giải thích lý do cụ thể và lập yêu cầu trong Hàng đợi để chuyên gia xử lý.
              </p>

              <div className="bento-outcome-mock warning-mock">
                <div className="bento-outcome-mock-badge warning">
                  Đã tạo yêu cầu chuyên gia #c1f2b172
                </div>
                <p className="bento-outcome-mock-text">
                  Trợ lý chưa đủ căn cứ xác thực trong kho tri thức nội bộ để trả lời an toàn. Hệ thống đã chuyển yêu cầu đến đội ngũ Chuyên gia kỹ thuật để thẩm định và phản hồi sớm nhất.
                </p>
              </div>

              <div className="bento-outcome-footer-tip">
                <IconTipLight className="bento-inline-tip-icon" /> <strong>An toàn:</strong> Chặn đứng mọi nguy cơ tư vấn sai lệch đối với các ca khó hoặc nhạy cảm.
              </div>
            </div>
          </div>
        </section>

        {/* ====================================================================
            SECTION 3: BENTO GRID — THANG ĐIỂM CĂN CỨ (GROUNDING SCORE)
            ==================================================================== */}
        <section className="bento-guide-section" id="thang-diem">
          <div className="bento-section-head">
            <span className="bento-section-step">PHẦN 03</span>
            <h2 className="bento-section-title">Hiểu đúng bản chất để ra quyết định</h2>
            <p className="bento-section-desc">
              Điểm số cao thể hiện <em>mức độ phù hợp của bằng chứng tài liệu</em>, không có nghĩa là “đúng tuyệt đối” trong mọi hoàn cảnh.
            </p>
          </div>

          <div className="bento-score-grid">
            <div className="bento-score-card">
              <div className="bento-score-header">
                <span className="bento-score-icon analytics">
                  <IconScoreAnalytics size={22} />
                </span>
                <h4>Điểm được cấu thành từ đâu?</h4>
              </div>
              <ul className="bento-score-list">
                <li>
                  <strong>Độ tương đồng ngữ nghĩa:</strong> Câu hỏi của bạn khớp với các phân đoạn tri thức trong kho ở mức độ nào.
                </li>
                <li>
                  <strong>Chất lượng & Tính xác minh:</strong> Tài liệu đã được chuyên gia gắn nhãn “Đã xác minh” hay chưa.
                </li>
                <li>
                  <strong>Thời điểm cập nhật:</strong> Bài viết mới cập nhật sẽ có trọng số cao hơn tài liệu cũ.
                </li>
              </ul>
            </div>

            <div className="bento-score-card">
              <div className="bento-score-header">
                <span className="bento-score-icon safety">
                  <IconSafetyShield size={22} />
                </span>
                <h4>Khi nào hệ thống kiểm soát chặt hơn?</h4>
              </div>
              <ul className="bento-score-list">
                <li>
                  <strong>Chủ đề nhạy cảm:</strong> Các câu hỏi về thanh toán, xóa dữ liệu, bảo mật SCIM áp dụng ngưỡng tin cậy cao hơn bình thường.
                </li>
                <li>
                  <strong>Chính sách bắt buộc chuyên gia:</strong> Nếu bài viết gốc có thuộc tính <code>Chuyển chuyên gia</code>, câu trả lời sẽ không tự động hoàn tất.
                </li>
                <li>
                  <strong>Nguồn tài liệu xung đột:</strong> Khi có hai tài liệu mâu thuẫn thông tin, hệ thống sẽ cảnh báo thay vì chọn bừa.
                </li>
              </ul>
            </div>

            <div className="bento-score-card">
              <div className="bento-score-header">
                <span className="bento-score-icon rules">
                  <IconGoldenRules size={22} />
                </span>
                <h4>Quy tắc vàng cho nhân viên tư vấn</h4>
              </div>
              <ul className="bento-score-list">
                <li>
                  <strong>Luôn đọc nguồn trích dẫn:</strong> Kiểm tra xem ngữ cảnh tài liệu có trùng khớp với dịch vụ khách hàng đang mua hay không.
                </li>
                <li>
                  <strong>Không cam kết vượt quá tài liệu:</strong> Nếu tài liệu chưa khẳng định, tuyệt đối không hứa hẹn với khách.
                </li>
                <li>
                  <strong>Sẵn sàng gửi Ticket chuyên gia:</strong> Khi có bất kỳ nghi ngờ nào, hãy sử dụng nút chuyển chuyên gia để được xác nhận.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ====================================================================
            SECTION 4: VÒNG ĐỜI TRI THỨC & GỘP BÀI TỰ ĐỘNG
            ==================================================================== */}
        <section className="bento-guide-section" id="vong-doi-tri-thuc">
          <div className="bento-section-head">
            <span className="bento-section-step">PHẦN 04</span>
            <h2 className="bento-section-title">Kho tri thức & Vòng lặp Hợp nhất thông minh</h2>
            <p className="bento-section-desc">
              Một kho tri thức tốt là kho tri thức tinh gọn, không trùng lặp và liên tục được làm mới từ những câu trả lời thực tế của chuyên gia.
            </p>
          </div>

          <div className="bento-merge-lifecycle">
            {/* Bước 1 */}
            <div className="bento-lifecycle-step step-1">
              <div className="bento-lifecycle-top">
                <div className="bento-lifecycle-badge">
                  <span className="bento-lifecycle-dot" /> 01. LỌC PHẠM VI
                </div>
              </div>
              <h4>Chọn nhóm bài viết cần rà soát</h4>
              <p>
                Chọn nhóm dịch vụ (ví dụ: DNS, Hosting, Email), đặt số lượng bài viết tối đa và ngưỡng tương đồng để bắt đầu quét.
              </p>
            </div>

            {/* Connector 1 */}
            <div className="bento-lifecycle-connector connector-1" aria-hidden="true">
              <div className="bento-lifecycle-line">
                <span className="bento-lifecycle-particle" />
              </div>
              <div className="bento-lifecycle-arrow-circle">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </div>
            </div>

            {/* Bước 2 */}
            <div className="bento-lifecycle-step step-2">
              <div className="bento-lifecycle-top">
                <div className="bento-lifecycle-badge">
                  <span className="bento-lifecycle-dot" /> 02. AI QUÉT & ĐỐI CHIẾU
                </div>
              </div>
              <h4>Phát hiện các bài trùng nội dung</h4>
              <p>
                Agent tự động so khớp ngữ nghĩa giữa các bài, phát hiện nội dung cùng ý nhưng khác câu chữ và tạo bản nháp gộp.
              </p>
            </div>

            {/* Connector 2 */}
            <div className="bento-lifecycle-connector connector-2" aria-hidden="true">
              <div className="bento-lifecycle-line">
                <span className="bento-lifecycle-particle delay" />
              </div>
              <div className="bento-lifecycle-arrow-circle">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </div>
            </div>

            {/* Bước 3 */}
            <div className="bento-lifecycle-step step-3">
              <div className="bento-lifecycle-top">
                <div className="bento-lifecycle-badge">
                  <span className="bento-lifecycle-dot" /> 03. DUYỆT BẢN GỘP
                </div>
              </div>
              <h4>Con người kiểm duyệt trước khi lưu</h4>
              <p>
                Chuyên gia hoặc Quản trị viên xem bảng đối chiếu (Diff), kiểm tra nội dung trước khi bấm duyệt xuất bản bài mới.
              </p>
            </div>
          </div>

          <div className="bento-guide-callout-box">
            <span className="bento-callout-icon">
              <IconDataProtection size={22} />
            </span>
            <div>
              <strong>Nguyên tắc bảo vệ dữ liệu:</strong> Hệ thống không bao giờ tự ý thay đổi hay xóa bài viết mà không có sự đồng ý của con người. Tính năng quét gộp đòi hỏi Agent AI đang hoạt động; nếu Agent tắt, dữ liệu trong kho vẫn được giữ nguyên trạng và bảo đảm an toàn.
            </div>
          </div>
        </section>

        {/* ====================================================================
            SECTION 5: DANH MỤC CÀI ĐẶT HỆ THỐNG
            ==================================================================== */}
        <section className="bento-guide-section" id="cai-dat">
          <div className="bento-section-head">
            <span className="bento-section-step">PHẦN 05</span>
            <h2 className="bento-section-title">Cấu hình Quản trị</h2>
            <p className="bento-section-desc">
              Chỉ Quản trị viên hệ thống có quyền truy cập và thay đổi các cấu hình này. Mỗi tham số đều tác động trực tiếp đến hành vi của Trợ lý:
            </p>
          </div>

          <div className="bento-settings-cards-grid">
            {settingSpecs.map((item) => {
              const PillarIcon = item.Icon;
              return (
                <div
                  className={`bento-setting-spec-card pillar-${item.color}`}
                  key={item.id}
                >
                  <div className="bento-spec-head">
                    <div className="bento-spec-badge-group">
                      <span className={`bento-pillar-icon-box ${item.color}`}>
                        <PillarIcon size={18} />
                      </span>
                      <Badge variant={item.badgeVariant} size="sm">
                        {item.badge}
                      </Badge>
                    </div>
                    <h4 className="bento-spec-title">{item.category}</h4>
                  </div>
                  <div className="bento-spec-focus">
                    <strong>Trọng tâm:</strong> {item.focus}
                  </div>
                  <p className="bento-spec-impact">{item.impact}</p>
                </div>
              );
            })}
          </div>

          {canManageSettings && (
            <div className="bento-settings-cta-banner">
              <div>
                <strong>Bạn đang đăng nhập với quyền Quản trị viên</strong>
                <p>Mọi thay đổi cấu hình cần được kiểm tra cẩn trọng trước khi áp dụng diện rộng.</p>
              </div>
              <a className="ui-btn ui-btn-primary ui-btn-md" href="/settings?tab=retrieval">
                Mở Cài đặt hệ thống →
              </a>
            </div>
          )}
        </section>

        {/* ====================================================================
            CLOSING FOOTER BANNER
            ==================================================================== */}
        <footer className="bento-guide-closing-banner">
          <div className="bento-closing-text">
            <h3 className="bento-closing-title">
              Minh bạch với điều bạn biết và có trách nhiệm với điều cần xác nhận.
            </h3>
            <p className="bento-closing-desc">
              Mọi tính năng trong bản hướng dẫn này đều phản ánh chính xác trạng thái hoạt động thực tế của Trợ lý. Quyền hạn tài khoản của bạn sẽ quyết định những tác vụ có thể thực thi.
            </p>
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            Quay lại đầu trang ↑
          </Button>
        </footer>
      </div>
    </AppShell>
  );
}
