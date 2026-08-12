"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSesion } from "@/components/Sesion";
import Aparece from "@/components/efectos/Aparece";

export default function Entrar() {
  const { entrar, registrar, usuario, salir, hayNube } = useSesion();
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "registro">("entrar");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  if (!hayNube) {
    return (
      <div className="tarjeta mx-auto max-w-md p-6">
        <h1 className="serif text-xl">Sin conexión con la nube</h1>
        <p className="mt-2 text-sm text-suave">
          Faltan las variables de entorno de Supabase. La app sigue funcionando en modo local:
          tu progreso se guarda en este navegador.
        </p>
      </div>
    );
  }

  if (usuario) {
    return (
      <div className="tarjeta mx-auto max-w-md p-6">
        <h1 className="serif text-xl">Sesión iniciada</h1>
        <p className="mt-2 text-sm text-suave">{usuario.email}</p>
        <p className="mt-1 text-xs text-suave">
          Tu progreso, subrayados y anotaciones se guardan en tu cuenta.
        </p>
        <button
          onClick={async () => { await salir(); router.push("/"); }}
          className="mt-4 rounded-lg border border-borde px-4 py-2 text-sm text-suave hover:text-texto"
        >
          Cerrar sesión
        </button>
      </div>
    );
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setAviso(""); setOcupado(true);
    try {
      if (modo === "entrar") { await entrar(email, pass); router.push("/"); }
      else { setAviso(await registrar(email, pass, nombre)); }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo ha fallado.");
    } finally { setOcupado(false); }
  };

  return (
    <Aparece className="tarjeta mx-auto max-w-md p-6">
      <h1 className="serif text-2xl">{modo === "entrar" ? "Entrar" : "Crear cuenta"}</h1>
      <p className="mt-1 text-sm text-suave">
        Con una cuenta, tu progreso y tus anotaciones te siguen a cualquier dispositivo.
      </p>

      <form onSubmit={enviar} className="mt-5 space-y-3">
        {modo === "registro" && (
          <Campo etiqueta="Nombre" valor={nombre} cambiar={setNombre} tipo="text" requerido={false} />
        )}
        <Campo etiqueta="Correo" valor={email} cambiar={setEmail} tipo="email" />
        <Campo etiqueta="Contraseña" valor={pass} cambiar={setPass} tipo="password" />

        {error && <p className="rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p>}
        {aviso && <p className="rounded-lg border border-jade/40 bg-jade/10 px-3 py-2 text-sm text-jade">{aviso}</p>}

        <button
          type="submit" disabled={ocupado}
          className="zen-lustre w-full rounded-lg bg-jade px-4 py-2.5 text-sm font-medium text-tinta disabled:opacity-50"
        >
          {ocupado ? "Un momento…" : modo === "entrar" ? "Entrar" : "Crear cuenta"}
        </button>
      </form>

      <button
        onClick={() => { setModo(modo === "entrar" ? "registro" : "entrar"); setError(""); setAviso(""); }}
        className="mt-4 text-sm text-jade underline"
      >
        {modo === "entrar" ? "No tengo cuenta todavía" : "Ya tengo cuenta"}
      </button>
    </Aparece>
  );
}

function Campo({ etiqueta, valor, cambiar, tipo, requerido = true }: {
  etiqueta: string; valor: string; cambiar: (v: string) => void; tipo: string; requerido?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-suave">{etiqueta}</span>
      <input
        type={tipo} value={valor} required={requerido}
        onChange={(e) => cambiar(e.target.value)}
        className="mt-1 w-full rounded-lg border border-borde bg-tinta-2 px-3 py-2 text-sm"
      />
    </label>
  );
}
