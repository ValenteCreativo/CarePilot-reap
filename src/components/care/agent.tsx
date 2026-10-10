"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  Package,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import CareResearch from "./research";
import type { Draft, Identity, Run, Shipping } from "@/lib/care-agent/types";
type PublicRun = Omit<Run, "operations"> & {
  termsHash: string | null;
  verifiedCompleted: boolean;
  amountDiscrepancy: boolean;
  sandboxSimulation?: boolean;
  operations: Record<string, { state: string; code?: string }>;
};
const defaultInstruction =
  "My mom needs care supplies for this week. Research options, assign the purchase to Guille and prepare a $700 MXN budget that I can approve";
const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount,
  ) +
  " " +
  currency;
const date = (value: string) =>
  new Date(value).toLocaleString("en-US", { timeZone: "America/Mexico_City" });
export default function CareAgent({
  instruction = "",
  productQuery = "",
}: {
  instruction?: string;
  productQuery?: string;
}) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [text, setText] = useState(instruction || defaultInstruction);
  const [draft, setDraft] = useState<{
    draft: Draft;
    signature: string;
  } | null>(null);
  const [run, setRun] = useState<PublicRun | null>(null);
  const [variant, setVariant] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [agreementConsent, setAgreementConsent] = useState(false);
  const [purchaseConsent, setPurchaseConsent] = useState(false);
  const [manualCategory, setManualCategory] = useState<
    "soap" | "wipes" | "gloves"
  >("soap");
  const [manual, setManual] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [budget, setBudget] = useState(50);
  const [currency, setCurrency] = useState<"MXN" | "SGD" | "USD">("SGD");
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [responsible, setResponsible] = useState("Guille");
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (instruction && !run && !draft) setText(instruction);
    });
    return () => cancelAnimationFrame(frame);
  }, [instruction, run, draft]);
  const request = useCallback(async (url: string, payload?: unknown) => {
    const response = await fetch(
      url,
      payload === undefined
        ? { cache: "no-store" }
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
    );
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        `${result.message || "The operation was not confirmed."} [${result.error || response.status}]`,
      );
    return result;
  }, []);
  useEffect(() => {
    let active = true;
    const pendingId = new URL(window.location.href).searchParams.get("run");
    const frame = requestAnimationFrame(() => {
      if (active && pendingId) setShowSignIn(true);
    });
    request("/api/care/agent/session")
      .then(async (result) => {
        if (!active) return;
        setIdentity(result.identity);
        setDemoMode(String(result.identity.email).startsWith("judge-"));
        const id = new URL(window.location.href).searchParams.get("run");
        if (id && /^[a-f0-9-]{36}$/i.test(id)) {
          try {
            const saved = await request("/api/care/agent", {
              action: "read",
              runId: id,
            });
            if (active) {
              setRun(saved.run);
              setVariant(
                saved.run.selected?.variantId ||
                  saved.run.agreement.candidates[0]?.variantId ||
                  "",
              );
            }
          } catch (e) {
            if (active)
              setError(
                e instanceof Error
                  ? e.message
                  : "Could not restore the purchase.",
              );
          }
        }
      })
      .catch(() => {
        /* Signing in supplies explicit diagnostics. */
      })
      .finally(() => {
        if (active) setSessionLoaded(true);
      });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [request]);
  async function command(payload: unknown) {
    setBusy(true);
    setError("");
    try {
      const result = await request("/api/care/agent", payload);
      if (result.draft) {
        setDraft(result);
        setAgreementConsent(false);
      }
      if (result.run) {
        setRun(result.run);
        if (result.run.agreement?.candidates?.[0] && !variant)
          setVariant(result.run.agreement.candidates[0].variantId);
        if (result.run.checkout && !result.run.checkoutVerifiedAt) {
          const verified = await request("/api/care/agent", {
            action: "sync-checkout",
            runId: result.run.id,
          });
          setRun(verified.run);
        }
        setDraft(null);
        window.history.replaceState(
          null,
          "",
          `/admin?view=payments&run=${result.run.id}`,
        );
      }
      return result;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The operation was not confirmed.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    fetch("/api/care/demo")
      .then((r) => r.json())
      .then((d) => setDemoEnabled(d.enabled))
      .catch(() => {});
    const refresh = () =>
      request("/api/care/agent/session")
        .then((r) => setIdentity(r.identity))
        .catch(() => {});
    window.addEventListener("carepilot-session", refresh);
    return () => window.removeEventListener("carepilot-session", refresh);
  }, [request]);
  async function startDemo() {
    setBusy(true);
    setError("");
    try {
      const result = await request("/api/care/demo", {});
      setIdentity(result.identity);
      setDemoMode(true);
      setCurrency("SGD");
      setBudget(50);
      setText(
        "I fund and authorize a maximum budget of 50 SGD for hand soap. Guille coordinates the purchase.",
      );
      window.dispatchEvent(new Event("carepilot-session"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Demo unavailable.");
    } finally {
      setBusy(false);
    }
  }
  const checkoutId = run?.checkout?.id;
  const checkoutStatus = run?.checkout?.status;
  const runId = run?.id;
  // Poll only an existing checkout. Bounded per page: 12 attempts, then manual verification.
  useEffect(() => {
    if (
      !runId ||
      !checkoutId ||
      !checkoutStatus ||
      !["PROCESSING", "REQUIRES_ACTION"].includes(checkoutStatus)
    )
      return;
    let stopped = false;
    let count = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (stopped || ++count > 12) return;
      if (document.visibilityState === "visible") {
        try {
          const result = await request("/api/care/agent", {
            action: "sync-checkout",
            runId,
          });
          if (!stopped) setRun(result.run);
          if (
            !["PROCESSING", "REQUIRES_ACTION"].includes(
              result.run.checkout?.status,
            )
          )
            return;
        } catch (e) {
          if (!stopped)
            setError(
              e instanceof Error ? e.message : "We are still verifying.",
            );
          return;
        }
      }
      timer = setTimeout(poll, Math.min(2000 * count, 10000));
    };
    timer = setTimeout(poll, 2000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [runId, checkoutId, checkoutStatus, request]);
  const proposal = draft?.draft ?? run?.agreement;
  const selected = run?.agreement.candidates.find(
    (c) => c.variantId === variant,
  );
  const cardReady = run?.enrollment?.status === "ACTIVE";
  const step = !identity
    ? 0
    : run?.checkout
      ? 6
      : !run && !draft
        ? 1
        : draft
          ? 2
          : !run?.quote
            ? 3
            : !cardReady
              ? 4
              : !run?.checkout
                ? 5
                : 6;
  const steps = [
    showSignIn ? "Sign in" : "Explore",
    "Describe",
    "Review",
    "Quote",
    "Card",
    "Approve",
    "Result",
  ];
  const quoteAmount = run?.quote?.amountBreakdown.finalAmount;
  return (
    <section className="payment-workflow" aria-labelledby="payment-title">
      <div className="payment-heading">
        <span className="payment-icon">
          <ShieldCheck size={23} />
        </span>
        <div>
          <span className="eyebrow">QUAK + REAP · SANDBOX PURCHASE</span>
          <h2 id="payment-title">From a care need to a confirmed order.</h2>
          <p>One guided flow. You stay in control of the budget.</p>
        </div>
      </div>
      <ol className="checkout-progress" aria-label="Purchase progress">
        {steps.map((label, i) => (
          <li
            key={label}
            className={i === step ? "current" : i < step ? "complete" : ""}
            aria-current={i === step ? "step" : undefined}
          >
            <span>{i < step ? <Check size={12} /> : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {busy && (
        <p className="operation-status" role="status">
          <LoaderCircle size={17} className="care-spin" /> Working on this step.
          Please keep this window open.
        </p>
      )}
      {identity && (
        <div className="verified-identity">
          <ShieldCheck size={14} />
          <span>
            Purchases authorized by <strong>{identity.name}</strong>
          </span>
          <button
            className="text-action"
            disabled={busy}
            onClick={() => {
              setRun(null);
              setDraft(null);
              setVariant("");
              setAgreementConsent(false);
              setPurchaseConsent(false);
              setText(instruction || defaultInstruction);
              setError("");
              window.history.replaceState(null, "", "/admin?view=payments");
            }}
          >
            New request
          </button>
          <button
            className="text-action"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const response = await fetch("/api/care/agent/session", {
                  method: "DELETE",
                });
                if (!response.ok)
                  throw new Error("Sign out could not be confirmed.");
                setIdentity(null);
                setRun(null);
                setDraft(null);
                window.history.replaceState(null, "", "/admin?view=payments");
              } catch (e) {
                setError(e instanceof Error ? e.message : "Please try again.");
              } finally {
                setBusy(false);
              }
            }}
          >
            Sign out
          </button>
        </div>
      )}
      {!identity && demoEnabled && (
        <div className="demo-access">
          <div>
            <strong>Try one complete purchase</strong>
            <p>
              A private judge session. Real Reap sandbox calls, test card, no
              money charged.
            </p>
          </div>
          <button
            className="primary-action"
            disabled={busy}
            onClick={startDemo}
          >
            Start checkout demo <ArrowRight size={16} />
          </button>
        </div>
      )}
      {step === 0 && !showSignIn && (
        <CareResearch
          query={productQuery}
          onContinue={(request) => {
            setText(request);
            setShowSignIn(true);
          }}
        />
      )}
      {step === 0 && showSignIn && (
        <div className="checkout-step">
          <div className="step-intro">
            <LockKeyhole size={26} />
            <h3>Let’s keep your purchases personal.</h3>
            <p>
              Sign in with your CarePilot account to research and approve a
              purchase. The family selector only changes the care plan.
            </p>
          </div>
          {!sessionLoaded ? (
            <p role="status">Checking your account…</p>
          ) : (
            <form
              className="simple-form login-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                setBusy(true);
                setError("");
                try {
                  const result = await request("/api/care/agent/session", {
                    email: form.get("email"),
                    password: form.get("password"),
                  });
                  setIdentity(result.identity);
                  const id = new URL(window.location.href).searchParams.get(
                    "run",
                  );
                  if (id && /^[a-f0-9-]{36}$/i.test(id)) {
                    const saved = await request("/api/care/agent", {
                      action: "read",
                      runId: id,
                    });
                    setRun(saved.run);
                  }
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Identity could not be validated.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  placeholder="you@example.com"
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="Your CarePilot password"
                />
              </label>
              <button className="primary-action" disabled={busy}>
                Sign in to continue <ArrowRight size={16} />
              </button>
            </form>
          )}
          <button
            className="text-action"
            disabled={busy}
            onClick={() => setShowSignIn(false)}
          >
            ← Back to product research
          </button>
          <p className="checkout-footnote">
            <ShieldCheck size={14} /> Cards and approval codes stay on Reap’s
            secure hosted page.
          </p>
        </div>
      )}
      {step === 1 && (
        <div className="checkout-step">
          <h3>What needs restocking?</h3>
          {demoEnabled && (
            <div className="demo-access">
              <strong>Ready-to-record sandbox purchase</strong>
              <p>
                Hand soap from Spectrum Store. You authorize a SGD50 ceiling;
                the final quote includes shipping. Reap simulates the merchant
                order after test-card approval.
              </p>
              <button
                className="primary-action"
                disabled={busy}
                onClick={() => {
                  setDemoMode(true);
                  command({
                    action: "prepare-human",
                    confirmed: true,
                    intent: {
                      needs: ["soap"],
                      responsible: "Guille",
                      payer: "self",
                      budget: { amount: 50, currency: "SGD" },
                      tasks: [
                        "Restock hand soap",
                        "Guille coordinates; I review and authorize the final quote",
                      ],
                      clarification: null,
                    },
                  });
                }}
              >
                Use hand soap demo · SGD50 limit <ArrowRight size={16} />
              </button>
            </div>
          )}
          <p>
            Quak prepares the plan and checks supplier sources and the supported
            Reap catalog.
          </p>
          <form
            className="simple-form"
            onSubmit={(e) => {
              e.preventDefault();
              command({ action: "prepare", text });
            }}
          >
            <label>
              Describe the need
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={4000}
                rows={3}
                required
              />
            </label>
            <button className="primary-action" disabled={busy}>
              <Sparkles size={16} /> Research with Quak
            </button>
          </form>
          <details className="workflow-details">
            <summary>Prefer to choose the supplies yourself?</summary>
            <p>
              Set the plan yourself, then research real suppliers and the Reap
              catalog.
            </p>
            <div className="simple-form">
              <div className="form-grid">
                <label>
                  Supply
                  <select
                    value={manualCategory}
                    onChange={(e) => {
                      setManualCategory(
                        e.target.value as typeof manualCategory,
                      );
                      setManual(false);
                    }}
                  >
                    <option value="soap">Hand soap</option>
                    <option value="wipes">Hygiene wipes</option>
                    <option value="gloves">Disposable gloves</option>
                  </select>
                </label>
                <label>
                  Budget limit ({currency})
                  <input
                    type="number"
                    value={budget}
                    onChange={(e) => {
                      setBudget(Number(e.target.value));
                      setManual(false);
                    }}
                    min="1"
                    max="100000"
                  />
                </label>
              </div>
              <label>
                Budget currency
                <select
                  value={currency}
                  onChange={(e) => {
                    setCurrency(e.target.value as typeof currency);
                    setManual(false);
                  }}
                >
                  <option value="SGD">SGD · Singapore dollar</option>
                  <option value="MXN">MXN · Mexican peso</option>
                  <option value="USD">USD · US dollar</option>
                </select>
              </label>
              <label>
                Who coordinates the purchase?
                <select
                  value={responsible}
                  onChange={(e) => {
                    setResponsible(e.target.value);
                    setManual(false);
                  }}
                >
                  <option>Guille</option>
                  <option>Vale</option>
                </select>
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={manual}
                  onChange={(e) => setManual(e.target.checked)}
                />{" "}
                I confirm this supply, coordinator and budget for review.
              </label>
              <button
                className="secondary-action"
                disabled={busy || !manual || budget <= 0 || budget > 100000}
                onClick={() =>
                  command({
                    action: "prepare-human",
                    confirmed: true,
                    intent: {
                      needs: [manualCategory],
                      responsible,
                      payer: "self",
                      budget: { amount: budget, currency },
                      tasks: [
                        "Review hygiene supplies for this week",
                        `${responsible} coordinates the purchase after my authorization`,
                      ],
                      clarification: null,
                    },
                  })
                }
              >
                Research my selection <ArrowRight size={15} />
              </button>
            </div>
          </details>
        </div>
      )}
      {step === 2 && proposal && draft && (
        <div className="checkout-step">
          <h3>A plan you can review.</h3>
          <div className="agreement-summary">
            <div>
              <span>Budget limit</span>
              <strong>
                {money(
                  proposal.intent.budget.amount,
                  proposal.intent.budget.currency,
                )}
              </strong>
            </div>
            <div>
              <span>Coordinates</span>
              <strong>{proposal.intent.responsible}</strong>
            </div>
            <div>
              <span>Approves payment</span>
              <strong>{identity?.name}</strong>
            </div>
          </div>
          <ul className="agreement-tasks">
            {proposal.intent.tasks.map((task, i) => (
              <li key={i}>
                <Check size={15} />
                {task}
              </li>
            ))}
          </ul>
          <h4>Available through Reap</h4>
          {proposal.candidates.length ? (
            <div className="product-grid">
              {proposal.candidates.map((c) => (
                <article key={c.variantId}>
                  <Package size={22} />
                  <strong>{c.name}</strong>
                  <span>{c.merchant}</span>
                  <b>{money(c.price.amount, c.price.currency)}</b>
                  <small>Catalog price · final total pending</small>
                </article>
              ))}
            </div>
          ) : (
            <p className="checkout-note">
              No compatible product found in Reap. You can save the plan, but
              checkout needs a supported product.
            </p>
          )}
          <details className="workflow-details">
            <summary>
              Supplier sources & research details ({proposal.sources.length})
            </summary>
            <p>
              Reference prices are separate from a Reap quote.{" "}
              {proposal.origin === "human"
                ? "This plan was prepared by you."
                : "This plan was interpreted by the AI."}
            </p>
            {proposal.sources.map((source) => (
              <article className="source-card" key={source.url}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.title}
                </a>
                <p>{source.excerpt}</p>
                <small>Checked {date(source.consultedAt)}</small>
              </article>
            ))}
            {proposal.blockers.length > 0 && (
              <p>Services to check: {proposal.blockers.join(", ")}</p>
            )}
          </details>
          <label className="check-label">
            <input
              type="checkbox"
              checked={agreementConsent}
              onChange={(e) => setAgreementConsent(e.target.checked)}
            />{" "}
            I reviewed the responsibilities and budget. Save this plan without
            authorizing payment.
          </label>
          <div className="workflow-actions">
            <button
              className="primary-action"
              disabled={busy || !agreementConsent}
              onClick={() =>
                command({ action: "confirm", ...draft, confirmed: true })
              }
            >
              Save & continue <ArrowRight size={16} />
            </button>
            <button
              className="text-action"
              disabled={busy}
              onClick={() => setDraft(null)}
            >
              Edit the request
            </button>
          </div>
        </div>
      )}
      {step === 4 && run && (
        <div className="checkout-step">
          <div className="step-intro">
            <CreditCard size={26} />
            <h3>Your card, securely linked.</h3>
            <p className="checkout-note">
              Use Chrome or Safari with passkeys enabled. The in-app browser
              cannot complete Reap’s device verification. Never enter a real
              card in this demo.
            </p>
            <p>
              Register your card on Reap’s hosted page, then return here to
              check its status. Linking a card does not authorize a purchase.
            </p>
          </div>
          {run.quote && (
            <div className="quote-total">
              <div>
                <span>
                  Reap quote ready · expires {date(run.quote.expiresAt)}
                </span>
                <h4>{run.selected?.name}</h4>
              </div>
              <strong>
                {money(
                  run.quote.amountBreakdown.finalAmount.amount,
                  run.quote.amountBreakdown.finalAmount.currency,
                )}
              </strong>
            </div>
          )}
          <div className="payment-status">
            <span>Card status</span>
            <strong>{run.enrollment?.status || "Not registered"}</strong>
          </div>
          <div className="workflow-actions">
            {!run.enrollment ||
            ["FAILED", "EXPIRED", "REVOKED"].includes(run.enrollment.status) ? (
              <button
                className="primary-action"
                disabled={busy}
                onClick={() => command({ action: "enroll", runId: run.id })}
              >
                Link card with Reap <ArrowRight size={16} />
              </button>
            ) : (
              <>
                {run.enrollment.nextAction?.url && (
                  <a
                    className="primary-action"
                    href={run.enrollment.nextAction.url}
                    rel="noopener noreferrer"
                  >
                    Continue securely on Reap ↗
                  </a>
                )}
                <button
                  className="secondary-action"
                  disabled={busy}
                  onClick={() =>
                    command({ action: "sync-enrollment", runId: run.id })
                  }
                >
                  Check card status
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {step === 4 && run && (
        <button
          className="text-action"
          disabled={busy}
          onClick={() => {
            setVariant(run.selected?.variantId || "");
            setRun({ ...run, quote: undefined, approval: undefined });
          }}
        >
          Refresh the quote before continuing
        </button>
      )}
      {step === 4 && (
        <div className="demo-card-guide">
          <strong>Secure sandbox checkout</strong>
          <p>
            Use sandbox test details only on Reap’s hosted page.{" "}
            <a
              href="https://docs.reap.global/agentic-payments/setup#test-cards"
              target="_blank"
              rel="noopener noreferrer"
            >
              Official test-card instructions ↗
            </a>
          </p>
        </div>
      )}
      {step === 3 && run && (
        <div className="checkout-step">
          <h3>Get the price before you decide.</h3>
          <p>
            Choose a supported product. Reap confirms the final amount, currency
            and shipping.
          </p>
          <form
            className="simple-form"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
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
                const value = String(form.get(key) || "").trim();
                if (value) shipping[key] = value;
              }
              setPurchaseConsent(false);
              command({
                action: "quote",
                runId: run.id,
                variantId: variant,
                ...(Object.keys(shipping).length
                  ? { shipping: shipping as Shipping }
                  : {}),
              });
            }}
          >
            <label>
              Product
              <select
                value={variant}
                onChange={(e) => {
                  setVariant(e.target.value);
                  setPurchaseConsent(false);
                }}
                required
              >
                <option value="">Choose a product</option>
                {run.agreement.candidates.map((c) => (
                  <option key={c.variantId} value={c.variantId}>
                    {c.name} · {c.merchant}
                  </option>
                ))}
              </select>
            </label>
            {!run.agreement.candidates.length && (
              <p className="checkout-note">
                No supported product was found in this plan. No quote or
                purchase can be created.
              </p>
            )}
            {selected?.requiresShipping && (
              <fieldset>
                <legend>Where should it go?</legend>
                <p>
                  {demoMode
                    ? "Synthetic sandbox address. No delivery will be made. Review it before requesting the quote."
                    : "Shipping details go to Reap, never to supplier research."}
                </p>
                <div className="form-grid">
                  {[
                    ["firstName", "First name"],
                    ["lastName", "Last name"],
                    ["phone", "Phone (+ country code)"],
                    ["addressLine1", "Street address"],
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
                        defaultValue={
                          demoMode
                            ? (
                                {
                                  firstName: "Demo",
                                  lastName: "Caregiver",
                                  phone: "+6581234567",
                                  addressLine1: "1 Example Street",
                                  city: "Singapore",
                                  region: "Singapore",
                                  postalCode: "018989",
                                  country: "SG",
                                } as Record<string, string>
                              )[key]
                            : key === "country"
                              ? "MX"
                              : ""
                        }
                        maxLength={200}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <button className="primary-action" disabled={busy || !selected}>
              Get Reap quote <ArrowRight size={16} />
            </button>
          </form>
        </div>
      )}
      {step === 5 && run && run.quote && quoteAmount && (
        <div className="checkout-step">
          <h3>One clear amount. Your decision.</h3>
          <div className="quote-total">
            <div>
              <span>{run.selected?.merchant}</span>
              <h4>{run.selected?.name}</h4>
            </div>
            <strong>{money(quoteAmount.amount, quoteAmount.currency)}</strong>
            <small>
              Final Reap quote · expires {date(run.quote.expiresAt)}
            </small>
          </div>
          <details className="workflow-details">
            <summary>Shipping, taxes & quote details</summary>
            <pre>
              {JSON.stringify(
                {
                  breakdown: run.quote.amountBreakdown,
                  shippingOptions: run.quote.shippingOptions,
                },
                null,
                2,
              )}
            </pre>
          </details>
          <label className="check-label">
            <input
              type="checkbox"
              checked={purchaseConsent}
              onChange={(e) => setPurchaseConsent(e.target.checked)}
            />{" "}
            I authorize this product, merchant, shipping, currency and total as
            the funder. I will complete approval on Reap.
          </label>
          <div className="workflow-actions">
            {!run.approval ? (
              <button
                className="primary-action"
                disabled={busy || !purchaseConsent}
                onClick={() =>
                  command({
                    action: "approve",
                    runId: run.id,
                    termsHash: run.termsHash,
                    confirmed: true,
                  })
                }
              >
                Authorize this amount <ShieldCheck size={16} />
              </button>
            ) : (
              <button
                className="primary-action"
                disabled={busy || !purchaseConsent}
                onClick={() =>
                  command({
                    action: "checkout",
                    runId: run.id,
                    confirmed: true,
                  })
                }
              >
                Continue to Reap approval <ArrowRight size={16} />
              </button>
            )}
            <button
              className="text-action"
              disabled={busy}
              onClick={() => {
                setRun({ ...run, quote: undefined });
                setPurchaseConsent(false);
              }}
            >
              Get a new quote
            </button>
          </div>
        </div>
      )}
      {step === 6 && run?.checkout && (
        <div className="checkout-step">
          <h3>
            {run.verifiedCompleted
              ? "Your sandbox order is confirmed."
              : "Let’s confirm what happened."}
          </h3>
          <div className="payment-status">
            <span>Verified Reap status</span>
            <strong>{run.checkout.status}</strong>
          </div>
          {run.checkout.nextAction?.url && (
            <a
              className="primary-action"
              href={run.checkout.nextAction.url}
              rel="noopener noreferrer"
            >
              Review & approve on Reap ↗
            </a>
          )}
          <button
            className="secondary-action"
            disabled={busy}
            onClick={() => command({ action: "sync-checkout", runId: run.id })}
          >
            Refresh purchase status
          </button>
          {run.verifiedCompleted ? (
            <p className="checkout-note success">
              Order {run.checkout.orderId} ·{" "}
              {run.checkout.finalAmount &&
                money(
                  run.checkout.finalAmount.amount,
                  run.checkout.finalAmount.currency,
                )}
              .{" "}
              {run.sandboxSimulation
                ? "Reap simulated merchant order. No money or delivery."
                : "Sandbox confirmation; delivery is not confirmed."}
            </p>
          ) : (
            <p>
              Returning from Reap does not mean the purchase is complete. We
              show success only when Reap confirms it.
            </p>
          )}
          {run.amountDiscrepancy && (
            <p className="form-error">
              The final amount differs from the authorized quote. Reconciliation
              is needed.
            </p>
          )}
        </div>
      )}
      {run && (
        <details className="workflow-details evidence-details">
          <summary>Purchase activity & verification</summary>
          <p>Agreement {run.id}</p>
          <ul>
            {run.audit.map((entry, i) => (
              <li key={i}>
                {date(entry.at)} · {entry.event}
              </li>
            ))}
          </ul>
          {Object.entries(run.operations)
            .filter(([, op]) => op?.state === "pending")
            .map(([key, op]) => (
              <p className="checkout-note" key={key}>
                {key}: awaiting confirmation ({op.code || "checking"}). The
                existing operation is kept to avoid duplicates.
              </p>
            ))}
        </details>
      )}
      <div className="workflow-footer">
        <ShieldCheck size={14} /> Powered by Reap · Sandbox only. No real money
        moves.
      </div>
    </section>
  );
}
