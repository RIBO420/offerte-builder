"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useMemo } from "react";
import { Trees, Shovel, Leaf, Hammer, Fence, Droplets } from "lucide-react";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { transitions } from "@/lib/motion-config";

// Floating icon component with 3D effect - optimized for GPU
function FloatingIcon({
  icon: Icon,
  delay,
  x,
  y,
  color,
  size = 40,
  prefersReducedMotion = false,
}: {
  icon: React.ElementType;
  delay: number;
  x: string;
  y: string;
  color: string;
  size?: number;
  prefersReducedMotion?: boolean;
}) {
  // Reduced motion: just fade in, no floating animation
  if (prefersReducedMotion) {
    return (
      <motion.div
        className="absolute"
        style={{ left: x, top: y }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: delay * 0.5 }}
      >
        <div
          className={`relative flex items-center justify-center rounded-2xl ${color} backdrop-blur-sm border border-white/20 shadow-lg`}
          style={{ width: size, height: size }}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="absolute will-change-transform"
      style={{ left: x, top: y }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: [0, -20, 0],
      }}
      transition={{
        opacity: { duration: 0.5, delay },
        scale: { duration: 0.5, delay, type: "spring", stiffness: 200 },
        y: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: delay + 0.5 },
      }}
    >
      <div
        className={`relative flex items-center justify-center rounded-2xl ${color} backdrop-blur-sm border border-white/20 shadow-optimized-lg`}
        style={{
          width: size,
          height: size,
        }}
      >
        <Icon className="h-5 w-5 text-white" />
        {/* Simplified glow effect - less expensive than blur-xl */}
        <div
          className="absolute inset-0 rounded-2xl opacity-30 bg-emerald-500"
          style={{ filter: "blur(12px)" }}
        />
      </div>
    </motion.div>
  );
}

// Particle effect - optimized with fewer particles and GPU acceleration
function Particles({ prefersReducedMotion = false }: { prefersReducedMotion?: boolean }) {
  // Memoize particles to prevent recreation on re-renders
  const particles = useMemo(() => {
    // Use fewer particles for better performance
    const count = prefersReducedMotion ? 0 : 12;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: `${(i * 8.33) % 100}%`, // Deterministic positions for SSR
      y: `${(i * 12.5) % 100}%`,
      size: (i % 3) + 2, // Deterministic sizes
      duration: 10 + (i % 5) * 2,
      delay: i * 0.5,
    }));
  }, [prefersReducedMotion]);

  if (prefersReducedMotion || particles.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-emerald-400/30 will-change-transform"
          style={{
            left: particle.x,
            top: particle.y,
            width: particle.size,
            height: particle.size,
          }}
          animate={{
            y: [0, -80, 0],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

// 3D Garden visualization
function Garden3D({ prefersReducedMotion = false }: { prefersReducedMotion?: boolean }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Only apply scroll-based rotation when motion is allowed
  const rotateY = useTransform(
    scrollYProgress,
    [0, 1],
    prefersReducedMotion ? [0, 0] : [-15, 15]
  );
  const rotateX = useTransform(
    scrollYProgress,
    [0, 1],
    prefersReducedMotion ? [0, 0] : [10, -10]
  );

  return (
    <motion.div
      ref={ref}
      className="relative w-full h-full"
      style={{
        perspective: prefersReducedMotion ? "none" : 1000,
      }}
    >
      <motion.div
        className="relative w-full h-full"
        style={{
          rotateY: prefersReducedMotion ? 0 : rotateY,
          rotateX: prefersReducedMotion ? 0 : rotateX,
          transformStyle: prefersReducedMotion ? "flat" : "preserve-3d",
        }}
      >
        {/* Main garden plane */}
        <motion.div
          className="absolute inset-0 rounded-3xl overflow-hidden contain-paint"
          style={{
            background: "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
          }}
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.8, delay: 0.2 }}
        >
          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `
                linear-gradient(rgba(16, 185, 129, 0.3) 1px, transparent 1px),
                linear-gradient(90deg, rgba(16, 185, 129, 0.3) 1px, transparent 1px)
              `,
              backgroundSize: "40px 40px",
            }}
          />

          {/* Floating scope elements */}
          <FloatingIcon
            icon={Shovel}
            delay={0.3}
            x="15%"
            y="20%"
            color="bg-gradient-to-br from-amber-500 to-amber-600"
            size={56}
            prefersReducedMotion={prefersReducedMotion}
          />
          <FloatingIcon
            icon={Hammer}
            delay={0.5}
            x="70%"
            y="25%"
            color="bg-gradient-to-br from-slate-500 to-slate-600"
            size={48}
            prefersReducedMotion={prefersReducedMotion}
          />
          <FloatingIcon
            icon={Leaf}
            delay={0.7}
            x="25%"
            y="60%"
            color="bg-gradient-to-br from-emerald-500 to-emerald-600"
            size={52}
            prefersReducedMotion={prefersReducedMotion}
          />
          <FloatingIcon
            icon={Fence}
            delay={0.9}
            x="75%"
            y="65%"
            color="bg-gradient-to-br from-amber-600 to-amber-700"
            size={44}
            prefersReducedMotion={prefersReducedMotion}
          />
          <FloatingIcon
            icon={Droplets}
            delay={1.1}
            x="50%"
            y="45%"
            color="bg-gradient-to-br from-blue-500 to-blue-600"
            size={48}
            prefersReducedMotion={prefersReducedMotion}
          />

          {/* Center glow - reduced blur for performance */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 70%)",
              filter: "blur(30px)",
            }}
          />
        </motion.div>

        {/* Reflection/gloss effect */}
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%, transparent 100%)",
          }}
        />
      </motion.div>
    </motion.div>
  );
}

