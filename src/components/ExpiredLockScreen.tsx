import React from 'react';
import { ShieldAlert, Lock, AlertCircle, KeyRound } from 'lucide-react';

interface ExpiredLockScreenProps {
  onOpenMasterAdmin: () => void;
}

export const ExpiredLockScreen: React.FC<ExpiredLockScreenProps> = ({
  onOpenMasterAdmin,
}) => {
  return (
    <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4 sm:p-6 text-stone-900 select-none">
      <div className="bg-white max-w-md w-full rounded-3xl p-6 sm:p-8 shadow-2xl border border-stone-200 text-center space-y-6 animate-in fade-in zoom-in-95">
        
        {/* Warning Icon Badge */}
        <div className="w-20 h-20 rounded-3xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center shadow-inner">
          <ShieldAlert className="w-10 h-10" />
        </div>

        {/* Message requested by user */}
        <div className="space-y-2">
          <span className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full inline-block">
            Aviso do Sistema
          </span>
          <h1 className="font-black text-2xl sm:text-3xl text-stone-900 tracking-tight">
            Página Expirada
          </h1>
          <p className="text-stone-600 text-sm sm:text-base font-semibold leading-relaxed max-w-sm mx-auto">
            Favor entrar em contato com o administrador.
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-stone-100 pt-2">
          {/* Only administrator access button as requested */}
          <button
            type="button"
            onClick={onOpenMasterAdmin}
            className="w-full bg-stone-900 hover:bg-stone-800 text-white font-extrabold py-3.5 px-5 rounded-2xl text-sm flex items-center justify-center gap-2.5 shadow-md shadow-stone-900/20 active:scale-98 transition-all"
          >
            <KeyRound className="w-4 h-4 text-amber-400" />
            <span>Acesso do Administrador</span>
          </button>
        </div>

        <p className="text-[11px] text-stone-400">
          Uso exclusivo para renovação e liberação do serviço.
        </p>

      </div>
    </div>
  );
};
