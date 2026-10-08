import React, { useState, useEffect } from 'react';
import { 
  X, 
  Lock, 
  KeyRound, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  AlertTriangle, 
  Save, 
  ShieldCheck, 
  Clock, 
  RefreshCw,
  Power,
  Plus,
  Eye,
  EyeOff,
  Database,
  FileCode,
  Copy,
  Download,
  Check,
  Sparkles,
  RotateCcw,
  SlidersHorizontal
} from 'lucide-react';
import { SystemSubscription, StoreSettings } from '../types';
import { 
  saveSubscription, 
  checkIsSubscriptionExpired,
  saveSettings,
  getStoredSettings
} from '../services/storeService';
import { 
  parseFirebaseConfigInput, 
  FirebaseAppletConfig 
} from '../services/firebaseConfigParser';
import { 
  getActiveFirebaseConfig, 
  saveActiveFirebaseConfig, 
  resetToDefaultFirebaseConfig, 
  isUsingCustomFirebaseConfig 
} from '../lib/firebase';
import defaultFirebaseConfig from '../../firebase-applet-config.json';

const MASTER_PASSWORD = 'xT7$mQ2!vB9#';

interface MasterAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: SystemSubscription;
  settings?: StoreSettings;
  onSettingsUpdated?: (settings: StoreSettings) => void;
}

