"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient, useSession, signOut } from "@/lib/auth-client";
import { PRICING } from "@/lib/constants";
import {
  User,
  Lock,
  Bell,
  CreditCard,
  Check,
  AlertCircle,
  LogOut,
  Mail,
  Trash2,
} from "lucide-react";

type NotificationPrefs = {
  newPicks: boolean;
  weeklySummary: boolean;
  performanceAlerts: boolean;
  productUpdates: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  newPicks: true,
  weeklySummary: true,
  performanceAlerts: true,
  productUpdates: false,
};

type SubscriptionStatus =
  | "inactive"
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "canceled";

type Subscription = {
  status: SubscriptionStatus;
  paddleCustomerId: string | null;
  paddleSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
};

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  const user = session?.user;

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  if (sessionPending) {
    return (
      <div className="max-w-[760px]">
        <p className="font-mono text-[11px] text-text-dim animate-pulse">
          LOADING...
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-[760px]">
        <p className="font-sans text-[14px] text-text-muted">
          You need to be signed in to view settings.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[760px] space-y-12">
      {/* Header */}
      <div>
        <h1 className="font-sans text-xl font-bold">Settings</h1>
        <p className="font-sans text-[13px] text-text-dim mt-1">
          Manage your account, notifications, and subscription.
        </p>
      </div>

      {/* Account */}
      <Section
        label="ACCOUNT"
        title="Your account"
        description="Your name is shown on receipts and inside the dashboard. Your email is used to sign in."
        icon={User}
      >
        <ProfileForm
          initialName={user.name ?? ""}
          email={user.email ?? ""}
        />
      </Section>

      {/* Password */}
      <Section
        label="PASSWORD"
        title="Change password"
        description="Pick a new password at least 8 characters long. We'll keep you signed in on this device."
        icon={Lock}
      >
        <PasswordForm />
      </Section>

      {/* Notifications */}
      <Section
        label="NOTIFICATIONS"
        title="Email notifications"
        description="Choose which emails you want to receive. Changes save instantly."
        icon={Bell}
      >
        <NotificationsForm />
      </Section>

      {/* Subscription */}
      <Section
        label="SUBSCRIPTION"
        title="Plan & billing"
        description="You can cancel any time. Cancellation takes effect at the end of your current billing period."
        icon={CreditCard}
      >
        <SubscriptionPanel />
      </Section>

      {/* Danger zone */}
      <Section
        label="DANGER ZONE"
        title="Delete account"
        description="Permanently delete your account and all associated data. This cannot be undone."
        icon={Trash2}
      >
        <DeleteAccountPanel />
      </Section>

      {/* Sign out */}
      <div className="pt-4 border-t border-border">
        <button
          onClick={handleSignOut}
          className="font-mono text-[11px] text-text-dim hover:text-accent-red transition-colors flex items-center gap-2"
        >
          <LogOut size={12} />
          SIGN OUT OF THIS DEVICE
        </button>
      </div>
    </div>
  );
}

/* -------------------------- Section wrapper -------------------------- */

function Section({
  label,
  title,
  description,
  icon: Icon,
  children,
}: {
  label: string;
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-accent-green" />
        <p className="font-mono text-[10px] text-accent-green tracking-[2px]">
          {label}
        </p>
      </div>
      <h2 className="font-sans text-[18px] font-semibold mb-1">{title}</h2>
      <p className="font-sans text-[13px] text-text-muted mb-5 leading-relaxed max-w-[560px]">
        {description}
      </p>
      <div className="bg-bg-secondary border border-border p-6">{children}</div>
    </section>
  );
}

/* -------------------------- Profile form -------------------------- */

function ProfileForm({
  initialName,
  email,
}: {
  initialName: string;
  email: string;
}) {
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });

  // Sync if session updates from elsewhere
  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  const dirty = name.trim() !== initialName.trim();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setStatus({ kind: "saving" });
    try {
      const result = await authClient.updateUser({ name: name.trim() });
      if (result.error) {
        setStatus({
          kind: "error",
          message: result.error.message ?? "Could not update name",
        });
        return;
      }
      setStatus({ kind: "success", message: "Name updated" });
    } catch {
      setStatus({ kind: "error", message: "Something went wrong" });
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <FieldRow label="EMAIL">
        <div className="flex items-center gap-2 font-sans text-[14px] text-text-muted">
          <Mail size={14} className="text-text-dim" />
          {email}
        </div>
        <p className="font-sans text-[11px] text-text-dim mt-1.5">
          Email changes are not supported yet —{" "}
          <a
            href="mailto:hello@outpick.com"
            className="text-accent-green hover:underline"
          >
            contact support
          </a>{" "}
          if you need to update it.
        </p>
      </FieldRow>

      <FieldRow label="NAME">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-bg border border-border px-4 py-3 font-sans text-[14px] text-text placeholder:text-text-dim focus:outline-none focus:border-accent-green transition-colors"
          placeholder="Your name"
          maxLength={120}
        />
      </FieldRow>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!dirty || status.kind === "saving"}
          className="font-mono text-[11px] bg-accent-green text-black px-5 py-2.5 font-semibold tracking-wider hover:bg-accent-green-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status.kind === "saving" ? "SAVING..." : "SAVE NAME"}
        </button>
        <StatusMessage status={status} />
      </div>
    </form>
  );
}

