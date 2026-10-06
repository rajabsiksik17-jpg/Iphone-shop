import { notFound } from "next/navigation";

// Unknown multi-segment paths render the storefront's designed 404.
export default function CatchAll() {
  notFound();
}
