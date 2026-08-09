"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Modo = "oscuro" | "claro";
const CLAVE = "zen-tema";
const C = createContext<{ modo: Modo; alternar: () => void; fijar: (m: Modo) => void } | null>(null);

export function ProveedorTema({ children }: { children: ReactNode }) {
  const [modo, setModo] = useState<Modo>("oscuro");

  useEffect(() => {
    const guardado = window.localStorage.getItem(CLAVE) as Modo | null;
    if (guardado === "claro" || guardado === "oscuro") setModo(guardado);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-tema", modo);
    window.localStorage.setItem(CLAVE, modo);
  }, [modo]);

  return (
    <C.Provider value={{ modo, alternar: () => setModo((m) => (m === "oscuro" ? "claro" : "oscuro")), fijar: setModo }}>
      {children}
    </C.Provider>
  );
}

export function useTema() {
  const c = useContext(C);
  if (!c) throw new Error("useTema fuera del ProveedorTema");
  return c;
}
