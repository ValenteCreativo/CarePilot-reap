'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Draft, Identity, Run, Shipping } from '@/lib/care-agent/types';
type PublicRun = Omit<Run, 'operations'> & { termsHash: string | null; verifiedCompleted: boolean; amountDiscrepancy: boolean; operations: Record<string, { state: string; code?: string }> };
const instruction = 'Mi mamá necesita insumos de cuidado para esta semana. Investiga opciones, asígnale la compra a Guille y prepara un presupuesto de $700 MXN que yo pueda aprobar';
const money = (amount: number, currency: string) => new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(amount) + ' ' + currency;
const date = (value: string) => new Date(value).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
export default function CareAgent() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [text, setText] = useState(instruction);
  const [draft, setDraft] = useState<{ draft: Draft; signature: string } | null>(null);
  const [run, setRun] = useState<PublicRun | null>(null);
  const [variant, setVariant] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [agreementConsent, setAgreementConsent] = useState(false);
  const [purchaseConsent, setPurchaseConsent] = useState(false);
  const [manualCategory, setManualCategory] = useState<'soap' | 'wipes' | 'gloves'>('soap');
  const [manual, setManual] = useState(false);
  const request = useCallback(async (url: string, payload?: unknown) => {
    const response = await fetch(url, payload === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok) throw new Error(`${result.message || 'La operación no se confirmó.'} [${result.error || response.status}]`);
    return result;
  }, []);
  useEffect(() => {
    let active = true;
    request('/api/care/agent/session').then(async result => {
      if (!active) return; setIdentity(result.identity);
      const id = new URL(window.location.href).searchParams.get('run');
      if (id && /^[a-f0-9-]{36}$/i.test(id)) {
        const saved = await request('/api/care/agent', { action: 'read', runId: id });
        if (active) setRun(saved.run);
      }
    }).catch(() => { /* login panel supplies explicit diagnostics */ });
    return () => { active = false; };
  }, [request]);
  async function command(payload: unknown) {
    setBusy(true); setError('');
    try {
      const result = await request('/api/care/agent', payload);
      if (result.draft) { setDraft(result); setAgreementConsent(false); }
      if (result.run) {
        setRun(result.run); setDraft(null);
        window.history.replaceState(null, '', `/care-agent?run=${result.run.id}`);
      }
      return result;
    } catch (e) { setError(e instanceof Error ? e.message : 'No se confirmó la operación.'); return null; }
    finally { setBusy(false); }
  }
  const checkoutId = run?.checkout?.id;
  const checkoutStatus = run?.checkout?.status;
  const runId = run?.id;
  // Poll only an existing checkout. Bounded per page: 12 attempts, then manual verification.
  useEffect(() => {
    if (!runId || !checkoutId || !checkoutStatus || !['PROCESSING', 'REQUIRES_ACTION'].includes(checkoutStatus)) return;
    let stopped = false; let count = 0; let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (stopped || ++count > 12) return;
      if (document.visibilityState === 'visible') {
        try {
          const result = await request('/api/care/agent', { action: 'sync-checkout', runId });
          if (!stopped) setRun(result.run);
          if (!['PROCESSING', 'REQUIRES_ACTION'].includes(result.run.checkout?.status)) return;
        } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : 'Seguimos verificando.'); return; }
      }
      timer = setTimeout(poll, Math.min(2000 * count, 10000));
    };
    timer = setTimeout(poll, 2000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [runId, checkoutId, checkoutStatus, request]);
  const proposal = draft?.draft ?? run?.agreement;
  const selected = run?.agreement.candidates.find(c => c.variantId === variant);
  return <main className="agent-shell">
    <header><Link href="/admin">← Centro familiar</Link><h1>Una necesidad, un acuerdo y una compra autorizada</h1><p>CarePilot · Demo sandbox. Cada aprobación corresponde al financiador autenticado.</p></header>
    {error && <p className="agent-error" role="alert">{error}</p>}
    {!identity ? <section><h2>Identifica al financiador</h2><p>Usa tu cuenta de CarePilot. La selección de personas del demo no autoriza pagos.</p><form onSubmit={async e => {
      e.preventDefault(); const form = new FormData(e.currentTarget); setBusy(true); setError('');
      try { const result = await request('/api/care/agent/session', { email: form.get('email'), password: form.get('password') }); setIdentity(result.identity); }
      catch (err) { setError(err instanceof Error ? err.message : 'No se validó la identidad.'); } finally { setBusy(false); }
    }}><label>Email<input name="email" type="email" autoComplete="username" required /></label><label>Contraseña<input name="password" type="password" autoComplete="current-password" required /></label><button disabled={busy}>Verificar identidad</button></form></section> : <>
      <p>Financia: <strong>{identity.name}</strong> · {identity.email} <button className="agent-secondary" onClick={async () => { await fetch('/api/care/agent/session', { method: 'DELETE' }); setIdentity(null); setRun(null); setDraft(null); window.history.replaceState(null, '', '/care-agent'); }}>Cerrar sesión</button></p>
      {!run && <section><h2>1. Describe la necesidad</h2><form onSubmit={e => { e.preventDefault(); command({ action: 'prepare', text }); }}><label>Instrucción<textarea value={text} onChange={e => setText(e.target.value)} maxLength={4000} rows={4} required /></label><button disabled={busy}>{busy ? 'Investigando…' : 'Interpretar con Brian e investigar'}</button></form><details><summary>Preparación humana mientras se configura Brian</summary><p>Este modo no usa un LLM. Registra lo que confirmes y consulta Tavily/Reap reales; no genera resultados ficticios.</p><label>Insumo propuesto<select value={manualCategory} onChange={e => { setManualCategory(e.target.value as typeof manualCategory); setManual(false); }}><option value="soap">Jabón para manos</option><option value="wipes">Toallitas de higiene personal</option><option value="gloves">Guantes de higiene desechables</option></select></label><label><input type="checkbox" checked={manual} onChange={e => setManual(e.target.checked)} />Confirmo el insumo seleccionado, compra a cargo de Guille, financiada por mí, máximo $700 MXN. Es una propuesta para revisar.</label><button className="agent-secondary" disabled={busy || !manual} onClick={() => command({ action: 'prepare-human', confirmed: true, intent: { needs: [manualCategory], responsible: 'Guille', payer: 'self', budget: { amount: 700, currency: 'MXN' }, tasks: ['Revisar insumos de higiene para esta semana', 'Guille coordina la compra después de mi autorización'], clarification: null } })}>Investigar la propuesta que confirmé</button></details></section>}
      {proposal && <section><h2>2. Revisa el Care Agreement</h2><p>Origen: {proposal.origin === 'brian' ? 'Interpretación de Brian' : 'Propuesta humana explícita'}. Compra: <strong>{proposal.intent.responsible}</strong>. Financiador: <strong>{identity.name}</strong>.</p><p>Límite: <strong>{money(proposal.intent.budget.amount, proposal.intent.budget.currency)}</strong>; no es un precio ni una cotización.</p><ul>{proposal.intent.tasks.map((task, i) => <li key={i}>{task}</li>)}</ul>
        <h3>Investigación de proveedores</h3><p>Las fuentes son datos no confiables y precios indicativos. El símbolo $ sin código de moneda queda sin moneda confirmada.</p>{proposal.sources.length ? proposal.sources.map(source => <article key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a><p>{source.excerpt}</p><small>Consultado: {date(source.consultedAt)}</small><ul>{source.prices.map((price, i) => <li key={i}>Texto de precio: {price.evidence} · Moneda {price.currency || 'no confirmada'} · No es quote Reap.</li>)}</ul></article>) : <p>Sin resultados de investigación confirmados.</p>}
        {proposal.blockers.length > 0 && <p className="agent-note">Pendientes: {proposal.blockers.join(', ')}. Ningún resultado se ha sustituido por datos ficticios.</p>}
        <h3>Opciones compatibles obtenidas de Reap</h3>{proposal.candidates.length ? proposal.candidates.map(candidate => <article key={candidate.variantId}><strong>{candidate.name}</strong><p>{candidate.merchant} · Catálogo: {money(candidate.price.amount, candidate.price.currency)}. Falta cotizar envío, total y moneda final.</p></article>) : <p>No hay coincidencia apropiada confirmada en Reap. No se puede cotizar ni comprar.</p>}
        {draft && <><label><input type="checkbox" checked={agreementConsent} onChange={e => setAgreementConsent(e.target.checked)} />Revisé necesidades, Guille como responsable y mi presupuesto. Confirmo guardar el acuerdo; no autorizo un pago todavía.</label><button disabled={busy || !agreementConsent} onClick={() => command({ action: 'confirm', ...draft, confirmed: true })}>Confirmar y guardar acuerdo</button></>}
      </section>}
      {run && <>
        <section><h2>3. Registra y verifica tu tarjeta</h2><p>Enrollment: {run.enrollment?.status || 'Pendiente'}</p>{run.enrollment?.nextAction?.url && <a className="agent-button" href={run.enrollment.nextAction.url} target="_blank" rel="noopener noreferrer">Completar registro en Reap</a>}<button disabled={busy} onClick={() => command({ action: 'enroll', runId: run.id })}>Preparar registro de tarjeta</button><button className="agent-secondary" disabled={busy || !run.enrollment} onClick={() => command({ action: 'sync-enrollment', runId: run.id })}>Consultar estado de tarjeta</button><p>Tarjeta y OTP se ingresan únicamente en Reap. Este paso no autoriza compras.</p></section>
        {!run.checkout && <section><h2>4. Solicita una cotización real</h2><form onSubmit={e => {
          e.preventDefault(); const form = new FormData(e.currentTarget);
          const shipping: Record<string, string> = {};
          for (const key of ['firstName', 'lastName', 'phone', 'addressLine1', 'city', 'region', 'postalCode', 'country']) { const value = String(form.get(key) || '').trim(); if (value) shipping[key] = value; }
          setPurchaseConsent(false); command({ action: 'quote', runId: run.id, variantId: variant, ...(Object.keys(shipping).length ? { shipping: shipping as Shipping } : {}) });
        }}><label>Producto<select value={variant} onChange={e => { setVariant(e.target.value); setPurchaseConsent(false); }} required><option value="">Selecciona una variante verificada</option>{run.agreement.candidates.map(c => <option key={c.variantId} value={c.variantId}>{c.name} · {c.merchant}</option>)}</select></label>{selected?.requiresShipping && <fieldset><legend>Envío (solo a Reap, nunca a Tavily)</legend>{[['firstName', 'Nombre'], ['lastName', 'Apellido'], ['phone', 'Teléfono E.164'], ['addressLine1', 'Dirección'], ['city', 'Ciudad'], ['region', 'Estado'], ['postalCode', 'Código postal'], ['country', 'País ISO: MX']].map(([key, label]) => <label key={key}>{label}<input name={key} required={!['region', 'postalCode'].includes(key)} defaultValue={key === 'country' ? 'MX' : ''} maxLength={200} /></label>)}</fieldset>}<button disabled={busy || !selected}>Obtener quote de Reap</button></form></section>}
        {run.quote && <section><h2>5. Revisa y autoriza el monto</h2><p><strong>{run.selected?.name}</strong> · {run.selected?.merchant}</p><p>Total Reap: <strong>{money(run.quote.amountBreakdown.finalAmount.amount, run.quote.amountBreakdown.finalAmount.currency)}</strong></p><p>Quote {run.quote.id} · Vence: {date(run.quote.expiresAt)}</p><details><summary>Envío, impuestos, descuentos y condiciones</summary><pre>{JSON.stringify({ breakdown: run.quote.amountBreakdown, shippingOptions: run.quote.shippingOptions }, null, 2)}</pre></details>{!run.checkout && <><label><input type="checkbox" checked={purchaseConsent} onChange={e => setPurchaseConsent(e.target.checked)} />Como financiador, autorizo este producto, comercio, envío, moneda y total; entiendo que aún debo aprobar en Reap.</label><button disabled={busy || !purchaseConsent} onClick={() => command({ action: 'approve', runId: run.id, termsHash: run.termsHash, confirmed: true })}>Autorizar estos términos</button><button disabled={busy || !run.approval || !purchaseConsent} onClick={() => command({ action: 'checkout', runId: run.id, confirmed: true })}>Preparar aprobación alojada en Reap</button></>}</section>}
        {run.checkout && <section><h2>6. Estado consultado a Reap</h2><p>Estado: <strong>{run.checkout.status}</strong> · Checkout {run.checkout.id}</p>{run.checkout.nextAction?.url && <a className="agent-button" href={run.checkout.nextAction.url} target="_blank" rel="noopener noreferrer">Revisar y aprobar en Reap</a>}<button disabled={busy} onClick={() => command({ action: 'sync-checkout', runId: run.id })}>Consultar resultado real</button>{run.verifiedCompleted ? <p className="agent-note">Pedido sandbox confirmado: {run.checkout.orderId}. Monto final: {run.checkout.finalAmount && money(run.checkout.finalAmount.amount, run.checkout.finalAmount.currency)}. Esto no confirma entrega ni liquidación de dinero real.</p> : <p>Sin evidencia completa de compra terminada. Ninguna espera o retorno se interpreta como éxito.</p>}{run.amountDiscrepancy && <p className="agent-error">El monto final difiere del quote autorizado; requiere conciliación.</p>}</section>}
        <section><h2>Evidencia del acuerdo</h2><p>ID {run.id}. El responsable operativo coordina la compra; el consentimiento de pago corresponde exclusivamente a tu cuenta.</p><ul>{run.audit.map((entry, i) => <li key={i}>{date(entry.at)} · {entry.event}</li>)}</ul>{Object.entries(run.operations).filter(([, op]) => op?.state === 'pending').map(([key, op]) => <p className="agent-note" key={key}>{key}: resultado pendiente/incierto ({op.code || 'por consultar'}). Conservamos la operación para evitar duplicados.</p>)}</section>
      </>}
    </>}
  </main>;
}
