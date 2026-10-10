'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Draft, Identity, Run, Shipping } from '@/lib/care-agent/types';
type PublicRun = Omit<Run, 'operations'> & { termsHash: string | null; verifiedCompleted: boolean; amountDiscrepancy: boolean; operations: Record<string, { state: string; code?: string }> };
const instruction = 'My mom needs care supplies for this week. Research options, assign the purchase to Guille and prepare a $700 MXN budget that I can approve';
const money = (amount: number, currency: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount) + ' ' + currency;
const date = (value: string) => new Date(value).toLocaleString('en-US', { timeZone: 'America/Mexico_City' });
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
    if (!response.ok) throw new Error(`${result.message || 'The operation was not confirmed.'} [${result.error || response.status}]`);
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
    } catch (e) { setError(e instanceof Error ? e.message : 'The operation was not confirmed.'); return null; }
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
        } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : 'We are still verifying.'); return; }
      }
      timer = setTimeout(poll, Math.min(2000 * count, 10000));
    };
    timer = setTimeout(poll, 2000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [runId, checkoutId, checkoutStatus, request]);
  const proposal = draft?.draft ?? run?.agreement;
  const selected = run?.agreement.candidates.find(c => c.variantId === variant);
  return <main className="agent-shell">
    <header><Link href="/admin">← Family hub</Link><h1>One need, one agreement and one authorized purchase</h1><p>CarePilot · Demo sandbox. Every approval corresponds to the authenticated funder.</p></header>
    {error && <p className="agent-error" role="alert">{error}</p>}
    {!identity ? <section><h2>Identify the funder</h2><p>Use your CarePilot account. The demo person selector does not authorize payments.</p><form onSubmit={async e => {
      e.preventDefault(); const form = new FormData(e.currentTarget); setBusy(true); setError('');
      try { const result = await request('/api/care/agent/session', { email: form.get('email'), password: form.get('password') }); setIdentity(result.identity); }
      catch (err) { setError(err instanceof Error ? err.message : 'Identity could not be validated.'); } finally { setBusy(false); }
    }}><label>Email<input name="email" type="email" autoComplete="username" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label><button disabled={busy}>Verify identity</button></form></section> : <>
      <p>Funder: <strong>{identity.name}</strong> · {identity.email} <button className="agent-secondary" onClick={async () => { await fetch('/api/care/agent/session', { method: 'DELETE' }); setIdentity(null); setRun(null); setDraft(null); window.history.replaceState(null, '', '/care-agent'); }}>Log out</button></p>
      {!run && <section><h2>1. Describe the need</h2><form onSubmit={e => { e.preventDefault(); command({ action: 'prepare', text }); }}><label>Instruction<textarea value={text} onChange={e => setText(e.target.value)} maxLength={4000} rows={4} required /></label><button disabled={busy}>{busy ? 'Researching…' : 'Interpret with Brian and research'}</button></form><details><summary>Human preparation while Brian is being configured</summary><p>This mode does not use an LLM. It records what you confirm and queries the real Tavily/Reap; it does not generate fictional results.</p><label>Proposed supply<select value={manualCategory} onChange={e => { setManualCategory(e.target.value as typeof manualCategory); setManual(false); }}><option value="soap">Hand soap</option><option value="wipes">Personal hygiene wipes</option><option value="gloves">Disposable hygiene gloves</option></select></label><label><input type="checkbox" checked={manual} onChange={e => setManual(e.target.checked)} />I confirm the selected supply, purchase handled by Guille, funded by me, maximum $700 MXN. This is a proposal to review.</label><button className="agent-secondary" disabled={busy || !manual} onClick={() => command({ action: 'prepare-human', confirmed: true, intent: { needs: [manualCategory], responsible: 'Guille', payer: 'self', budget: { amount: 700, currency: 'MXN' }, tasks: ['Review hygiene supplies for this week', 'Guille coordinates the purchase after my authorization'], clarification: null } })}>Research the proposal I confirmed</button></details></section>}
      {proposal && <section><h2>2. Review the Care Agreement</h2><p>Origin: {proposal.origin === 'brian' ? 'Interpreted by Brian' : 'Explicit human proposal'}. Purchase: <strong>{proposal.intent.responsible}</strong>. Funder: <strong>{identity.name}</strong>.</p><p>Limit: <strong>{money(proposal.intent.budget.amount, proposal.intent.budget.currency)}</strong>; it is not a price or a quote.</p><ul>{proposal.intent.tasks.map((task, i) => <li key={i}>{task}</li>)}</ul>
        <h3>Supplier research</h3><p>The sources are untrusted data and indicative prices. A $ symbol without a currency code means the currency is not confirmed.</p>{proposal.sources.length ? proposal.sources.map(source => <article key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a><p>{source.excerpt}</p><small>Checked: {date(source.consultedAt)}</small><ul>{source.prices.map((price, i) => <li key={i}>Price text: {price.evidence} · Currency {price.currency || 'not confirmed'} · Not a Reap quote.</li>)}</ul></article>) : <p>No confirmed research results.</p>}
        {proposal.blockers.length > 0 && <p className="agent-note">Pending: {proposal.blockers.join(', ')}. No result has been replaced with fictional data.</p>}
        <h3>Compatible options retrieved from Reap</h3>{proposal.candidates.length ? proposal.candidates.map(candidate => <article key={candidate.variantId}><strong>{candidate.name}</strong><p>{candidate.merchant} · Catalog: {money(candidate.price.amount, candidate.price.currency)}. Shipping, total and final currency still to be quoted.</p></article>) : <p>No suitable match confirmed in Reap. We cannot quote or buy.</p>}
        {draft && <><label><input type="checkbox" checked={agreementConsent} onChange={e => setAgreementConsent(e.target.checked)} />I reviewed the needs, Guille as the person responsible and my budget. I confirm saving the agreement; I am not authorizing a payment yet.</label><button disabled={busy || !agreementConsent} onClick={() => command({ action: 'confirm', ...draft, confirmed: true })}>Confirm and save agreement</button></>}
      </section>}
      {run && <>
        <section><h2>3. Register and verify your card</h2><p>Enrollment: {run.enrollment?.status || 'Pending'}</p>{run.enrollment?.nextAction?.url && <a className="agent-button" href={run.enrollment.nextAction.url} target="_blank" rel="noopener noreferrer">Complete registration in Reap</a>}<button disabled={busy} onClick={() => command({ action: 'enroll', runId: run.id })}>Prepare card registration</button><button className="agent-secondary" disabled={busy || !run.enrollment} onClick={() => command({ action: 'sync-enrollment', runId: run.id })}>Check card status</button><p>Card and OTP are entered only in Reap. This step does not authorize purchases.</p></section>
        {!run.checkout && <section><h2>4. Request a real quote</h2><form onSubmit={e => {
          e.preventDefault(); const form = new FormData(e.currentTarget);
          const shipping: Record<string, string> = {};
          for (const key of ['firstName', 'lastName', 'phone', 'addressLine1', 'city', 'region', 'postalCode', 'country']) { const value = String(form.get(key) || '').trim(); if (value) shipping[key] = value; }
          setPurchaseConsent(false); command({ action: 'quote', runId: run.id, variantId: variant, ...(Object.keys(shipping).length ? { shipping: shipping as Shipping } : {}) });
        }}><label>Product<select value={variant} onChange={e => { setVariant(e.target.value); setPurchaseConsent(false); }} required><option value="">Select a verified variant</option>{run.agreement.candidates.map(c => <option key={c.variantId} value={c.variantId}>{c.name} · {c.merchant}</option>)}</select></label>{selected?.requiresShipping && <fieldset><legend>Shipping (to Reap only, never to Tavily)</legend>{[['firstName', 'First name'], ['lastName', 'Last name'], ['phone', 'Phone E.164'], ['addressLine1', 'Address'], ['city', 'City'], ['region', 'State'], ['postalCode', 'Postal code'], ['country', 'Country ISO: MX']].map(([key, label]) => <label key={key}>{label}<input name={key} required={!['region', 'postalCode'].includes(key)} defaultValue={key === 'country' ? 'MX' : ''} maxLength={200} /></label>)}</fieldset>}<button disabled={busy || !selected}>Get Reap quote</button></form></section>}
        {run.quote && <section><h2>5. Review and authorize the amount</h2><p><strong>{run.selected?.name}</strong> · {run.selected?.merchant}</p><p>Reap total: <strong>{money(run.quote.amountBreakdown.finalAmount.amount, run.quote.amountBreakdown.finalAmount.currency)}</strong></p><p>Quote {run.quote.id} · Expires: {date(run.quote.expiresAt)}</p><details><summary>Shipping, taxes, discounts and terms</summary><pre>{JSON.stringify({ breakdown: run.quote.amountBreakdown, shippingOptions: run.quote.shippingOptions }, null, 2)}</pre></details>{!run.checkout && <><label><input type="checkbox" checked={purchaseConsent} onChange={e => setPurchaseConsent(e.target.checked)} />As the funder, I authorize this product, merchant, shipping, currency and total; I understand I still have to approve it in Reap.</label><button disabled={busy || !purchaseConsent} onClick={() => command({ action: 'approve', runId: run.id, termsHash: run.termsHash, confirmed: true })}>Authorize these terms</button><button disabled={busy || !run.approval || !purchaseConsent} onClick={() => command({ action: 'checkout', runId: run.id, confirmed: true })}>Prepare hosted approval in Reap</button></>}</section>}
        {run.checkout && <section><h2>6. Status consulted from Reap</h2><p>Status: <strong>{run.checkout.status}</strong> · Checkout {run.checkout.id}</p>{run.checkout.nextAction?.url && <a className="agent-button" href={run.checkout.nextAction.url} target="_blank" rel="noopener noreferrer">Review and approve in Reap</a>}<button disabled={busy} onClick={() => command({ action: 'sync-checkout', runId: run.id })}>Check real result</button>{run.verifiedCompleted ? <p className="agent-note">Sandbox order confirmed: {run.checkout.orderId}. Final amount: {run.checkout.finalAmount && money(run.checkout.finalAmount.amount, run.checkout.finalAmount.currency)}. This does not confirm delivery or settlement of real money.</p> : <p>No complete evidence of a finished purchase. No wait or return is interpreted as success.</p>}{run.amountDiscrepancy && <p className="agent-error">The final amount differs from the authorized quote; it requires reconciliation.</p>}</section>}
        <section><h2>Agreement evidence</h2><p>ID {run.id}. The operational owner coordinates the purchase; payment consent belongs exclusively to your account.</p><ul>{run.audit.map((entry, i) => <li key={i}>{date(entry.at)} · {entry.event}</li>)}</ul>{Object.entries(run.operations).filter(([, op]) => op?.state === 'pending').map(([key, op]) => <p className="agent-note" key={key}>{key}: pending/uncertain result ({op.code || 'to be checked'}). We keep the operation to avoid duplicates.</p>)}</section>
      </>}
    </>}
  </main>;
}
