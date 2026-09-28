import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

/** Icon Biểu đồ Phân tích Điểm số Căn cứ (Thay cho 📊) */
export function IconScoreAnalytics({ size = 22, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Nền dạng lưới dữ liệu phân tích */}
      <rect
        x="3"
        y="13"
        width="4.5"
        height="8"
        rx="1.5"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="9.75"
        y="8"
        width="4.5"
        height="13"
        rx="1.5"
        fill="currentColor"
        fillOpacity="0.35"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="16.5"
        y="3"
        width="4.5"
        height="18"
        rx="1.5"
        fill="currentColor"
        fillOpacity="0.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      {/* Đường xu hướng độ tin cậy RAG */}
      <path
        d="M4 10L10.5 5.5L14.5 8.5L20 2.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="2.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

/** Icon Khiên Kiểm soát An toàn & Rủi ro (Thay cho ⚠️) */
export function IconSafetyShield({ size = 22, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Thân khiên bảo hộ với duotone fill */}
      <path
        d="M12 2L4 5.5V11.5C4 16.5 7.4 21.1 12 22C16.6 21.1 20 16.5 20 11.5V5.5L12 2Z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Biểu tượng cảnh báo an toàn ở trung tâm */}
      <path
        d="M12 8V12.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16" r="1.2" fill="currentColor" />
    </svg>
  );
}

