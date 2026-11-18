import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, loadApiUrl, setToken, setUnauthorizedHandler, type User } from './api';
import { secure } from './storage';
import { updateWidgets } from './widgets';
import { clearWidgetSummary } from './widgets/data';

type AuthCtx = {
  user: User | null;
  ready: boolean;
  login: (u: string, p: string) => Promise<void>;
  register: (token: string, code: string, password: string) => Promise<void>;
  resetPassword: (token: string, code: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Profil (ism, rasm) yangilangach — kontekstdagi foydalanuvchini almashtirish */
  setUser: (u: User) => void;
};

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const logout = async () => {
    setToken(null);
    setUser(null);
    await secure.remove('token');
    await clearWidgetSummary().catch(() => {});
    updateWidgets();
  };

  useEffect(() => {
    setUnauthorizedHandler(() => void logout());
    (async () => {
      await loadApiUrl();
      const t = await secure.get('token');
      if (t) {
        setToken(t);
        try {
          setUser(await api.me());
        } catch (e: any) {
          // Server o'chiq bo'lsa ham sessiyani saqlab qolamiz; 401 bo'lsa handler chiqaradi
          if (e?.status === 0) setUser({ id: 0, phone: '' });
        }
      }
      setReady(true);
    })();
  }, []);

  const accept = async (r: { access_token: string; user: User }) => {
    setToken(r.access_token);
    await secure.set('token', r.access_token);
    setUser(r.user);
    updateWidgets(true);
  };

  return (
    <Ctx.Provider
      value={{
        user,
        ready,
        logout,
        setUser,
        login: async (u, p) => accept(await api.login(u.trim(), p)),
        register: async (token, code, p) => accept(await api.register(token, code.trim(), p)),
        resetPassword: async (token, code, p) => accept(await api.resetPassword(token, code.trim(), p)),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
