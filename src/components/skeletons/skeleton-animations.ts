// Shared animation variants for skeleton components

export const shimmer = {
  initial: { opacity: 0.5 },
  animate: { opacity: 1 },
  transition: { duration: 0.8, repeat: Infinity, repeatType: "reverse" as const }
};

export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } }
};

export const fadeInUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 }
};
