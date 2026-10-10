'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowUpRight, Heart, ShieldCheck, Users, ClipboardList, Wallet, Pill } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const OtterScene = dynamic(() => import('./otter-scene'), { ssr: false });

type Lang = 'en' | 'es';

type Chapter = {
  label: string;
  eyebrow: string;
  lines: string[];
  accent: string;
  description: string;
  aside: string;
};

type Copy = {
  chapters: Chapter[];
  brandAria: string;
  chaptersNav: string;
  headerAction: string;
  topline: [string, string];
  modelCaption: [string, string];
  branches: { coordinate: string; organize: string; finance: string; meds: string; therapies: string; nutrition: string };
  reapNote: string;
  primary: { default: string; final: string };
  reassurance: string;
  storyAria: string;
  goToAria: (label: string) => string;
  footerScrollEnd: string;
  footerScroll: string;
  footerLogin: string;
};

const copy: Record<Lang, Copy> = {
  en: {
    chapters: [
      { label: 'Accompany', eyebrow: '01 / CARE STARTS HERE', lines: ['Caring is', 'being close.'], accent: 'Even from afar.', description: 'For those who care, for those who love. Coordination, tasks, and financial support for your family’s care, all in one place.', aside: 'There are many ways to say “I’m here.” Helping you with what comes next is one of them.' },
      { label: 'Organize', eyebrow: '02 / ONE PLAN, FEWER WORRIES', lines: ['A small step.', 'A big relief.'], accent: 'Let’s know what’s next.', description: 'Turn instructions into a shared plan. Appointments, tests, and supplies: each task with a person in charge and a date to confirm.', aside: 'From “who can?” to “I’ve got it.” Your whole team, on the same page.' },
      { label: 'Finance', eyebrow: '03 / MAKING CARE POSSIBLE', lines: ['More support.', 'Less burden.'], accent: 'Care is financial too.', description: 'Medications, therapies, and nutrition: organize budgets, choose who covers them, and pave the way to Reap-compatible purchases.', aside: 'Clear responsibilities. Shared budgets. More room for what matters.' },
      { label: 'Begin', eyebrow: '04 / MORE CALM, MORE CONNECTED', lines: ['Fewer worries.', 'More moments.'], accent: 'Let’s care together.', description: 'Your family decides every step. Review the proposals, confirm the instructions, and authorize expenses from your family hub.', aside: 'Built from a real family experience, to make everything around caregiving a little lighter.' },
    ],
    brandAria: 'CarePilot home',
    chaptersNav: 'Chapters',
    headerAction: 'Family hub',
    topline: ['A LITTLE HELP. A LOT OF CARE.', 'REAP × CAREPILOT · CARE + FINANCE'],
    modelCaption: ['Always on your team.', 'Your care companion.'],
    branches: { coordinate: 'Coordinate', organize: 'Organize', finance: 'Finance', meds: 'Medications', therapies: 'Therapies', nutrition: 'Nutrition' },
    reapNote: 'Payments subject to integration and compatible merchants.',
    primary: { default: 'Explore the family hub', final: 'Create my first agreement' },
    reassurance: 'You decide. CarePilot is with you.',
    storyAria: 'Chapter progress',
    goToAria: (label) => `Go to ${label}`,
    footerScrollEnd: 'WE’RE WITH YOU',
    footerScroll: 'SCROLL TO DISCOVER',
    footerLogin: 'ALREADY HAVE AN ACCOUNT? LOG IN ↗',
  },
  es: {
    chapters: [
      { label: 'Acompañar', eyebrow: '01 / EL CUIDADO EMPIEZA AQUÍ', lines: ['Cuidar es', 'estar cerca.'], accent: 'Incluso a la distancia.', description: 'Para quienes cuidan, para quienes aman. Coordinación, tareas y apoyo financiero para el cuidado de tu familia, en un mismo lugar.', aside: 'Hay muchas formas de decir “aquí estoy”. Ayudarte con lo que sigue es una de ellas.' },
      { label: 'Organizar', eyebrow: '02 / UN PLAN, MENOS PENDIENTES', lines: ['Un pequeño paso.', 'Un gran alivio.'], accent: 'Sepamos qué sigue.', description: 'Convierte las indicaciones en un plan compartido. Citas, estudios y suministros: cada pendiente con una persona responsable y una fecha por confirmar.', aside: 'Del “¿quién puede?” al “yo me encargo”. Todo tu equipo, en la misma página.' },
      { label: 'Financiar', eyebrow: '03 / HACER POSIBLE EL CUIDADO', lines: ['Más apoyo.', 'Menos carga.'], accent: 'El cuidado también es financiero.', description: 'Medicamentos, terapias y nutrición: organiza presupuestos, elige quién los cubre y prepara el camino a compras compatibles con Reap.', aside: 'Responsabilidades claras. Presupuestos compartidos. Más espacio para lo que importa.' },
      { label: 'Comenzar', eyebrow: '04 / MÁS CALMA, MÁS CERCA', lines: ['Menos pendientes.', 'Más momentos.'], accent: 'Cuidemos juntos.', description: 'Tu familia decide cada paso. Revisa las propuestas, confirma las indicaciones y autoriza los gastos desde tu centro familiar.', aside: 'Creado desde una experiencia familiar real, para hacer más llevadero todo lo que rodea al cuidado.' },
    ],
    brandAria: 'CarePilot inicio',
    chaptersNav: 'Capítulos',
    headerAction: 'Centro familiar',
    topline: ['UN POCO DE AYUDA. MUCHO CARIÑO.', 'REAP × CAREPILOT · CUIDADO + FINANZAS'],
    modelCaption: ['Siempre en tu equipo.', 'Tu compañero de cuidado.'],
    branches: { coordinate: 'Coordinar', organize: 'Organizar', finance: 'Financiar', meds: 'Medicamentos', therapies: 'Terapias', nutrition: 'Nutrición' },
    reapNote: 'Pagos sujetos a integración y comercios compatibles.',
    primary: { default: 'Explorar el centro familiar', final: 'Crear mi primer acuerdo' },
    reassurance: 'Tú decides. CarePilot te acompaña.',
    storyAria: 'Progreso de capítulos',
    goToAria: (label) => `Ir a ${label}`,
    footerScrollEnd: 'ESTAMOS CONTIGO',
    footerScroll: 'DESLIZA PARA DESCUBRIR',
    footerLogin: '¿YA TIENES CUENTA? INICIA SESIÓN ↗',
  },
};

