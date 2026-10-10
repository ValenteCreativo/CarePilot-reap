"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Heart,
  MoreHorizontal,
  LayoutGrid,
  Plus,
  RefreshCw,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import CareChat from "./chat";
import CareAgent from "./agent";
import type { CareChatAction } from "@/lib/care/chat";
import { members, type Agreement } from "@/lib/care/types";

type View = "overview" | "calendar" | "payments";
type Task = Agreement & { started?: boolean; recurring?: boolean };
type Flow = "task" | "appointment" | "expense" | null;
const team = members.filter((m) => !m.roles.includes("recipient"));
const name = (id: string) =>
  team.find((m) => m.id === id)?.name || "Unassigned";
const money = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "MXN" }).format(
    v,
  );
const dateLabel = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
const localDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const stageOf = (t: Task) =>
  t.completed ? "done" : t.started ? "doing" : "todo";
const storageKey = "carepilot-workspace-v2";

export default function CareWorkspace() {
  const [view, setView] = useState<View>("overview");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [person, setPerson] = useState("Mom");
  const [actor, setActor] = useState("vale");
  const [today, setToday] = useState("");
  const [month, setMonth] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [flow, setFlow] = useState<Flow>(null);
  const [notice, setNotice] = useState("");
  const [removed, setRemoved] = useState<Task | null>(null);
  const [purchase, setPurchase] = useState({ query: "", instruction: "" });
  const [proof, setProof] = useState<{
    connected: boolean;
    message?: string;
    verifiedAt?: string;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const date = localDate();
      setToday(date);
      setMonth(date.slice(0, 7));
      setSelectedDay(date);
      const params = new URL(window.location.href).searchParams;
      const initialView = params.get("view");
      if (
        initialView === "overview" ||
        initialView === "calendar" ||
        initialView === "payments"
      )
        setView(initialView);
      else if (params.has("run")) setView("payments");
      if (params.get("query"))
        setPurchase({
          query: params.get("query")!.slice(0, 160),
          instruction: "",
        });
      try {
        const savedPerson = localStorage.getItem(`${storageKey}-person`);
        if (savedPerson && savedPerson.length <= 80) setPerson(savedPerson);
        const saved: unknown = JSON.parse(
          localStorage.getItem(storageKey) || "[]",
        );
        if (Array.isArray(saved))
          setTasks(
            saved
              .filter(
                (t): t is Task =>
                  t &&
                  typeof t.id === "string" &&
                  typeof t.title === "string" &&
                  ["task", "study", "supplies", "medication"].includes(
                    t.kind,
                  ) &&
                  team.some((m) => m.id === t.owner) &&
                  team.some((m) => m.id === t.payer) &&
                  typeof t.date === "string" &&
                  (!t.date || /^\d{4}-\d{2}-\d{2}$/.test(t.date)) &&
                  typeof t.completed === "boolean" &&
                  (t.budget === null ||
                    (typeof t.budget === "number" &&
                      Number.isFinite(t.budget) &&
                      t.budget >= 0)),
              )
              .slice(0, 200),
          );
      } catch {
        /* The workspace remains usable without browser storage. */
      }
      setLoaded(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    window.history.replaceState(null, "", url.pathname + url.search);
    try {
      localStorage.setItem(`${storageKey}-person`, person);
    } catch {
      /* Session stays usable. */
    }
  }, [view, loaded, person]);
  useEffect(() => {
    if (loaded)
      try {
        localStorage.setItem(storageKey, JSON.stringify(tasks));
      } catch {
        /* Keep the current session usable. */
      }
  }, [tasks, loaded]);
  useEffect(() => {
    if (flow) {
      opener.current = document.activeElement as HTMLElement;
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
      opener.current?.focus();
    }
  }, [flow]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => {
        setNotice("");
        setRemoved(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  useEffect(() => {
    void checkReap();
  }, []);
  async function checkReap() {
    setChecking(true);
    try {
      const r = await fetch("/api/care/reap/status", {
        signal: AbortSignal.timeout(25000),
        cache: "no-store",
      });
      const data = await r.json();
      setProof({ ...data, connected: r.ok && data.connected === true });
    } catch {
      setProof({
        connected: false,
        message: "Connection could not be verified. Try again.",
      });
    } finally {
      setChecking(false);
    }
  }
  function open(kind: Flow) {
    setFlow(kind);
  }
  function shop(query: string, task?: Task) {
    setPurchase({
      query: query.slice(0, 160),
      instruction: `Research ${query}, coordinated by ${task ? name(task.owner) : "Guille"}, with a maximum budget of ${task?.budget ?? 700} MXN. I am the funder.`,
    });
    setView("payments");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function saveTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const title = String(data.get("title") || "").trim();
    if (!title) return;
    const budget = String(data.get("budget") || "");
    setTasks((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        title,
        kind:
          flow === "appointment"
            ? "study"
            : flow === "expense"
              ? "supplies"
              : "task",
        owner: String(data.get("owner")),
        payer: String(data.get("payer") || actor),
        budget: budget ? Number(budget) : null,
        date: String(data.get("date") || ""),
        due: "Date to be confirmed",
        clinical: flow === "appointment",
        approval: "pending",
        completed: false,
        evidence: "Added by the family.",
        inference: "",
        recurring: data.get("recurring") === "on",
      },
    ]);
    setFlow(null);
    setNotice("Added to your care plan.");
  }
  function apply(actions: CareChatAction[]) {
    if (
      actions.some(
        (a) =>
          (a.owner && !team.some((m) => m.id === a.owner)) ||
          (a.payer && !team.some((m) => m.id === a.payer)) ||
          (a.type === "update_task" && !tasks.some((t) => t.id === a.taskId)),
      )
    )
      return false;
    const rename = actions.find((a) => a.type === "rename_person");
    if (rename) setPerson(rename.title);
    setTasks((current) => [
      ...current.map((t) => {
        const a = actions.find(
          (a) => a.type === "update_task" && a.taskId === t.id,
        );
        return a
          ? { ...t, owner: a.owner, date: a.date, due: a.due || t.due }
          : t;
      }),
      ...actions
        .filter((a) => a.type === "create_task")
        .map((a) => ({
          id: crypto.randomUUID(),
          title: a.title,
          kind: a.kind,
          owner: a.owner,
          payer: a.payer,
          budget: a.budget,
          date: a.date,
          due: a.due || "Date to be confirmed",
          clinical: a.clinical,
          approval: "pending" as const,
          completed: false,
          evidence: "Reviewed with Quak.",
          inference: a.reason,
        })),
    ]);
    setNotice("Your care plan has been updated.");
    return true;
  }
  function loadExample() {
    if (!today || tasks.length) return;
    const base = {
      payer: "vale",
      due: "This week",
      approval: "pending" as const,
      completed: false,
      evidence: "Sample care plan",
      inference: "",
      date: today,
    };
    setTasks([
      {
        ...base,
        id: crypto.randomUUID(),
        title: "Coordinate Mom’s therapy visit",
        kind: "study",
        owner: "guille",
        budget: 450,
        clinical: true,
      },
      {
        ...base,
        id: crypto.randomUUID(),
        title: "Restock weekly hygiene supplies",
        kind: "supplies",
        owner: "guille",
        budget: 700,
        clinical: false,
        recurring: true,
      },
      {
        ...base,
        id: crypto.randomUUID(),
        title: "Check in and prepare lunch",
        kind: "task",
        owner: "vale",
        budget: null,
        clinical: false,
        started: true,
      },
    ]);
    setNotice("Sample plan loaded. These are example tasks, not purchases.");
  }
  const pending = tasks.filter((t) => !t.completed);
  const expenses = tasks.filter((t) => t.budget !== null);
  const budget = expenses.reduce((sum, t) => sum + (t.budget || 0), 0);
  const upcoming = pending
    .filter((t) => t.date && t.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);
  const monthDate = new Date(`${month || "2026-01"}-01T12:00:00`);
  const days = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0,
  ).getDate();
  const offset = (monthDate.getDay() + 6) % 7;
  function changeMonth(n: number) {
    const d = new Date(monthDate);
    d.setMonth(d.getMonth() + n);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  function removeTask(task: Task) {
    setRemoved(task);
    setTasks((current) => current.filter((t) => t.id !== task.id));
    setNotice("Task removed from the plan.");
  }
  function card(t: Task) {
    return (
      <article
        className={`task-card ${t.completed ? "is-done" : ""}`}
        key={t.id}
      >
        <div className="task-tags">
          <span className={`task-tag tag-${t.kind}`}>
            {t.kind === "study"
              ? "Appointment"
              : t.kind === "supplies"
                ? "Supplies"
                : t.kind === "medication"
                  ? "Medication"
                  : "Daily care"}
          </span>
          {t.recurring && (
            <span title="Weekly restock reminder" className="repeat-tag">
              <RefreshCw size={12} /> Weekly
            </span>
          )}
          <details className="task-menu">
            <summary aria-label={`Options for ${t.title}`}>
              <MoreHorizontal size={16} />
            </summary>
            <button onClick={() => removeTask(t)}>Remove task</button>
          </details>
        </div>
        <h3>{t.title}</h3>
        <div className="task-meta">
          <span className="avatar">{name(t.owner)[0]}</span>
          {name(t.owner)}
          {t.date && (
            <span className={t.date < today && !t.completed ? "overdue" : ""}>
              <CalendarDays size={12} />
              {dateLabel(t.date)}
            </span>
          )}
        </div>
        {t.budget !== null && (
          <div className="task-budget">
            <Wallet size={14} />
            <strong>{money(t.budget)}</strong>
            <small>Planned · {name(t.payer)}</small>
          </div>
        )}
        <div className="task-actions">
          {!t.completed && (
            <button
              onClick={() =>
                setTasks((current) =>
                  current.map((item) =>
                    item.id === t.id
                      ? { ...item, started: true, completed: !!item.started }
                      : item,
                  ),
                )
              }
            >
              {t.started ? (
                <>
                  <Check size={14} /> Complete
                </>
              ) : (
                <>
                  Start task <ArrowRight size={14} />
                </>
              )}
            </button>
          )}
          {t.completed && (
            <button
              onClick={() =>
                setTasks((current) =>
                  current.map((item) =>
                    item.id === t.id
                      ? { ...item, completed: false, started: false }
                      : item,
                  ),
                )
              }
            >
              Reopen
            </button>
          )}
          {t.kind === "supplies" && !t.completed && (
            <button onClick={() => shop(t.title, t)}>Find products</button>
          )}
        </div>
      </article>
    );
  }
  return (
    <div className="care-workspace" lang="en">
      <aside className="workspace-sidebar">
        <Link href="/" className="workspace-brand">
          <Image src="/images/logos/otters.png" alt="" width={39} height={39} />
          carepilot<span>CARE, TOGETHER.</span>
        </Link>
        <div className="care-profile">
          <span className="person-icon">
            <Heart size={21} />
          </span>
          <div>
            <small>YOUR CARE CIRCLE</small>
            <strong>{person}’s care</strong>
            <span>{team.length} people, one shared plan</span>
          </div>
        </div>
        <nav aria-label="Care workspace">
          {(
            [
              { id: "overview", title: "Care board", icon: LayoutGrid },
              { id: "calendar", title: "Calendar", icon: CalendarDays },
              { id: "payments", title: "Budget & payments", icon: Wallet },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              className={view === v.id ? "active" : ""}
              aria-current={view === v.id ? "page" : undefined}
              onClick={() => setView(v.id)}
            >
              <v.icon size={19} />
              {v.title}
              {v.id === "overview" && pending.length > 0 && (
                <span>{pending.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="team-avatars">
            {team.map((m) => (
              <span className="avatar" key={m.id} title={m.name}>
                {m.name[0]}
              </span>
            ))}
            <span>Your care team</span>
          </div>
          <p>
            A little less to carry.
            <br />A little more time together.
          </p>
          <Link href="/">
            Back to home <ArrowRight size={14} />
          </Link>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-topbar">
          <span>
            <span className="breadcrumb">Your workspace / </span>
            {view === "calendar"
              ? "Calendar"
              : view === "payments"
                ? "Budget & payments"
                : "Care board"}
          </span>
          <label className="identity">
            <span className="avatar">{name(actor)[0]}</span>
            <select
              aria-label="Plan as"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
            >
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </header>
        <main className="workspace-main">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {view === "overview"
                  ? "SMALL STEPS. SHARED CARE."
                  : view === "calendar"
                    ? "MAKE ROOM FOR WHAT MATTERS."
                    : "CARE HAS A COST. SHARE THE PLAN."}
              </span>
              <h1>
                {view === "overview"
                  ? "Good care starts together."
                  : view === "calendar"
                    ? "A clearer view of the week."
                    : "Less worry about the next expense."}
              </h1>
              <p>
                {view === "overview"
                  ? `One place for the things ${person} needs, and the people who make them happen.`
                  : view === "calendar"
                    ? "Appointments, daily care and restock reminders, in one shared calendar."
                    : "Plan care costs, find supplies and approve purchases without leaving your workspace."}
              </p>
            </div>
            <button
              className="primary-action"
              onClick={() =>
                open(
                  view === "calendar"
                    ? "appointment"
                    : view === "payments"
                      ? "expense"
                      : "task",
                )
              }
            >
              <Plus size={17} />
              {view === "calendar"
                ? "Add appointment"
                : view === "payments"
                  ? "Plan an expense"
                  : "Add a task"}
            </button>
          </div>
          <div
            className={
              view === "payments" ? "payments-layout" : "workspace-grid"
            }
          >
            <div className="workspace-content">
              <div hidden={view !== "overview"}>
                <CareChat
                  person={person}
                  actor={actor}
                  today={today}
                  team={team}
                  tasks={tasks}
                  onApply={apply}
                  onShop={shop}
                />
              </div>
              {view === "overview" && (
                <>
                  <section className="care-board">
                    <div className="section-heading">
                      <div>
                        <h2>
                          The care plan <span>{tasks.length}</span>
                        </h2>
                        <p>Who’s doing what. One step at a time.</p>
                      </div>
                      {!tasks.length && (
                        <button
                          className="text-action"
                          disabled={!loaded}
                          onClick={loadExample}
                        >
                          Try a sample plan <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                    <div className="board-columns">
                      {[
                        {
                          id: "todo",
                          title: "To do",
                          empty: "What does Mom need next?",
                        },
                        {
                          id: "doing",
                          title: "In progress",
                          empty: "Start a task when you’re ready.",
                        },
                        {
                          id: "done",
                          title: "Done",
                          empty: "Every little thing counts.",
                        },
                      ].map((stage) => (
                        <section
                          className={`board-column column-${stage.id}`}
                          key={stage.id}
                        >
                          <header>
                            <span className="stage-dot" />
                            <h3>{stage.title}</h3>
                            <span>
                              {
                                tasks.filter((t) => stageOf(t) === stage.id)
                                  .length
                              }
                            </span>
                          </header>
                          <div>
                            {tasks
                              .filter((t) => stageOf(t) === stage.id)
                              .map(card)}
                            {!tasks.some((t) => stageOf(t) === stage.id) && (
                              <div className="board-empty">
                                <CircleDot size={22} />
                                <p>{stage.empty}</p>
                              </div>
                            )}
                          </div>
                          {stage.id === "todo" && (
                            <button
                              className="board-add"
                              onClick={() => open("task")}
                            >
                              <Plus size={15} /> Add a task
                            </button>
                          )}
                        </section>
                      ))}
                    </div>
                  </section>
                  <div className="care-note">
                    <Heart size={16} />
                    <p>
                      Care is more than a checklist. Your team handles the
                      details, so you can be present.
                    </p>
                  </div>
                </>
              )}
              {view === "calendar" && (
                <section className="calendar-panel">
                  <div className="section-heading">
                    <h2>
                      {monthDate.toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      })}
                    </h2>
                    <div className="month-controls">
                      <button
                        aria-label="Previous month"
                        onClick={() => changeMonth(-1)}
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        onClick={() => {
                          setMonth(today.slice(0, 7));
                          setSelectedDay(today);
                        }}
                      >
                        Today
                      </button>
                      <button
                        aria-label="Next month"
                        onClick={() => changeMonth(1)}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="month-grid">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                      (day) => (
                        <span className="weekday" key={day}>
                          {day}
                        </span>
                      ),
                    )}
                    {Array.from({ length: offset }, (_, i) => (
                      <span className="calendar-blank" key={`blank${i}`} />
                    ))}
                    {Array.from({ length: days }, (_, i) => {
                      const date = `${month}-${String(i + 1).padStart(2, "0")}`;
                      const items = tasks.filter((t) => t.date === date);
                      return (
                        <button
                          key={date}
                          className={`calendar-day ${date === today ? "is-today" : ""} ${date === selectedDay ? "is-selected" : ""}`}
                          aria-label={`${dateLabel(date)}, ${items.length} tasks`}
                          aria-pressed={date === selectedDay}
                          onClick={() => setSelectedDay(date)}
                        >
                          <span>{i + 1}</span>
                          <div className="day-events">
                            {items.slice(0, 2).map((t) => (
                              <small key={t.id}>{t.title}</small>
                            ))}
                            {items.length > 2 && (
                              <small>+{items.length - 2} more</small>
                            )}
                          </div>
                          {items.length > 0 && <i />}
                        </button>
                      );
                    })}
                  </div>
                  <div className="selected-day">
                    <h3>
                      {selectedDay ? dateLabel(selectedDay) : "Choose a day"}{" "}
                      <span>
                        {tasks.filter((t) => t.date === selectedDay).length}{" "}
                        planned
                      </span>
                    </h3>
                    {tasks.filter((t) => t.date === selectedDay).map(card)}
                    {!tasks.some((t) => t.date === selectedDay) && (
                      <p>Nothing planned. A little breathing room.</p>
                    )}
                    <button
                      className="text-action"
                      onClick={() => open("appointment")}
                    >
                      <Plus size={15} /> Add to this day
                    </button>
                  </div>
                </section>
              )}
              <div hidden={view !== "payments"}>
                <div className="finance-summary">
                  <div>
                    <span>Planned care budget</span>
                    <strong>
                      {money(budget)} <small>MXN</small>
                    </strong>
                    <p>{expenses.length} expenses in your plan · not charged</p>
                  </div>
                  <div>
                    <span>Recurring reminders</span>
                    <strong>
                      {tasks.filter((t) => t.recurring && !t.completed).length}
                    </strong>
                    <p>Weekly supplies to review</p>
                  </div>
                  <div>
                    <span>Payment provider</span>
                    <strong className="reap-wordmark">
                      reap{" "}
                      <span
                        className={`connection-dot ${proof?.connected ? "connected" : ""}`}
                      />
                    </strong>
                    <p>
                      {checking
                        ? "Checking sandbox…"
                        : proof?.connected
                          ? "Sandbox connection verified"
                          : "Sandbox connection not verified"}
                    </p>
                    <button
                      className="text-action"
                      onClick={checkReap}
                      disabled={checking}
                    >
                      <RefreshCw size={12} /> Check connection
                    </button>
                  </div>
                </div>
                <section className="expense-list">
                  <div className="section-heading">
                    <div>
                      <h2>What care needs</h2>
                      <p>
                        Planning a budget is separate from authorizing a
                        purchase.
                      </p>
                    </div>
                  </div>
                  {expenses.length ? (
                    expenses.map((t) => (
                      <div className="expense-row" key={t.id}>
                        <span className={`expense-icon tag-${t.kind}`}>
                          <Wallet size={19} />
                        </span>
                        <div>
                          <strong>{t.title}</strong>
                          <span>
                            {name(t.owner)} coordinates · {name(t.payer)} covers
                            the cost
                            {t.recurring ? " · weekly reminder" : ""}
                          </span>
                        </div>
                        <strong>{money(t.budget || 0)}</strong>
                        {t.kind === "supplies" ? (
                          <button
                            className="secondary-action"
                            onClick={() => shop(t.title, t)}
                          >
                            Find & quote <ArrowRight size={14} />
                          </button>
                        ) : (
                          <span className="planned-label">Planned expense</span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="expenses-empty">
                      <Wallet size={26} />
                      <p>
                        No expenses planned yet. Add medication, therapy,
                        nutrition or supplies to see the full picture.
                      </p>
                      <button
                        className="text-action"
                        onClick={() => open("expense")}
                      >
                        Plan your first expense <Plus size={15} />
                      </button>
                    </div>
                  )}
                </section>
                <CareAgent
                  instruction={purchase.instruction}
                  productQuery={purchase.query}
                />
              </div>
            </div>
            {view !== "payments" && (
              <aside className="workspace-rail">
                <section className="rail-card today-card">
                  <span className="eyebrow">A LITTLE OVERVIEW</span>
                  <h2>
                    {today
                      ? new Date(`${today}T12:00:00`).toLocaleDateString(
                          "en-US",
                          { weekday: "long", month: "short", day: "numeric" },
                        )
                      : "Today"}
                  </h2>
                  <div className="today-metrics">
                    <div>
                      <strong>{pending.length}</strong>
                      <span>Open tasks</span>
                    </div>
                    <div>
                      <strong>{tasks.filter((t) => t.completed).length}</strong>
                      <span>Done with care</span>
                    </div>
                  </div>
                  <div className="team-line">
                    <span className="avatar">V</span>
                    <span className="avatar">G</span>
                    <small>You’re in this together.</small>
                  </div>
                </section>
                <section className="rail-card">
                  <div className="section-heading">
                    <h2>Coming up</h2>
                    <CalendarDays size={18} />
                  </div>
                  {upcoming.length ? (
                    upcoming.map((t) => (
                      <div className="upcoming-item" key={t.id}>
                        <span>{dateLabel(t.date)}</span>
                        <div>
                          <strong>{t.title}</strong>
                          <small>{name(t.owner)}</small>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rail-empty">
                      <p>No upcoming dates yet.</p>
                      <button
                        className="text-action"
                        onClick={() => open("appointment")}
                      >
                        Plan an appointment <Plus size={14} />
                      </button>
                    </div>
                  )}
                  {upcoming.length > 0 && (
                    <button
                      className="text-action"
                      onClick={() => setView("calendar")}
                    >
                      Open calendar <ArrowRight size={14} />
                    </button>
                  )}
                </section>
                <section className="rail-card budget-card">
                  <span className="eyebrow">THE COST OF CARE</span>
                  <h2>
                    {money(budget)} <small>MXN</small>
                  </h2>
                  <p>Planned together. Approved by you.</p>
                  <button
                    className="secondary-action"
                    onClick={() => setView("payments")}
                  >
                    Budget & payments <ArrowRight size={15} />
                  </button>
                  <div className="powered-by">
                    <ShieldCheck size={13} />
                    <span>
                      Purchases powered by <b>reap</b>
                    </span>
                  </div>
                </section>
              </aside>
            )}
          </div>
          <footer className="workspace-footer">
            <span>Made for the people who care.</span>
            <span>
              Demo workspace · saved in this browser. Reap sandbox · no real
              money moves.
            </span>
          </footer>
        </main>
      </div>
      <dialog
        ref={dialog}
        className="care-dialog"
        aria-labelledby="flow-title"
        onCancel={() => setFlow(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setFlow(null);
        }}
      >
        <div className="dialog-body">
          <button
            className="dialog-close"
            aria-label="Close"
            onClick={() => setFlow(null)}
          >
            <X size={21} />
          </button>
          <span className="dialog-icon">
            {flow === "appointment" ? (
              <CalendarDays size={24} />
            ) : flow === "expense" ? (
              <Wallet size={24} />
            ) : (
              <Plus size={24} />
            )}
          </span>
          <h2 id="flow-title">
            {flow === "appointment"
              ? "Plan an appointment"
              : flow === "expense"
                ? "Plan a care expense"
                : `One small step for ${person}`}
          </h2>
          <p>Just the essentials. Your team takes it from here.</p>
          <form className="simple-form" onSubmit={saveTask}>
            <label>
              What’s needed?
              <input
                name="title"
                placeholder={
                  flow === "appointment"
                    ? "e.g. Therapy visit"
                    : flow === "expense"
                      ? "e.g. Weekly hygiene supplies"
                      : "e.g. Prepare lunch for Mom"
                }
                required
                autoFocus
                maxLength={180}
              />
            </label>
            <div className="form-grid">
              <label>
                Who’s taking care of it?
                <select name="owner" defaultValue={actor}>
                  {team.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {flow === "appointment"
                  ? "Appointment date"
                  : "When? (optional)"}
                <input
                  name="date"
                  type="date"
                  required={flow === "appointment"}
                  defaultValue={view === "calendar" ? selectedDay : ""}
                />
              </label>
            </div>
            {flow !== "task" && (
              <div className="form-grid">
                <label>
                  Planned budget (MXN)
                  <input
                    name="budget"
                    type="number"
                    min="0"
                    max="100000"
                    step="0.01"
                    placeholder="700"
                    required={flow === "expense"}
                  />
                </label>
                <label>
                  Who covers the cost?
                  <select name="payer" defaultValue={actor}>
                    {team.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {flow === "expense" && (
              <label className="check-label">
                <input name="recurring" type="checkbox" /> Weekly restock
                reminder (purchases require approval)
              </label>
            )}
            {flow === "appointment" && (
              <label className="check-label">
                <input type="checkbox" required /> I’ll confirm the time and
                instructions with the clinic.
              </label>
            )}
            <button className="primary-action full-action" type="submit">
              Add to care plan <Check size={17} />
            </button>
          </form>
        </div>
      </dialog>
      {notice && (
        <div className="care-toast" role="status">
          <Check size={18} />
          {notice}
          {removed && (
            <button
              className="undo-action"
              onClick={() => {
                setTasks((current) => [...current, removed]);
                setRemoved(null);
                setNotice("Task restored.");
              }}
            >
              Undo
            </button>
          )}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
