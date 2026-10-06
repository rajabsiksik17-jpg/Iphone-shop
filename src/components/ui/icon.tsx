import {
  BadgeCheck, Banknote, Cable, CircleHelp, CreditCard, Gift, Headphones, HeartHandshake, Laptop, Lock, MessagesSquare, Package, RotateCcw, Scale,
  ShieldCheck, Smartphone, Sparkles, Star, Store, Tablet, Tag, Truck, Watch, Wrench, Zap, Clock, MapPin, Phone, Mail, Award, Leaf, Battery, Wifi, Camera,
  type LucideIcon,
} from "lucide-react";

/**
 * Curated icon set available to CMS content (features, announcements…).
 * Keeping it explicit avoids shipping the entire icon library to shoppers.
 */
export const CMS_ICONS: Record<string, LucideIcon> = {
  Truck, ShieldCheck, RotateCcw, MessagesSquare, BadgeCheck, Scale, HeartHandshake, CreditCard, Banknote, Sparkles, Gift, Tag, Star, Zap, Clock,
  Package, Store, Wrench, Lock, Award, Leaf, Battery, Wifi, Camera, MapPin, Phone, Mail, Smartphone, Tablet, Laptop, Watch, Headphones, Cable, CircleHelp,
};

export function CmsIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  const I = (name && CMS_ICONS[name]) || Sparkles;
  return <I className={className} aria-hidden />;
}
