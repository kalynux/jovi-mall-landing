"use client";

import type { CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  BadgeCheck,
  Bell,
  Building2,
  CalendarCheck,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleCheckBig,
  CircleHelp,
  Clock,
  Coins,
  CreditCard,
  Dot,
  Download,
  FileDown,
  Globe,
  Heart,
  Info,
  KeyRound,
  Layers,
  LayoutGrid,
  List,
  Lock,
  type LucideIcon,
  MapPin,
  MessageCircle,
  Minus,
  MonitorSmartphone,
  Moon,
  Package,
  PackageCheck,
  Phone,
  Play,
  Plus,
  ReceiptText,
  Repeat,
  Search,
  SearchX,
  Share2,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Smartphone,
  Star,
  Store,
  Sun,
  Trash2,
  Truck,
  User,
  Wallet,
  X,
} from "lucide-react";

// Kebab-name → component. Statically imported so icons render on the server
// (no lazy/Suspense) and tree-shake to only what's referenced here.
const ICONS: Record<string, LucideIcon> = {
  "arrow-left": ArrowLeft,
  "arrow-right": ArrowRight,
  "arrow-up-down": ArrowUpDown,
  "badge-check": BadgeCheck,
  bell: Bell,
  "building-2": Building2,
  "calendar-check": CalendarCheck,
  "calendar-clock": CalendarClock,
  check: Check,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  "chevron-up": ChevronUp,
  "circle-check-big": CircleCheckBig,
  "circle-help": CircleHelp,
  clock: Clock,
  coins: Coins,
  "credit-card": CreditCard,
  dot: Dot,
  download: Download,
  "file-down": FileDown,
  globe: Globe,
  heart: Heart,
  info: Info,
  "key-round": KeyRound,
  layers: Layers,
  "layout-grid": LayoutGrid,
  list: List,
  lock: Lock,
  "map-pin": MapPin,
  "message-circle": MessageCircle,
  minus: Minus,
  "monitor-smartphone": MonitorSmartphone,
  moon: Moon,
  package: Package,
  "package-check": PackageCheck,
  phone: Phone,
  play: Play,
  plus: Plus,
  "receipt-text": ReceiptText,
  repeat: Repeat,
  search: Search,
  "search-x": SearchX,
  "share-2": Share2,
  "shield-check": ShieldCheck,
  "shopping-cart": ShoppingCart,
  "sliders-horizontal": SlidersHorizontal,
  smartphone: Smartphone,
  star: Star,
  store: Store,
  sun: Sun,
  "trash-2": Trash2,
  truck: Truck,
  user: User,
  wallet: Wallet,
  x: X,
};

export interface IconProps {
  name: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}

/** Renders a lucide icon by the design's kebab-case name. */
export function Icon({ name, size = 20, strokeWidth = 2, color, className, style }: IconProps) {
  const Cmp = ICONS[name] ?? Dot;
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