/* -------------------------- Password form -------------------------- */

function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setStatus({ kind: "error", message: "New passwords do not match" });
      return;
    }
    if (newPassword.length < 8) {
      setStatus({
        kind: "error",
        message: "New password must be at least 8 characters",
      });
      return;
    }

    setStatus({ kind: "saving" });
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });
      if (result.error) {
        setStatus({
          kind: "error",
          message: result.error.message ?? "Could not change password",
        });
        return;
      }
      setStatus({ kind: "success", message: "Password updated" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setStatus({ kind: "error", message: "Something went wrong" });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FieldRow label="CURRENT PASSWORD">
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          className="w-full bg-bg border border-border px-4 py-3 font-sans text-[14px] text-text placeholder:text-text-dim focus:outline-none focus:border-accent-green transition-colors"
          placeholder="Current password"
          autoComplete="current-password"
        />
      </FieldRow>

      <FieldRow label="NEW PASSWORD">
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          className="w-full bg-bg border border-border px-4 py-3 font-sans text-[14px] text-text placeholder:text-text-dim focus:outline-none focus:border-accent-green transition-colors"
          placeholder="Min. 8 characters"
          autoComplete="new-password"
        />
      </FieldRow>

      <FieldRow label="CONFIRM NEW PASSWORD">
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          className="w-full bg-bg border border-border px-4 py-3 font-sans text-[14px] text-text placeholder:text-text-dim focus:outline-none focus:border-accent-green transition-colors"
          placeholder="Repeat new password"
          autoComplete="new-password"
        />
      </FieldRow>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={
            status.kind === "saving" ||
            !currentPassword ||
            !newPassword ||
            !confirmPassword
          }
          className="font-mono text-[11px] bg-accent-green text-black px-5 py-2.5 font-semibold tracking-wider hover:bg-accent-green-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status.kind === "saving" ? "UPDATING..." : "UPDATE PASSWORD"}
        </button>
        <StatusMessage status={status} />
      </div>
    </form>
  );
}

/* -------------------------- Notifications form (DB-backed) -------------------------- */

function NotificationsForm() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/preferences", { cache: "no-store" });
        if (!res.ok) throw new Error("fetch failed");
        const data = (await res.json()) as { preferences: NotificationPrefs };
        if (!cancelled && data.preferences) {
          setPrefs(data.preferences);
        }
      } catch {
        // Fall back to defaults silently — toggles still work optimistically.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function update<K extends keyof NotificationPrefs>(
    key: K,
    value: NotificationPrefs[K]
  ) {
    const previous = prefs;
    const optimistic = { ...prefs, [key]: value };
    setPrefs(optimistic);
    setStatus({ kind: "saving" });

    try {
      const res = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      if (!res.ok) throw new Error("save failed");
      const data = (await res.json()) as { preferences: NotificationPrefs };
      setPrefs(data.preferences);
      setStatus({ kind: "success", message: "Saved" });
    } catch {
      setPrefs(previous);
      setStatus({ kind: "error", message: "Could not save" });
    }
  }

  return (
    <div className="space-y-1">
      <Toggle
        label="New pick alerts"
        description="Email me as soon as a new pick is published. Twice a month."
        enabled={prefs.newPicks}
        onChange={(v) => update("newPicks", v)}
        disabled={!loaded}
      />
      <Toggle
        label="Weekly summary"
        description="A short Sunday digest of portfolio performance and any moves."
        enabled={prefs.weeklySummary}
        onChange={(v) => update("weeklySummary", v)}
        disabled={!loaded}
      />
      <Toggle
        label="Performance alerts"
        description="Heads-up when a position hits a major milestone or the portfolio enters a drawdown."
        enabled={prefs.performanceAlerts}
        onChange={(v) => update("performanceAlerts", v)}
        disabled={!loaded}
      />
      <Toggle
        label="Product updates"
        description="Occasional notes about new features and improvements. No marketing fluff."
        enabled={prefs.productUpdates}
        onChange={(v) => update("productUpdates", v)}
        disabled={!loaded}
      />

      <div className="pt-3 mt-2 border-t border-border flex items-center justify-end">
        <StatusMessage status={status} />
      </div>
    </div>
  );
}

