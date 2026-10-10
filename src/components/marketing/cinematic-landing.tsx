'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowUpRight, Heart, ShieldCheck, Users, ClipboardList, Wallet, Pill } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const OtterScene = dynamic(() => import('./otter-scene'), { ssr: false });
const chapters = [
  { label: 'Acompañar', eyebrow: '01 / EL CUIDADO EMPIEZA AQUÍ', lines: ['Cuidar es', 'estar cerca.'], accent: 'Incluso a la distancia.', description: 'Para quienes cuidan, para quienes aman. Coordinación, tareas y apoyo financiero para el cuidado de tu familia, en un mismo lugar.', aside: 'Hay muchas formas de decir “aquí estoy”. Ayudarte con lo que sigue es una de ellas.' },
  { label: 'Organizar', eyebrow: '02 / UN PLAN, MENOS PENDIENTES', lines: ['Un pequeño paso.', 'Un gran alivio.'], accent: 'Sepamos qué sigue.', description: 'Convierte las indicaciones en un plan compartido. Citas, estudios y suministros: cada pendiente con una persona responsable y una fecha por confirmar.', aside: 'Del “¿quién puede?” al “yo me encargo”. Todo tu equipo, en la misma página.' },
  { label: 'Financiar', eyebrow: '03 / HACER POSIBLE EL CUIDADO', lines: ['Más apoyo.', 'Menos carga.'], accent: 'El cuidado también es financiero.', description: 'Medicamentos, terapias y nutrición: organiza presupuestos, elige quién los cubre y prepara el camino a compras compatibles con Reap.', aside: 'Responsabilidades claras. Presupuestos compartidos. Más espacio para lo que importa.' },
  { label: 'Comenzar', eyebrow: '04 / MÁS CALMA, MÁS CERCA', lines: ['Menos pendientes.', 'Más momentos.'], accent: 'Cuidemos juntos.', description: 'Tu familia decide cada paso. Revisa las propuestas, confirma las indicaciones y autoriza los gastos desde tu centro familiar.', aside: 'Creado desde una experiencia familiar real, para hacer más llevadero todo lo que rodea al cuidado.' },
];

export default function CinematicLanding() {
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
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
        <Link href="/" className="care-brand" aria-label="CarePilot inicio"><Image src="/images/logos/otters.png" alt="" width={44} height={44} />carepilot<span>®</span></Link>
        <nav aria-label="Capítulos">{chapters.map((c, i) => <button key={c.label} onClick={() => goTo(i)} className={active === i ? 'selected' : ''} aria-current={active === i ? 'step' : undefined}>{c.label}</button>)}</nav>
        <Link href="/admin" className="care-header-action">Centro familiar <ArrowUpRight size={15} /></Link>
      </header>
      <div className="care-topline"><span>UN POCO DE AYUDA. MUCHO CARIÑO.</span><span>REAP × CAREPILOT · CUIDADO + FINANZAS <Heart size={11} /></span></div>
      <div className="care-model"><OtterScene progress={progress} /></div>
      <div className="care-model-caption" aria-hidden="true"><span className="caption-mark">↗</span><span>Siempre en tu equipo.<br /><strong>Tu compañero de cuidado.</strong></span></div>
      <main className="care-slides">{chapters.map((c, i) => <section key={c.label} className={`care-slide slide-composition-${i} ${active === i ? 'is-active' : ''}`} aria-hidden={active !== i} inert={active !== i} aria-label={c.label}>
        <div className="care-eyebrow"><span />{c.eyebrow}</div>
        <h1 aria-label={c.lines.join(' ')}>{c.lines.map((line, j) => <span className="title-line" key={line}>{Array.from(line).map((char, k) => <span aria-hidden="true" key={k} style={{ transitionDelay: `${(j * 12 + k) * .018}s` }} className="title-char">{char === ' ' ? '\u00a0' : char}</span>)}</span>)}</h1>
        <p className="care-script"><span>{c.accent}</span></p>
        <div className="care-description"><p>{c.description}</p><p>{c.aside}</p></div>
        <div className="landing-branches">{i === 2 ? <><span><Pill size={13} /> Medicamentos</span><span><Heart size={13} /> Terapias</span><span>Nutrición</span></> : <><span><Users size={13} /> Coordinar</span><span><ClipboardList size={13} /> Organizar</span><span><Wallet size={13} /> Financiar</span></>}</div>
        {i === 2 && <div className="landing-reap"><strong>reap <span>×</span> carepilot</strong><small>Pagos sujetos a integración y comercios compatibles.</small></div>}
        <Link href="/admin" className="care-primary">{i === 3 ? 'Crear mi primer acuerdo' : 'Explorar el centro familiar'}<span><ArrowUpRight size={19} /></span></Link>
        <div className="care-reassurance"><ShieldCheck size={13} /> Tú decides. CarePilot te acompaña.</div>
      </section>)}</main>
      <aside className="care-story" aria-label="Progreso de capítulos">{chapters.map((c, i) => <button key={c.label} onClick={() => goTo(i)} aria-label={`Ir a ${c.label}`} aria-current={active === i ? 'step' : undefined}><span ref={element => { fills.current[i] = element; }} style={{ transform: 'scaleY(0)' }} /></button>)}</aside>
      <footer className="care-footer"><button onClick={() => goTo(Math.min(3, active + 1))}><span className="scroll-circle"><ArrowDown size={15} /></span>{active === 3 ? 'ESTAMOS CONTIGO' : 'DESLIZA PARA DESCUBRIR'}</button><Link href="/login" className="care-footer-center care-login">¿YA TIENES CUENTA? INICIA SESIÓN ↗</Link><span className="care-counter">0{active + 1}<i />04</span></footer>
    </div>
    <div className="care-scroll-markers" aria-hidden="true">{chapters.map(c => <div key={c.label} />)}</div>
  </div>;
}
