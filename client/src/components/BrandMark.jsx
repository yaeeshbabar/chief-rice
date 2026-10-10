// Three grains of rice on the brand-blue tile. Same drawing as public/favicon.svg.
const BrandMark = ({ className = "h-8 w-8" }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    <rect width="32" height="32" rx="8" fill="var(--accent)" />
    <g fill="#fff">
      <ellipse cx="12.4" cy="13.2" rx="2.5" ry="6.4" transform="rotate(40 12.4 13.2)" />
      <ellipse cx="19.8" cy="13.4" rx="2.5" ry="6.4" transform="rotate(22 19.8 13.4)" />
      <ellipse cx="15.6" cy="21.4" rx="2.5" ry="6.4" transform="rotate(58 15.6 21.4)" />
    </g>
  </svg>
);

export default BrandMark;
