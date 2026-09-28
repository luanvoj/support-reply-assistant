import type { ReactNode } from "react";

type NavigationIconName =
  | "overview"
  | "guide"
  | "assistant"
  | "conversations"
  | "knowledge"
  | "queue"
  | "profile"
  | "settings";

export function NavigationIcon({
  name,
  className,
}: {
  name: NavigationIconName;
  className?: string;
}) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const icons: Record<NavigationIconName, ReactNode> = {
    // Tổng quan: Bố cục Bento Dashboard phân tầng hiện đại
    overview: (
      <>
        <rect
          x="3"
          y="3"
          width="8"
          height="10"
          rx="2"
          fill="currentColor"
          fillOpacity="0.2"
        />
        <rect x="3" y="3" width="8" height="10" rx="2" />
        <rect x="13" y="3" width="8" height="5" rx="1.5" />
        <rect
          x="13"
          y="10"
          width="8"
          height="11"
          rx="2"
          fill="currentColor"
          fillOpacity="0.2"
        />
        <rect x="13" y="10" width="8" height="11" rx="2" />
        <rect x="3" y="15" width="8" height="6" rx="1.5" />
      </>
    ),

    // Hướng dẫn sử dụng: Cẩm nang tri thức có ruy-băng đánh dấu và trang nội dung
    guide: (
      <>
        <path
          d="M5 4C5 2.89543 5.89543 2 7 2H18C19.1046 2 20 2.89543 20 4V20C20 21.1046 19.1046 22 18 22H7C5.89543 22 5 21.1046 5 20V4Z"
          fill="currentColor"
          fillOpacity="0.15"
        />
        <path d="M5 19.5A2.5 2.5 0 0 1 7.5 17H20" />
        <path d="M7 2H18C19.1 2 20 2.9 20 4V20C20 21.1 19.1 22 18 22H7.5A2.5 2.5 0 0 1 5 19.5V4.5A2.5 2.5 0 0 1 7 2Z" />
        <path
          d="M14 2V8L11.5 6.5L9 8V2"
          fill="currentColor"
          fillOpacity="0.3"
        />
        <path d="M9 13H15M9 16.5H13" />
      </>
    ),

    // Trợ lý AI: Neural Star đồng bộ 100% với Logo chính
    assistant: (
      <>
        {/* Lõi sao Neural Star 4 cánh với lớp nền duotone */}
        <path
          d="M12 2C12.8 7.2 15.5 9.8 20.5 10.5C15.5 11.2 12.8 13.8 12 19C11.2 13.8 8.5 11.2 3.5 10.5C8.5 9.8 11.2 7.2 12 2Z"
          fill="currentColor"
          fillOpacity="0.2"
        />
        <path d="M12 2C12.8 7.2 15.5 9.8 20.5 10.5C15.5 11.2 12.8 13.8 12 19C11.2 13.8 8.5 11.2 3.5 10.5C8.5 9.8 11.2 7.2 12 2Z" />
        {/* Vệ tinh tri thức bổ trợ */}
        <path
          d="M18 16C18.3 17.6 19.4 18.7 21 19C19.4 19.3 18.3 20.4 18 22C17.7 20.4 16.6 19.3 15 19C16.6 18.7 17.7 17.6 18 16Z"
          fill="currentColor"
          fillOpacity="0.35"
        />
        <path d="M18 16C18.3 17.6 19.4 18.7 21 19C19.4 19.3 18.3 20.4 18 22C17.7 20.4 16.6 19.3 15 19C16.6 18.7 17.7 17.6 18 16Z" />
      </>
    ),

    // Hội thoại: Cặp bong bóng tin nhắn lồng nhau 3D
    conversations: (
      <>
        {/* Bong bóng phụ phía sau */}
        <path
          d="M7 6H16C18.2 6 20 7.8 20 10V12C20 14.2 18.2 16 16 16H15V18.5L12 16H7C4.8 16 3 14.2 3 12V10C3 7.8 4.8 6 7 6Z"
          fill="currentColor"
          fillOpacity="0.16"
        />
        <path d="M7 6H16C18.2 6 20 7.8 20 10V12C20 14.2 18.2 16 16 16H15V18.5L12 16H7C4.8 16 3 14.2 3 12V10C3 7.8 4.8 6 7 6Z" />
        {/* Tín hiệu tin nhắn 3 chấm */}
        <circle cx="7.5" cy="11" r="1" fill="currentColor" />
        <circle cx="11.5" cy="11" r="1" fill="currentColor" />
        <circle cx="15.5" cy="11" r="1" fill="currentColor" />
      </>
    ),

    // Kho kiến thức: Sách tri thức RAG mở rộng với các trang tri thức xếp tầng
    knowledge: (
      <>
        <path
          d="M3 5C3 3.89543 3.89543 3 5 3H11V20H5C3.89543 20 3 19.1046 3 18V5Z"
          fill="currentColor"
          fillOpacity="0.18"
        />
        <path
          d="M21 5C21 3.89543 20.1046 3 19 3H13V20H19C20.1046 20 21 19.1046 21 18V5Z"
          fill="currentColor"
          fillOpacity="0.18"
        />
        <path d="M3 18C3 16.8954 3.89543 16 5 16H11" />
        <path d="M21 18C21 16.8954 20.1046 16 19 16H13" />
        <path d="M3 5A2 2 0 0 1 5 3H11V21H5A2 2 0 0 0 3 23V5Z" />
        <path d="M21 5A2 2 0 0 0 19 3H13V21H19A2 2 0 0 1 21 23V5Z" />
        <line x1="6" y1="7.5" x2="8.5" y2="7.5" />
        <line x1="6" y1="11.5" x2="8.5" y2="11.5" />
        <line x1="15.5" y1="7.5" x2="18" y2="7.5" />
        <line x1="15.5" y1="11.5" x2="18" y2="11.5" />
      </>
    ),

    // Hàng đợi chuyên gia: Hộp hồ sơ chuyển giao nghiệp vụ với huy hiệu xác nhận
    queue: (
      <>
        <path
          d="M4 5C4 3.89543 4.89543 3 6 3H18C19.1046 3 20 3.89543 20 4V17C20 18.1046 19.1046 19 18 19H6C4.89543 19 4 18.1046 4 17V5Z"
          fill="currentColor"
          fillOpacity="0.15"
        />
        <path d="M4 5C4 3.9 4.9 3 6 3H18C19.1 3 20 3.9 20 5V17C20 18.1 19.1 19 18 19H6C4.9 19 4 18.1 4 17V5Z" />
        <path d="M4 12H8L9.5 14.5H14.5L16 12H20" />
        {/* Dấu tick kiểm duyệt chuyên gia */}
        <circle cx="12" cy="7.5" r="2.2" fill="currentColor" fillOpacity="0.25" />
        <path d="M10.8 7.5L11.7 8.4L13.2 6.8" />
      </>
    ),

    // Cài đặt: Bộ tinh chỉnh tham số cao cấp (Parametric Adjusters)
    settings: (
      <>
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
        <rect
          x="6"
          y="3.5"
          width="5"
          height="5"
          rx="1.5"
          fill="currentColor"
          fillOpacity="0.28"
        />
        <rect x="6" y="3.5" width="5" height="5" rx="1.5" />
        <rect
          x="14"
          y="9.5"
          width="5"
          height="5"
          rx="1.5"
          fill="currentColor"
          fillOpacity="0.28"
        />
        <rect x="14" y="9.5" width="5" height="5" rx="1.5" />
        <rect
          x="8"
          y="15.5"
          width="5"
          height="5"
          rx="1.5"
          fill="currentColor"
          fillOpacity="0.28"
        />
        <rect x="8" y="15.5" width="5" height="5" rx="1.5" />
      </>
    ),

    // Hồ sơ người dùng: Thẻ chuyên viên tri thức
    profile: (
      <>
        <circle cx="12" cy="8" r="4" fill="currentColor" fillOpacity="0.2" />
        <circle cx="12" cy="8" r="4" />
        <path
          d="M5 20C5 16.5 8 14 12 14C16 14 19 16.5 19 20"
          fill="currentColor"
          fillOpacity="0.15"
        />
        <path d="M5 20C5 16.5 8 14 12 14C16 14 19 16.5 19 20" />
      </>
    ),
  };

  return (
    <svg
      className={`navigation-icon ${className ?? ""}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      {...common}
    >
      {icons[name]}
    </svg>
  );
}

export type { NavigationIconName };

