import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** Locale-aware Link/redirect/router — always use these instead of next/link. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
