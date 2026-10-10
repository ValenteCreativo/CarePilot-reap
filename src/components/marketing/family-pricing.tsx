"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  Check,
  Heart,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

const copy = {
  en: {
    eyebrow: "A LITTLE LESS TO CARRY",
    title: "One family.\nOne thoughtful plan.",
    description:
      "A subscription for the work around care: knowing what comes next, sharing the responsibility and planning the cost. More room for the moments that matter.",
    pillars: [
      "Coordinate the people who care",
      "Keep appointments and tasks together",
      "Plan expenses with clear approval",
    ],
    label: "CarePilot Family",
    subtitle: "One subscription for your care circle.",
    monthly: "Monthly",
    annual: "Yearly",
    save: "Save 20%",
    month: "/ month",
    monthlyBilling: "US$30 billed monthly.",
    annualBilling: "US$288 billed yearly. US$72 less per year.",
    features: [
      "Care board and calendar",
      "Quak, your planning companion",
      "Care budgets and restock reminders",
      "Supported purchases with Reap approval",
    ],
    cta: "Explore the family demo",
    note: "Medication, therapy and other care purchases are paid separately.",
    demo: "Proposed launch pricing. This demo does not charge a subscription.",
    footer: "Made for the people who care.",
    back: "Back to the story",
  },
  es: {
    eyebrow: "UN POCO MENOS QUE CARGAR",
    title: "Una familia.\nUn plan con cariño.",
    description:
      "Una suscripción para todo lo que rodea al cuidado: saber qué sigue, compartir responsabilidades y planear los gastos. Más espacio para los momentos que importan.",
    pillars: [
      "Coordina a quienes cuidan",
      "Reúne citas y pendientes",
      "Planea los gastos con aprobación clara",
    ],
    label: "CarePilot Familia",
    subtitle: "Una suscripción para tu círculo de cuidado.",
    monthly: "Mensual",
    annual: "Anual",
    save: "Ahorra 20%",
    month: "/ mes",
    monthlyBilling: "US$30 con pago mensual.",
    annualBilling: "US$288 con pago anual. Ahorra US$72 al año.",
    features: [
      "Tablero de cuidado y calendario",
      "Quak, tu compañero para planear",
      "Presupuestos y recordatorios de reposición",
      "Compras compatibles con aprobación en Reap",
    ],
    cta: "Explorar el demo familiar",
    note: "Medicamentos, terapias y otras compras de cuidado se pagan por separado.",
    demo: "Precio de lanzamiento propuesto. Este demo no cobra una suscripción.",
    footer: "Para las personas que cuidan.",
    back: "Volver a la historia",
  },
};

export default function FamilyPricing({ lang }: { lang: "en" | "es" }) {
  const [annual, setAnnual] = useState(false);
  const t = copy[lang];
  return (
    <section
      className="family-pricing"
      id="plans"
      aria-labelledby="pricing-title"
      lang={lang}
    >
      <div className="pricing-layout">
        <div className="pricing-story">
          <span className="pricing-eyebrow">
            <Heart size={13} />
            {t.eyebrow}
          </span>
          <h2 id="pricing-title">
            {t.title.split("\n").map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h2>
          <p>{t.description}</p>
          <ul className="pricing-pillars">
            {t.pillars.map((pillar, i) => {
              const Icon = [Users, Heart, Wallet][i];
              return (
                <li key={pillar}>
                  <span>
                    <Icon size={19} />
                  </span>
                  {pillar}
                </li>
              );
            })}
          </ul>
          <div className="pricing-companion">
            <Image
              src="/images/logos/otters.png"
              alt=""
              width={48}
              height={48}
            />
            <span>{t.footer}</span>
          </div>
        </div>
        <div className="family-plan">
          <div className="family-plan-heading">
            <span className="plan-symbol">
              <Heart size={22} />
            </span>
            <div>
              <h3>{t.label}</h3>
              <p>{t.subtitle}</p>
            </div>
          </div>
          <div
            className="billing-switch"
            role="group"
            aria-label={
              lang === "en"
                ? "Subscription billing period"
                : "Periodo de suscripción"
            }
          >
            <button
              type="button"
              aria-pressed={!annual}
              onClick={() => setAnnual(false)}
              className={!annual ? "selected" : ""}
            >
              {t.monthly}
            </button>
            <button
              type="button"
              aria-pressed={annual}
              onClick={() => setAnnual(true)}
              className={annual ? "selected" : ""}
            >
              {t.annual}
              <span>{t.save}</span>
            </button>
          </div>
          <div className="family-plan-price" aria-live="polite">
            <span className="price-currency">US$</span>
            <strong>{annual ? "24" : "30"}</strong>
            <span>{t.month}</span>
          </div>
          <p className="billing-detail">
            {annual ? t.annualBilling : t.monthlyBilling}
          </p>
          <div className="plan-divider" />
          <ul className="family-plan-features">
            {t.features.map((feature) => (
              <li key={feature}>
                <Check size={16} />
                {feature}
              </li>
            ))}
          </ul>
          <Link className="family-plan-cta" href="/admin">
            {t.cta}
            <ArrowUpRight size={18} />
          </Link>
          <p className="plan-purchase-note">{t.note}</p>
          <div className="subscription-demo">
            <ShieldCheck size={15} />
            <span>{t.demo}</span>
          </div>
        </div>
      </div>
      <footer className="pricing-footer">
        <Link href="/" className="pricing-brand">
          carepilot
        </Link>
        <span>{t.footer}</span>
        <a href="#care-story">{t.back} ↑</a>
      </footer>
    </section>
  );
}
