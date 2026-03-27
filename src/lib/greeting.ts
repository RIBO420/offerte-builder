export function getGreeting(name?: string): string {
  const hour = new Date().getHours();
  let greeting: string;

  if (hour < 12) greeting = "Goedemorgen";
  else if (hour < 18) greeting = "Goedemiddag";
  else greeting = "Goedenavond";

  return name ? `${greeting}, ${name}` : greeting;
}
