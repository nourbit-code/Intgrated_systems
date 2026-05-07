import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { apiRequest } from '@/utils/api';

type Role = 'receptionist' | 'lab-tech';
type UserProfile = {
  title: string;
  department: string;
  shift: string;
  workingDays: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  contactPhone: string;
  contactEmail?: string;
  emergencyContact?: string;
  address?: string;
  photoDataUrl?: string;
  notes?: string;
};
type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};
type ManagedUser = AuthUser & {
  password: string;
  active: boolean;
  username?: string;
  profile: UserProfile;
};
type LoginResult = { ok: true } | { ok: false; error: string };
type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: Role;
  active?: boolean;
  profile?: Partial<UserProfile>;
};

type AuthState = {
  role: Role | null;
  currentUser: AuthUser | null;
  users: ManagedUser[];
  login: (nextRole: Role) => void;
  loginWithCredentials: (email: string, password: string, expectedRole?: Role) => Promise<LoginResult>;
  logout: () => void;
  createUser: (input: CreateUserInput) => LoginResult;
  updateUser: (id: string, patch: Partial<Omit<ManagedUser, 'id'>>) => LoginResult;
  deleteUser: (id: string) => void;
  verifyUserManagementAccess: (password: string) => boolean;
  changeUserManagementPassword: (currentPassword: string, nextPassword: string) => LoginResult;
  getCurrentUserSignature: () => string;
  updateUserProfile: (id: string, patch: Partial<UserProfile>) => LoginResult;
  saveUserProfileDetails: (id: string, input: { name: string; role?: Role; profile: Partial<UserProfile> }) => LoginResult;
};

type ApiUser = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'LAB_TECH' | 'RECEPTIONIST';
  phone: string;
  is_active: boolean;
  job_title: string;
  department: string;
  shift: string;
  working_days: string;
  working_hours_start: string;
  working_hours_end: string;
  contact_phone: string;
  contact_email: string | null;
  emergency_contact: string;
  address: string;
  photo_data_url: string;
  notes: string;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

const STORAGE_KEY = 'clinic_role';
const SESSION_KEY = 'clinic_auth_session';
const USER_MGMT_PASSWORD_KEY = 'clinic_user_mgmt_password';

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function roleLabel(role: Role) {
  return role === 'lab-tech' ? 'Lab Technician' : 'Receptionist';
}

function firstName(fullName?: string) {
  return (fullName ?? '').trim().split(/\s+/)[0] ?? '';
}

function toFrontendRole(role: ApiUser['role']): Role {
  return role === 'LAB_TECH' ? 'lab-tech' : 'receptionist';
}

function toBackendRole(role: Role): ApiUser['role'] {
  return role === 'lab-tech' ? 'LAB_TECH' : 'RECEPTIONIST';
}

function defaultProfileForRole(role: Role): UserProfile {
  if (role === 'lab-tech') {
    return {
      title: 'Lab Technician',
      department: 'Laboratory',
      shift: 'Morning',
      workingDays: 'Sunday - Thursday',
      workingHoursStart: '08:00',
      workingHoursEnd: '16:00',
      contactPhone: '',
      contactEmail: '',
      emergencyContact: '',
      address: '',
      notes: '',
    };
  }
  return {
    title: 'Receptionist',
    department: 'Front Desk',
    shift: 'Morning',
    workingDays: 'Sunday - Thursday',
    workingHoursStart: '08:00',
    workingHoursEnd: '16:00',
    contactPhone: '',
    contactEmail: '',
    emergencyContact: '',
    address: '',
    notes: '',
  };
}

function sanitizeProfile(role: Role, profile?: Partial<UserProfile>): UserProfile {
  const base = defaultProfileForRole(role);
  return {
    ...base,
    ...profile,
    title: (profile?.title ?? base.title).trim(),
    department: (profile?.department ?? base.department).trim(),
    shift: (profile?.shift ?? base.shift).trim(),
    workingDays: (profile?.workingDays ?? base.workingDays).trim(),
    workingHoursStart: (profile?.workingHoursStart ?? base.workingHoursStart).trim(),
    workingHoursEnd: (profile?.workingHoursEnd ?? base.workingHoursEnd).trim(),
    contactPhone: (profile?.contactPhone ?? base.contactPhone).trim(),
    contactEmail: (profile?.contactEmail ?? base.contactEmail)?.trim() || undefined,
    emergencyContact: (profile?.emergencyContact ?? base.emergencyContact)?.trim() || undefined,
    address: (profile?.address ?? base.address)?.trim() || undefined,
    photoDataUrl: (profile?.photoDataUrl ?? base.photoDataUrl)?.trim() || undefined,
    notes: (profile?.notes ?? base.notes)?.trim() || undefined,
  };
}

