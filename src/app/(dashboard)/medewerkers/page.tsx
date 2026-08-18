import { redirect } from "next/navigation";

/**
 * Het medewerkersscherm is opgegaan in `/team`, samen met het oude
 * gebruikersbeheer. Server-side redirect zodat oude links, bladwijzers en
 * deeplinks uit e-mails blijven werken zonder eerst een leeg scherm te tonen.
 *
 * `/medewerkers/teams` blijft een eigen route: dat gaat over ploegindeling,
 * niet over personeelsdossiers.
 */
export default function MedewerkersPage() {
  redirect("/team");
}