function Toggle({
  label,
  description,
  enabled,
  onChange,
  disabled = false,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="font-sans text-[14px] font-semibold">{label}</p>
        <p className="font-sans text-[12px] text-text-muted mt-0.5 leading-relaxed">
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        onClick={() => onChange(!enabled)}
        disabled={disabled}
        className={`shrink-0 relative inline-flex h-6 w-11 items-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
          enabled ? "bg-accent-green" : "bg-bg-tertiary border border-border"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform transition-transform ${
            enabled ? "translate-x-6 bg-black" : "translate-x-1 bg-text-muted"
          }`}
        />
      </button>
    </div>
  );
}

/* -------------------------- Subscription (DB-backed) -------------------------- */

function SubscriptionPanel() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/subscription", { cache: "no-store" });
        if (!res.ok) throw new Error("fetch failed");
        const data = (await res.json()) as { subscription: Subscription };
        if (!cancelled) setSub(data.subscription);
      } catch {
        if (!cancelled) setSub(null);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const status = sub?.status ?? "inactive";
  const renewal = sub?.currentPeriodEnd
    ? formatDate(sub.currentPeriodEnd)
    : null;
  const canceledAt = sub?.canceledAt ? formatDate(sub.canceledAt) : null;
  const isActive = status === "active" || status === "trialing";

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-4 pb-5 border-b border-border">
        <div>
          <p className="font-mono text-[10px] text-text-dim tracking-[1.5px] mb-1">
            CURRENT PLAN
          </p>
          <p className="font-sans text-[16px] font-semibold">
            Outpick Membership
          </p>
          <p className="font-sans text-[12px] text-text-muted mt-0.5">
            Billed annually · cancel any time
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[20px] font-bold text-accent-green">
            {PRICING.label}
          </p>
        </div>
      </div>

      {/* Status row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] text-text-dim tracking-[1.5px] mb-1.5">
            STATUS
          </p>
          {!loaded ? (
            <p className="font-mono text-[11px] text-text-dim animate-pulse">
              LOADING...
            </p>
          ) : (
            <StatusBadge status={status} />
          )}
        </div>
        {loaded && renewal && (
          <div className="text-right">
            <p className="font-mono text-[10px] text-text-dim tracking-[1.5px] mb-1.5">
              {status === "canceled" ? "ACCESS UNTIL" : "RENEWS"}
            </p>
            <p className="font-mono text-[12px] font-semibold">{renewal}</p>
          </div>
        )}
      </div>

      {loaded && status === "canceled" && canceledAt && (
        <div className="bg-accent-red-soft/30 border border-accent-red/30 px-4 py-3">
          <p className="font-sans text-[12px] text-text-muted">
            Subscription canceled on{" "}
            <span className="text-text font-semibold">{canceledAt}</span>.
            You&apos;ll keep access until {renewal ?? "your billing period ends"}.
          </p>
        </div>
      )}

      {loaded && status === "past_due" && (
        <div className="bg-accent-red-soft/30 border border-accent-red/30 px-4 py-3">
          <p className="font-sans text-[12px] text-text-muted">
            Your last payment failed. Update your billing method to keep access.
          </p>
        </div>
      )}

      <div className="space-y-2.5 font-sans text-[13px] text-text-muted">
        <BulletRow text="A new high-conviction stock pick every two weeks" />
        <BulletRow text="Live portfolio with full position tracking" />
        <BulletRow text="Six-agent research notes and methodology access" />
        <BulletRow text="Performance vs S&P 500, no cherry-picking" />
      </div>

      <div className="pt-5 border-t border-border space-y-3">
        <p className="font-sans text-[13px] text-text-muted leading-relaxed">
          Need to update payment details, download an invoice, or cancel?
          We&apos;ll handle it personally — just send us a note and
          we&apos;ll get back to you the same business day.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="mailto:hello@outpick.com?subject=Subscription%20request"
            className="font-mono text-[11px] bg-accent-green text-black px-5 py-2.5 font-semibold tracking-wider hover:bg-accent-green-hover transition-colors inline-flex items-center gap-2"
          >
            <Mail size={12} />
            CONTACT BILLING
          </a>
          {isActive && (
            <a
              href="mailto:hello@outpick.com?subject=Cancel%20subscription"
              className="font-mono text-[11px] text-text-dim hover:text-accent-red transition-colors tracking-wider"
            >
              CANCEL SUBSCRIPTION
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const config: Record<
    SubscriptionStatus,
    { label: string; className: string }
  > = {
    active: {
      label: "ACTIVE",
      className: "bg-accent-green-soft text-accent-green",
    },
    trialing: {
      label: "TRIAL",
      className: "bg-accent-green-soft text-accent-green",
    },
    past_due: {
      label: "PAST DUE",
      className: "bg-accent-red-soft text-accent-red",
    },
    paused: {
      label: "PAUSED",
      className: "bg-bg-tertiary text-text-muted border border-border",
    },
    canceled: {
      label: "CANCELED",
      className: "bg-accent-red-soft text-accent-red",
    },
    inactive: {
      label: "NOT SUBSCRIBED",
      className: "bg-bg-tertiary text-text-muted border border-border",
    },
  };
  const { label, className } = config[status];
  return (
    <span
      className={`font-mono text-[10px] tracking-[1.5px] font-bold px-2.5 py-1 inline-block ${className}`}
    >
      {label}
    </span>
  );
}

function BulletRow({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Check size={13} className="text-accent-green shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

/* -------------------------- Delete account -------------------------- */

function DeleteAccountPanel() {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });

  async function handleRequestDelete() {
    setStatus({ kind: "saving" });
    try {
      const result = await authClient.deleteUser({
        callbackURL: "/",
      });
      if (result.error) {
        setStatus({
          kind: "error",
          message: result.error.message ?? "Could not start deletion",
        });
        return;
      }
      setStatus({
        kind: "success",
        message: "Check your inbox to confirm deletion",
      });
      setConfirming(false);
      setConfirmText("");
    } catch {
      setStatus({ kind: "error", message: "Something went wrong" });
    }
  }

  if (!confirming) {
    return (
      <div className="space-y-4">
        <p className="font-sans text-[13px] text-text-muted leading-relaxed">
          We&apos;ll send a confirmation link to your email. Account deletion
          only happens after you click that link, and the link expires after an
          hour.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setConfirming(true);
              setStatus({ kind: "idle" });
            }}
            className="font-mono text-[11px] border border-accent-red/40 text-accent-red bg-accent-red-soft/20 hover:bg-accent-red-soft/40 px-5 py-2.5 font-semibold tracking-wider transition-colors inline-flex items-center gap-2"
          >
            <Trash2 size={12} />
            DELETE ACCOUNT
          </button>
          <StatusMessage status={status} />
        </div>
      </div>
    );
  }

  const canConfirm = confirmText.trim().toUpperCase() === "DELETE";

  return (
    <div className="space-y-5">
      <div className="bg-accent-red-soft/30 border border-accent-red/30 px-4 py-3">
        <p className="font-sans text-[13px] text-text leading-relaxed">
          <strong>This will permanently delete your account.</strong> Your
          subscription will continue to bill until you cancel it separately —
          please contact billing first if you also want to cancel.
        </p>
      </div>

      <FieldRow label="TYPE 'DELETE' TO CONFIRM">
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="w-full bg-bg border border-border px-4 py-3 font-mono text-[14px] text-text placeholder:text-text-dim focus:outline-none focus:border-accent-red transition-colors"
          placeholder="DELETE"
          autoComplete="off"
        />
      </FieldRow>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleRequestDelete}
          disabled={!canConfirm || status.kind === "saving"}
          className="font-mono text-[11px] bg-accent-red text-white px-5 py-2.5 font-semibold tracking-wider hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {status.kind === "saving" ? "SENDING..." : "SEND CONFIRMATION EMAIL"}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setConfirmText("");
            setStatus({ kind: "idle" });
          }}
          className="font-mono text-[11px] text-text-dim hover:text-text tracking-wider transition-colors"
        >
          CANCEL
        </button>
        <StatusMessage status={status} />
      </div>
    </div>
  );
}

/* -------------------------- Shared form bits -------------------------- */

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="font-mono text-[10px] text-text-dim tracking-[1.5px] block mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}

type FormStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

function StatusMessage({ status }: { status: FormStatus }) {
  if (status.kind === "idle" || status.kind === "saving") return null;
  if (status.kind === "success") {
    return (
      <span className="font-mono text-[11px] text-accent-green flex items-center gap-1.5">
        <Check size={12} />
        {status.message}
      </span>
    );
  }
  return (
    <span className="font-mono text-[11px] text-accent-red flex items-center gap-1.5">
      <AlertCircle size={12} />
      {status.message}
    </span>
  );
}
