import { redirect } from "next/navigation";

export default function VerificatiePage() {
  // PRD §1.3: leads hebben een eigen menu-item
  redirect("/leads");
}
