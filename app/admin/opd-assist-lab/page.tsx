import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import OpdAssistFeatureDisabled from "@/components/chartAssist/OpdAssistFeatureDisabled";
import { isOpdAssistEnabled, isAdminSession } from "@/lib/chartAssist/guards";
import OpdAssistLabClient from "@/components/chartAssist/OpdAssistLabClient";

export default async function OpdAssistLabPage() {
  const session = await getServerSession(authOptions);
  if (!isAdminSession(session)) notFound();
  if (!isOpdAssistEnabled()) {
    return <OpdAssistFeatureDisabled />;
  }
  return <OpdAssistLabClient />;
}