// Animated gradient text
function GradientText({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400 bg-clip-text text-transparent"
      style={{
        backgroundSize: "200% 200%",
        animation: "gradient-shift 5s ease infinite",
      }}
    >
      {children}
    </span>
  );
}

// Main animated hero section
export function AnimatedHero() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="relative min-h-screen overflow-hidden bg-background">
      {/* Background effects - conditionally rendered based on reduced motion */}
      <div className="absolute inset-0">
        {/* Gradient orbs - static for reduced motion */}
        {prefersReducedMotion ? (
          <>
            <div
              className="absolute top-20 left-1/4 w-96 h-96 rounded-full opacity-60"
              style={{
                background: "radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)",
                filter: "blur(40px)",
              }}
            />
            <div
              className="absolute bottom-20 right-1/4 w-96 h-96 rounded-full opacity-60"
              style={{
                background: "radial-gradient(circle, rgba(34, 197, 94, 0.15) 0%, transparent 70%)",
                filter: "blur(40px)",
              }}
            />
          </>
        ) : (
          <>
            <motion.div
              className="absolute top-20 left-1/4 w-96 h-96 rounded-full will-change-transform"
              style={{
                background: "radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)",
                filter: "blur(40px)",
              }}
              animate={{
                x: [0, 50, 0],
                y: [0, 30, 0],
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.div
              className="absolute bottom-20 right-1/4 w-96 h-96 rounded-full will-change-transform"
              style={{
                background: "radial-gradient(circle, rgba(34, 197, 94, 0.15) 0%, transparent 70%)",
                filter: "blur(40px)",
              }}
              animate={{
                x: [0, -30, 0],
                y: [0, -50, 0],
              }}
              transition={{
                duration: 12,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          </>
        )}
        <Particles prefersReducedMotion={prefersReducedMotion} />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-20" style={{ paddingTop: "calc(8rem + env(safe-area-inset-top))" }}>
        <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[80vh]">
          {/* Left: Text content */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : transitions.entrance}
            className="space-y-8"
          >
            {/* Badge */}
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, delay: 0.2 }}
              className="inline-flex"
            >
              <span className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Speciaal voor hoveniers
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, delay: 0.3 }}
              className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]"
            >
              Offertes maken
              <br />
              waarbij{" "}
              <GradientText>niets</GradientText>
              <br />
              <GradientText>vergeten</GradientText> kan
            </motion.h1>

            {/* Subhead */}
            <motion.p
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, delay: 0.5 }}
              className="text-xl text-muted-foreground max-w-lg leading-relaxed"
            >
              De eerste scope-gedreven offerte tool voor hoveniers. 
              Bereken automatisch alle werkzaamheden met 100+ normuren.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, delay: 0.7 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <a
                href="#probeer-het-zelf"
                className="group relative inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-white bg-gradient-to-r from-emerald-600 to-green-600 rounded-xl overflow-hidden transition-all hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/25"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Start gratis trial
                  <svg
                    className="w-4 h-4 transition-transform group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
              <a
                href="#hoe-het-werkt"
                className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-foreground bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm transition-all hover:bg-white/10 hover:border-white/20"
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Bekijk demo
              </a>
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, delay: 0.9 }}
              className="flex items-center gap-6 pt-4"
            >
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 border-2 border-background"
                  />
                ))}
              </div>
              <div className="text-sm">
                <span className="text-emerald-400 font-semibold">500+</span>
                <span className="text-muted-foreground"> hoveniers vertrouwen ons</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Right: 3D Visualization */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative h-[300px] sm:h-[400px] md:h-[500px] lg:h-[600px]"
          >
            <Garden3D prefersReducedMotion={prefersReducedMotion} />
          </motion.div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />

      {/* CSS for gradient animation */}
      <style jsx global>{`
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </section>
  );
}
