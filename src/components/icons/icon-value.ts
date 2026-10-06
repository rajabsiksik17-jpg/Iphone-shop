/**
 * Icon values stored in the database:
 *   "lucide:BatteryFull"   → an icon from the Lucide library
 *   "custom:<CustomIcon id>" → an admin-uploaded, sanitised SVG
 */
export type IconValue = string | null | undefined;

export function parseIcon(value: IconValue): { kind: "lucide"; name: string } | { kind: "custom"; id: string } | null {
  if (!value) return null;
  if (value.startsWith("custom:")) return { kind: "custom", id: value.slice(7) };
  // Bare names (older CMS content) are treated as Lucide names.
  return { kind: "lucide", name: value.startsWith("lucide:") ? value.slice(7) : value };
}
