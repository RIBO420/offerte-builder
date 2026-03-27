import { SignIn } from "@clerk/nextjs";

export default function PortaalLoginPage() {
  return (
    <SignIn
      path="/portaal/inloggen"
      routing="path"
      afterSignInUrl="/portaal/overzicht"
      appearance={{
        elements: {
          formButtonPrimary: "bg-[#4ADE80] hover:bg-[#22c55e] text-black",
          card: "shadow-lg",
        },
      }}
    />
  );
}
