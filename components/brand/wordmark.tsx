import Link from "next/link";

export function MarsMark({
  inverse = false,
  className = "mars-mark",
}: {
  inverse?: boolean;
  className?: string;
}) {
  void inverse;
  const ink = "currentColor";
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 40 40"
    >
      <ellipse
        cx="20"
        cy="20"
        rx="15.2"
        ry="9.4"
        stroke={ink}
        strokeWidth="1.2"
        transform="rotate(-28 20 20)"
      />
      <ellipse
        cx="20"
        cy="20"
        rx="9.6"
        ry="15.4"
        stroke={ink}
        strokeOpacity="0.55"
        strokeWidth="1"
        transform="rotate(-28 20 20)"
      />
      <circle cx="20" cy="20" r="1.6" fill={ink} />
      <circle cx="31.2" cy="13.2" r="2.35" fill="#e4623f" />
      <path d="M20 4.8v3.2M20 32v3.2M4.8 20h3.2M32 20h3.2" stroke="#356CFF" strokeWidth="1" />
    </svg>
  );
}

export function Wordmark({
  inverse = false,
  href = "/",
}: {
  inverse?: boolean;
  href?: string;
}) {
  return (
    <Link className={`wordmark${inverse ? " wordmark-inverse" : ""}`} href={href}>
      <MarsMark inverse={inverse} />
      <span>Mars Bank</span>
    </Link>
  );
}
