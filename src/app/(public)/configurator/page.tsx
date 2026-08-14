import { redirect } from "next/navigation";

/**
 * Kale /configurator was een 404 in de publieke funnel (WS1 B5).
 * Voorlopig doorsturen naar de gazon-wizard; de volwaardige indexpagina
 * ("Waar kunnen we u mee helpen?" + dienstkaarten) komt in WS9.
 */
export default function ConfiguratorIndexPage() {
  redirect("/configurator/gazon");
}
