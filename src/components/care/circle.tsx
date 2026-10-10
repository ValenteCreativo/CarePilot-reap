"use client";
import { useEffect, useRef, useState } from "react";
import { Users, Check, Copy, ArrowRight } from "lucide-react";
import type { CircleState } from "@/lib/care-circle/schema";
type Member = { slot: string; name: string };
type Circle = {
  id: string;
  revision: number;
  slot: string;
  isOwner: boolean;
  state: CircleState;
  members: Member[];
};
async function api(path: string, payload?: unknown) {
  const r = await fetch(
    path,
    payload
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      : { cache: "no-store" },
  );
  const d = await r.json();
  if (!r.ok) throw new Error(d.message || "Could not sync.");
  return d;
}
export default function CareCircle({
  state,
  onLoad,
  onMembers,
  loaded,
}: {
  state: CircleState;
  onLoad: (s: CircleState) => void;
  onMembers: (m: Member[], slot: string) => void;
  loaded: boolean;
}) {
  const [circle, setCircle] = useState<Circle | null>(null),
    [status, setStatus] = useState("Private plan on this device"),
    [error, setError] = useState(""),
    [onboard, setOnboard] = useState(false),
    [invite, setInvite] = useState(""),
    [link, setLink] = useState(""),
    [busy, setBusy] = useState(false);
  const latest = useRef(state),
    current = useRef<Circle | null>(null),
    ack = useRef(""),
    working = useRef(false),
    onLoadRef = useRef(onLoad),
    onMembersRef = useRef(onMembers);
  useEffect(() => {
    latest.current = state;
    onLoadRef.current = onLoad;
    onMembersRef.current = onMembers;
  }, [state, onLoad, onMembers]);
  const accept = (c: Circle) => {
    current.current = c;
    localStorage.setItem("carepilot-circle-id", c.id);
    ack.current = JSON.stringify(c.state);
    latest.current = c.state;
    setCircle(c);
    onLoadRef.current(c.state);
    onMembersRef.current(c.members, c.slot);
    setStatus("Shared plan · up to date");
  };
  useEffect(() => {
    if (!loaded) return;
    let stopped = false;
    const token = new URL(location.href).searchParams.get("invite");
    if (token) {
      setInvite(token);
      setOnboard(true);
    } else if (!localStorage.getItem("carepilot-onboarded")) setOnboard(true);
    const refresh = async () => {
      if (working.current) return;
      try {
        const selectedId = localStorage.getItem("carepilot-circle-id");
        let d = await api(
          selectedId ? `/api/care/circle?id=${selectedId}` : "/api/care/circle",
        );
        if (!d.circle && selectedId) d = await api("/api/care/circle");
        if (!stopped && d.circle && !token) {
          accept(d.circle);
          setOnboard(false);
        }
      } catch {
        /* A private plan works before signing in. */
      }
    };
    void refresh();
    window.addEventListener("carepilot-session", refresh);
    return () => {
      stopped = true;
      window.removeEventListener("carepilot-session", refresh);
    };
    // Initial shared snapshot is loaded once; subsequent snapshots use revision polling.
  }, [loaded]);
  useEffect(() => {
    if (!circle) return;
    let stopped = false;
    const sync = async () => {
      if (working.current || stopped || document.visibilityState !== "visible")
        return;
      working.current = true;
      try {
        const c = current.current;
        if (!c) return;
        const snapshot = latest.current;
        if (JSON.stringify(snapshot) !== ack.current) {
          setStatus("Saving shared plan…");
          const d = await api("/api/care/circle", {
            action: "save",
            circleId: c.id,
            revision: c.revision,
            state: snapshot,
          });
          c.revision = d.revision;
          ack.current = JSON.stringify(snapshot);
          setStatus("Shared plan · saved");
          setError("");
        } else {
          const d = await api(`/api/care/circle?id=${c.id}`);
          if (!d.circle) throw new Error("Care circle unavailable.");
          if (JSON.stringify(latest.current) === ack.current) {
            if (d.circle.revision !== c.revision) accept(d.circle);
            else if (
              JSON.stringify(c.members) !== JSON.stringify(d.circle.members)
            ) {
              c.members = d.circle.members;
              onMembersRef.current(d.circle.members, c.slot);
              setCircle({ ...c });
            }
          }
          setStatus("Shared plan · up to date");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sync unavailable.");
        setStatus("Edits kept on this device · not synced");
      } finally {
        working.current = false;
      }
    };
    const timer = setInterval(sync, 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
    // circle object is stable across local edits; refs protect in-flight snapshots.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circle?.id]);
  async function setup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    working.current = true;
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      try {
        await api("/api/care/agent/session");
      } catch {
        await api("/api/care/demo", {});
      }
      window.dispatchEvent(new Event("carepilot-session"));
      let id: string;
      if (invite) {
        const d = await api("/api/care/circle", {
          action: "join",
          token: invite,
          name: f.get("name"),
        });
        id = d.id;
      } else {
        const person = String(f.get("person") || "Mom");
        const title = String(f.get("need") || "Check in together");
        const task = {
          id: crypto.randomUUID(),
          title,
          kind: /schedule|appointment|therapy|visit/i.test(title)
            ? "study"
            : /restock|soap|supplies/i.test(title)
              ? "supplies"
              : "task",
          owner: "vale",
          payer: "vale",
          budget: null,
          date: new Date().toLocaleDateString("en-CA"),
          due: "Today",
          clinical: /schedule|appointment|therapy|visit/i.test(title),
          approval: "pending",
          completed: false,
          evidence: "Added during first-time setup.",
          inference: "",
        };
        const d = await api("/api/care/circle", {
          action: "create",
          name: f.get("name"),
          state: {
            person,
            tasks: [...latest.current.tasks, task],
            receipts: latest.current.receipts,
          },
        });
        id = d.id;
      }
      const d = await api(`/api/care/circle?id=${id}`);
      accept(d.circle);
      localStorage.setItem("carepilot-onboarded", "true");
      setOnboard(false);
      setInvite("");
      history.replaceState(null, "", "/admin?view=overview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start your circle.");
    } finally {
      setBusy(false);
      working.current = false;
    }
  }
  async function inviteCaregiver() {
    setBusy(true);
    setError("");
    try {
      const d = await api("/api/care/circle", {
        action: "invite",
        circleId: circle!.id,
      });
      setLink(location.origin + d.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invite unavailable.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="circle-panel">
      <div className="circle-bar">
        <Users size={18} />
        <div>
          <strong>
            {circle
              ? `${circle.members.length} caregiver${circle.members.length === 1 ? "" : "s"}, one shared plan`
              : "Care is easier together"}
          </strong>
          <span role="status">{status}</span>
        </div>
        {circle?.isOwner ? (
          <button
            className="secondary-action"
            disabled={busy}
            onClick={inviteCaregiver}
          >
            Invite a caregiver
          </button>
        ) : (
          !circle && (
            <button
              className="secondary-action"
              onClick={() => setOnboard(!onboard)}
            >
              Set up your circle <ArrowRight size={15} />
            </button>
          )
        )}
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
          {circle && (
            <button
              className="text-action"
              onClick={async () => {
                try {
                  const d = await api(`/api/care/circle?id=${circle.id}`);
                  accept(d.circle);
                  setError("");
                } catch {
                  setError(
                    "The shared version is unavailable. Your edits remain on this device.",
                  );
                }
              }}
            >
              Load shared version (replaces local edits)
            </button>
          )}
        </p>
      )}
      {link && (
        <div className="invite-link">
          <label>
            Private invite · one caregiver · expires in 7 days
            <input readOnly value={link} />
          </label>
          <button
            className="secondary-action"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setStatus(
                  "Invite copied · share privately with your caregiver",
                );
              } catch {
                setStatus("Select and copy the invite link.");
              }
            }}
          >
            <Copy size={15} /> Copy invite
          </button>
        </div>
      )}
      {onboard && (
        <form className="simple-form circle-setup" onSubmit={setup}>
          <div>
            <span className="eyebrow">ONE MINUTE TO FEEL MORE ORGANIZED</span>
            <h2>
              {invite ? "Join your care circle" : "Who are we caring for?"}
            </h2>
            <p>
              Hackathon sandbox: use example names and needs. Your circle is
              private to this session and invited caregivers.
            </p>
          </div>
          <div className="form-grid">
            <label>
              Your name
              <input name="name" required maxLength={60} placeholder="Alex" />
            </label>
            {!invite && (
              <>
                <label>
                  Person you care for
                  <input
                    name="person"
                    required
                    maxLength={60}
                    defaultValue={state.person}
                  />
                </label>
                <label>
                  First thing to take care of
                  <input
                    name="need"
                    required
                    maxLength={180}
                    placeholder="Schedule a therapy appointment"
                  />
                </label>
              </>
            )}
          </div>
          <div className="task-actions">
            <button className="primary-action" disabled={busy}>
              <Check size={16} />
              {busy
                ? "Preparing your circle…"
                : invite
                  ? "Join shared plan"
                  : "Start our care plan"}
            </button>
            {!invite && (
              <button
                type="button"
                className="text-action"
                onClick={() => {
                  localStorage.setItem("carepilot-onboarded", "true");
                  setOnboard(false);
                }}
              >
                Keep exploring privately
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
