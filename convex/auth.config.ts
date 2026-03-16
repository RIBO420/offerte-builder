export default {
  providers: [
    // Production - toptuinen.app (used by both web and mobile)
    {
      domain: "https://clerk.toptuinen.app",
      applicationID: "convex",
    },
    // Development - local development (same Clerk project as toptuinen.app)
    {
      domain: "https://moral-earwig-1.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
