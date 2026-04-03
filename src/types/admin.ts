import type { Session, User } from "@supabase/supabase-js";

export type AdminProfile = {
  id: string;
  fullName: string;
  role: "admin" | "super_admin";
  isActive: boolean;
};

export type AdminSessionState = {
  session: Session;
  user: User;
  profile: AdminProfile;
};