export const MasterAdminModal: React.FC<MasterAdminModalProps> = ({
  isOpen,
  onClose,
  subscription,
  settings,
  onSettingsUpdated,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Active Tab: 'subscription' | 'pet_mode' | 'database'
  const [activeTab, setActiveTab] = useState<'subscription' | 'pet_mode' | 'database'>('subscription');
  
  // Settings & Pet Mode State
  const [currentSettings, setCurrentSettings] = useState<StoreSettings>(() => settings || getStoredSettings());
  const [isSavingPetMode, setIsSavingPetMode] = useState(false);
  const [petSuccessMsg, setPetSuccessMsg] = useState('');
  
  // Subscription Form values
  const [monthlyFee, setMonthlyFee] = useState<number>(subscription.monthlyFee || 150);
  const [startDate, setStartDate] = useState<string>(subscription.startDate || new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState<string>(subscription.dueDate || new Date().toISOString().split('T')[0]);
  const [isExpiredManual, setIsExpiredManual] = useState<boolean>(subscription.isExpiredManualOverride || false);
  const [notes, setNotes] = useState<string>(subscription.notes || '');

  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Database (Firebase) Config values
  const [dbInputText, setDbInputText] = useState('');
  const [parsedConfig, setParsedConfig] = useState<FirebaseAppletConfig | null>(null);
  const [formattedJsonOutput, setFormattedJsonOutput] = useState('');
  const [parseError, setParseError] = useState('');
  const [isSavingDb, setIsSavingDb] = useState(false);
  const [dbSuccessMsg, setDbSuccessMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<FirebaseAppletConfig>(getActiveFirebaseConfig());
  const [hasCustomDb, setHasCustomDb] = useState<boolean>(isUsingCustomFirebaseConfig());

  // Sync state when props update
  useEffect(() => {
    if (subscription) {
      setMonthlyFee(subscription.monthlyFee || 150);
      setStartDate(subscription.startDate || new Date().toISOString().split('T')[0]);
      setDueDate(subscription.dueDate || new Date().toISOString().split('T')[0]);
      setIsExpiredManual(subscription.isExpiredManualOverride || false);
      setNotes(subscription.notes || '');
    }
    if (settings) {
      setCurrentSettings(settings);
    } else {
      setCurrentSettings(getStoredSettings());
    }
    if (isOpen) {
      setCurrentConfig(getActiveFirebaseConfig());
      setHasCustomDb(isUsingCustomFirebaseConfig());
    }
  }, [subscription, settings, isOpen]);

  // Handle parsing database config when input changes
  const handleDbInputChange = (text: string) => {
    setDbInputText(text);
    setDbSuccessMsg('');
    if (!text.trim()) {
      setParsedConfig(null);
      setFormattedJsonOutput('');
      setParseError('');
      return;
    }

    const result = parseFirebaseConfigInput(text);
    if (result.success && result.config && result.formattedJson) {
      setParsedConfig(result.config);
      setFormattedJsonOutput(result.formattedJson);
      setParseError('');
    } else {
      setParsedConfig(null);
      setFormattedJsonOutput('');
      setParseError(result.error || 'Formato inválido. Insira o objeto com apiKey, projectId, appId.');
    }
  };

  const handleFillSample = () => {
    const sample = `{\n  apiKey: "AIzaSyCWdj8oW7mBlIloEJdyXN3_N4btg203FlM",\n  authDomain: "lojabase1-9a4d4.firebaseapp.com",\n  projectId: "lojabase1-9a4d4",\n  storageBucket: "lojabase1-9a4d4.firebasestorage.app",\n  messagingSenderId: "1094336366479",\n  appId: "1:1094336366479:web:f7acb05482ccf71707adfa",\n  measurementId: "G-9L3Z7GYPQD"\n};`;
    handleDbInputChange(sample);
  };

  const handleCopyJson = () => {
    if (!formattedJsonOutput) return;
    navigator.clipboard.writeText(formattedJsonOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadJsonFile = () => {
    if (!formattedJsonOutput) return;
    const blob = new Blob([formattedJsonOutput], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'firebase-applet-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveDatabaseConfig = async () => {
    if (!parsedConfig) return;
    setIsSavingDb(true);
    setDbSuccessMsg('');

    try {
      // 1. Save to active localStorage so the browser uses it immediately
      saveActiveFirebaseConfig(parsedConfig);

      // 2. Attempt to save permanently to server file /firebase-applet-config.json
      let fileSavedOnDisk = false;
      try {
        const response = await fetch('/api/save-firebase-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsedConfig, null, 2),
        });
        if (response.ok) {
          fileSavedOnDisk = true;
        }
      } catch (e) {
        console.warn('File save API note:', e);
      }

      setCurrentConfig(parsedConfig);
      setHasCustomDb(true);
      setDbSuccessMsg(
        fileSavedOnDisk
          ? '✓ Sucesso! O arquivo firebase-applet-config.json foi atualizado no disco e o banco ativado!'
          : '✓ Sucesso! Configuração gravada e ativada no sistema!'
      );
    } catch (err: any) {
      setParseError(err.message || 'Erro ao salvar novo banco de dados.');
    } finally {
      setIsSavingDb(false);
    }
  };

  const handleRestoreDefaultDatabase = async () => {
    resetToDefaultFirebaseConfig();
    try {
      await fetch('/api/save-firebase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaultFirebaseConfig, null, 2),
      });
    } catch {}

    setCurrentConfig(defaultFirebaseConfig as FirebaseAppletConfig);
    setHasCustomDb(false);
    setDbInputText('');
    setParsedConfig(null);
    setFormattedJsonOutput('');
    setDbSuccessMsg('✓ Banco de dados padrão restaurado com sucesso!');
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  if (!isOpen) return null;

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput.trim() === MASTER_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError('');
      setPasswordInput('');
    } else {
      setPasswordError('Senha master incorreta. Acesso não autorizado.');
    }
  };

  // Helper to add days to due date
  const handleAddDays = (days: number) => {
    const baseDate = dueDate ? new Date(dueDate + 'T12:00:00') : new Date();
    // If already expired, advance from today
    const now = new Date();
    const effectiveBase = baseDate.getTime() < now.getTime() ? now : baseDate;
    
    effectiveBase.setDate(effectiveBase.getDate() + days);
    const newDueDate = effectiveBase.toISOString().split('T')[0];
    setDueDate(newDueDate);
    setIsExpiredManual(false); // remove manual lock
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSuccessMsg('');

    try {
      const updated: SystemSubscription = {
        ...subscription,
        monthlyFee: Number(monthlyFee) || 0,
        startDate,
        dueDate,
        isExpiredManualOverride: isExpiredManual,
        notes,
        updatedAt: new Date().toISOString(),
      };

      await saveSubscription(updated);
      setSuccessMsg('✓ Dados da assinatura e vencimento salvos com sucesso!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error('Error saving subscription:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate preview status with current form dates
  const previewExpired = checkIsSubscriptionExpired({
    id: 'preview',
    monthlyFee,
    startDate,
    dueDate,
    isExpiredManualOverride: isExpiredManual,
  });

  const isPetModeDisabled = Boolean(currentSettings.disablePetMode || currentSettings.hidePetFilters);

  const handleTogglePetMode = async () => {
    setIsSavingPetMode(true);
    setPetSuccessMsg('');
    try {
      const nextValue = !isPetModeDisabled;
      const updated: StoreSettings = {
        ...currentSettings,
        disablePetMode: nextValue,
        hidePetFilters: nextValue,
      };
      setCurrentSettings(updated);
      await saveSettings(updated);
      if (onSettingsUpdated) {
        onSettingsUpdated(updated);
      }
      setPetSuccessMsg(
        nextValue
          ? '✓ Modo Pet desabilitado com sucesso! A opção "Tipo de Pet" foi ocultada na Área do Lojista, os filtros por animais foram removidos da página inicial e o informativo de ração a granel foi ocultado.'
          : '✓ Modo Pet reativado com sucesso! As opções de pet, filtros e informativos voltaram a ficar visíveis.'
      );
      setTimeout(() => setPetSuccessMsg(''), 5000);
    } catch (err) {
      console.error('Error toggling pet mode:', err);
    } finally {
      setIsSavingPetMode(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-stone-950/85 backdrop-blur-md animate-in fade-in overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col my-auto animate-in zoom-in-95 max-h-[92vh]">
        
        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-stone-900 text-white flex items-center justify-between border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">Painel Master do Administrador</h3>
              <p className="text-[11px] text-stone-400">Mensalidade, Desabilitar Modo Pet e Banco de Dados</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Lock Screen if Not Authenticated */}
        {!isAuthenticated ? (
          <div className="p-6 sm:p-8 text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 mx-auto flex items-center justify-center">
              <KeyRound className="w-7 h-7" />
            </div>

            <div>
              <h4 className="font-extrabold text-stone-900 text-lg">Acesso Restrito do Administrador</h4>
              <p className="text-xs text-stone-500 mt-1">
                Digite a senha master para gerenciar a mensalidade e a configuração do banco de dados.
              </p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-3.5 max-w-xs mx-auto">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite a senha master"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full text-center py-3 pl-4 pr-10 rounded-xl border border-stone-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-sm font-bold outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1"
                  tabIndex={-1}
                  title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {passwordError && (
                <p className="text-xs font-bold text-rose-600 animate-in fade-in">{passwordError}</p>
              )}

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-md shadow-blue-700/20 active:scale-98"
              >
                Acessar Painel Master
              </button>
            </form>
          </div>
        ) : (
          /* Master Admin Management Form */
          <div className="flex flex-col flex-1 overflow-hidden">
            
            {/* Tab Navigation */}
            <div className="bg-stone-50 border-b border-stone-200 px-4 sm:px-6 pt-3 flex gap-2 shrink-0 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveTab('subscription')}
                className={`pb-3 px-3 text-xs font-extrabold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
                  activeTab === 'subscription'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Assinatura & Vencimento</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('pet_mode')}
                className={`pb-3 px-3 text-xs font-extrabold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
                  activeTab === 'pet_mode'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Desabilitar Modo Pet</span>
                {isPetModeDisabled ? (
                  <span className="text-[10px] bg-amber-100 text-amber-900 font-extrabold px-1.5 py-0.2 rounded-full border border-amber-300">
                    Oculto
                  </span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('database')}
                className={`pb-3 px-3 text-xs font-extrabold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
                  activeTab === 'database'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                <Database className="w-4 h-4" />
                <span>Banco de Dados (Firebase)</span>
                {hasCustomDb && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                )}
              </button>
            </div>

            {/* Content Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
              
              {/* TAB 1: ASSINATURA & VENCIMENTO */}
              {activeTab === 'subscription' && (
                <div className="space-y-5">
                  {/* Live Status Banner */}
                  <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                    previewExpired.isExpired 
                      ? 'bg-rose-50 border-rose-200 text-rose-900' 
                      : 'bg-blue-50 border-blue-200 text-blue-900'
                  }`}>
                    {previewExpired.isExpired ? (
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <span className="font-extrabold text-xs uppercase tracking-wider block">
                        Status Atual do Site:
                      </span>
                      <p className="font-extrabold text-sm sm:text-base mt-0.5">
                        {previewExpired.isExpired 
                          ? '⛔ SITE BLOQUEADO / EXPIRADO' 
                          : '✅ SITE ATIVO & LIBERADO'}
                      </p>
                      <p className="text-xs mt-1 text-stone-600">
                        {previewExpired.isExpired
                          ? 'Os clientes estão vendo a tela de "Página expirada". Atualize a data de vencimento abaixo para reativar o site imediatamente.'
                          : `Vencimento programado para ${previewExpired.formattedDueDate} (${previewExpired.daysRemaining} dias restantes).`}
                      </p>
                    </div>
                  </div>

                  {successMsg && (
                    <div className="p-3 bg-blue-100 border border-blue-300 text-blue-900 text-xs font-bold rounded-xl flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  {/* Subscription Form Inputs */}
                  <div className="space-y-4">
                    {/* Valor Mensal */}
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1 flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-stone-500" />
                        <span>Valor Mensal (R$):</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={monthlyFee}
                          onChange={(e) => setMonthlyFee(parseFloat(e.target.value) || 0)}
                          placeholder="150.00"
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-300 text-sm font-bold text-stone-900 bg-white outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Datas: Início e Vencimento */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1 flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-stone-500" />
                          <span>Data de Início:</span>
                        </label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-800 bg-white outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-stone-700 mb-1 flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-stone-500" />
                          <span>Data de Vencimento:</span>
                        </label>
                        <input
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-800 bg-white outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {/* Botões de Ação Rápida de Renovação */}
                    <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
                      <span className="text-[11px] font-extrabold text-stone-600 uppercase tracking-wider block">
                        Renovação Rápida da Assinatura:
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => handleAddDays(30)}
                          className="py-2 px-2 rounded-xl bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ 30 Dias</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddDays(60)}
                          className="py-2 px-2 rounded-xl bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ 60 Dias</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddDays(365)}
                          className="py-2 px-2 rounded-xl bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ 1 Ano</span>
                        </button>
                      </div>
                    </div>

                    {/* Opção Manual de Bloqueio/Teste */}
                    <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-stone-800 block">
                          Forçar Bloqueio Imediato (Manual)
                        </span>
                        <span className="text-[11px] text-stone-500 block">
                          Ative caso queira suspender o site mesmo antes da data de vencimento.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsExpiredManual(!isExpiredManual)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                          isExpiredManual
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                        }`}
                      >
                        {isExpiredManual ? 'Bloqueio Ativo' : 'Desativado'}
                      </button>
                    </div>

                    {/* Observações / Anotações */}
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        Observações Internas (Cliente / Contrato):
                      </label>
                      <textarea
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ex: Mensalidade paga via Pix referente ao mês de Outubro..."
                        className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs text-stone-800 bg-white outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Botão Salvar e Atualizar Site */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handleSave()}
                      disabled={isSaving}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3.5 px-4 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-700/25 active:scale-98 transition-all disabled:opacity-50"
                    >
                      {isSaving ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Salvando Alterações...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Salvar Dados & Reativar Site</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: DESABILITAR MODO PET */}
              {activeTab === 'pet_mode' && (
                <div className="space-y-5">
                  {/* Status do Modo Pet */}
                  <div className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                    isPetModeDisabled
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-blue-50 border-blue-200 text-blue-900'
                  }`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                      isPetModeDisabled ? 'bg-amber-500 text-stone-950' : 'bg-blue-600 text-white'
                    }`}>
                      {isPetModeDisabled ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-xs uppercase tracking-wider block">
                          Status do Catálogo:
                        </span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                          isPetModeDisabled 
                            ? 'bg-amber-200 text-amber-950 border border-amber-300' 
                            : 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                        }`}>
                          {isPetModeDisabled ? 'MODO PET DESABILITADO (OCULTO)' : 'MODO PET HABILITADO (ATIVO)'}
                        </span>
                      </div>
                      <p className="font-extrabold text-sm sm:text-base mt-1 text-stone-900">
                        {isPetModeDisabled
                          ? 'O Modo Pet está Desabilitado no Sistema'
                          : 'O Modo Pet está Ativo no Sistema'}
                      </p>
                      <p className="text-xs mt-1 text-stone-600 leading-relaxed">
                        {isPetModeDisabled
                          ? 'A opção "Tipo de Pet" foi ocultada da Área do Lojista, os filtros por animais foram removidos da página principal e o informativo de ração a granel por kg/reais foi ocultado em todos os modos de visualização.'
                          : 'O catálogo funciona como pet shop completo: exibe filtros de animais (cães, gatos, etc.), seleção de tipo de pet no cadastro do lojista e o informativo de ração a granel por kg ou reais.'}
                      </p>
                    </div>
                  </div>

                  {/* Mensagem de Confirmação */}
                  {petSuccessMsg && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-xl flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{petSuccessMsg}</span>
                    </div>
                  )}

                  {/* Card Principal de Ação - Botão Exclusivo do Administrador */}
                  <div className="p-5 bg-stone-50 border border-stone-200 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-extrabold text-stone-900 text-sm sm:text-base flex items-center gap-2">
                          <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                          <span>Configuração de Visualização</span>
                        </h4>
                        <p className="text-xs text-stone-500 mt-0.5">
                          Função exclusiva do administrador (não disponível na área do lojista).
                        </p>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleTogglePetMode}
                        disabled={isSavingPetMode}
                        className={`w-full py-4 px-5 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2.5 transition-all shadow-md active:scale-98 cursor-pointer ${
                          isPetModeDisabled
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-700/25'
                            : 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-700/25'
                        }`}
                      >
                        {isSavingPetMode ? (
                          <>
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            <span>Salvando Alteração...</span>
                          </>
                        ) : isPetModeDisabled ? (
                          <>
                            <Eye className="w-5 h-5" />
                            <span>Reativar Modo Pet</span>
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-5 h-5" />
                            <span>Desabilitar Modo Pet</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-stone-200 space-y-2.5 text-xs text-stone-700">
                      <p className="font-bold text-stone-900 text-xs uppercase tracking-wide">
                        Efeito imediato de "Desabilitar Modo Pet":
                      </p>
                      <ul className="space-y-2 list-none pl-0">
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold shrink-0">1.</span>
                          <span><strong>Oculta a opção "Tipo de Pet":</strong> No cadastro e edição de produtos dentro da Área do Lojista (os botões de Cães, Gatos, Pássaros, Peixes e Outros desaparecem).</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold shrink-0">2.</span>
                          <span><strong>Oculta os filtros na página principal:</strong> As opções de filtrar por animais no topo da tela inicial são removidas da visualização dos clientes.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold shrink-0">3.</span>
                          <span><strong>Oculta o informativo "Ração a Granel por Kg ou Reais":</strong> O banner promocional de ração a granel é ocultado em todos os modos de visualização (computador, tablet e celular).</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold shrink-0">4.</span>
                          <span><strong>Adapta o texto de atendimento:</strong> Altera o informativo de estoque para <em>"Fale com a gente, atenderemos em segundos! trabalhamos com a principais marcas do mercado em nosso estoque físico, com preços especiais"</em>.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-blue-600 font-bold shrink-0">5.</span>
                          <span><strong>Atualiza a barra de pesquisa:</strong> Altera a sugestão na busca da página principal para <em>"Pesquisar produtos..."</em>.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: BANCO DE DADOS (FIREBASE) */}
              {activeTab === 'database' && (
                <div className="space-y-5">
                  {/* Banner Informativo do Banco Conectado */}
                  <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-stone-800 flex items-center gap-1.5">
                        <Database className="w-4 h-4 text-blue-600" />
                        <span>Banco de Dados Conectado no Momento:</span>
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase ${
                        hasCustomDb ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-blue-100 text-blue-800 border border-blue-200'
                      }`}>
                        {hasCustomDb ? '✓ Banco Próprio Personalizado' : 'Banco Inicial da Loja'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                      <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                        <span className="text-[10px] text-stone-400 block font-bold">PROJECT ID</span>
                        <span className="font-mono font-bold text-stone-800 truncate block">{currentConfig.projectId}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-stone-200">
                        <span className="text-[10px] text-stone-400 block font-bold">FIRESTORE DATABASE ID</span>
                        <span className="font-mono font-bold text-stone-800 truncate block">
                          {currentConfig.firestoreDatabaseId || '(default)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Instruções */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-stone-800 flex items-center gap-1.5">
                        <span>Cole abaixo os dados do novo Firebase:</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleFillSample}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Inserir dados de exemplo (lojabase1-9a4d4)</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-stone-500">
                      Você pode colar diretamente o objeto JavaScript copiado do console do Firebase ou o JSON. O sistema converte automaticamente para a estrutura de <strong>firebase-applet-config.json</strong>.
                    </p>

                    <textarea
                      rows={6}
                      value={dbInputText}
                      onChange={(e) => handleDbInputChange(e.target.value)}
                      placeholder={`Cole aqui no formato:\n{\n  apiKey: "AIzaSy...",\n  authDomain: "lojabase1-9a4d4.firebaseapp.com",\n  projectId: "lojabase1-9a4d4",\n  storageBucket: "lojabase1-9a4d4.firebasestorage.app",\n  messagingSenderId: "1094336366479",\n  appId: "1:1094336366479:web:f7acb05482ccf71707adfa",\n  measurementId: "G-9L3Z7GYPQD"\n};`}
                      className="w-full p-3 rounded-xl border border-stone-300 font-mono text-xs bg-white text-stone-900 outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Parse Error Notification */}
                  {parseError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-2 animate-in fade-in">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{parseError}</span>
                    </div>
                  )}

                  {/* Database Save Success Notification */}
                  {dbSuccessMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{dbSuccessMsg}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="px-3 py-1 bg-emerald-700 text-white rounded-lg text-xs font-bold shrink-0 hover:bg-emerald-800"
                      >
                        Recarregar Loja Agora
                      </button>
                    </div>
                  )}

                  {/* Live Conversion Preview */}
                  {parsedConfig && formattedJsonOutput && (
                    <div className="space-y-2 p-3.5 bg-stone-900 text-white rounded-2xl border border-stone-800 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                          <Check className="w-4 h-4" />
                          <span>Convertido com Sucesso para firebase-applet-config.json:</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleCopyJson}
                            className="text-[11px] bg-stone-800 hover:bg-stone-700 text-stone-200 px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold transition-colors"
                          >
                            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copied ? 'Copiado!' : 'Copiar JSON'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleDownloadJsonFile}
                            className="text-[11px] bg-stone-800 hover:bg-stone-700 text-stone-200 px-2.5 py-1 rounded-lg flex items-center gap-1 font-semibold transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            <span>Baixar Arquivo</span>
                          </button>
                        </div>
                      </div>

                      <pre className="font-mono text-[11px] leading-relaxed text-stone-300 bg-stone-950 p-3 rounded-xl overflow-x-auto max-h-48 border border-stone-800">
                        {formattedJsonOutput}
                      </pre>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveDatabaseConfig}
                      disabled={!parsedConfig || isSavingDb}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-3.5 px-4 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-700/25 active:scale-98 transition-all disabled:opacity-40 disabled:pointer-events-none"
                    >
                      {isSavingDb ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Atualizando Banco de Dados...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Salvar no Arquivo firebase-applet-config.json & Ativar</span>
                        </>
                      )}
                    </button>

                    {hasCustomDb && (
                      <button
                        type="button"
                        onClick={handleRestoreDefaultDatabase}
                        className="w-full bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
                        <span>Restaurar Banco de Dados Padrão Original</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
