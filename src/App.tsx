import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  Rocket,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { configured, publicSupabase, supabase } from "./supabase";
import type {
  Profile,
  Project,
  PublishedScore,
  PublishedTotal,
  Score,
  ScoreReveal,
} from "./supabase";
import "./App.css";

type View = "guest" | "login" | "admin" | "judge";
type AdminTab = "projects" | "judges" | "reveal";
type ProjectDraft = { name: string; description: string; members: string };
const blankDraft: ProjectDraft = { name: "", description: "", members: "" };
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
const parseMembers = (text: string) =>
  text
    .split(/[\n,]+/)
    .map((member) => member.trim())
    .filter(Boolean);

function Brand({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="brand"
      onClick={onClick}
      aria-label="iStartup Junior home"
    >
      <img
        className="brand-logo"
        src="/istartup-logo.png"
        alt="iStartup Junior logo"
      />
      <span className="brand-copy">
        <span className="eyebrow">MS Dhoni Global School presents</span>
        <span className="brand-name">
          iStartup Junior <b>— Season 2</b>
        </span>
      </span>
    </button>
  );
}
function Badge({
  children,
  kind = "locked",
}: {
  children: React.ReactNode;
  kind?: "locked" | "live" | "done";
}) {
  return <span className={"status " + kind}>{children}</span>;
}
function Empty({
  title,
  text,
  icon = <Rocket size={24} />,
  action,
}: {
  title: string;
  text: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  );
}
function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="dialog-heading">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {subtitle && <p className="subcopy">{subtitle}</p>}
        {children}
      </section>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>("guest");
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authRole, setAuthRole] = useState<"judge" | "admin">("judge");
  const [signup, setSignup] = useState(false);
  const [authName, setAuthName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [publicJudges, setPublicJudges] = useState<Profile[]>([]);
  const [publishedScores, setPublishedScores] = useState<PublishedScore[]>([]);
  const [publishedTotals, setPublishedTotals] = useState<PublishedTotal[]>([]);
  const [guestError, setGuestError] = useState("");
  const [guestLoading, setGuestLoading] = useState(true);
  const [guestProjectId, setGuestProjectId] = useState<string | null>(null);
  const [adminTab, setAdminTab] = useState<AdminTab>("projects");
  const [judges, setJudges] = useState<Profile[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [scoreReveals, setScoreReveals] = useState<ScoreReveal[]>([]);
  const [adminProjectId, setAdminProjectId] = useState<string | null>(null);
  const [privateError, setPrivateError] = useState("");
  const [dialog, setDialog] = useState<
    "project" | "delete" | "score" | "delete-score" | null
  >(null);
  const [editing, setEditing] = useState<Project | null>(null);
  const [draft, setDraft] = useState<ProjectDraft>(blankDraft);
  const [draftError, setDraftError] = useState("");
  const [dialogBusy, setDialogBusy] = useState(false);
  const [judgeProject, setJudgeProject] = useState<Project | null>(null);
  const [editingScore, setEditingScore] = useState<Score | null>(null);
  const [scoreInput, setScoreInput] = useState("");
  const [scoreError, setScoreError] = useState("");
  const [deletingScore, setDeletingScore] = useState<Score | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 4000);
  };

  const loadGuest = useCallback(async () => {
    if (!configured) {
      setGuestError("Supabase configuration is missing.");
      setGuestLoading(false);
      return;
    }
    const results = await Promise.all([
      publicSupabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: true }),
      publicSupabase
        .from("profiles")
        .select("id,display_name,role")
        .eq("role", "judge")
        .order("created_at", { ascending: true }),
      publicSupabase.from("published_scores").select("*"),
      publicSupabase.from("published_totals").select("*"),
    ]);
    const failed = results.find((result) => result.error);
    if (failed?.error) setGuestError(failed.error.message);
    else {
      setGuestError("");
      setProjects((results[0].data ?? []) as Project[]);
      setPublicJudges((results[1].data ?? []) as Profile[]);
      setPublishedScores((results[2].data ?? []) as PublishedScore[]);
      setPublishedTotals((results[3].data ?? []) as PublishedTotal[]);
    }
    setGuestLoading(false);
  }, []);

  const loadPrivate = useCallback(async (role: "judge" | "admin") => {
    const base = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: true });
    if (base.error) {
      setPrivateError(base.error.message);
      return;
    }
    setProjects((base.data ?? []) as Project[]);
    if (role === "admin") {
      const results = await Promise.all([
        supabase
          .from("profiles")
          .select("id,display_name,role,created_at")
          .eq("role", "judge")
          .order("created_at", { ascending: true }),
        supabase.from("scores").select("*"),
        supabase.from("score_reveals").select("*"),
      ]);
      const failed = results.find((result) => result.error);
      if (failed?.error) {
        setPrivateError(failed.error.message);
        return;
      }
      setJudges((results[0].data ?? []) as Profile[]);
      setScores((results[1].data ?? []) as Score[]);
      setScoreReveals((results[2].data ?? []) as ScoreReveal[]);
    } else {
      const mine = await supabase.from("scores").select("*");
      if (mine.error) {
        setPrivateError(mine.error.message);
        return;
      }
      setScores((mine.data ?? []) as Score[]);
    }
    setPrivateError("");
  }, []);

  const resolveUser = useCallback(
    async (current: User | null) => {
      setUser(current);
      if (!current) {
        setProfile(null);
        setSessionLoading(false);
        return;
      }
      const result = await supabase
        .from("profiles")
        .select("id,display_name,role")
        .eq("id", current.id)
        .single();
      if (result.data) {
        const next = result.data as Profile;
        setProfile(next);
        setView(next.role);
        await loadPrivate(next.role);
      }
      setSessionLoading(false);
    },
    [loadPrivate],
  );

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => resolveUser(data.user))
      .catch(() => setSessionLoading(false));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);
        setView("guest");
      } else if (event === "SIGNED_IN" && session?.user)
        window.setTimeout(() => resolveUser(session.user), 0);
    });
    return () => subscription.unsubscribe();
  }, [resolveUser]);
  useEffect(() => {
    loadGuest();
    const timer = window.setInterval(loadGuest, 4000);
    return () => window.clearInterval(timer);
  }, [loadGuest]);
  useEffect(() => {
    if (!profile) return;
    const timer = window.setInterval(() => loadPrivate(profile.role), 6000);
    return () => window.clearInterval(timer);
  }, [profile, loadPrivate]);

  const guestProject = projects.find(
    (project) => project.id === guestProjectId,
  );
  const adminProject =
    projects.find((project) => project.id === adminProjectId) ?? projects[0];
  const publishedCount = useMemo(
    () => publishedScores.length,
    [publishedScores],
  );

  const openAuth = (role: "judge" | "admin", create = false) => {
    setAuthRole(role);
    setSignup(role === "judge" && create);
    setAuthError("");
    setAuthNotice("");
    setView("login");
  };
  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    setAuthNotice("");
    try {
      if (signup) {
        if (authRole === "admin")
          throw new Error("Only one admin is allowed. Please sign in.");
        if (!authName.trim()) throw new Error("Enter your name.");
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/register`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              email: email.trim(),
              password,
              display_name: authName.trim(),
            }),
          },
        );
        const created = await response.json();
        if (!response.ok)
          throw new Error(created.error || "Unable to create account.");
        const result = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (result.error) throw result.error;
        await resolveUser(result.data.user);
        notify("Judge account ready.");
      } else {
        const result = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (result.error) throw result.error;
        const profileResult = await supabase
          .from("profiles")
          .select("role")
          .eq("id", result.data.user.id)
          .single();
        if (profileResult.error) throw profileResult.error;
        if (profileResult.data.role !== authRole) {
          await supabase.auth.signOut();
          throw new Error(
            `This account is registered as a ${profileResult.data.role}. Select that role to sign in.`,
          );
        }
        await resolveUser(result.data.user);
      }
      setPassword("");
    } catch (error) {
      setAuthError(errorText(error));
    } finally {
      setAuthBusy(false);
    }
  };
  const logout = async () => {
    await supabase.auth.signOut();
    setView("guest");
    setProfile(null);
    setUser(null);
    notify("Signed out.");
  };

  const openProjectEditor = (project?: Project) => {
    setEditing(project ?? null);
    setDraft(
      project
        ? {
            name: project.name,
            description: project.description,
            members: project.team_members.join("\n"),
          }
        : blankDraft,
    );
    setDraftError("");
    setDialog("project");
  };
  const saveProject = async (event: FormEvent) => {
    event.preventDefault();
    setDraftError("");
    const members = parseMembers(draft.members);
    if (draft.name.trim().length < 2) {
      setDraftError("Enter a project name with at least two characters.");
      return;
    }
    if (!members.length) {
      setDraftError("Add at least one team member.");
      return;
    }
    setDialogBusy(true);
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      team_members: members,
      updated_at: new Date().toISOString(),
    };
    const result = editing
      ? await supabase.from("projects").update(payload).eq("id", editing.id)
      : await supabase.from("projects").insert(payload);
    setDialogBusy(false);
    if (result.error) {
      setDraftError(result.error.message);
      return;
    }
    setDialog(null);
    await loadPrivate("admin");
    await loadGuest();
    notify(editing ? "Project updated." : "Project added.");
  };
  const deleteProject = async () => {
    if (!editing) return;
    setDialogBusy(true);
    const result = await supabase
      .from("projects")
      .delete()
      .eq("id", editing.id);
    setDialogBusy(false);
    if (result.error) {
      setDraftError(result.error.message);
      return;
    }
    setDialog(null);
    setAdminProjectId(null);
    await loadPrivate("admin");
    await loadGuest();
    notify("Project deleted.");
  };
  const toggleJudge = async (
    projectId: string,
    judgeId: string,
    current: boolean,
  ) => {
    const result = await supabase.from("score_reveals").upsert({
      project_id: projectId,
      judge_id: judgeId,
      is_revealed: !current,
    });
    if (result.error) {
      setPrivateError(result.error.message);
      return;
    }
    await Promise.all([loadPrivate("admin"), loadGuest()]);
    notify(current ? "Judge score hidden." : "Judge score revealed.");
  };
  const openScoring = (project: Project, score?: Score) => {
    setJudgeProject(project);
    setEditingScore(score ?? null);
    setScoreInput(score ? String(score.value) : "");
    setScoreError("");
    setDialog("score");
  };
  const submitScore = async (event: FormEvent) => {
    event.preventDefault();
    if (!judgeProject || !user) return;
    const value = Number(scoreInput);
    if (
      !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(scoreInput.trim()) ||
      !Number.isFinite(value)
    ) {
      setScoreError("Enter a valid non-negative number.");
      return;
    }
    setDialogBusy(true);
    const result = editingScore
      ? await supabase
          .from("scores")
          .update({ value })
          .eq("id", editingScore.id)
          .eq("judge_id", user.id)
      : await supabase
          .from("scores")
          .insert({ project_id: judgeProject.id, judge_id: user.id, value });
    setDialogBusy(false);
    if (result.error) {
      setScoreError(result.error.message);
      return;
    }
    setDialog(null);
    await Promise.all([loadPrivate("judge"), loadGuest()]);
    notify(editingScore ? "Score updated." : "Score added.");
  };
  const deleteScore = async () => {
    if (!deletingScore || !user) return;
    setDialogBusy(true);
    const result = await supabase
      .from("scores")
      .delete()
      .eq("id", deletingScore.id)
      .eq("judge_id", user.id);
    setDialogBusy(false);
    if (result.error) {
      setScoreError(result.error.message);
      return;
    }
    setDeletingScore(null);
    await Promise.all([loadPrivate("judge"), loadGuest()]);
    notify("Score deleted.");
  };

  const header = (
    <header className="topbar shell">
      <Brand
        onClick={() => {
          setMenuOpen(false);
          setGuestProjectId(null);
          setView("guest");
        }}
      />
      <button
        className="menu-toggle"
        type="button"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        aria-controls="main-navigation"
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>
      <nav
        id="main-navigation"
        className={"nav-actions" + (menuOpen ? " menu-open" : "")}
        aria-label="Main navigation"
      >
        <button
          className={"nav-link " + (view === "guest" ? "active" : "")}
          onClick={() => {
            setMenuOpen(false);
            setGuestProjectId(null);
            setView("guest");
          }}
        >
          Public scores
        </button>
        {profile ? (
          <>
            <button
              className={"nav-link " + (view === profile.role ? "active" : "")}
              onClick={() => {
                setMenuOpen(false);
                setView(profile.role);
              }}
            >
              {profile.role === "admin" ? "Control room" : "Judge desk"}
            </button>
            <span className="user-pill">{profile.display_name}</span>
            <button
              className="icon-button"
              onClick={() => {
                setMenuOpen(false);
                void logout();
              }}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={17} />
              <span className="signout-label">Sign out</span>
            </button>
          </>
        ) : (
          <button className="top-cta" onClick={() => {
            setMenuOpen(false);
            openAuth("judge");
          }}>
            Sign in
          </button>
        )}
      </nav>
    </header>
  );

  return (
    <div className="app">
      {header}
      <main className="shell main">
        {!configured && (
          <div className="error-banner">
            Supabase environment variables are missing. Check .env.local.
          </div>
        )}
        {sessionLoading ? (
          <div className="loading">Opening iStartup Junior…</div>
        ) : (
          <>
            {view === "guest" && (
              <>
                {guestError && <div className="error-banner">{guestError}</div>}
                {guestProject ? (
                  <GuestDetail
                    project={guestProject}
                    judges={publicJudges}
                    scores={publishedScores}
                    totals={publishedTotals}
                    back={() => setGuestProjectId(null)}
                  />
                ) : (
                  <>
                    <div className="hero-grid">
                      <section className="hero-panel">
                        <span className="hero-label">
                          <Sparkles size={14} /> MS Dhoni Global School presents
                        </span>
                        <div className="section-kicker">
                          The public scoreboard
                        </div>
                        <h1>
                          Big ideas.
                          <br />
                          <em>Bold scores.</em>
                        </h1>
                        <p className="lede">
                          Explore the Season 2 projects. Judge scores and totals
                          appear here only when the event admin reveals them.
                        </p>
                      </section>
                      <aside className="hero-aside">
                        <div className="aside-top">
                          <span className="pulse-dot" /> LIVE COMPETITION
                        </div>
                        <div>
                          <div className="aside-number">
                            {String(projects.length).padStart(2, "0")}
                          </div>
                          <div className="aside-caption">
                            projects on the pitch deck
                          </div>
                        </div>
                        <div className="aside-footer">
                          <span>Season 02</span>
                          <span>
                            {publishedCount
                              ? `${publishedCount} scores revealed`
                              : "Reveals coming soon"}
                          </span>
                        </div>
                      </aside>
                    </div>
                    <div className="section-heading">
                      <h2>Projects on the stage</h2>
                      <span className="count">{projects.length} PROJECTS</span>
                    </div>
                    {guestLoading ? (
                      <div className="loading">Loading projects…</div>
                    ) : projects.length ? (
                      <div className="project-grid">
                        {projects.map((project, index) => (
                          <button
                            className="project-card"
                            key={project.id}
                            onClick={() => setGuestProjectId(project.id)}
                          >
                            <div className="card-top">
                              <span className="project-index">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <Badge
                                kind={
                                  publishedTotals.some(
                                    (item) => item.project_id === project.id,
                                  ) ||
                                  publishedScores.some(
                                    (item) => item.project_id === project.id,
                                  )
                                    ? "live"
                                    : "locked"
                                }
                              >
                                {publishedTotals.some(
                                  (item) => item.project_id === project.id,
                                ) ||
                                publishedScores.some(
                                  (item) => item.project_id === project.id,
                                )
                                  ? "Scores live"
                                  : "Scores locked"}
                              </Badge>
                            </div>
                            <h3>{project.name}</h3>
                            <p className="card-description">
                              {project.description ||
                                "Discover the team and watch scores reveal live."}
                            </p>
                            <div className="card-bottom">
                              <span>
                                {project.team_members.length} team member
                                {project.team_members.length === 1 ? "" : "s"}
                              </span>
                              <ArrowRight size={17} className="arrow" />
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        title="The stage is being set"
                        text="Projects will appear here as soon as the admin adds them."
                        icon={<Rocket size={23} />}
                      />
                    )}
                  </>
                )}
              </>
            )}
            {view === "login" && (
              <div className="account-layout">
                <section className="account-story">
                  <div className="section-kicker">Your seat at the event</div>
                  <h1>
                    {signup ? (
                      <>
                        Join the <em>competition.</em>
                      </>
                    ) : (
                      <>
                        Welcome <em>back.</em>
                      </>
                    )}
                  </h1>
                  <p>
                    Judges can add and edit numeric scores. The admin manages
                    projects and controls every reveal. All changes are saved to
                    the live competition database.
                  </p>
                </section>
                <section className="account-card">
                  <h2>{signup ? "Create your account" : "Sign in"}</h2>
                  <p className="subcopy">Choose your role to continue.</p>
                  <div className="segmented">
                    <button
                      className={authRole === "judge" ? "active" : ""}
                      onClick={() => {
                        setAuthRole("judge");
                        setAuthError("");
                        setAuthNotice("");
                      }}
                    >
                      Judge
                    </button>
                    <button
                      className={authRole === "admin" ? "active" : ""}
                      onClick={() => {
                        setAuthRole("admin");
                        setSignup(false);
                        setAuthError("");
                        setAuthNotice(
                          signup
                            ? "Only one admin is allowed. Please sign in."
                            : "",
                        );
                      }}
                    >
                      Admin
                    </button>
                  </div>
                  <form className="form" onSubmit={submitAuth}>
                    {signup && (
                      <div className="field">
                        <label htmlFor="auth-name">Your name</label>
                        <input
                          id="auth-name"
                          value={authName}
                          onChange={(event) => setAuthName(event.target.value)}
                          autoComplete="name"
                          required
                        />
                      </div>
                    )}
                    <div className="field">
                      <label htmlFor="auth-email">Email address</label>
                      <input
                        id="auth-email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        type="email"
                        autoComplete="email"
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="auth-password">Password</label>
                      <input
                        id="auth-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        type="password"
                        autoComplete={
                          signup ? "new-password" : "current-password"
                        }
                        minLength={8}
                        required
                      />
                    </div>
                    {authError && <div className="form-error">{authError}</div>}
                    {authNotice && (
                      <div className="form-success">{authNotice}</div>
                    )}
                    <button
                      className="primary full"
                      disabled={authBusy || !configured}
                    >
                      {authBusy
                        ? "Please wait…"
                        : signup
                          ? "Create account"
                          : "Sign in"}{" "}
                      <ArrowRight size={16} />
                    </button>
                  </form>
                  {authRole === "judge" && (
                    <p className="auth-footer">
                      {signup
                        ? "Already have an account?"
                        : "New to the event?"}{" "}
                      <button
                        className="switch-auth"
                        onClick={() => {
                          setSignup(!signup);
                          setAuthError("");
                          setAuthNotice("");
                        }}
                      >
                        {signup ? "Sign in" : "Create an account"}
                      </button>
                    </p>
                  )}
                </section>
              </div>
            )}
            {view === "admin" && profile?.role === "admin" && (
              <>
                <div className="dashboard-top">
                  <div>
                    <div className="section-kicker">Event control room</div>
                    <h1>
                      Every reveal, <em>your call.</em>
                    </h1>
                    <p className="lede">
                      Manage the pitch lineup, see submitted scores, and decide
                      exactly what the audience sees.
                    </p>
                  </div>
                  <button
                    className="primary"
                    onClick={() => openProjectEditor()}
                  >
                    <Plus size={17} /> Add project
                  </button>
                </div>
                {privateError && (
                  <div className="error-banner">{privateError}</div>
                )}
                <div className="metrics">
                  <div className="metric">
                    <div className="metric-num">{projects.length}</div>
                    <div className="metric-label">Projects</div>
                  </div>
                  <div className="metric">
                    <div className="metric-num">{judges.length}</div>
                    <div className="metric-label">Registered judges</div>
                  </div>
                  <div className="metric">
                    <div className="metric-num">{scores.length}</div>
                    <div className="metric-label">Scores submitted</div>
                  </div>
                </div>
                <div className="tabs">
                  <button
                    className={
                      "tab " + (adminTab === "projects" ? "active" : "")
                    }
                    onClick={() => setAdminTab("projects")}
                  >
                    Projects
                  </button>
                  <button
                    className={"tab " + (adminTab === "judges" ? "active" : "")}
                    onClick={() => setAdminTab("judges")}
                  >
                    Judges
                  </button>
                  <button
                    className={"tab " + (adminTab === "reveal" ? "active" : "")}
                    onClick={() => setAdminTab("reveal")}
                  >
                    Reveal controls
                  </button>
                </div>
                {adminTab === "projects" &&
                  (projects.length ? (
                    <div className="admin-list">
                      {projects.map((project, index) => (
                        <div className="admin-project" key={project.id}>
                          <span className="project-index">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div className="admin-project-info">
                            <h3>{project.name}</h3>
                            <p>
                              {project.team_members.join(" · ")} ·{" "}
                              {
                                scores.filter(
                                  (score) => score.project_id === project.id,
                                ).length
                              }
                              score entries
                            </p>
                          </div>
                          <div className="admin-project-actions">
                            <button
                              className="secondary"
                              onClick={() => {
                                setAdminProjectId(project.id);
                                setAdminTab("reveal");
                              }}
                            >
                              <Eye size={15} /> Scores
                            </button>
                            <button
                              className="icon-button"
                              title={"Edit " + project.name}
                              onClick={() => openProjectEditor(project)}
                            >
                              <Settings2 size={16} />
                            </button>
                            <button
                              className="icon-button danger-icon"
                              title={"Delete " + project.name}
                              onClick={() => {
                                setEditing(project);
                                setDialog("delete");
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title="No projects yet"
                      text="Create the first project to make it instantly available to every judge and guest."
                      action={
                        <button
                          className="primary"
                          onClick={() => openProjectEditor()}
                        >
                          <Plus size={16} /> Add project
                        </button>
                      }
                    />
                  ))}
                {adminTab === "judges" && (
                  <div className="panel">
                    <div className="panel-header">
                      <div>
                        <h2>Registered judges</h2>
                        <p className="subcopy">
                          Judges create their own accounts. Their names appear
                          here as they join.
                        </p>
                      </div>
                      <Users color="#ffd460" size={23} />
                    </div>
                    {judges.length ? (
                      judges.map((judge) => (
                        <div className="judge-row" key={judge.id}>
                          <div className="avatar">
                            {initials(judge.display_name)}
                          </div>
                          <div>
                            <b>{judge.display_name}</b>
                            <div className="judge-meta">
                              {
                                scores.filter(
                                  (score) => score.judge_id === judge.id,
                                ).length
                              }{" "}
                              score entries
                            </div>
                          </div>
                          <Badge
                            kind={
                              scores.some(
                                (score) => score.judge_id === judge.id,
                              )
                                ? "done"
                                : "locked"
                            }
                          >
                            {scores.some((score) => score.judge_id === judge.id)
                              ? "Scoring"
                              : "Not started"}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <Empty
                        title="No judges registered"
                        text="Ask judges to select Judge and create their own account."
                      />
                    )}
                  </div>
                )}
                {adminTab === "reveal" &&
                  (projects.length ? (
                    <div className="operator">
                      <div className="project-nav">
                        {projects.map((project) => (
                          <button
                            className={
                              adminProject?.id === project.id ? "selected" : ""
                            }
                            key={project.id}
                            onClick={() => setAdminProjectId(project.id)}
                          >
                            {project.name}
                          </button>
                        ))}
                      </div>
                      {adminProject && (
                        <div className="panel">
                          <div className="panel-header">
                            <div>
                              <div className="section-kicker">
                                Selected project
                              </div>
                              <h2>{adminProject.name}</h2>
                              <p className="subcopy">
                                Only scores you turn on are visible to guests.
                              </p>
                            </div>
                            <ShieldCheck color="#ffd460" size={24} />
                          </div>
                          <div className="control-stack">
                            {judges.length ? (
                              judges.map((judge) => {
                                const judgeScores = scores.filter(
                                  (item) =>
                                    item.project_id === adminProject.id &&
                                    item.judge_id === judge.id,
                                );
                                const revealed = scoreReveals.some(
                                  (item) =>
                                    item.project_id === adminProject.id &&
                                    item.judge_id === judge.id &&
                                    item.is_revealed,
                                );
                                return (
                                  <div className="control-row" key={judge.id}>
                                    <div className="avatar">
                                      {initials(judge.display_name)}
                                    </div>
                                    <div className="judge-info">
                                      <b>{judge.display_name}</b>
                                      <small>
                                        {judgeScores.length
                                          ? `${judgeScores.length} score${judgeScores.length === 1 ? "" : "s"}: ${judgeScores.map((score) => score.value).join(" + ")}`
                                          : "Awaiting score"}
                                      </small>
                                    </div>
                                    <button
                                      className={
                                        "toggle " + (revealed ? "on" : "")
                                      }
                                      disabled={!judgeScores.length}
                                      onClick={() =>
                                        toggleJudge(
                                          adminProject.id,
                                          judge.id,
                                          revealed,
                                        )
                                      }
                                    >
                                      {revealed ? (
                                        <>
                                          <EyeOff size={13} /> Hide
                                        </>
                                      ) : (
                                        <>
                                          <Eye size={13} /> Reveal
                                        </>
                                      )}
                                    </button>
                                  </div>
                                );
                              })
                            ) : (
                              <Empty
                                title="No judges yet"
                                text="Judges will appear here after they register."
                              />
                            )}
                          </div>
                          <div className="control-total">
                            <b>Public total updates automatically</b>
                            <small>
                              Only revealed judge scores are included.
                            </small>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Empty
                      title="Add a project first"
                      text="Reveal controls will appear when the pitch lineup has a project."
                    />
                  ))}
              </>
            )}
            {view === "judge" && profile?.role === "judge" && (
              <>
                <div className="dashboard-top">
                  <div>
                    <div className="section-kicker">Judge desk</div>
                    <h1>
                      Your scores. <em>Your call.</em>
                    </h1>
                    <p className="lede">
                      Enter a number for each score. You can add more, edit, or
                      delete your scores at any time.
                    </p>
                  </div>
                  <Badge kind="live">Season 2 judging</Badge>
                </div>
                {privateError && (
                  <div className="error-banner">{privateError}</div>
                )}
                {projects.length ? (
                  <div className="judge-grid">
                    {projects.map((project, index) => {
                      const mine = scores.filter(
                        (score) =>
                          score.project_id === project.id &&
                          score.judge_id === user?.id,
                      );
                      return (
                        <article className="judge-project" key={project.id}>
                          <div className="card-top">
                            <span className="project-index">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <Badge kind={mine.length ? "done" : "locked"}>
                              {mine.length
                                ? `${mine.length} score${mine.length === 1 ? "" : "s"}`
                                : "Awaiting score"}
                            </Badge>
                          </div>
                          <h3>{project.name}</h3>
                          <p className="card-description">
                            {project.description || "No description provided."}
                          </p>
                          <div className="members">
                            {project.team_members.map((member, i) => (
                              <span className="member" key={i}>
                                {member}
                              </span>
                            ))}
                          </div>
                          {mine.length > 0 && (
                            <div className="judge-score-list">
                              {mine.map((score, scoreIndex) => (
                                <div className="judge-score-row" key={score.id}>
                                  <span>
                                    <Check size={15} /> Score {scoreIndex + 1}:{" "}
                                    <b>{score.value}</b>
                                  </span>
                                  <div className="judge-score-actions">
                                    <button
                                      type="button"
                                      className="secondary"
                                      onClick={() =>
                                        openScoring(project, score)
                                      }
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      className="icon-button danger-icon"
                                      aria-label={`Delete score ${scoreIndex + 1}`}
                                      onClick={() => {
                                        setDeletingScore(score);
                                        setScoreError("");
                                        setDialog("delete-score");
                                      }}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <button
                            className="primary"
                            onClick={() => openScoring(project)}
                          >
                            <Plus size={16} />{" "}
                            {mine.length ? "Add another score" : "Add score"}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <Empty
                    title="No projects to score yet"
                    text="Projects will appear here automatically when the admin adds them."
                  />
                )}
              </>
            )}
          </>
        )}
      </main>
      {dialog === "project" && (
        <Modal
          title={editing ? "Edit project" : "Add a project"}
          subtitle="Project changes become visible to judges and guests immediately."
          onClose={() => setDialog(null)}
        >
          <form className="form" onSubmit={saveProject}>
            <div className="field">
              <label htmlFor="project-name">Project name</label>
              <input
                id="project-name"
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
                maxLength={120}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="project-description">Description</label>
              <textarea
                id="project-description"
                value={draft.description}
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
                placeholder="What does this idea do?"
              />
            </div>
            <div className="field">
              <label htmlFor="project-members">Team members</label>
              <textarea
                id="project-members"
                value={draft.members}
                onChange={(event) =>
                  setDraft({ ...draft, members: event.target.value })
                }
                placeholder="One name per line, or separated by commas"
                required
              />
            </div>
            {draftError && <div className="form-error">{draftError}</div>}
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setDialog(null)}
              >
                Cancel
              </button>
              <button className="primary" disabled={dialogBusy}>
                {dialogBusy
                  ? "Saving…"
                  : editing
                    ? "Save changes"
                    : "Add project"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {dialog === "delete" && editing && (
        <Modal
          title="Delete this project?"
          subtitle={`“${editing.name}” and all its submitted scores will be removed permanently.`}
          onClose={() => setDialog(null)}
        >
          {draftError && <div className="form-error">{draftError}</div>}
          <div className="dialog-actions">
            <button className="secondary" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button
              className="danger"
              disabled={dialogBusy}
              onClick={deleteProject}
            >
              {dialogBusy ? "Deleting…" : "Delete project"}
            </button>
          </div>
        </Modal>
      )}
      {dialog === "score" && judgeProject && (
        <Modal
          title={editingScore ? "Edit score" : "Add score"}
          subtitle={judgeProject.name}
          onClose={() => setDialog(null)}
        >
          <form className="form" onSubmit={submitScore}>
            <div className="field">
              <label htmlFor="score-value">Numeric score</label>
              <input
                id="score-value"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={scoreInput}
                onChange={(event) => setScoreInput(event.target.value)}
                required
                autoFocus
              />
            </div>
            {scoreError && <div className="form-error">{scoreError}</div>}
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setDialog(null)}
              >
                Cancel
              </button>
              <button className="primary" disabled={dialogBusy}>
                {dialogBusy
                  ? "Saving…"
                  : editingScore
                    ? "Save score"
                    : "Add score"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {dialog === "delete-score" && deletingScore && (
        <Modal
          title="Delete this score?"
          subtitle={`Score ${deletingScore.value} will be removed from the project total.`}
          onClose={() => setDialog(null)}
        >
          {scoreError && <div className="form-error">{scoreError}</div>}
          <div className="dialog-actions">
            <button className="secondary" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button
              className="danger"
              disabled={dialogBusy}
              onClick={deleteScore}
            >
              {dialogBusy ? "Deleting…" : "Delete score"}
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function GuestDetail({
  project,
  judges,
  scores,
  totals,
  back,
}: {
  project: Project;
  judges: Profile[];
  scores: PublishedScore[];
  totals: PublishedTotal[];
  back: () => void;
}) {
  const total = totals.find((item) => item.project_id === project.id);
  return (
    <>
      <button className="back" onClick={back}>
        <ArrowLeft size={17} /> Back to all projects
      </button>
      <div className="headline-row">
        <div>
          <div className="section-kicker">Project spotlight</div>
          <h1>{project.name}</h1>
          <p className="lede">
            {project.description || "The team is ready to pitch."}
          </p>
        </div>
        <Badge
          kind={
            total || scores.some((item) => item.project_id === project.id)
              ? "live"
              : "locked"
          }
        >
          {total || scores.some((item) => item.project_id === project.id)
            ? "Reveal in progress"
            : "Scores locked"}
        </Badge>
      </div>
      <div className="detail-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>The judging panel</h2>
              <p className="subcopy">
                Each judge's scores appear when the admin reveals them.
              </p>
            </div>
            <Eye color="#ffd460" size={23} />
          </div>
          {judges.length ? (
            <div className="score-list">
              {judges.map((judge) => {
                const judgeScores = scores.filter(
                  (item) =>
                    item.project_id === project.id &&
                    item.judge_id === judge.id,
                );
                return (
                  <div className="score-row" key={judge.id}>
                    <div className="avatar">{initials(judge.display_name)}</div>
                    <div>
                      <div className="score-name">{judge.display_name}</div>
                      <div className="score-state">
                        {judgeScores.length
                          ? `${judgeScores.length} score${judgeScores.length === 1 ? "" : "s"} revealed`
                          : "Scores locked"}
                      </div>
                    </div>
                    <div
                      className={
                        "score-value " + (!judgeScores.length ? "hidden" : "")
                      }
                    >
                      {judgeScores.length ? (
                        judgeScores.map((score) => score.value).join(" + ")
                      ) : (
                        <>
                          <LockKeyhole size={13} /> LOCKED
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty
              title="The panel is forming"
              text="Judge names will appear after they register."
              icon={<Users size={22} />}
            />
          )}
        </section>
        <aside>
          <div className="total-panel">
            <div className="total-label">PROJECT TOTAL</div>
            <div className={"total-score " + (!total ? "hidden" : "")}>
              {total ? (
                total.value
              ) : (
                <>
                  <LockKeyhole size={23} /> LOCKED
                </>
              )}
            </div>
            <p className="total-note">
              {total
                ? "This is the sum of currently revealed judge scores."
                : "The total appears automatically when a judge's score is revealed."}
            </p>
          </div>
          <div className="mini-label">THE TEAM</div>
          <div className="members">
            {project.team_members.map((member, index) => (
              <span className="member" key={index}>
                {member}
              </span>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
