"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient, useSession, signOut } from "@/lib/auth-client";
import { MEMBERSHIP_BENEFITS, PRICING } from "@/lib/constants";
import { isFoundersDealActive } from "@/lib/portfolio";
import {
  User,
  Bell,
  CreditCard,
  Check,
  AlertCircle,
  LogOut,
  Mail,
  MessageSquare,
  Trash2,
} from "lucide-react";
import { DisplayNameForm } from "@/components/comments/display-name-form";
import { requestBillingUrl, type BillingPath } from "@/lib/billing-client";
import { DataStateCard } from "@/components/ui/data-state";
import { Skeleton } from "@/components/ui/skeleton";

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
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "canceled"
  | "unpaid";

type Subscription = {
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
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
      <div className="page-measure space-y-3" role="status" aria-label="Loading settings">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-measure space-y-5">
        <h1 className="page-title">Settings</h1>
        <DataStateCard state="unauthenticated" />
      </div>
    );
  }

  return (
    <div className="page-measure space-y-8">
      {/* Header */}
      <div>
        <h1 className="page-title">Settings</h1>
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

      {/* Public identity — separate from the account name above, which is
          private and appears on receipts. */}
      <Section
        label="PUBLIC PROFILE"
        title="How you appear in discussions"
        description="Your display name and monogram are shown beside every comment you leave on research notes and blog posts. Set one before your first comment."
        icon={MessageSquare}
      >
        <DisplayNameForm userId={user.id} />
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
        <p className="panel-label">
          {label}
        </p>
      </div>
      <h2 className="font-sans text-[18px] font-semibold mb-1">{title}</h2>
      <p className="font-sans text-[13px] text-text-muted mb-5 leading-relaxed max-w-[560px]">
        {description}
      </p>
      <div className="data-card">{children}</div>
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
            href="mailto:hello@outpick.xyz"
            className="text-text font-semibold underline underline-offset-2 hover:opacity-70"
          >
            contact support
          </a>{" "}
          if you need to update it.
        </p>
      </FieldRow>

      <FieldRow label="NAME" htmlFor="settings-name">
        <input
          id="settings-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="field-input"
          placeholder="Your name"
          maxLength={120}
        />
      </FieldRow>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!dirty || status.kind === "saving"}
          className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status.kind === "saving" ? "Saving…" : "Save name"}
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
        description="Heads-up when a position crosses +50%, +100% or +200%, or the book falls 10% or more from its high."
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
        className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
          enabled ? "bg-accent-green" : "bg-bg-tertiary border border-border"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full transform transition-transform ${
            enabled ? "translate-x-6 bg-inverse" : "translate-x-1 bg-text-muted"
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
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      try {
        const checkoutSucceeded =
          new URLSearchParams(window.location.search).get("checkout") ===
          "success";
        const attempts = checkoutSucceeded ? 10 : 1;
        for (let attempt = 0; attempt < attempts && !cancelled; attempt++) {
          const res = await fetch("/api/me/subscription", { cache: "no-store" });
          if (!res.ok) throw new Error("fetch failed");
          const data = (await res.json()) as { subscription: Subscription };
          if (!cancelled) setSub(data.subscription);
          if (
            data.subscription.status === "active" ||
            data.subscription.status === "trialing" ||
            data.subscription.status === "past_due" ||
            !checkoutSucceeded
          ) {
            break;
          }
          await new Promise<void>((resolve) => {
            timeout = setTimeout(resolve, 1000);
          });
        }
      } catch {
        if (!cancelled) setSub(null);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  async function openBilling(path: BillingPath) {
    setBillingLoading(true);
    setBillingError(null);
    try {
      window.location.assign(await requestBillingUrl(path));
    } catch (error) {
      setBillingError(
        error instanceof Error ? error.message : "Billing could not be opened",
      );
      setBillingLoading(false);
    }
  }

  const status = sub?.status ?? "inactive";
  const renewal = sub?.currentPeriodEnd
    ? formatDate(sub.currentPeriodEnd)
    : null;
  const canceledAt = sub?.canceledAt ? formatDate(sub.canceledAt) : null;
  const isActive =
    status === "active" || status === "trialing" || status === "past_due";
  const foundersActive = isFoundersDealActive();

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-4 pb-5 border-b border-border">
        <div>
          <p className="field-label mb-1">
            CURRENT PLAN
          </p>
          <p className="font-sans text-[16px] font-semibold">
            Outpick Membership
          </p>
          <p className="font-sans text-[12px] text-text-muted mt-0.5">
            Billed annually via Stripe · plus applicable taxes · cancel any time
            {foundersActive && !isActive && (
              <> · Founders offer applied at checkout if eligible</>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[20px] font-bold text-accent-green">
            {foundersActive && !isActive
              ? `From ${PRICING.foundersLabel}`
              : PRICING.label}
          </p>
          {foundersActive && !isActive && (
            <p className="font-sans text-[11px] text-text-dim mt-0.5">
              First year if eligible · then {PRICING.label}
            </p>
          )}
        </div>
      </div>

      {/* Status row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="field-label mb-1.5">
            STATUS
          </p>
          {!loaded ? (
            <Skeleton className="h-5 w-24" />
          ) : (
            <StatusBadge status={status} />
          )}
        </div>
        {loaded && renewal && (
          <div className="text-right">
            <p className="field-label mb-1.5">
              {sub?.cancelAtPeriodEnd
                ? "CANCELS ON"
                : status === "canceled"
                  ? "ENDED"
                  : "RENEWS"}
            </p>
            <p className="font-mono text-[12px] font-semibold">{renewal}</p>
          </div>
        )}
      </div>

      {loaded && sub?.cancelAtPeriodEnd && (
        <div className="rounded-soft bg-accent-yellow/10 border border-accent-yellow/30 px-4 py-3">
          <p className="font-sans text-[12px] text-text-muted">
            Your membership is set to cancel on{" "}
            <span className="text-text font-semibold">
              {renewal ?? "the end of this billing period"}
            </span>
            . You keep full access until then.
          </p>
        </div>
      )}

      {loaded && status === "canceled" && canceledAt && (
        <div className="rounded-soft bg-accent-red-soft/30 border border-accent-red/30 px-4 py-3">
          <p className="font-sans text-[12px] text-text-muted">
            Subscription canceled on{" "}
            <span className="text-text font-semibold">{canceledAt}</span>.
          </p>
        </div>
      )}

      {loaded && status === "past_due" && (
        <div className="rounded-soft bg-accent-red-soft/30 border border-accent-red/30 px-4 py-3">
          <p className="font-sans text-[12px] text-text-muted">
            Your last payment failed. You still have access while Stripe retries
            the payment. Open billing to update your payment method.
          </p>
        </div>
      )}

      <div className="space-y-2.5 font-sans text-[13px] text-text-muted">
        {MEMBERSHIP_BENEFITS.map((text) => (
          <BulletRow key={text} text={text} />
        ))}
      </div>

      <div className="pt-5 border-t border-border space-y-3">
        <p className="font-sans text-[13px] text-text-muted leading-relaxed">
          {isActive
            ? "Update your payment method, download invoices, or cancel at the end of the current period in Stripe."
            : "Start an annual membership in secure Stripe Checkout."}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() =>
              void openBilling(
                isActive ? "/api/billing/portal" : "/api/billing/checkout",
              )
            }
            disabled={billingLoading}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CreditCard size={12} />
            {billingLoading
              ? "Opening…"
              : isActive
                ? "Manage billing"
                : "Start membership"}
          </button>
          {billingError && (
            <span className="font-sans text-[12px] text-accent-red">
              {billingError}
            </span>
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
    incomplete: {
      label: "INCOMPLETE",
      className: "bg-bg-tertiary text-text-muted border border-border",
    },
    incomplete_expired: {
      label: "INCOMPLETE",
      className: "bg-bg-tertiary text-text-muted border border-border",
    },
    unpaid: {
      label: "UNPAID",
      className: "bg-accent-red-soft text-accent-red",
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
            className="pill-outline !text-accent-red !border-accent-red/40 hover:!bg-accent-red hover:!text-inverse-fg inline-flex items-center gap-2"
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
      <div className="rounded-soft bg-accent-red-soft/30 border border-accent-red/30 px-4 py-3">
        <p className="font-sans text-[13px] text-text leading-relaxed">
          <strong>This will permanently delete your account.</strong> Your
          Stripe subscription is canceled automatically as part of deletion —
          you won&apos;t be billed again.
        </p>
      </div>

      <FieldRow label="TYPE 'DELETE' TO CONFIRM" htmlFor="settings-delete-confirm">
        <input
          id="settings-delete-confirm"
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="field-input font-mono focus:!border-accent-red"
          placeholder="DELETE"
          autoComplete="off"
        />
      </FieldRow>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleRequestDelete}
          disabled={!canConfirm || status.kind === "saving"}
          className="rounded-pill font-mono text-[11px] bg-accent-red text-inverse-fg px-5 py-2.5 font-semibold tracking-wider hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
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
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="field-label block mb-2">
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
