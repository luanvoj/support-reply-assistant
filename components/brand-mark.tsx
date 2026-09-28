export function BrandMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <div className={`brand-mark-wrapper brand-mark-${size}`} aria-hidden="true">
      <div className="brand-mark-aura" />
      <div className="brand-mark-box">
        <div className="brand-mark-shine" />
        <svg
          className="brand-mark-icon"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
        <defs>
          <linearGradient id="brandStarGrad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" />
            <stop offset="0.6" stopColor="#E0E7FF" />
            <stop offset="1" stopColor="#C7D2FE" />
          </linearGradient>
          <linearGradient id="brandRingGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38BDF8" stopOpacity="0.8" />
            <stop offset="1" stopColor="#818CF8" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Vòng quỹ đạo hạt lượng tử quay nhẹ */}
        <circle
          cx="16"
          cy="16"
          r="11"
          stroke="url(#brandRingGrad)"
          strokeWidth="1.5"
          strokeDasharray="3 2"
          className="brand-mark-orbital"
        />

        {/* Biểu tượng Neural Star sáng lấp lánh */}
        <path
          d="M16 4C16.8 9.5 19.5 12.2 25 13C19.5 13.8 16.8 16.5 16 22C15.2 16.5 12.5 13.8 7 13C12.5 12.2 15.2 9.5 16 4Z"
          fill="url(#brandStarGrad)"
          className="brand-mark-sparkle"
        />

        {/* Điểm lượng tử trung tâm */}
        <circle cx="16" cy="13" r="2.2" fill="#FFFFFF" className="brand-mark-core" />

        {/* Vệ tinh tri thức bổ trợ */}
        <path
          d="M23 20C23.4 22.2 24.8 23.6 27 24C24.8 24.4 23.4 25.8 23 28C22.6 25.8 21.2 24.4 19 24C21.2 23.6 22.6 22.2 23 20Z"
          fill="#38BDF8"
          fillOpacity="0.95"
          className="brand-mark-satellite"
        />
        </svg>
      </div>
    </div>
  );
}
