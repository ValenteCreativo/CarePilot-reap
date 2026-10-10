"use client";
import { useEffect, useState } from "react";
import { FileText, Plus, Wallet, ArrowRight } from "lucide-react";
import type { CircleState } from "@/lib/care-circle/schema";
type Receipt = {
  id: string;
  title: string;
  amount: number;
  currency: string;
  date: string;
  reference: string;
  source: string;
  simulation?: boolean;
  runId?: string;
};
const money = (v: number, c: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(v);
export default function ExpenseTracker({
  planned,
  receipts,
  onAdd,
}: {
  planned: number;
  receipts: CircleState["receipts"];
  onAdd: (r: CircleState["receipts"][number]) => void;
}) {
  const [orders, setOrders] = useState<Receipt[]>([]),
    [form, setForm] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const r = await fetch("/api/care/receipts", { cache: "no-store" });
        if (r.ok) {
          const d = await r.json();
          if (active) setOrders(d.receipts);
        }
      } catch {
        /* Manual receipts remain accessible. */
      }
    };
    void refresh();
    const timer = setInterval(refresh, 5000);
    window.addEventListener("carepilot-session", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("carepilot-session", refresh);
    };
  }, []);
  const spent = receipts
    .filter((r) => r.currency === "MXN")
    .reduce((a, r) => a + r.amount, 0);
  return (
    <section className="expense-tracker">
      <div className="section-heading">
        <div>
          <h2>Know where the care budget goes.</h2>
          <p>Planned costs, recorded expenses and verified sandbox orders.</p>
        </div>
        <button className="secondary-action" onClick={() => setForm(!form)}>
          <Plus size={15} />
          Record an expense
        </button>
      </div>
      <div className="expense-metrics">
        <div>
          <span>Planned · MXN</span>
          <strong>{money(planned, "MXN")}</strong>
        </div>
        <div>
          <span>Recorded · MXN</span>
          <strong>{money(spent, "MXN")}</strong>
        </div>
        <div>
          <span>{spent > planned ? "Above plan" : "Remaining · MXN"}</span>
          <strong>{money(Math.abs(planned - spent), "MXN")}</strong>
        </div>
      </div>
      {form && (
        <form
          className="simple-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const amount = Number(f.get("amount"));
            if (!Number.isFinite(amount) || amount < 0) {
              setError("Enter a valid amount.");
              return;
            }
            onAdd({
              id: crypto.randomUUID(),
              title: String(f.get("title")),
              amount,
              currency: String(f.get("currency")) as "MXN" | "SGD" | "USD",
              date: String(f.get("date")),
              reference: String(f.get("reference") || ""),
              source: "manual",
            });
            setForm(false);
            setError("");
          }}
        >
          <div className="form-grid">
            <label>
              What was paid for?
              <input
                name="title"
                required
                maxLength={180}
                placeholder="Therapy session"
              />
            </label>
            <label>
              Amount
              <input
                name="amount"
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                required
              />
            </label>
            <label>
              Currency
              <select name="currency">
                <option>MXN</option>
                <option>SGD</option>
                <option>USD</option>
              </select>
            </label>
            <label>
              Payment date
              <input
                name="date"
                type="date"
                required
                defaultValue={new Date().toLocaleDateString("en-CA")}
              />
            </label>
          </div>
          <label>
            Receipt number or reference
            <input
              name="reference"
              maxLength={250}
              placeholder="Receipt #1042"
            />
          </label>
          <p>
            A family-recorded expense; it does not execute or verify a payment.
          </p>
          <button className="primary-action">Save expense & reference</button>
          {error && <p role="alert">{error}</p>}
        </form>
      )}
      {receipts.filter((r) => r.currency !== "MXN").length > 0 && (
        <p className="checkout-note">
          Other currencies:{" "}
          {(["SGD", "USD"] as const)
            .map(
              (c) =>
                `${c}: ${money(
                  receipts
                    .filter((r) => r.currency === c)
                    .reduce((s, r) => s + r.amount, 0),
                  c,
                )}`,
            )
            .join(" · ")}
          . No currency conversion is applied.
        </p>
      )}
      <div className="receipt-list">
        {[...orders, ...receipts].map((r) => (
          <details key={r.id} className="receipt-row">
            <summary>
              <FileText size={17} />
              <span>
                <strong>{r.title}</strong>
                <small>
                  {r.source === "reap"
                    ? "Reap-verified sandbox order · excluded from real spending"
                    : "Family-recorded expense"}{" "}
                  · {String(r.date).slice(0, 10)}
                </small>
              </span>
              <b>{money(r.amount, r.currency)}</b>
            </summary>
            <div>
              <p>Reference: {r.reference || "No receipt reference added"}</p>
              {r.source === "reap" && (
                <p>
                  {r.simulation
                    ? "Merchant order simulated by Reap."
                    : "Sandbox order."}{" "}
                  No real charge or delivery.
                </p>
              )}
              <button
                className="text-action"
                onClick={() => {
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(r, null, 2)], {
                      type: "application/json",
                    }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `carepilot-receipt-${r.id}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download receipt record <ArrowRight size={14} />
              </button>
            </div>
          </details>
        ))}
      </div>
      {!orders.length && !receipts.length && (
        <p className="checkout-note">
          <Wallet size={16} /> Record your first care expense, or complete a
          Reap sandbox order to see its verified reference here.
        </p>
      )}
    </section>
  );
}
