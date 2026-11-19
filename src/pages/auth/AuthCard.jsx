import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import ClinicLogo from '../../components/common/ClinicLogo.jsx';

const orbs = [
  { className: 'left-[-8%] top-[-10%] h-80 w-80 bg-teal-400/30' },
  { className: 'right-[-6%] top-[8%] h-96 w-96 bg-cyan-300/20' },
  { className: 'bottom-[-12%] left-[18%] h-[28rem] w-[28rem] bg-brand-600/25' },
  { className: 'bottom-[8%] right-[-4%] h-72 w-72 bg-sky-300/20' },
];

export default function AuthCard({ title, text, children }) {
  const rootRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = gsap.context(() => {
      if (reduce) return;
      gsap.from(cardRef.current, { y: 12, duration: 0.45, ease: 'power2.out', clearProps: 'transform' });
      gsap.to('.auth-orb', {
        x: 'random(-36, 36)',
        y: 'random(-48, 48)',
        scale: 'random(0.92, 1.08)',
        duration: 'random(9, 15)',
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        stagger: { each: 0.45, from: 'random' },
      });
      gsap.to('.auth-glow', {
        opacity: 0.55,
        duration: 4.5,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef} className="relative min-h-screen overflow-x-hidden bg-ink-950">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="auth-glow absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(15,118,110,0.45),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(8,47,73,0.7),transparent_46%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px]" />
        {orbs.map((orb) => (
          <span key={orb.className} className={`auth-orb absolute rounded-full blur-3xl ${orb.className}`} />
        ))}
      </div>
      <div className="relative z-10 flex min-h-screen items-center justify-center px-3 py-4 sm:px-4 sm:py-10">
        <div ref={cardRef} className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-card backdrop-blur">
          <div className="auth-mark bg-ink-950 px-5 pb-3 pt-4 text-center sm:px-8 sm:pb-6 sm:pt-8">
            <ClinicLogo className="mx-auto h-24 w-24 sm:h-40 sm:w-40" />
          </div>
          <div className="px-4 py-5 sm:px-10 sm:py-8">
            <div className="mb-5 text-center sm:mb-8">
              <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl lg:text-5xl">{title}</h1>
              {text && <p className="mt-2 text-base font-bold leading-6 text-slate-600 sm:mt-3 sm:text-lg sm:leading-7">{text}</p>}
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
