"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { db, supabaseConfigurado } from "@/lib/supabase";

interface Ctx {
  usuario: User | null;
  cargando: boolean;
  hayNube: boolean;
  entrar: (email: string, pass: string) => Promise<void>;
  registrar: (email: string, pass: string, nombre: string) => Promise<string>;
  salir: () => Promise<void>;
}

const C = createContext<Ctx | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const c = db();
    if (!c) { setCargando(false); return; }
    c.auth.getUser().then(({ data }) => { setUsuario(data.user ?? null); setCargando(false); });
    const { data: sub } = c.auth.onAuthStateChange((_e, sesion) => {
      setUsuario(sesion?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const valor: Ctx = {
    usuario, cargando, hayNube: supabaseConfigurado,
    entrar: async (email, pass) => {
      const c = db(); if (!c) throw new Error("Supabase no está configurado.");
      const { error } = await c.auth.signInWithPassword({ email, password: pass });
      if (error) throw new Error(traducir(error.message));
    },
    registrar: async (email, pass, nombre) => {
      const c = db(); if (!c) throw new Error("Supabase no está configurado.");
      const { data, error } = await c.auth.signUp({
        email, password: pass, options: { data: { full_name: nombre } },
      });
      if (error) throw new Error(traducir(error.message));
      return data.session
        ? "Cuenta creada. Ya puedes empezar."
        : "Cuenta creada. Revisa tu correo para confirmar la dirección.";
    },
    salir: async () => { await db()?.auth.signOut(); },
  };

  return <C.Provider value={valor}>{children}</C.Provider>;
}

function traducir(m: string) {
  const t: Record<string, string> = {
    "Invalid login credentials": "Correo o contraseña incorrectos.",
    "User already registered": "Ya existe una cuenta con ese correo.",
    "Password should be at least 6 characters": "La contraseña debe tener al menos 6 caracteres.",
    "Email not confirmed": "Todavía no has confirmado el correo.",
  };
  return t[m] ?? m;
}

export function useSesion() {
  const c = useContext(C);
  if (!c) throw new Error("useSesion fuera del ProveedorSesion");
  return c;
}
