import type {
  AccessCodeRecord,
  ColorPair,
  Difficulty,
  FlowLevel,
  FlowPaths,
  LeaderboardEntry,
  UserProfile,
} from '../game/types';

const TOKEN_KEY = 'flow_arena_token';

export function getStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage failures
  }
}

async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    throw new Error('پەیوەندی بە سێرڤەر پچڕا، تکایە دووبارە هەوڵبدەرەوە.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'هەڵەیەک ڕوویدا لە پەیوەندی بە سێرڤەر.');
  }
  return data as T;
}

export async function joinWithCode(code: string, playerName: string): Promise<{
  token: string;
  user: UserProfile;
  leaderboard: LeaderboardEntry[];
}> {
  const result = await apiRequest<{ token: string; user: UserProfile; leaderboard: LeaderboardEntry[] }>(
    '/api/auth/join-code',
    {
      method: 'POST',
      body: JSON.stringify({ code, playerName }),
    }
  );
  setStoredToken(result.token);
  return result;
}

export async function loginAdmin(username: string, password: string): Promise<{
  token: string;
  user: UserProfile;
}> {
  const result = await apiRequest<{ token: string; user: UserProfile }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setStoredToken(result.token);
  return result;
}

export async function fetchMe(): Promise<{ user: UserProfile }> {
  return apiRequest<{ user: UserProfile }>('/api/auth/me');
}

export async function fetchLevels(): Promise<{ levels: FlowLevel[] }> {
  return apiRequest<{ levels: FlowLevel[] }>('/api/levels');
}

export async function fetchLeaderboard(): Promise<{ leaderboard: LeaderboardEntry[] }> {
  return apiRequest<{ leaderboard: LeaderboardEntry[] }>('/api/leaderboard');
}

export async function recordCompletion(payload: {
  levelId: string;
  moves: number;
  timeSec: number;
  hintsUsed: number;
}): Promise<{
  user: UserProfile;
  levels: FlowLevel[];
  leaderboard: LeaderboardEntry[];
  award: {
    stars: number;
    xpAwarded: number;
    isNewCompletion: boolean;
    isFirstGlobalClear: boolean;
    streak: number;
  };
}> {
  return apiRequest('/api/completions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createAdminLevel(payload: {
  title: string;
  difficulty: Difficulty;
  gridSize: number;
  pairs: ColorPair[];
  solutionPaths?: FlowPaths;
}): Promise<{ level: FlowLevel; levels: FlowLevel[] }> {
  return apiRequest('/api/admin/levels', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createAdminLevelBatch(payload: {
  difficulty: Difficulty | 'mixed';
  count: number;
}): Promise<{ addedCount: number; addedLevels: FlowLevel[]; levels: FlowLevel[] }> {
  return apiRequest('/api/admin/levels/batch', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAdminLevel(
  levelId: string,
  payload: { title?: string; difficulty?: Difficulty; isActive?: boolean }
): Promise<{ level: FlowLevel; levels: FlowLevel[] }> {
  return apiRequest(`/api/admin/levels/${encodeURIComponent(levelId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminLevel(levelId: string): Promise<{ levels: FlowLevel[] }> {
  return apiRequest(`/api/admin/levels/${encodeURIComponent(levelId)}`, {
    method: 'DELETE',
  });
}

export async function fetchAdminCodes(): Promise<{ codes: AccessCodeRecord[] }> {
  return apiRequest<{ codes: AccessCodeRecord[] }>('/api/admin/codes');
}

export async function createAdminCode(payload: {
  code?: string;
  label?: string;
}): Promise<{ codeRecord: AccessCodeRecord; codes: AccessCodeRecord[] }> {
  return apiRequest('/api/admin/codes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAdminCode(
  codeId: string,
  payload: { isActive?: boolean; label?: string }
): Promise<{ codeRecord: AccessCodeRecord; codes: AccessCodeRecord[] }> {
  return apiRequest(`/api/admin/codes/${encodeURIComponent(codeId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminCode(codeId: string): Promise<{ codes: AccessCodeRecord[] }> {
  return apiRequest(`/api/admin/codes/${encodeURIComponent(codeId)}`, {
    method: 'DELETE',
  });
}

export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean }> {
  return apiRequest('/api/admin/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
