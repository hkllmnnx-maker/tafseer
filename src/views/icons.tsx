// مكتبة أيقونات SVG مخصصة (Lucide-style) - بدون اعتماد خارجي
type IconProps = { class?: string; size?: number; stroke?: number }
const base = (size = 20, stroke = 2) => ({
  width: size, height: size, viewBox: '0 0 24 24',
  fill: 'none', stroke: 'currentColor',
  'stroke-width': stroke, 'stroke-linecap': 'round' as const, 'stroke-linejoin': 'round' as const,
})

export const IconSearch = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
)
export const IconBook = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
  </svg>
)
export const IconBookOpen = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
)
export const IconUser = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)
export const IconLayers = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="M12 2 2 7l10 5 10-5-10-5Z" />
    <path d="m2 17 10 5 10-5" />
    <path d="m2 12 10 5 10-5" />
  </svg>
)
export const IconCompare = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <rect x="3" y="3" width="7" height="18" rx="1" />
    <rect x="14" y="3" width="7" height="18" rx="1" />
    <path d="M10 12h4" />
  </svg>
)
export const IconHome = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)
export const IconFilter = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
)
export const IconArrowLeft = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </svg>
)
export const IconArrowRight = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
)
export const IconChevronDown = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)
export const IconChevronUp = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="m18 15-6-6-6 6" />
  </svg>
)
export const IconCopy = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
)
export const IconShare = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
    <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
  </svg>
)
export const IconExternal = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
)
export const IconBookmark = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
  </svg>
)
export const IconSparkles = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="M9.5 2.5 11 6l3.5 1.5L11 9l-1.5 3.5L8 9 4.5 7.5 8 6Z" />
    <path d="M19 12.5 20 15l2.5 1L20 17l-1 2.5L18 17l-2.5-1L18 15Z" />
  </svg>
)
export const IconStar = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
)
export const IconHeart = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
  </svg>
)
export const IconShield = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </svg>
)
export const IconMoon = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
)
export const IconSun = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
  </svg>
)
export const IconScale = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
    <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
    <path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
  </svg>
)
export const IconPray = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="M12 2v6" />
    <path d="M9 12c0-1.7 1.3-3 3-3s3 1.3 3 3" />
    <path d="M5 22h14" />
    <path d="M5 22c0-3 3-6 7-6s7 3 7 6" />
  </svg>
)
export const IconList = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <line x1="8" x2="21" y1="6" y2="6" />
    <line x1="8" x2="21" y1="12" y2="12" />
    <line x1="8" x2="21" y1="18" y2="18" />
    <line x1="3" x2="3.01" y1="6" y2="6" />
    <line x1="3" x2="3.01" y1="12" y2="12" />
    <line x1="3" x2="3.01" y1="18" y2="18" />
  </svg>
)
export const IconMenu = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <line x1="4" x2="20" y1="12" y2="12" />
    <line x1="4" x2="20" y1="6" y2="6" />
    <line x1="4" x2="20" y1="18" y2="18" />
  </svg>
)
export const IconX = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
  </svg>
)
export const IconCheck = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
)
export const IconBolt = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
  </svg>
)
export const IconLanguages = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="m5 8 6 6" /><path d="m4 14 6-6 2-3" />
    <path d="M2 5h12" /><path d="M7 2h1" />
    <path d="m22 22-5-10-5 10" /><path d="M14 18h6" />
  </svg>
)
export const IconDatabase = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5v14a9 3 0 0 0 18 0V5" />
    <path d="M3 12a9 3 0 0 0 18 0" />
  </svg>
)
export const IconQuote = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
    <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
  </svg>
)
export const IconGrid = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <rect width="7" height="7" x="3" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="3" rx="1" />
    <rect width="7" height="7" x="14" y="14" rx="1" />
    <rect width="7" height="7" x="3" y="14" rx="1" />
  </svg>
)
export const IconHash = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <line x1="4" x2="20" y1="9" y2="9" />
    <line x1="4" x2="20" y1="15" y2="15" />
    <line x1="10" x2="8" y1="3" y2="21" />
    <line x1="16" x2="14" y1="3" y2="21" />
  </svg>
)
export const IconCalendar = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="M8 2v4" /><path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" />
  </svg>
)
export const IconArrowRightCircle = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <circle cx="12" cy="12" r="10" />
    <path d="m12 16 4-4-4-4" />
    <path d="M8 12h8" />
  </svg>
)
export const IconPlus = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="M5 12h14" /><path d="M12 5v14" />
  </svg>
)
export const IconMinus = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="M5 12h14" />
  </svg>
)
export const IconTextSize = (p: IconProps = {}) => (
  <svg {...base(p.size, p.stroke)} class={p.class}>
    <path d="M4 7V5h16v2" />
    <path d="M9 19h6" />
    <path d="M12 5v14" />
  </svg>
)
