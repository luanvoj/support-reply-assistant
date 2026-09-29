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
    strokeWidth: 1.8,
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
          height="9"
          rx="2.2"
          fill="currentColor"
          fillOpacity="0.25"
        />
        <rect x="3" y="3" width="8" height="9" rx="2.2" />
        <rect x="13" y="3" width="8" height="5.5" rx="1.8" />
        <rect
          x="13"
          y="10.5"
          width="8"
          height="10.5"
          rx="2.2"
          fill="currentColor"
          fillOpacity="0.25"
        />
        <rect x="13" y="10.5" width="8" height="10.5" rx="2.2" />
        <rect x="3" y="14" width="8" height="7" rx="1.8" />
      </>
    ),

    // Hướng dẫn sử dụng: Cẩm nang la bàn tri thức & ruy-băng đánh dấu
    guide: (
      <>
        <path
          d="M4.5 3.5C4.5 2.67157 5.17157 2 6 2H18C19.1046 2 20 2.89543 20 4V20C20 21.1046 19.1046 22 18 22H6C4.89543 22 4 21.1046 4 20V4"
          fill="currentColor"
          fillOpacity="0.22"
        />
        <path d="M4 18C4 16.6193 5.11929 15.5 6.5 15.5H20" />
        <path d="M6 2H18C19.1 2 20 2.9 20 4V20C20 21.1 19.1 22 18 22H6.5C5.11929 22 4 20.8807 4 19.5V4.5C4 3.11929 5.11929 2 6.5 2Z" />
        {/* Ruy băng chỉ mục */}
        <path
          d="M12 2V8.5L9.5 7L7 8.5V2"
          fill="currentColor"
          fillOpacity="0.38"
        />
        {/* Sao định hướng la bàn */}
        <path
          d="M14.5 12L15.3 13.7L17 14.5L15.3 15.3L14.5 17L13.7 15.3L12 14.5L13.7 13.7L14.5 12Z"
          fill="currentColor"
          stroke="none"
        />
      </>
    ),

    // Trợ lý AI: Neural Star kim cương 4 cánh sắc sảo
    assistant: (
      <>
        <path
          d="M12 2C12.8 7.4 15.6 10.2 21 11C15.6 11.8 12.8 14.6 12 20C11.2 14.6 8.4 11.8 3 11C8.4 10.2 11.2 7.4 12 2Z"
          fill="currentColor"
          fillOpacity="0.26"
        />
        <path d="M12 2C12.8 7.4 15.6 10.2 21 11C15.6 11.8 12.8 14.6 12 20C11.2 14.6 8.4 11.8 3 11C8.4 10.2 11.2 7.4 12 2Z" />
        {/* Lõi kim cương trung tâm */}
        <path
          d="M12 9.5L13.5 11L12 12.5L10.5 11L12 9.5Z"
          fill="currentColor"
          stroke="none"
        />
        {/* Vệ tinh tri thức phát quang */}
        <circle cx="18.5" cy="5.5" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="5.5" cy="17.5" r="1.2" fill="currentColor" stroke="none" />
      </>
    ),

    // Hội thoại: Cặp bong bóng tin nhắn lồng nhau đa lớp
    conversations: (
      <>
        <path
          d="M7 5H17C19.2 5 21 6.8 21 9V13C21 15.2 19.2 17 17 17H15.5L12 20.5L12 17H7C4.8 17 3 15.2 3 13V9C3 6.8 4.8 5 7 5Z"
          fill="currentColor"
          fillOpacity="0.24"
        />
        <path d="M7 5H17C19.2 5 21 6.8 21 9V13C21 15.2 19.2 17 17 17H15.5L12 20.5L12 17H7C4.8 17 3 15.2 3 13V9C3 6.8 4.8 5 7 5Z" />
        {/* Điểm sóng hội thoại 3 hạt */}
        <circle cx="8" cy="11" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="12" cy="11" r="1.4" fill="currentColor" stroke="none" />
        <circle cx="16" cy="11" r="1.4" fill="currentColor" stroke="none" />
      </>
    ),

    // Kho kiến thức: Sách tri thức RAG mở rộng đối xứng đa tầng
    knowledge: (
      <>
        <path
          d="M2.5 5.5C2.5 4.39543 3.39543 3.5 4.5 3.5H11V20.5H5C3.61929 20.5 2.5 19.3807 2.5 18V5.5Z"
          fill="currentColor"
          fillOpacity="0.25"
        />
        <path
          d="M21.5 5.5C21.5 4.39543 20.6046 3.5 19.5 3.5H13V20.5H19C20.3807 20.5 21.5 19.3807 21.5 18V5.5Z"
          fill="currentColor"
          fillOpacity="0.25"
        />
        <path d="M2.5 18C2.5 16.6193 3.61929 15.5 5 15.5H11" />
        <path d="M21.5 18C21.5 16.6193 20.3807 15.5 19 15.5H13" />
        <path d="M2.5 5.5A2 2 0 0 1 4.5 3.5H11V21H5A2 2 0 0 0 2.5 23V5.5" />
        <path d="M21.5 5.5A2 2 0 0 0 19.5 3.5H13V21H19A2 2 0 0 1 21.5 23V5.5" />
        <line x1="6" y1="8" x2="8.5" y2="8" />
        <line x1="6" y1="11.5" x2="8.5" y2="11.5" />
        <line x1="15.5" y1="8" x2="18" y2="8" />
        <line x1="15.5" y1="11.5" x2="18" y2="11.5" />
      </>
    ),

    // Hàng đợi chuyên gia: Hộp hồ sơ chuyển giao nghiệp vụ với khiên kiểm định
    queue: (
      <>
        <path
          d="M4 4C4 2.89543 4.89543 2 6 2H18C19.1046 2 20 2.89543 20 3V17C20 18.1046 19.1046 19 18 19H6C4.89543 19 4 18.1046 4 17V4Z"
          fill="currentColor"
          fillOpacity="0.22"
        />
        <path d="M4 4C4 2.9 4.9 2 6 2H18C19.1 2 20 2.9 20 4V17C20 18.1 19.1 19 18 19H6C4.9 19 4 18.1 4 17V4Z" />
        <path d="M4 12.5H8L9.5 15H14.5L16 12.5H20" />
        {/* Khiên kiểm định an toàn có dấu check */}
        <path
          d="M12 5C12 5 14 5.5 15 6C15 9.2 13.5 11.2 12 12C10.5 11.2 9 9.2 9 6C10 5.5 12 5 12 5Z"
          fill="currentColor"
          fillOpacity="0.35"
        />
        <path d="M10.8 8.6L11.7 9.5L13.5 7.6" strokeWidth="1.6" />
      </>
    ),

    // Cài đặt: Bộ tinh chỉnh tham số cao cấp (Parametric Adjusters)
    settings: (
      <>
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="18" x2="20" y2="18" />
        <rect
          x="6.5"
          y="3.5"
          width="5"
          height="5"
          rx="1.5"
          fill="currentColor"
          fillOpacity="0.35"
        />
        <rect x="6.5" y="3.5" width="5" height="5" rx="1.5" />
        <rect
          x="13.5"
          y="9.5"
          width="5"
          height="5"
          rx="1.5"
          fill="currentColor"
          fillOpacity="0.35"
        />
        <rect x="13.5" y="9.5" width="5" height="5" rx="1.5" />
        <rect
          x="8.5"
          y="15.5"
          width="5"
          height="5"
          rx="1.5"
          fill="currentColor"
          fillOpacity="0.35"
        />
        <rect x="8.5" y="15.5" width="5" height="5" rx="1.5" />
      </>
    ),

    // Hồ sơ người dùng: Thẻ chuyên viên tri thức với huy hiệu bảo mật
    profile: (
      <>
        <circle cx="12" cy="8" r="4" fill="currentColor" fillOpacity="0.25" />
        <circle cx="12" cy="8" r="4" />
        <path
          d="M5 20C5 16.5 8 14 12 14C16 14 19 16.5 19 20"
          fill="currentColor"
          fillOpacity="0.2"
        />
        <path d="M5 20C5 16.5 8 14 12 14C16 14 19 16.5 19 20" />
        {/* Huy hiệu xác thực hồ sơ */}
        <circle cx="17.5" cy="16.5" r="2.8" fill="currentColor" stroke="none" />
        <path d="M16.3 16.5L17.1 17.3L18.8 15.6" stroke="#ffffff" strokeWidth="1.2" />
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

