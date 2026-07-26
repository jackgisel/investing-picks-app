"use client";

import { createContext, useContext } from "react";

const AdminContext = createContext(false);

/**
 * Whether the signed-in user is an admin, resolved once server-side by
 * DashboardLayout and read by client pages.
 *
 * Presentation only — it decides whether a link to an ops surface is worth
 * showing, never whether that surface is allowed to render. The gate is
 * app/dashboard/ops/layout.tsx, which every ops page still goes through.
 */
export function DashboardAdminProvider({
  isAdmin,
  children,
}: {
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  return (
    <AdminContext.Provider value={isAdmin}>{children}</AdminContext.Provider>
  );
}

export function useIsAdmin(): boolean {
  return useContext(AdminContext);
}
