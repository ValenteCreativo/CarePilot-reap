"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  LoaderCircle,
  Package,
  Search,
  ShieldCheck,
} from "lucide-react";
import type { Candidate, Quote, ResearchSource } from "@/lib/care-agent/types";
type Research = {
  sources: ResearchSource[];
  candidates: Candidate[];
  errors: string[];
  proof: unknown;
  signature: string;
  checkoutReady: boolean;
};
const money = (n: number, c: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(n) +
  " " +
  c;
export default function CareResearch({
  query: initialQuery,
  onContinue,
}: {
  query: string;
  onContinue: (request: string) => void;
}) {
  const [query, setQuery] = useState(initialQuery || "Hand soap");
  const [research, setResearch] = useState<Research | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [variant, setVariant] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (initialQuery) {
        setQuery(initialQuery);
        setResearch(null);
        setQuote(null);
        setVariant("");
        try {
          const raw = sessionStorage.getItem("cuak-shopping-research");
          sessionStorage.removeItem("cuak-shopping-research");
          if (raw) {
            const saved = JSON.parse(raw);
            if (
              saved.query === initialQuery &&
              saved.proof?.expires > Date.now() &&
              typeof saved.signature === "string" &&
              Array.isArray(saved.sources) &&
              Array.isArray(saved.candidates)
            ) {
              setResearch(saved);
              setVariant(saved.candidates[0]?.variantId || "");
            }
          }
        } catch {
          /* Research can be repeated if the browser cache is unavailable. */
        }
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [initialQuery]);
  async function call(payload: unknown) {
    if (inFlight.current) return null;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/care/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await r.json();
      if (!r.ok)
        throw new Error(
          result.message || "Could not confirm this request. Please try again.",
        );
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
      return null;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const selected = research?.candidates.find((c) => c.variantId === variant);
  return (
    <div className="supply-explorer">
      <h3>Find the next thing care needs.</h3>
      <p>
        Explore real supplier sources and Reap products before signing in. No
        payment is created here.
      </p>
      <form
        className="research-search"
        onSubmit={async (e) => {
          e.preventDefault();
          setResearch(null);
          setQuote(null);
          const result = await call({ action: "research", query });
          if (result) {
            setResearch(result);
            setVariant(result.candidates[0]?.variantId || "");
          }
        }}
      >
        <label className="sr-only" htmlFor="supply-search">
          Product to research
        </label>
        <Search size={18} />
        <input
          id="supply-search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setResearch(null);
            setQuote(null);
            setVariant("");
          }}
          required
          minLength={2}
          maxLength={160}
          placeholder="e.g. hygiene wipes, gloves or soap"
        />
        <button
          className="primary-action"
          disabled={busy || query.trim().length < 2}
        >
          {busy ? (
            <LoaderCircle size={16} className="care-spin" />
          ) : (
            <Search size={15} />
          )}{" "}
          Find supplies
        </button>
      </form>
      <small>
        Use product names only; leave out personal or medical details.
      </small>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {research && (
        <>
          <div className="research-result-heading">
            <h4>Supported Reap products</h4>
            <span>{research.candidates.length} found</span>
          </div>
          <div className="product-grid">
            {research.candidates.map((c) => (
              <button
                className={`research-product ${variant === c.variantId ? "selected" : ""}`}
                key={c.variantId}
                disabled={busy}
                aria-pressed={variant === c.variantId}
                onClick={() => {
                  setVariant(c.variantId);
                  setQuote(null);
                }}
              >
                <Package size={22} />
                <strong>{c.name}</strong>
                <span>{c.merchant}</span>
                <b>{money(c.price.amount, c.price.currency)}</b>
                <small>Catalog price · choose to quote</small>
              </button>
            ))}
          </div>
          {!research.candidates.length && (
            <p className="checkout-note">
              No compatible product confirmed in Reap. Try wipes, hand soap or
              disposable gloves.
            </p>
          )}
          <details className="workflow-details">
            <summary>
              Supplier research ({research.sources.length} sources)
            </summary>
            {research.sources.map((s) => (
              <article className="source-card" key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.title}
                </a>
                <p>{s.excerpt}</p>
                <small>Reference information, not a Reap quote.</small>
              </article>
            ))}
            {!research.sources.length && <p>No supplier sources confirmed.</p>}
            {research.errors.length > 0 && (
              <p>Services to check: {research.errors.join(", ")}</p>
            )}
          </details>
          {selected && (
            <div className="research-quote">
              <h4>Get the final price</h4>
              <p>
                A real Reap quote includes the final currency and amount. This
                demo checks a $700 MXN limit.
              </p>
              <form
                className="simple-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  const shipping: Record<string, string> = {};
                  for (const key of [
                    "firstName",
                    "lastName",
                    "phone",
                    "addressLine1",
                    "city",
                    "region",
                    "postalCode",
                    "country",
                  ]) {
                    const value = String(data.get(key) || "").trim();
                    if (value) shipping[key] = value;
                  }
                  setQuote(null);
                  const result = await call({
                    action: "quote",
                    proof: research.proof,
                    signature: research.signature,
                    variantId: variant,
                    email: data.get("email"),
                    ...(selected.requiresShipping ? { shipping } : {}),
                  });
                  if (result) setQuote(result.quote);
                }}
              >
                <label>
                  Email for the quote
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                  />
                </label>
                {selected.requiresShipping && (
                  <details className="workflow-details" open>
                    <summary>Shipping details required</summary>
                    <div className="form-grid">
                      {[
                        ["firstName", "First name"],
                        ["lastName", "Last name"],
                        ["phone", "Phone (+ country code)"],
                        ["addressLine1", "Address"],
                        ["city", "City"],
                        ["region", "State"],
                        ["postalCode", "Postal code"],
                        ["country", "Country code"],
                      ].map(([key, label]) => (
                        <label key={key}>
                          {label}
                          <input
                            name={key}
                            required={!["region", "postalCode"].includes(key)}
                            defaultValue={key === "country" ? "MX" : ""}
                            maxLength={200}
                          />
                        </label>
                      ))}
                    </div>
                  </details>
                )}
                <button className="secondary-action" disabled={busy}>
                  {busy ? "Getting quote…" : "Get Reap quote"}{" "}
                  <ArrowRight size={15} />
                </button>
              </form>
              <small>
                Email and shipping details are shared only with Reap for the
                quote.
              </small>
            </div>
          )}
          {quote && (
            <div className="quote-total">
              <span>Confirmed quote from Reap</span>
              <h4>{selected?.name}</h4>
              <strong>
                {money(
                  quote.amountBreakdown.finalAmount.amount,
                  quote.amountBreakdown.finalAmount.currency,
                )}
              </strong>
              <small>
                Expires {new Date(quote.expiresAt).toLocaleString("en-US")}
              </small>
              <details className="workflow-details">
                <summary>Price breakdown & shipping</summary>
                <pre>
                  {JSON.stringify(
                    {
                      breakdown: quote.amountBreakdown,
                      shipping: quote.shippingOptions,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
              {quote.amountBreakdown.finalAmount.currency !== "MXN" ||
              quote.amountBreakdown.finalAmount.amount > 700 ? (
                <p className="checkout-note">
                  This quote is outside the demo’s $700 MXN limit or uses a
                  different currency. Purchase is blocked.
                </p>
              ) : (
                <>
                  <p className="quote-next">
                    To purchase, sign in and confirm the care agreement. The
                    authenticated flow gets a fresh quote for approval.
                  </p>
                  <button
                    className="primary-action"
                    disabled={busy || !research.checkoutReady}
                    onClick={() =>
                      onContinue(
                        `Please research ${selected?.name || query}, coordinated by Guille, with a maximum budget of 700 MXN. I am the funder.`,
                      )
                    }
                  >
                    Sign in to prepare checkout <ShieldCheck size={15} />
                  </button>
                </>
              )}
              {!research.checkoutReady && (
                <p className="checkout-note">
                  Checkout setup is incomplete. The account database and secure
                  return URL must be configured; research and quotes remain
                  available.
                </p>
              )}
            </div>
          )}
        </>
      )}
      {!quote && (
        <button
          className="text-action"
          onClick={() =>
            onContinue(
              initialQuery ||
                `Research ${query}, coordinated by Guille, maximum budget 700 MXN.`,
            )
          }
        >
          Already know what you need? Sign in to prepare checkout{" "}
          <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}
