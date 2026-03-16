import { redirect } from "next/navigation";

export default function VerificatiePage() {
  redirect("/klanten?tab=leads");
}
