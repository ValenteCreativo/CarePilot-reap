'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, CalendarDays, LoaderCircle, MessageCircle, Send, Sparkles, Users, X } from 'lucide-react';
import type { Agreement, CareMember } from '@/lib/care/types';
import type { CareChatAction, CareChatResponse } from '@/lib/care/chat';

type Message = { id: string; role: 'user' | 'assistant'; content: string; actions?: CareChatAction[]; applied?: boolean; dismissed?: boolean; shopping?: CareChatResponse['shopping']; research?: CareChatResponse['research']; shoppingError?: string };
type Props = { person: string; actor: string; today: string; team: CareMember[]; tasks: Agreement[]; onApply: (actions: CareChatAction[]) => boolean };
const suggestions = ['Let us plan a medical appointment', 'Help me split up responsibilities', 'Find prices for adult diapers'];
export default function CareChat({ person, actor, today, team, tasks, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ id: 'welcome', role: 'assistant', content: 'Hi, I am Cuak 👋 Your care assistant. Tell me what you need and I will prepare the next steps with you. We can plan appointments, split up tasks, organize expenses and research products and prices.' }]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const panel = useRef<HTMLDialogElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);
  useEffect(() => { if (open) panel.current?.showModal(); else panel.current?.close(); }, [open]);
  useEffect(() => { if (open) end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy, open]);
  async function send(message = text) {
    if (!message.trim() || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setText('');
    const next: Message[] = [...messages, { id: crypto.randomUUID(), role: 'user', content: message.trim() }];
    setMessages(next);
    try {
      const response = await fetch('/api/care/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.slice(-16).map(m => ({ role: m.role, content: m.content })), context: { person, actorId: actor, today, team: team.map(m => ({ id: m.id, name: m.name })), tasks: tasks.slice(-100).map(t => ({ id: t.id, title: t.title, owner: t.owner, payer: t.payer, date: t.date, completed: t.completed })) } }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'We could not connect with Cuak.');
      const reply = result as CareChatResponse;
      setMessages(current => [...current.map(m => m.actions?.length && !m.applied ? { ...m, dismissed: true } : m), { id: crypto.randomUUID(), role: 'assistant', content: reply.reply, actions: reply.actions, shopping: reply.shopping, research: reply.research, shoppingError: reply.shoppingError }]);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Please try again.'); setText(message); }
    finally { inFlight.current = false; setBusy(false); input.current?.focus(); }
  }
  function close() { setOpen(false); launcher.current?.focus(); }
  const name = (id: string) => team.find(m => m.id === id)?.name || 'To assign';
  return <>
    <section className="cuak-banner"><span className="cuak-avatar"><Sparkles size={25} /></span><div><span className="cuak-eyebrow">YOUR CARE ASSISTANT</span><h2>Tell Cuak about it.</h2><p>Appointments, responsibilities or whatever is needed. We organize it by chatting.</p></div><button className="primary-action" onClick={() => setOpen(true)}><MessageCircle size={18} /> Talk to Cuak</button></section>
    <button ref={launcher} className="cuak-launcher" onClick={() => setOpen(true)} aria-haspopup="dialog"><Sparkles size={21} /><span>Cuak · your assistant</span></button>
    <dialog ref={panel} className="cuak-panel" aria-labelledby="cuak-title" onCancel={e => { e.preventDefault(); close(); }} onClose={() => setOpen(false)}>
      <header className="cuak-header"><span className="cuak-avatar"><Sparkles size={24} /></span><div><h2 id="cuak-title">Cuak</h2><p><span className="cuak-dot" /> Your care assistant</p></div><button aria-label="Close chat" onClick={close}><X size={21} /></button></header>
      <div className="cuak-conversation" role="log" aria-label="Conversation with Cuak" aria-live="polite">
        <div className="cuak-context">Caring for {person} · {team.length} people on the team</div>
        {messages.map(m => <article key={m.id} className={`cuak-message cuak-${m.role}`}><small>{m.role === 'assistant' ? 'Cuak' : 'You'}</small><p>{m.content}</p>
          {m.shopping && <div className="cuak-shopping">
            {m.shoppingError && <p role="status">{m.shoppingError}</p>}
            {m.research && <><strong>Real research · {m.research.query}</strong>{m.research.sources.map(source => <div key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a><p>{source.excerpt.slice(0,280)}</p><small>{new Date(source.consultedAt).toLocaleString('en-US')}</small>{source.prices.map((price,i)=><p key={i}>{price.evidence} · {price.currency || 'currency not confirmed'} · reference</p>)}</div>)}<strong>Reap catalog</strong>{m.research.candidates.map(candidate=><p key={candidate.variantId}>{candidate.name} · {candidate.merchant} · {candidate.price.amount} {candidate.price.currency} (catalog, quote pending)</p>)}{!m.research.candidates.length&&<p>No compatible product confirmed with Reap.</p>}{m.research.errors.length>0&&<p>Pending services: {m.research.errors.join(', ')}</p>}</>}
            <a className="primary-action" href={`/care-shop?q=${encodeURIComponent(m.shopping.query)}`} onClick={()=>{if(m.research)try{sessionStorage.setItem('cuak-shopping-research',JSON.stringify(m.research));}catch{/* Navigation still works without browser storage. */}}}>Open products and quote on Reap ↗</a>
            <small>The purchase requires your authorization and verified identity.</small>
          </div>}
          {!!m.actions?.length && <div className="cuak-actions"><span className="cuak-eyebrow">{m.applied ? 'CHANGES APPLIED' : 'PROPOSAL FOR YOUR PLAN'}</span>{m.actions.map((action, i) => <div className="cuak-action" key={i}>{action.type === 'rename_person' ? <Sparkles size={17} /> : action.kind === 'study' ? <CalendarDays size={17} /> : <Users size={17} />}<div><strong>{action.type === 'rename_person' ? `Caring for ${action.title}` : action.title}</strong>{action.type !== 'rename_person' && <span>{name(action.owner)} · {action.date || action.due || 'Date to be confirmed'}{action.budget !== null && ` · Up to $${action.budget} MXN · covered by ${name(action.payer)}`}</span>}<small>{action.reason}</small>{action.clinical && <small>Confirm the instruction and availability with the healthcare professional.</small>}</div></div>)}
            {m.applied ? <p className="cuak-applied"><Check size={16} /> Done, it now appears in your space.</p> : m.dismissed ? <small>Proposal replaced by your next message.</small> : <><button className="primary-action" disabled={busy} onClick={() => { if (onApply(m.actions!)) { setError(''); setMessages(current => current.map(item => item.id === m.id ? { ...item, applied: true } : item)); } else setError('The team or the plan changed. Ask Cuak to update the proposal.'); }}>Apply to plan <Check size={16} /></button><button className="text-action" disabled={busy} onClick={() => setMessages(current => current.map(item => item.id === m.id ? { ...item, dismissed: true } : item))}>Dismiss</button></>}
          </div>}
        </article>)}
        {busy && <div className="cuak-thinking" role="status"><LoaderCircle size={17} className="care-spin" /> Cuak is organizing the next steps…</div>}
        <div ref={end} />
      </div>
      {messages.length === 1 && <div className="cuak-suggestions">{suggestions.map(s => <button key={s} disabled={busy} onClick={() => send(s)}>{s}<span>↗</span></button>)}</div>}
      <form className="cuak-composer" onSubmit={e => { e.preventDefault(); send(); }}>{error && <p role="alert" className="form-error">{error}</p>}<div><textarea ref={input} aria-label="Message for Cuak" placeholder="Cuak, help me organize…" rows={2} maxLength={4000} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} /><button type="submit" aria-label="Send message" disabled={busy || !text.trim()}>{busy ? <LoaderCircle className="care-spin" size={20} /> : <Send size={20} />}</button></div><small>You decide the changes. Appointments are coordinated with the clinic. Demo in this session.</small></form>
    </dialog>
  </>;
}