function mapApiUser(user: ApiUser): ManagedUser {
  const role = toFrontendRole(user.role);
  const name = [user.first_name, user.last_name].join(' ').trim() || user.username;
  return {
    id: String(user.id),
    username: user.username,
    name,
    email: normalizeEmail(user.email),
    role,
    active: user.is_active,
    password: '',
    profile: sanitizeProfile(role, {
      title: user.job_title || defaultProfileForRole(role).title,
      department: user.department,
      shift: user.shift,
      workingDays: user.working_days,
      workingHoursStart: user.working_hours_start,
      workingHoursEnd: user.working_hours_end,
      contactPhone: user.contact_phone || user.phone,
      contactEmail: user.contact_email ?? undefined,
      emergencyContact: user.emergency_contact || undefined,
      address: user.address || undefined,
      photoDataUrl: user.photo_data_url || undefined,
      notes: user.notes || undefined,
    }),
  };
}

function toApiPatch(user: ManagedUser, patch?: Partial<Omit<ManagedUser, 'id'>>) {
  const nextRole = patch?.role ?? user.role;
  const nextProfile = sanitizeProfile(nextRole, {
    ...(user.profile ?? defaultProfileForRole(nextRole)),
    ...(patch?.profile ?? {}),
  });
  const fullName = (patch?.name ?? user.name).trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  const first = parts[0] ?? '';
  const last = parts.slice(1).join(' ');
  const username = patch?.username ?? user.username ?? normalizeEmail((patch?.email ?? user.email).split('@')[0]);

  return {
    username,
    email: normalizeEmail(patch?.email ?? user.email),
    first_name: first,
    last_name: last,
    role: toBackendRole(nextRole),
    phone: nextProfile.contactPhone || '',
    is_active: patch?.active ?? user.active,
    job_title: nextProfile.title,
    department: nextProfile.department,
    shift: nextProfile.shift,
    working_days: nextProfile.workingDays,
    working_hours_start: nextProfile.workingHoursStart,
    working_hours_end: nextProfile.workingHoursEnd,
    contact_phone: nextProfile.contactPhone,
    contact_email: nextProfile.contactEmail ?? null,
    emergency_contact: nextProfile.emergencyContact ?? '',
    address: nextProfile.address ?? '',
    photo_data_url: nextProfile.photoDataUrl ?? '',
    notes: nextProfile.notes ?? '',
    ...(patch?.password ? { password: patch.password } : {}),
  };
}

