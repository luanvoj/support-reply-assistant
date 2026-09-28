import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

/** Icon nhập dữ liệu bảng tính Excel / CSV */
export function IconImportSpreadsheet({ size = 16, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Khung tệp bảng tính */}
      <path
        d="M3.5 4.5C3.5 3.39543 4.39543 2.5 5.5 2.5H11.5L16.5 7.5V15.5C16.5 16.6046 15.6046 17.5 14.5 17.5H5.5C4.39543 17.5 3.5 16.6046 3.5 15.5V4.5Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* Nếp gấp góc tệp */}
      <path
        d="M11.5 2.5V7.5H16.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      {/* Lưới dòng bảng tính */}
      <path
        d="M6 10.5H10.5M6 13.5H9.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      {/* Mũi tên nạp dữ liệu Import nổi bật */}
      <path
        d="M13 11V15.5M13 15.5L11 13.5M13 15.5L15 13.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Icon gộp hợp nhất bài viết tương tự (Smart Merge) */
export function IconMergeArticles({ size = 16, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      {/* Nút nguồn 1 (nhánh trên) */}
      <circle
        cx="5"
        cy="5.5"
        r="2.5"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      {/* Nút nguồn 2 (nhánh dưới) */}
      <circle
        cx="5"
        cy="14.5"
        r="2.5"
        fill="currentColor"
        fillOpacity="0.2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      {/* Nút hợp nhất đích */}
      <circle
        cx="15"
        cy="10"
        r="2.8"
        fill="currentColor"
        fillOpacity="0.3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Luồng kết nối hội tụ */}
      <path
        d="M7.5 5.5H9.5C11.5 5.5 12.5 8 13.2 9M7.5 14.5H9.5C11.5 14.5 12.5 12 13.2 11"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Icon thêm mới bài viết tri thức */
export function IconAddDocument({ size = 16, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <path
        d="M4.5 4.5C4.5 3.39543 5.39543 2.5 6.5 2.5H11.5L15.5 6.5V15.5C15.5 16.6046 14.6046 17.5 13.5 17.5H6.5C5.39543 17.5 4.5 16.6046 4.5 15.5V4.5Z"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M10 9V14M7.5 11.5H12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
