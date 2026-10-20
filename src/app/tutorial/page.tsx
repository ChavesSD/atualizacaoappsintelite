import { redirect } from "next/navigation";
import { getClientContext } from "@/lib/auth";
import { TutorialApp } from "./TutorialApp";

export const dynamic = "force-dynamic";

export default async function TutorialPage() {
  if (!(await getClientContext())) redirect("/");
  return <TutorialApp />;
}
