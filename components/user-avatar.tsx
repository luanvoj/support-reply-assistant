type UserAvatarProps = {
  fullName?: string | null;
  src?: string | null;
  className?: string;
  alt?: string;
};

export function UserAvatar({ fullName, src, className = "", alt = "Ảnh đại diện" }: UserAvatarProps) {
  if (src) return <img className={`user-avatar-image ${className}`.trim()} src={src} alt={alt} />;
  return <span className={`ops-user ${className}`.trim()} aria-label={alt}>{fullName?.slice(0, 2).toUpperCase() ?? "…"}</span>;
}
