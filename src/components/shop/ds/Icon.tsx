"use client";

import type { CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  BadgeCheck,
  Banknote,
  Bell,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarX,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleCheckBig,
  CircleDot,
  CircleHelp,
  CircleSlash,
  CircleX,
  Clock,
  CloudDownload,
  Coins,
  CreditCard,
  Dot,
  Download,
  EllipsisVertical,
  ExternalLink,
  FileDown,
  FileText,
  Globe,
  Heart,
  Hourglass,
  Info,
  KeyRound,
  Landmark,
  Languages,
  Layers,
  LayoutGrid,
  LifeBuoy,
  Link2Off,
  List,
  Loader,
  LocateFixed,
  Lock,
  LogOut,
  type LucideIcon,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Minus,
  MonitorSmartphone,
  Moon,
  Navigation,
  Package,
  PackageCheck,
  PackageOpen,
  PackageX,
  Phone,
  Play,
  Plus,
  ReceiptText,
  RefreshCw,
  Repeat,
  Search,
  SearchX,
  Send,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Star,
  Store,
  Sun,
  Trash2,
  TreePalm,
  TriangleAlert,
  Truck,
  Undo2,
  User,
  UserX,
  Wallet,
  WifiOff,
  X,
  Zap,
} from "lucide-react";

// Kebab-name → component. Statically imported so icons render on the server
// (no lazy/Suspense) and tree-shake to only what's referenced here.
//
// ── Why this map is `satisfies`-checked and `IconName` is derived from it ────
//
// An unmapped name used to fall back to `Dot` silently, so a name that was
// never added here rendered a small dot and nothing — not tsc, not the build,
// not a console warning — said so. It happened twice. The first batch drew dots
// where the shop's warning triangles were meant to be; the second was found on
// 2026-09-09: ten names across ten files, including the account menu's "Sign-in
// details" row, Telegram in two places, the Returned / Refunded / Mixed / Unknown
// order-status chips, and "locate-fixed" on the address form's own button — that
// last one was invisible to a grep and was found only by this type.
//
// `IconName` below is `keyof typeof ICONS`, and `IconProps.name` is typed to it,
// so the third batch is a compile error instead of a dot. `satisfies` keeps that
// key union narrow — annotating this as `Record<string, LucideIcon>` would widen
// `keyof` back to `string` and give the check nothing to bite on.
const ICONS = {
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "arrow-up-down": ArrowUpDown,
  "badge-check": BadgeCheck,
  banknote: Banknote,
  bell: Bell,
  "building-2": Building2,
  calendar: Calendar,
  "calendar-check": CalendarCheck,
  "calendar-clock": CalendarClock,
  "calendar-days": CalendarDays,
  "calendar-x": CalendarX,
  check: Check,
  "check-check": CheckCheck,
  "chevron-down": ChevronDown,
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  "chevron-up": ChevronUp,
  "circle-alert": CircleAlert,
  "circle-check-big": CircleCheckBig,
  "circle-dot": CircleDot,
  "circle-help": CircleHelp,
  "circle-slash": CircleSlash,
  "circle-x": CircleX,
  clock: Clock,
  "cloud-download": CloudDownload,
  coins: Coins,
  "credit-card": CreditCard,
  dot: Dot,
  download: Download,
  "ellipsis-vertical": EllipsisVertical,
  "external-link": ExternalLink,
  "file-down": FileDown,
  "file-text": FileText,
  globe: Globe,
  heart: Heart,
  hourglass: Hourglass,
  info: Info,
  "key-round": KeyRound,
  landmark: Landmark,
  languages: Languages,
  layers: Layers,
  "layout-grid": LayoutGrid,
  "life-buoy": LifeBuoy,
  "link-2-off": Link2Off,
  list: List,
  loader: Loader,
  "locate-fixed": LocateFixed,
  lock: Lock,
  "log-out": LogOut,
  mail: Mail,
  "map-pin": MapPin,
  "message-circle": MessageCircle,
  "message-square": MessageSquare,
  minus: Minus,
  "monitor-smartphone": MonitorSmartphone,
  moon: Moon,
  navigation: Navigation,
  package: Package,
  "package-check": PackageCheck,
  "package-open": PackageOpen,
  "package-x": PackageX,
  // `Palmtree` is lucide's deprecated alias for this glyph; the current export
  // is `TreePalm`, and the shop's holiday notice asks for the old name.
  palmtree: TreePalm,
  phone: Phone,
  play: Play,
  plus: Plus,
  "receipt-text": ReceiptText,
  "refresh-cw": RefreshCw,
  repeat: Repeat,
  search: Search,
  "search-x": SearchX,
  send: Send,
  settings: Settings,
  "share-2": Share2,
  shield: Shield,
  "shield-check": ShieldCheck,
  "shopping-cart": ShoppingCart,
  "sliders-horizontal": SlidersHorizontal,
  smartphone: Smartphone,
  sparkles: Sparkles,
  star: Star,
  store: Store,
  sun: Sun,
  "trash-2": Trash2,
  "triangle-alert": TriangleAlert,
  truck: Truck,
  "undo-2": Undo2,
  user: User,
  "user-x": UserX,
  wallet: Wallet,
  "wifi-off": WifiOff,
  x: X,
  zap: Zap,
} satisfies Record<string, LucideIcon>;

/**
 * Every icon this design system can draw.
 *
 * Derived from `ICONS` rather than written out, so adding a glyph is one edit
 * and the union cannot drift from the map.
 */
export type IconName = keyof typeof ICONS;

export interface IconProps {
  /**
   * ⚠ Typed to {@link IconName}, not `string`, deliberately — see the note on
   * `ICONS`. A name that is not in the map is now a compile error rather than a
   * silently-rendered dot. If you are reaching for a glyph that is not here,
   * import it from lucide and add it to the map; do not widen this type.
   */
  name: IconName;
  size?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}

/** Renders a lucide icon by the design's kebab-case name. */
export function Icon({ name, size = 20, strokeWidth = 2, color, className, style }: IconProps) {
  // The `?? Dot` is unreachable through the typed prop and stays only for
  // callers that reach this through an `as` cast or untyped JSON.
  const Cmp: LucideIcon = ICONS[name] ?? Dot;
  return (
    <Cmp
      size={size}
      strokeWidth={strokeWidth}
      color={color}
      className={className}
      style={style}
    />
  );
}