/** Icon Ngọn Hải đăng / La bàn Quy tắc Vàng (Thay cho 💡) */
export function IconGoldenRules({ size = 22, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Bóng đèn tri thức & tia sáng định hướng */}
      <path
        d="M9 18H15M10 21H14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 2C8.134 2 5 5.134 5 9C5 11.4 6.2 13.5 8 14.7V17C8 17.55 8.45 18 9 18H15C15.55 18 16 17.55 16 17V14.7C17.8 13.5 19 11.4 19 9C19 5.134 15.866 2 12 2Z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Tim đèn phát sáng hình ngôi sao tri thức */}
      <path
        d="M12 6V9M10.5 7.5H13.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Icon Vai trò: Chuyên viên Tư vấn khách hàng (Thay cho 👤) */
export function IconRoleSales({ size = 18, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <circle
        cx="12"
        cy="8"
        r="4"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M4 20C4 16.5 7.5 14 12 14C16.5 14 20 16.5 20 20"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      {/* Headset tư vấn viên */}
      <path
        d="M7 10C7 7.2 9.2 5 12 5C14.8 5 17 7.2 17 10V12C17 12.6 16.6 13 16 13H15.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="16" cy="11.5" r="1.5" fill="currentColor" />
      <path
        d="M17 11V15C17 15.5 16.5 16 16 16H14"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Icon Vai trò: Chuyên gia Kỹ thuật (Thay cho 🛠️) */
export function IconRoleTechnical({ size = 18, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Biểu tượng cờ lê & khung cấu hình kỹ thuật */}
      <path
        d="M14.7 6.3C14.3 5.9 14.1 5.3 14.2 4.7C14.4 3.7 15.3 3 16.3 3C17 3 17.6 3.3 18 3.8L19.2 5C19.7 5.4 20 6 20 6.7C20 7.7 19.3 8.6 18.3 8.8C17.7 8.9 17.1 8.7 16.7 8.3L15.4 7L8 14.4V17H10.6L18 9.6"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M5 19H9M4 16L3 17L7 21L8 20L4 16Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      {/* Code bracket ký hiệu kỹ thuật */}
      <path
        d="M4 8L2 10L4 12M10 8L12 10L10 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Icon Vai trò: Quản trị viên Toàn quyền (Thay cho 🛡️) */
export function IconRoleAdmin({ size = 18, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M12 2L4 5.5V11.5C4 16.5 7.4 21.1 12 22C16.6 21.1 20 16.5 20 11.5V5.5L12 2Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Huy hiệu vương miện quyền hạn quản trị */}
      <path
        d="M8.5 13.5L9.5 9.5L12 11.5L14.5 9.5L15.5 13.5H8.5Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="9.5" cy="8.5" r="0.8" fill="currentColor" />
      <circle cx="12" cy="7.5" r="0.8" fill="currentColor" />
      <circle cx="14.5" cy="8.5" r="0.8" fill="currentColor" />
    </svg>
  );
}

/** Icon Bảo vệ Toàn vẹn Dữ liệu (Thay cho 🛡️ trong Callout) */
export function IconDataProtection({ size = 20, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M12 2L4 5.5V11.5C4 16.5 7.4 21.1 12 22C16.6 21.1 20 16.5 20 11.5V5.5L12 2Z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Khóa bảo mật */}
      <rect
        x="9"
        y="11"
        width="6"
        height="5"
        rx="1.2"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M10 11V9C10 7.9 10.9 7 12 7C13.1 7 14 7.9 14 9V11"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Icon Gợi ý / Tip nhỏ thanh lịch */
export function IconTipLight({ size = 14, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M6 12H10M6.5 14H9.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M8 2C5.5 2 3.5 4 3.5 6.5C3.5 8.1 4.3 9.5 5.5 10.3V11.5H10.5V10.3C11.7 9.5 12.5 8.1 12.5 6.5C12.5 4 10.5 2 8 2Z"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

/** Icon Trụ cột 01: Cấu hình Trợ lý AI (Persona & Prompting) */
export function IconPillarAssistant({ size = 20, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect
        x="3"
        y="5"
        width="14"
        height="14"
        rx="3.5"
        fill="currentColor"
        fillOpacity="0.15"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="7.5" cy="11.5" r="1.25" fill="currentColor" />
      <circle cx="12.5" cy="11.5" r="1.25" fill="currentColor" />
      <path
        d="M8 15C8.8 15.6 11.2 15.6 12 15"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {/* AI Sparkle */}
      <path
        d="M19 2L19.8 4.2L22 5L19.8 5.8L19 8L18.2 5.8L16 5L18.2 4.2L19 2Z"
        fill="currentColor"
      />
      <path
        d="M2 12H3M17 12H18M10 2V5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Icon Trụ cột 02: Tri thức & Tìm kiếm RAG (Retrieval & Policy) */
export function IconPillarRetrieval({ size = 20, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <ellipse
        cx="11"
        cy="5.5"
        rx="7"
        ry="2.5"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M4 5.5V11.5C4 12.88 7.13 14 11 14C11.5 14 11.98 13.98 12.44 13.94"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M4 11.5V17.5C4 18.88 7.13 20 11 20C11.8 20 12.57 19.95 13.27 19.85"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      {/* Kính lúp tìm kiếm RAG */}
      <circle
        cx="17"
        cy="15"
        r="3.5"
        fill="currentColor"
        fillOpacity="0.25"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M19.5 17.5L22 20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Icon Trụ cột 03: Nhà cung cấp AI (Dual-Engine LLM Provider) */
export function IconPillarProviders({ size = 20, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Chipset Core 1 */}
      <rect
        x="3"
        y="6"
        width="11"
        height="11"
        rx="2.5"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      {/* Chipset Core 2 (Overlay Dual Engine) */}
      <rect
        x="10"
        y="7"
        width="11"
        height="11"
        rx="2.5"
        fill="currentColor"
        fillOpacity="0.35"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      {/* Chân tiếp xúc CPU */}
      <path
        d="M6 3V6M10 3V6M6 17V20M10 17V20M1 9H3M1 13H3M21 10H23M21 14H23M14 4V7M18 4V7M14 18V21M18 18V21"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      {/* Điểm nhân xử lý */}
      <circle cx="15.5" cy="12.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

/** Icon Trụ cột 04: Quản trị người dùng & Bảo mật (RBAC & 2FA) */
export function IconPillarSecurity({ size = 20, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Khiên bảo mật */}
      <path
        d="M12 3L4 6.5V11.5C4 16.5 7.4 20.8 12 22C16.6 20.8 20 16.5 20 11.5V6.5L12 3Z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Dấu tích xác thực 2FA */}
      <path
        d="M8.5 12.5L10.8 14.8L15.5 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
