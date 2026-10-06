import {
  LayoutDashboard, LineChart, ShoppingBag, Users, Package, FolderTree, BadgeCheck, SlidersHorizontal, Boxes, Star, TicketPercent, Mail, Home, FileText,
  GalleryHorizontal, Megaphone, Menu, CircleHelp, Share2, MessagesSquare, Inbox, Plug, Settings, ShieldCheck, ScrollText, Image, LayoutGrid, Type,
  PanelLeft, MousePointerClick, PlaySquare, Contact, Code, MessageSquareQuote, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, LineChart, ShoppingBag, Users, Package, FolderTree, BadgeCheck, SlidersHorizontal, Boxes, Star, TicketPercent, Mail, Home, FileText,
  GalleryHorizontal, Megaphone, Menu, CircleHelp, Share2, MessagesSquare, Inbox, Plug, Settings, ShieldCheck, ScrollText, Image, LayoutGrid, Type, PanelLeft,
  MousePointerClick, PlaySquare, Contact, Code, MessageSquareQuote,
};

export function AdminIcon({ name, className }: { name: string; className?: string }) {
  const I = ICONS[name] ?? LayoutGrid;
  return <I className={className} aria-hidden />;
}