export function buildUserSignature(user?: AuthUser | null) {
  if (!user) return 'Unknown User';
  return `${user.name} (${roleLabel(user.role)} - ${user.id})`;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [role, setRole] = useState<Role | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [userManagementPassword, setUserManagementPassword] = useState('admin123');

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        const apiUsers = await apiRequest<ApiUser[]>('/api/v1/users/');
        if (cancelled) return;
        const mapped = apiUsers.map(mapApiUser);
        setUsers(mapped);

        if (Platform.OS === 'web') {
          const storedMgmtPassword = window.localStorage.getItem(USER_MGMT_PASSWORD_KEY);
          if (storedMgmtPassword?.trim()) {
            setUserManagementPassword(storedMgmtPassword.trim());
          }

          const storedSession = window.localStorage.getItem(SESSION_KEY);
          if (storedSession) {
            const session = JSON.parse(storedSession) as { userId?: string };
            const matched = mapped.find((user) => user.id === session.userId && user.active);
            if (matched) {
              setRole(matched.role);
              setCurrentUser({ id: matched.id, name: matched.name, email: matched.email, role: matched.role });
              return;
            }
          }

          const storedRole = window.localStorage.getItem(STORAGE_KEY) as Role | null;
          if (storedRole) {
            const matched = mapped.find((user) => user.role === storedRole && user.active);
            if (matched) {
              setRole(matched.role);
              setCurrentUser({ id: matched.id, name: matched.name, email: matched.email, role: matched.role });
              window.localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: matched.id }));
            } else {
              setRole(storedRole);
            }
          }
        }
      } catch {
        if (!cancelled) setUsers([]);
      }
    };
    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    window.localStorage.setItem(USER_MGMT_PASSWORD_KEY, userManagementPassword);
  }, [userManagementPassword]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (currentUser) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: currentUser.id }));
    } else {
      window.localStorage.removeItem(SESSION_KEY);
    }
  }, [currentUser]);

  const login = (nextRole: Role) => {
    const matched = users.find((user) => user.role === nextRole && user.active);
    setRole(nextRole);
    setCurrentUser(
      matched
        ? { id: matched.id, name: matched.name, email: matched.email, role: matched.role }
        : null
    );
    if (Platform.OS === 'web') {
      window.localStorage.setItem(STORAGE_KEY, nextRole);
      if (matched) {
        window.localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: matched.id }));
      }
    }
  };

  const loginWithCredentials: AuthState['loginWithCredentials'] = async (email, password, expectedRole) => {
    const normalizedEmail = normalizeEmail(email);
    const normalizedPassword = password.trim();
    if (!normalizedEmail || !normalizedPassword) {
      return { ok: false, error: 'Email and password are required.' };
    }

    try {
      const loggedIn = await apiRequest<ApiUser>('/api/v1/auth/login', {
        method: 'POST',
        body: { email: normalizedEmail, password: normalizedPassword },
      });
      const mapped = mapApiUser(loggedIn);
      if (expectedRole && mapped.role !== expectedRole) {
        return { ok: false, error: 'Invalid role for this account.' };
      }

      setUsers((prev) => {
        const exists = prev.some((entry) => entry.id === mapped.id);
        if (exists) {
          return prev.map((entry) => (entry.id === mapped.id ? mapped : entry));
        }
        return [mapped, ...prev];
      });

      setRole(mapped.role);
      setCurrentUser({ id: mapped.id, name: mapped.name, email: mapped.email, role: mapped.role });
      if (Platform.OS === 'web') {
        window.localStorage.setItem(STORAGE_KEY, mapped.role);
        window.localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: mapped.id }));
      }
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('Invalid credentials')) {
        return { ok: false, error: 'Invalid email or password.' };
      }
      return { ok: false, error: 'Login failed. Make sure backend server is running on http://127.0.0.1:8001.' };
    }
  };

  const logout = () => {
    setRole(null);
    setCurrentUser(null);
    void apiRequest('/api/v1/auth/logout', { method: 'POST' }).catch(() => {
      // ignore
    });
    if (Platform.OS === 'web') {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(SESSION_KEY);
    }
  };

  const createUser: AuthState['createUser'] = (input) => {
    const name = input.name.trim();
    const email = normalizeEmail(input.email);
    const password = input.password.trim();
    if (!name) return { ok: false, error: 'Name is required.' };
    if (!email || !email.includes('@')) return { ok: false, error: 'Valid email is required.' };
    if (!password) return { ok: false, error: 'Password is required.' };
    if (users.some((user) => user.email === email)) {
      return { ok: false, error: 'Email already exists.' };
    }

    const profile = sanitizeProfile(input.role, input.profile);
    const tempId = `temp-${Date.now()}`;
    const username = email.split('@')[0];
    const optimistic: ManagedUser = {
      id: tempId,
      username,
      name,
      email,
      password,
      role: input.role,
      active: input.active !== false,
      profile,
    };
    setUsers((prev) => [optimistic, ...prev]);

    const [first, ...rest] = name.split(/\s+/).filter(Boolean);
    void (async () => {
      try {
        const created = await apiRequest<ApiUser>('/api/v1/users/', {
          method: 'POST',
          body: {
            username: `${username}-${Date.now().toString().slice(-6)}`,
            email,
            first_name: first ?? '',
            last_name: rest.join(' '),
            role: toBackendRole(input.role),
            is_active: input.active !== false,
            phone: profile.contactPhone || '',
            job_title: profile.title,
            department: profile.department,
            shift: profile.shift,
            working_days: profile.workingDays,
            working_hours_start: profile.workingHoursStart,
            working_hours_end: profile.workingHoursEnd,
            contact_phone: profile.contactPhone || '',
            contact_email: profile.contactEmail || null,
            emergency_contact: profile.emergencyContact || '',
            address: profile.address || '',
            photo_data_url: profile.photoDataUrl || '',
            notes: profile.notes || '',
            password,
          },
        });
        const mapped = mapApiUser(created);
        setUsers((prev) => prev.map((entry) => (entry.id === tempId ? mapped : entry)));
      } catch {
        setUsers((prev) => prev.filter((entry) => entry.id !== tempId));
      }
    })();

    return { ok: true };
  };

  const updateUser: AuthState['updateUser'] = (id, patch) => {
    const existing = users.find((user) => user.id === id);
    if (!existing) return { ok: false, error: 'User not found.' };

    const nextName = patch.name === undefined ? existing.name : patch.name.trim();
    const nextEmail = patch.email === undefined ? existing.email : normalizeEmail(patch.email);
    const nextPassword = patch.password === undefined ? existing.password : patch.password.trim();
    const nextRole = patch.role ?? existing.role;
    const nextActive = patch.active ?? existing.active;
    const nextProfile = sanitizeProfile(nextRole, { ...existing.profile, ...patch.profile });

    if (!nextName) return { ok: false, error: 'Name is required.' };
    if (!nextEmail || !nextEmail.includes('@')) return { ok: false, error: 'Valid email is required.' };
    if (users.some((user) => user.id !== id && user.email === nextEmail)) {
      return { ok: false, error: 'Email already exists.' };
    }

    const optimistic: ManagedUser = {
      ...existing,
      ...patch,
      name: nextName,
      email: nextEmail,
      password: nextPassword || existing.password,
      role: nextRole,
      active: nextActive,
      profile: nextProfile,
    };
    setUsers((prev) => prev.map((user) => (user.id === id ? optimistic : user)));

    const numericId = Number(id);
    if (Number.isFinite(numericId)) {
      void apiRequest(`/api/v1/users/${numericId}/`, {
        method: 'PATCH',
        body: toApiPatch(existing, {
          ...patch,
          name: nextName,
          email: nextEmail,
          password: patch.password || undefined,
          role: nextRole,
          active: nextActive,
          profile: nextProfile,
        }),
      }).catch(() => {
        // optimistic update
      });
    }

    if (currentUser?.id === id) {
      if (!nextActive) {
        setRole(null);
        setCurrentUser(null);
      } else {
        setRole(nextRole);
        setCurrentUser({ id, name: nextName, email: nextEmail, role: nextRole });
      }
    }
    return { ok: true };
  };

  const deleteUser: AuthState['deleteUser'] = (id) => {
    setUsers((prev) => prev.filter((user) => user.id !== id));
    const numericId = Number(id);
    if (Number.isFinite(numericId)) {
      void apiRequest(`/api/v1/users/${numericId}/`, { method: 'DELETE' }).catch(() => {
        // ignore
      });
    }
    if (currentUser?.id === id) {
      setRole(null);
      setCurrentUser(null);
      if (Platform.OS === 'web') {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem(SESSION_KEY);
      }
    }
  };

  const verifyUserManagementAccess: AuthState['verifyUserManagementAccess'] = (password) => {
    return password.trim() === userManagementPassword;
  };

  const changeUserManagementPassword: AuthState['changeUserManagementPassword'] = (currentPassword, nextPassword) => {
    if (currentPassword.trim() !== userManagementPassword) {
      return { ok: false, error: 'Current management password is incorrect.' };
    }
    const next = nextPassword.trim();
    if (next.length < 4) {
      return { ok: false, error: 'New password must be at least 4 characters.' };
    }
    setUserManagementPassword(next);
    return { ok: true };
  };

  const getCurrentUserSignature: AuthState['getCurrentUserSignature'] = () => buildUserSignature(currentUser);

  const updateUserProfile: AuthState['updateUserProfile'] = (id, patch) => {
    const existing = users.find((user) => user.id === id);
    if (!existing) return { ok: false, error: 'User not found.' };
    const nextProfile = sanitizeProfile(existing.role, {
      ...(existing.profile ?? defaultProfileForRole(existing.role)),
      ...patch,
    });
    return updateUser(id, { profile: nextProfile });
  };

  const saveUserProfileDetails: AuthState['saveUserProfileDetails'] = (id, input) => {
    const existing = users.find((user) => user.id === id);
    if (!existing) return { ok: false, error: 'User not found.' };

    const nextName = input.name.trim();
    if (!nextName) return { ok: false, error: 'Name is required.' };

    const nextRole = input.role ?? existing.role;
    const nextProfile = sanitizeProfile(nextRole, {
      ...(existing.profile ?? defaultProfileForRole(nextRole)),
      ...input.profile,
    });

    return updateUser(id, {
      name: nextName,
      role: nextRole,
      profile: nextProfile,
    });
  };

  const value = useMemo(
    () => ({
      role,
      currentUser,
      users,
      login,
      loginWithCredentials,
      logout,
      createUser,
      updateUser,
      deleteUser,
      verifyUserManagementAccess,
      changeUserManagementPassword,
      getCurrentUserSignature,
      updateUserProfile,
      saveUserProfileDetails,
    }),
    [role, currentUser, users, userManagementPassword]
  );

  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export type { Role, AuthUser, ManagedUser, UserProfile };
export { roleLabel, firstName };