export default function CinematicLanding() {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [lang, setLang] = useState<Lang>('en');
  const t = copy[lang];
  const chapters = t.chapters;
  const progress = useRef(0);
  const fills = useRef<(HTMLSpanElement | null)[]>([]);
  const dots = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    let frame = 0;
    let currentChapter = -1;
    const update = () => {
      const height = (root.current?.offsetHeight ?? innerHeight) - innerHeight;
      const p = Math.max(0, Math.min(1, scrollY / Math.max(height, 1)));
      progress.current = p;
      fills.current.forEach((fill, i) => {
        if (fill) fill.style.transform = `scaleY(${Math.max(0, Math.min(1, p * 4 - i))})`;
      });
      dots.current.forEach((dot, i) => {
        if (dot) dot.style.transform = `translateY(${p * (i % 2 ? 110 : -80)}vh)`;
      });
      const chapter = Math.min(3, Math.floor(p * 4));
      if (chapter !== currentChapter) { currentChapter = chapter; setActive(chapter); }
      frame = 0;
    };
    const scroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    addEventListener('scroll', scroll, { passive: true });
    addEventListener('resize', scroll);
    update();
    return () => { removeEventListener('scroll', scroll); removeEventListener('resize', scroll); cancelAnimationFrame(frame); };
  }, []);
  const goTo = (index: number) => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const height = (root.current?.offsetHeight ?? innerHeight) - innerHeight;
    scrollTo({ top: height * [0, .34, .62, .94][index], behavior: reduced ? 'instant' : 'smooth' });
  };
  return <div ref={root} className={`care-cinema chapter-${active}`}>
    <div className="care-stage">
      <div className="care-ambient" aria-hidden="true"><div className="ambient-orb orb-one" /><div className="ambient-orb orb-two" /><div className="ambient-orb orb-three" /><div className="care-grain" /></div>
      <div className="care-grid" aria-hidden="true">{Array.from({ length: 5 }, (_, i) => <div key={i}><i ref={element => { dots.current[i] = element; }} style={{ top: `${18 + i * 15}%` }} /></div>)}</div>
      <header className="care-header">
        <Link href="/" className="care-brand" aria-label={t.brandAria}><Image src="/images/logos/otters.png" alt="" width={44} height={44} />carepilot<span>®</span></Link>
        <nav aria-label={t.chaptersNav}>{chapters.map((c, i) => <button key={c.label} onClick={() => goTo(i)} className={active === i ? 'selected' : ''} aria-current={active === i ? 'step' : undefined}>{c.label}</button>)}</nav>
        <div className="care-header-right">
          <div className="care-lang" role="group" aria-label="Language">
            <button type="button" onClick={() => setLang('en')} className={lang === 'en' ? 'is-active' : ''} aria-pressed={lang === 'en'}>EN</button>
            <span aria-hidden="true">/</span>
            <button type="button" onClick={() => setLang('es')} className={lang === 'es' ? 'is-active' : ''} aria-pressed={lang === 'es'}>ES</button>
          </div>
          <Link href="/admin" className="care-header-action">{t.headerAction} <ArrowUpRight size={15} /></Link>
        </div>
      </header>
      <div className="care-topline"><span>{t.topline[0]}</span><span>{t.topline[1]} <Heart size={11} /></span></div>
      <div className="care-model"><OtterScene progress={progress} lang={lang} /></div>
      <div className="care-model-caption" aria-hidden="true"><span className="caption-mark">↗</span><span>{t.modelCaption[0]}<br /><strong>{t.modelCaption[1]}</strong></span></div>
      <main className="care-slides">{chapters.map((c, i) => <section key={c.label} className={`care-slide slide-composition-${i} ${active === i ? 'is-active' : ''}`} aria-hidden={active !== i} inert={active !== i} aria-label={c.label}>
        <div className="care-eyebrow"><span />{c.eyebrow}</div>
        <h1 aria-label={c.lines.join(' ')}>{c.lines.map((line, j) => <span className="title-line" key={line}>{Array.from(line).map((char, k) => <span aria-hidden="true" key={k} style={{ transitionDelay: `${(j * 12 + k) * .018}s` }} className="title-char">{char === ' ' ? '\u00a0' : char}</span>)}</span>)}</h1>
        <p className="care-script"><span>{c.accent}</span></p>
        <div className="care-description"><p>{c.description}</p><p>{c.aside}</p></div>
        <div className="landing-branches">{i === 2 ? <><span><Pill size={13} /> {t.branches.meds}</span><span><Heart size={13} /> {t.branches.therapies}</span><span>{t.branches.nutrition}</span></> : <><span><Users size={13} /> {t.branches.coordinate}</span><span><ClipboardList size={13} /> {t.branches.organize}</span><span><Wallet size={13} /> {t.branches.finance}</span></>}</div>
        {i === 2 && <div className="landing-reap"><strong>reap <span>×</span> carepilot</strong><small>{t.reapNote}</small></div>}
        <Link href="/admin" className="care-primary">{i === 3 ? t.primary.final : t.primary.default}<span><ArrowUpRight size={19} /></span></Link>
        <div className="care-reassurance"><ShieldCheck size={13} /> {t.reassurance}</div>
      </section>)}</main>
      <aside className="care-story" aria-label={t.storyAria}>{chapters.map((c, i) => <button key={c.label} onClick={() => goTo(i)} aria-label={t.goToAria(c.label)} aria-current={active === i ? 'step' : undefined}><span ref={element => { fills.current[i] = element; }} style={{ transform: 'scaleY(0)' }} /></button>)}</aside>
      <footer className="care-footer"><button onClick={() => goTo(Math.min(3, active + 1))}><span className="scroll-circle"><ArrowDown size={15} /></span>{active === 3 ? t.footerScrollEnd : t.footerScroll}</button><Link href="/login" className="care-footer-center care-login">{t.footerLogin}</Link><span className="care-counter">0{active + 1}<i />04</span></footer>
    </div>
    <div className="care-scroll-markers" aria-hidden="true">{chapters.map(c => <div key={c.label} />)}</div>
  </div>;
}
