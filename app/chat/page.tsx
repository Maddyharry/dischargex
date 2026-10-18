import { redirect } from "next/navigation";

// This product surface is retired; customer-support chat remains available separately.
export default function RetiredChatRoute() {
  redirect("/app");
}
