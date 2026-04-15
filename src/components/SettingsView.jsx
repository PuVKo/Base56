import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  GripVertical,
  LogOut,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ADDABLE_FIELD_TYPES } from '@/lib/fieldTypeMeta';
import { getFieldTypeMeta } from '@/lib/fieldTypeMeta';
import { fieldUsesOptionList, getFieldOptionItems } from '@/lib/fieldOptions';
import { NOTION_COLOR_KEYS, notionPillClasses } from '@/lib/notionColors';
import { newId } from '@/lib/id';
import { FIELD_ICON_CHOICES, iconComponentByKey } from '@/lib/fieldIcons';

/**
 * @param {{ currentUser: { id: string, email: string, login?: string | null, emailVerified?: boolean } | null, flushNow: () => Promise<void> }} props
 */
function ProfileAccountPanel({ currentUser, flushNow }) {
  const navigate = useNavigate();
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdSent, setPwdSent] = useState(false);

  async function sendPasswordResetEmail() {
    if (!currentUser?.email) return;
    setPwdBusy(true);
    try {
      await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: currentUser.email }),
      });
    } catch {
      /* как на странице сброса — не раскрываем детали */
    } finally {
      setPwdBusy(false);
      setPwdSent(true);
    }
  }

  async function logout() {
    await flushNow();
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    navigate('/login', { replace: true });
  }

  if (!currentUser) {
    return <p className="text-sm text-notion-muted">Не удалось загрузить данные профиля.</p>;
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-violet-500/20 bg-violet-950/20 px-4 py-3 flex items-start gap-3">
        <CreditCard className="w-5 h-5 text-violet-300/90 shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="text-sm font-medium text-white">Оплаты и подписка</p>
          <p className="text-xs text-notion-muted mt-1 leading-relaxed">
            Скоро здесь же появятся тарифы, счета и история платежей — следите за обновлениями.
          </p>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-white tracking-tight mb-4">Данные аккаунта</h2>
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-xs text-notion-muted mb-1">Почта</dt>
            <dd className="text-white break-all">{currentUser.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-notion-muted mb-1">Логин</dt>
            <dd className={`text-sm ${currentUser.login ? 'text-white font-mono' : 'text-notion-muted'}`}>
              {currentUser.login ?? 'не задан — вход по email'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-notion-muted mb-1">Почта подтверждена</dt>
            <dd className="text-white">{currentUser.emailVerified ? 'Да' : 'Нет'}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border border-notion-border bg-notion-surface/60 p-4">
        <h3 className="text-sm font-medium text-white mb-2">Смена пароля</h3>
        <p className="text-xs text-notion-muted mb-4 leading-relaxed">
          Отправим на эту почту письмо со ссылкой для установки нового пароля (как в разделе «Забыли пароль»).
        </p>
        <button
          type="button"
          disabled={pwdBusy || pwdSent}
          onClick={() => void sendPasswordResetEmail()}
          className="inline-flex items-center justify-center rounded-lg bg-white text-notion-bg px-4 py-2.5 text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          {pwdSent ? 'Письмо запрошено' : pwdBusy ? 'Отправка…' : 'Отправить письмо для смены пароля'}
        </button>
        {pwdSent ? (
          <p className="text-xs text-notion-muted mt-3 leading-relaxed">
            Если адрес совпадает с аккаунтом, проверьте входящие и папку «Спам». Ссылка действует ограниченное время.
          </p>
        ) : null}
      </section>

      <button
        type="button"
        onClick={() => void logout()}
        className="inline-flex items-center gap-2 text-sm text-notion-muted hover:text-white border border-notion-border rounded-lg px-3 py-2 transition-colors"
      >
        <LogOut className="w-4 h-4 shrink-0" />
        Выйти из аккаунта
      </button>
    </div>
  );
}

/**
 * @param {object} props
 * @param {any[]} props.fields
 * @param {() => Promise<void>} props.onFieldsChange
 * @param {() => Promise<void>} props.refreshBookings
 * @param {() => Promise<void>} [props.refreshClientUi]
 * @param {number} [props.bookingCount]
 * @param {(id: string, partial: Record<string, unknown>) => void} props.patchFieldLocal
 * @param {(body: { label: string, type: string, iconKey: string | null }) => string} props.createFieldLocal
 * @param {(id: string) => void} props.deleteFieldLocal
 * @param {(sorted: any[]) => void} props.reorderFieldsLocal
 * @param {() => Promise<void>} props.flushNow
 * @param {{ id: string, email: string, login?: string | null, emailVerified?: boolean } | null} [props.currentUser]
 * @param {'profile' | 'fields'} [props.settingsTab]
 * @param {(tab: 'profile' | 'fields') => void} [props.onSettingsTabChange]
 */
export function SettingsView({
  fields,
  onFieldsChange,
  refreshBookings,
  refreshClientUi,
  bookingCount = 0,
  patchFieldLocal,
  createFieldLocal,
  deleteFieldLocal,
  reorderFieldsLocal,
  flushNow,
  currentUser = null,
  settingsTab = 'fields',
  onSettingsTabChange = () => {},
}) {
  const navigate = useNavigate();
  const [msg, setMsg] = useState('');
  const [dumpYearKey, setDumpYearKey] = useState('');
  const [dumpBusy, setDumpBusy] = useState(false);
  const [dumpToast, setDumpToast] = useState(/** @type {{ message: string, variant: 'ok' | 'err' } | null} */ (null));
  const dumpToastTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const dumpImportRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const [resetBusy, setResetBusy] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [typeQuery, setTypeQuery] = useState('');
  const [nameModal, setNameModal] = useState(/** @type {{ type: string } | null} */ (null));
  const [newName, setNewName] = useState('');
  const [newIconKey, setNewIconKey] = useState('');
  const [newIconQuery, setNewIconQuery] = useState('');
  const [expandedId, setExpandedId] = useState(/** @type {string | null} */ (null));
  const [iconPickerId, setIconPickerId] = useState(/** @type {string | null} */ (null));
  const [iconQuery, setIconQuery] = useState('');
  const pickerRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  const sorted = useMemo(() => [...fields].sort((a, b) => a.sortOrder - b.sortOrder), [fields]);

  const dumpYearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 32 }, (_, i) => y - i);
  }, []);

  const DUMP_TOAST_MS = 5000;
  const DUMP_TOAST_LONG_MS = 9000;

  /**
   * @param {string} message
   * @param {'ok' | 'err'} [variant]
   * @param {number} [durationMs]
   */
  function showDumpToast(message, variant = 'ok', durationMs = DUMP_TOAST_MS) {
    if (dumpToastTimerRef.current) clearTimeout(dumpToastTimerRef.current);
    setDumpToast({ message, variant });
    dumpToastTimerRef.current = setTimeout(() => {
      setDumpToast(null);
      dumpToastTimerRef.current = null;
    }, durationMs);
  }

  useEffect(
    () => () => {
      if (dumpToastTimerRef.current) clearTimeout(dumpToastTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!resetConfirmOpen && !importConfirmOpen) return;
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (resetBusy || dumpBusy) return;
      setResetConfirmOpen(false);
      setImportConfirmOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [resetConfirmOpen, importConfirmOpen, resetBusy, dumpBusy]);

  async function exportDump() {
    setDumpBusy(true);
    setMsg('');
    try {
      const qs = dumpYearKey ? `?year=${encodeURIComponent(dumpYearKey)}` : '';
      const res = await fetch(`/api/admin/export-dump${qs}`, { method: 'GET', credentials: 'include' });
      if (!res.ok) throw new Error(res.statusText);
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `base56_dump${dumpYearKey ? `_${dumpYearKey}` : ''}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showDumpToast(
        dumpYearKey
          ? `Файл скачан. В выгрузку попали только записи за ${dumpYearKey} год — если за этот год заказов не было, в файле может не быть строк с заказами (остальные данные копии всё равно внутри файла).`
          : 'Файл скачан. В нём колонки вашей таблицы, все заказы и настройки плиток (фильтры и панель) из этой вкладки браузера — сохраните файл в надёжное место.',
        'ok',
        dumpYearKey ? DUMP_TOAST_LONG_MS : DUMP_TOAST_MS,
      );
    } catch (e) {
      showDumpToast(String(e?.message || e), 'err');
    } finally {
      setDumpBusy(false);
    }
  }

  function openImportConfirm() {
    const f = dumpImportRef.current?.files?.[0];
    if (!f) {
      showDumpToast('Выберите JSON-файл резервной копии.', 'err');
      return;
    }
    setImportConfirmOpen(true);
  }

  async function executeImportDump() {
    setImportConfirmOpen(false);
    try {
      await flushNow();
    } catch (e) {
      showDumpToast(String(e?.message || e), 'err');
      return;
    }
    await importDump();
  }

  async function importDump() {
    const f = dumpImportRef.current?.files?.[0];
    if (!f) {
      showDumpToast('Выберите JSON-файл резервной копии.', 'err');
      return;
    }
    setDumpBusy(true);
    setMsg('');
    try {
      const text = await f.text();
      const parsed = text ? JSON.parse(text) : null;
      const payload = {
        fields: parsed?.fields ?? [],
        bookings: parsed?.bookings ?? [],
        overwrite: true,
        clientUi: parsed?.clientUi,
      };
      const res = await apiFetch('/api/admin/import-dump', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await onFieldsChange();
      await refreshBookings();
      if (refreshClientUi) await refreshClientUi();
      const fieldsCount = Number(res.fields ?? 0);
      const n = Number(res.bookings ?? 0);
      const total = Number(res.bookingsInPayload ?? n);
      const gen = Number(res.bookingIdsGenerated ?? 0);
      const repl = Number(res.bookingIdsReplacedDueToConflict ?? 0);
      const parts = [
        `Импорт из файла завершён. В аккаунте сейчас ${fieldsCount} колонок в таблице заказа и ${n} записей в календаре (по данным из файла).`,
      ];
      if (total === 0) {
        parts.push(
          'В файле не было ни одной записи заказа — часто так бывает, если при выгрузке выбрали год без заказов или в резервной копии не сохранялись строки таблицы.',
        );
      } else {
        if (gen > 0) {
          parts.push(
            `У ${gen} записей в файле не было служебного номера — приложение присвоило новые номера; сами поля (дата, клиент, сумма и т.д.) не менялись.`,
          );
        }
        if (repl > 0) {
          parts.push(
            `У ${repl} записей номер совпадал с уже существующими в базе — чтобы ничего не затереть, им выданы новые номера, содержимое строк из файла сохранено.`,
          );
        }
      }
      const importMsg = parts.join(' ');
      showDumpToast(importMsg, 'ok', importMsg.length > 160 ? DUMP_TOAST_LONG_MS : DUMP_TOAST_MS);
    } catch (e) {
      showDumpToast(String(e?.message || e), 'err');
    } finally {
      setDumpBusy(false);
      if (dumpImportRef.current) dumpImportRef.current.value = '';
    }
  }

  useEffect(() => {
    function onDoc(e) {
      if (!pickerOpen || !pickerRef.current) return;
      if (!pickerRef.current.contains(/** @type {Node} */ (e.target))) {
        setPickerOpen(false);
        setTypeQuery('');
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [pickerOpen]);

  const filteredTypes = useMemo(() => {
    const q = typeQuery.trim().toLowerCase();
    if (!q) return ADDABLE_FIELD_TYPES;
    return ADDABLE_FIELD_TYPES.filter((t) => t.label.toLowerCase().includes(q));
  }, [typeQuery]);

  /**
   * @param {string} dragFieldId
   * @param {string} targetFieldId
   */
  function reorderAfterDrop(dragFieldId, targetFieldId) {
    if (!dragFieldId || dragFieldId === targetFieldId) return;
    const from = sorted.findIndex((f) => f.id === dragFieldId);
    if (from < 0) return;
    const next = [...sorted];
    const [item] = next.splice(from, 1);
    const to2 = next.findIndex((f) => f.id === targetFieldId);
    if (to2 < 0) return;
    next.splice(to2, 0, item);
    const withOrder = next.map((f, i) => ({ ...f, sortOrder: i }));
    reorderFieldsLocal(withOrder);
  }

  async function executeResetBookings() {
    setResetConfirmOpen(false);
    setResetBusy(true);
    setMsg('');
    try {
      await flushNow();
      const data = await apiFetch('/api/admin/reset-bookings', {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      });
      await refreshBookings();
      setMsg(`База заказов очищена. Удалено записей: ${data.deleted ?? 0}.`);
    } catch (e) {
      setMsg(String(e?.message || e));
    } finally {
      setResetBusy(false);
    }
  }

  function toggleVisible(f) {
    setMsg('');
    patchFieldLocal(f.id, { visible: !f.visible });
  }

  function updateLabel(f, newLabel) {
    const t = newLabel.trim();
    if (!t || t === f.label) return;
    setMsg('');
    patchFieldLocal(f.id, { label: t });
  }

  function updateIconKey(f, nextKey) {
    setMsg('');
    patchFieldLocal(f.id, { iconKey: nextKey || null });
  }

  function removeField(f) {
    if (f.system) return;
    if (!window.confirm(`Удалить свойство «${f.label}»?`)) return;
    if (expandedId === f.id) setExpandedId(null);
    setMsg('');
    deleteFieldLocal(f.id);
  }

  function submitNewField() {
    if (!nameModal) return;
    const t = newName.trim();
    if (!t) return;
    setMsg('');
    createFieldLocal({ label: t, type: nameModal.type, iconKey: newIconKey || null });
    setNameModal(null);
    setNewName('');
    setNewIconKey('');
    setNewIconQuery('');
    setPickerOpen(false);
    setTypeQuery('');
  }

  async function logout() {
    await flushNow();
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    navigate('/login', { replace: true });
  }

  return (
    <div className="max-w-xl mx-auto pb-16">
      <div className="flex gap-1 p-1 rounded-xl border border-notion-border bg-notion-surface/40 mb-8">
        <button
          type="button"
          onClick={() => onSettingsTabChange('fields')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            settingsTab === 'fields'
              ? 'bg-white/10 text-white shadow-sm'
              : 'text-notion-muted hover:bg-white/[0.04] hover:text-white'
          }`}
        >
          Свойства заказа
        </button>
        <button
          type="button"
          onClick={() => onSettingsTabChange('profile')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            settingsTab === 'profile'
              ? 'bg-white/10 text-white shadow-sm'
              : 'text-notion-muted hover:bg-white/[0.04] hover:text-white'
          }`}
        >
          Профиль
        </button>
      </div>

      {settingsTab === 'profile' ? (
        <ProfileAccountPanel currentUser={currentUser} flushNow={flushNow} />
      ) : (
        <>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white tracking-tight">Настройки приложения</h1>
        <p className="text-sm text-notion-muted mt-2 leading-relaxed">
          Здесь вы настраиваете поля в форме заказа. Ручка слева от строки — перетащите её, чтобы поменять порядок
          полей. По названию поля можно сменить подпись. У статуса, тегов и источника откройте «Варианты», чтобы
          задать или изменить список значений. Значок глаза убирает поле из формы (сами заказы при этом не удаляются).
          Внизу — выгрузка и загрузка резервной копии в файл, а также сброс всех заказов. Поле «Дата» удалить нельзя:
          без него не работает календарь.
        </p>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-4 inline-flex items-center gap-2 text-sm text-notion-muted hover:text-white border border-notion-border rounded-lg px-3 py-2 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Выйти из аккаунта
        </button>
      </div>

      {msg ? (
        <p className="text-sm text-rose-300 bg-rose-950/30 border border-rose-500/25 rounded-lg px-3 py-2 mb-6">
          {msg}
        </p>
      ) : null}

      <ul className="rounded-lg border border-notion-border/80 bg-notion-surface/80 overflow-hidden divide-y divide-notion-border/60">
        {sorted.map((f) => {
          const { Icon, label: typeLabel } = getFieldTypeMeta(f.type, f.key);
          const IconOverride = iconComponentByKey(f.iconKey);
          const RowIcon = IconOverride || Icon;
          const hasOpts = fieldUsesOptionList(f);
          const open = expandedId === f.id;
          const iconOpen = iconPickerId === f.id;
          return (
            <li key={f.id} className={!f.visible ? 'opacity-55' : ''}>
              <div
                className="flex items-start gap-1 sm:gap-2 py-2.5 pl-2 pr-2 sm:pr-3 hover:bg-white/[0.03]"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const dragFieldId = e.dataTransfer.getData('text/plain');
                  reorderAfterDrop(dragFieldId, f.id);
                }}
              >
                <button
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', f.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => {}}
                  className="p-1.5 mt-0.5 rounded text-notion-muted hover:text-white hover:bg-notion-hover cursor-grab active:cursor-grabbing touch-manipulation shrink-0"
                  aria-label="Перетащить"
                >
                  <GripVertical className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIconPickerId((cur) => (cur === f.id ? null : f.id))}
                  className="p-1.5 mt-0.5 -ml-1 rounded-md text-notion-muted/70 hover:bg-notion-hover hover:text-white shrink-0"
                  title="Значок"
                  aria-expanded={iconOpen}
                >
                  <RowIcon className="w-4 h-4" aria-hidden />
                </button>
                <div className="flex-1 min-w-0 pt-1">
                  <EditableLabel initial={f.label} onCommit={(t) => updateLabel(f, t)} />
                  <div className="text-[11px] text-notion-muted/70 mt-0.5 truncate">
                    {typeLabel}
                    {f.system ? ' · системное' : ''}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                  {hasOpts ? (
                    <button
                      type="button"
                      onClick={() => setExpandedId(open ? null : f.id)}
                      className="p-2 rounded-md text-notion-muted hover:bg-notion-hover hover:text-white"
                      title="Варианты"
                      aria-expanded={open}
                    >
                      {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => toggleVisible(f)}
                    className="p-2 rounded-md text-notion-muted hover:bg-notion-hover hover:text-white"
                    title={f.visible ? 'Скрыть в форме' : 'Показать'}
                  >
                    {f.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  {!f.system ? (
                    <button
                      type="button"
                      onClick={() => removeField(f)}
                      className="p-2 rounded-md text-rose-300/80 hover:bg-rose-950/40"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>
              </div>
              {iconOpen ? (
                <div className="px-3 pb-4 pl-11 sm:pl-12 bg-black/20 border-t border-notion-border/40">
                  <div className="flex items-center justify-between gap-2 pt-3 pb-2">
                    <p className="text-[11px] text-notion-muted/80">Значок</p>
                    <button
                      type="button"
                      onClick={() => {
                        void updateIconKey(f, '');
                        setIconPickerId(null);
                        setIconQuery('');
                      }}
                      className="text-[11px] text-notion-muted hover:text-white"
                      title="По типу"
                    >
                      По типу
                    </button>
                  </div>
                  <div className="rounded-lg border border-notion-border/80 bg-notion-bg/60 p-2.5 flex items-center gap-2 mb-3">
                    <RowIcon className="w-4 h-4 text-notion-muted/80 shrink-0" aria-hidden />
                    <span className="text-sm text-white/90 truncate">{f.label}</span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    <input
                      value={iconQuery}
                      onChange={(e) => setIconQuery(e.target.value)}
                      placeholder="Поиск значка…"
                      className="col-span-4 sm:col-span-6 w-full rounded-lg border border-notion-border/80 bg-notion-bg px-3 py-2 text-sm text-white placeholder:text-notion-muted/60 outline-none focus:ring-1 focus:ring-violet-500/50"
                    />
                    {FIELD_ICON_CHOICES.filter((c) => {
                      const q = iconQuery.trim().toLowerCase();
                      if (!q) return true;
                      return c.label.toLowerCase().includes(q) || c.key.toLowerCase().includes(q);
                    }).map((c) => {
                      const selected = typeof f.iconKey === 'string' && f.iconKey === c.key;
                      return (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => {
                            void updateIconKey(f, c.key);
                            setIconPickerId(null);
                            setIconQuery('');
                          }}
                          className={`flex items-center justify-center px-2 py-2 rounded-lg border transition-colors aspect-square ${
                            selected
                              ? 'border-violet-500/50 bg-violet-500/10 text-white'
                              : 'border-notion-border/80 text-notion-muted hover:bg-notion-hover hover:text-white'
                          }`}
                          title={c.label}
                          aria-label={c.label}
                        >
                          <c.Icon className="w-5 h-5" aria-hidden />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {open && hasOpts ? (
                <FieldOptionsPanel
                  field={f}
                  onOptionsCommit={(items) => patchFieldLocal(f.id, { options: { items } })}
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="relative mt-1" ref={pickerRef}>
        <button
          type="button"
          onClick={() => {
            setPickerOpen((v) => !v);
            setTypeQuery('');
          }}
          className="flex items-center gap-2 w-full text-left py-2.5 px-2 -mx-2 rounded-md text-sm text-notion-muted hover:bg-white/[0.04] hover:text-white transition-colors"
        >
          <Plus className="w-4 h-4 shrink-0" />
          Добавить свойство
        </button>
        {pickerOpen ? (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-notion-border bg-[#252525] shadow-2xl overflow-hidden max-h-80 flex flex-col">
            <div className="p-2 border-b border-notion-border/80 flex items-center gap-2">
              <Search className="w-4 h-4 text-notion-muted shrink-0" />
              <input
                autoFocus
                value={typeQuery}
                onChange={(e) => setTypeQuery(e.target.value)}
                placeholder="Поиск типа…"
                className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-notion-muted/60 outline-none"
              />
            </div>
            <ul className="overflow-y-auto py-1">
              {filteredTypes.map((t) => (
                <li key={t.value}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm text-white/90 hover:bg-white/[0.06]"
                    onClick={() => {
                      setPickerOpen(false);
                      setTypeQuery('');
                      setNameModal({ type: t.value });
                      setNewName('');
                      setNewIconKey('');
                      setNewIconQuery('');
                    }}
                  >
                    <t.Icon className="w-4 h-4 text-notion-muted shrink-0" />
                    {t.label}
                  </button>
                </li>
              ))}
              {filteredTypes.length === 0 ? (
                <li className="px-3 py-4 text-sm text-notion-muted text-center">Ничего не найдено</li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="mt-8 space-y-4">
        <div>
          <p className="text-sm text-white font-medium">Дамп данных</p>
          <p className="text-xs text-notion-muted mt-1 leading-relaxed">
            Здесь вы скачиваете или поднимаете резервную копию: заказы, колонки таблицы и настройки галереи в этом
            браузере. Файл лежит у вас на компьютере — им можно перенести данные на другое устройство или просто
            сохранить «на всякий случай».
          </p>
        </div>

        <div className="rounded-xl border border-violet-500/25 bg-violet-950/15 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-200">
              <Download className="w-4 h-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-sm font-medium text-white">Экспорт</p>
                <p className="text-xs text-notion-muted mt-1 leading-relaxed">
                  Сохраняет на диск файл JSON с вашей таблицей и заказами из этого браузера. В «Год в дампе»:
                  «Все» — полная копия; если выбрать год — в файл попадут только заказы с датой в этом году.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <label className="flex flex-col gap-1.5 text-xs text-notion-muted sm:max-w-[12rem]">
                  <span className="text-notion-muted/90">Год в дампе</span>
                  <select
                    value={dumpYearKey}
                    onChange={(e) => setDumpYearKey(e.target.value)}
                    disabled={dumpBusy}
                    className="rounded-md border border-notion-border bg-notion-bg px-2 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/50 w-full"
                  >
                    <option value="">Все</option>
                    {dumpYearOptions.map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={dumpBusy || resetBusy}
                  onClick={exportDump}
                  className="w-full sm:w-auto shrink-0 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-40"
                >
                  {dumpBusy ? 'Экспорт…' : 'Скачать JSON'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/15 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-200">
              <Upload className="w-4 h-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-sm font-medium text-white">Импорт</p>
                <p className="text-xs text-notion-muted mt-1 leading-relaxed">
                  Файл .json — тот, что скачивали здесь или на другом устройстве. После «Импортировать» откроется окно
                  подтверждения: при согласии все текущие заказы и колонки таблицы в аккаунте удаляются и полностью
                  заменяются данными из файла (как чистая установка из копии).
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  ref={dumpImportRef}
                  type="file"
                  accept=".json,application/json"
                  disabled={dumpBusy}
                  className="text-xs text-notion-muted w-full min-w-0 sm:flex-1 file:mr-2 file:rounded file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-xs file:text-white"
                />
                <button
                  type="button"
                  disabled={dumpBusy}
                  onClick={() => openImportConfirm()}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-40 shrink-0"
                >
                  {dumpBusy ? 'Импорт…' : 'Импортировать'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-rose-500/25 bg-rose-950/15 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-white font-medium">Очистить заказы</p>
              <p className="text-xs text-notion-muted mt-1 leading-relaxed">
                Навсегда удаляет все заказы в этом аккаунте; колонки таблицы не меняются.
              </p>
            </div>
            <button
              type="button"
              disabled={resetBusy}
              onClick={() => setResetConfirmOpen(true)}
              className="w-full sm:w-auto px-3 py-2 rounded-lg border border-rose-500/40 bg-rose-950/40 hover:bg-rose-900/50 text-rose-100 text-sm font-medium disabled:opacity-40 shrink-0"
            >
              {resetBusy ? 'Удаление…' : 'Стереть'}
            </button>
          </div>
        </div>
      </div>

      {nameModal ? (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-field-title"
        >
          <div className="w-full max-w-md rounded-xl border border-notion-border bg-notion-surface shadow-2xl p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 id="new-field-title" className="text-lg font-semibold text-white">
                Новое свойство
              </h2>
              <button
                type="button"
                onClick={() => setNameModal(null)}
                className="p-2 rounded-md text-notion-muted hover:bg-notion-hover hover:text-white"
                aria-label="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitNewField();
              }}
              className="space-y-4"
            >
              <label className="block">
                <span className="text-xs text-notion-muted uppercase tracking-wide">Название</span>
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-notion-border bg-notion-bg px-3 py-2 text-sm text-white"
                  placeholder="Например: Площадка"
                />
              </label>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-notion-muted uppercase tracking-wide">Значок</span>
                  <button
                    type="button"
                    onClick={() => setNewIconKey('')}
                    className="text-xs text-notion-muted hover:text-white"
                    title="Сбросить (по типу)"
                  >
                    По типу
                  </button>
                </div>
                <div className="rounded-lg border border-notion-border/80 bg-notion-bg/60 p-2.5 flex items-center gap-2">
                  {(() => {
                    const { Icon } = getFieldTypeMeta(nameModal.type, '');
                    const IconOverride = iconComponentByKey(newIconKey);
                    const PreviewIcon = IconOverride || Icon;
                    return <PreviewIcon className="w-4 h-4 text-notion-muted/80 shrink-0" aria-hidden />;
                  })()}
                  <span className="text-sm text-white/90 truncate">
                    {newName.trim() ? newName.trim() : 'Новое свойство'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={newIconQuery}
                    onChange={(e) => setNewIconQuery(e.target.value)}
                    placeholder="Поиск значка…"
                    className="col-span-2 w-full rounded-lg border border-notion-border/80 bg-notion-bg px-3 py-2 text-sm text-white placeholder:text-notion-muted/60 outline-none focus:ring-1 focus:ring-violet-500/50"
                  />
                  {FIELD_ICON_CHOICES.filter((c) => {
                    const q = newIconQuery.trim().toLowerCase();
                    if (!q) return true;
                    return c.label.toLowerCase().includes(q) || c.key.toLowerCase().includes(q);
                  }).map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setNewIconKey(c.key)}
                      className={`flex items-center justify-center px-2 py-2 rounded-lg border transition-colors aspect-square ${
                        newIconKey === c.key
                          ? 'border-violet-500/50 bg-violet-500/10 text-white'
                          : 'border-notion-border/80 text-notion-muted hover:bg-notion-hover hover:text-white'
                      }`}
                      title={c.label}
                      aria-label={c.label}
                    >
                      <c.Icon className="w-5 h-5" aria-hidden />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setNameModal(null)}
                  className="px-4 py-2 rounded-lg border border-notion-border text-sm text-notion-muted hover:bg-notion-hover hover:text-white"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim()}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium disabled:opacity-40"
                >
                  Создать
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
        </>
      )}

      {resetConfirmOpen ? (
        <div className="fixed inset-0 z-[105] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            aria-label="Закрыть подтверждение"
            disabled={resetBusy}
            onClick={() => {
              if (!resetBusy) setResetConfirmOpen(false);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-bookings-title"
            className="relative z-[1] w-full max-w-sm rounded-xl border border-rose-500/45 bg-[#252525] shadow-2xl p-4 ring-1 ring-black/40"
          >
            <h3 id="reset-bookings-title" className="text-sm font-semibold text-white">
              Удалить все заказы?
            </h3>
            <p className="text-xs text-notion-muted mt-2 leading-relaxed">
              Это нельзя отменить. Колонки таблицы и настройки полей останутся — удалятся только записи заказов в этом
              аккаунте.
            </p>
            <div className="mt-4 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                disabled={resetBusy}
                onClick={() => setResetConfirmOpen(false)}
                className="w-full sm:w-auto px-3 py-2 rounded-lg border border-notion-border text-sm text-notion-muted hover:bg-notion-hover hover:text-white disabled:opacity-40"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={resetBusy}
                onClick={() => void executeResetBookings()}
                className="w-full sm:w-auto px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium disabled:opacity-40"
              >
                {resetBusy ? 'Удаление…' : 'Да, удалить'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {importConfirmOpen ? (
        <div className="fixed inset-0 z-[106] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            aria-label="Закрыть подтверждение импорта"
            disabled={dumpBusy}
            onClick={() => {
              if (!dumpBusy) setImportConfirmOpen(false);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-dump-title"
            className="relative z-[1] w-full max-w-sm rounded-xl border border-emerald-500/45 bg-[#252525] shadow-2xl p-4 ring-1 ring-black/40"
          >
            <h3 id="import-dump-title" className="text-sm font-semibold text-white">
              Заменить данные из файла?
            </h3>
            <p className="text-xs text-notion-muted mt-2 leading-relaxed">
              Все текущие заказы и колонки таблицы в этом аккаунте будут удалены и заново созданы из выбранного
              JSON-файла. Отменить это действие будет нельзя.
            </p>
            <div className="mt-4 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                disabled={dumpBusy}
                onClick={() => setImportConfirmOpen(false)}
                className="w-full sm:w-auto px-3 py-2 rounded-lg border border-notion-border text-sm text-notion-muted hover:bg-notion-hover hover:text-white disabled:opacity-40"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={dumpBusy}
                onClick={() => void executeImportDump()}
                className="w-full sm:w-auto px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-40"
              >
                {dumpBusy ? 'Импорт…' : 'Да, заменить'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {dumpToast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed z-[100] bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-3 max-w-sm w-[min(22rem,calc(100vw-1.5rem))] md:bottom-6 md:right-6 pointer-events-none"
        >
          <div
            className={`pointer-events-auto max-h-[min(70vh,20rem)] overflow-y-auto rounded-xl border px-4 py-3 text-sm leading-snug shadow-2xl backdrop-blur-md ${
              dumpToast.variant === 'err'
                ? 'border-rose-500/40 bg-rose-950/95 text-rose-50'
                : 'border-emerald-500/40 bg-emerald-950/95 text-emerald-50'
            }`}
          >
            {dumpToast.message}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const FIELD_OPTIONS_SAVE_DEBOUNCE_MS = 450;

/**
 * @param {object} p
 * @param {any} p.field
 * @param {(items: any[]) => void} p.onOptionsCommit
 */
function FieldOptionsPanel({ field, onOptionsCommit }) {
  const [items, setItems] = useState(() => getFieldOptionItems(field));
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const skipNextRef = useRef(true);
  const lastCommittedRef = useRef('');
  const onCommitRef = useRef(onOptionsCommit);
  onCommitRef.current = onOptionsCommit;

  useEffect(() => {
    const initial = getFieldOptionItems(field);
    setItems(initial);
    skipNextRef.current = true;
    lastCommittedRef.current = JSON.stringify({ items: initial });
  }, [field.id]);

  function reorderOptions(fromId, toId) {
    if (fromId === toId) return;
    const from = items.findIndex((x) => x.id === fromId);
    const to = items.findIndex((x) => x.id === toId);
    if (from < 0 || to < 0) return;
    const next = [...items];
    const [row] = next.splice(from, 1);
    const to2 = next.findIndex((x) => x.id === toId);
    next.splice(to2, 0, row);
    setItems(next);
  }

  useEffect(() => {
    if (skipNextRef.current) {
      skipNextRef.current = false;
      return;
    }
    const json = JSON.stringify({ items });
    if (json === lastCommittedRef.current) return;
    const t = setTimeout(() => {
      const latest = itemsRef.current;
      const j = JSON.stringify({ items: latest });
      if (j === lastCommittedRef.current) return;
      lastCommittedRef.current = j;
      onCommitRef.current(latest);
    }, FIELD_OPTIONS_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [items]);

  useEffect(
    () => () => {
      const latest = itemsRef.current;
      const j = JSON.stringify({ items: latest });
      if (j === lastCommittedRef.current) return;
      lastCommittedRef.current = j;
      onCommitRef.current(latest);
    },
    [],
  );

  return (
    <div className="px-3 pb-4 pl-11 sm:pl-12 bg-black/20 border-t border-notion-border/40">
      <p className="text-[11px] text-notion-muted/80 pt-3 pb-2">Варианты (цвет метки)</p>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex items-center gap-2 py-1"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain');
              if (id) reorderOptions(id, it.id);
            }}
          >
            <button
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', it.id);
              }}
              onDragEnd={() => {}}
              className="p-1 rounded text-notion-muted hover:text-white cursor-grab active:cursor-grabbing shrink-0 touch-manipulation"
              aria-label="Перетащить вариант"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
            <span
              className={`text-xs px-2 py-1 rounded-md border shrink-0 max-w-[40%] truncate ${notionPillClasses(it.color)}`}
            >
              {it.label || '—'}
            </span>
            <input
              value={it.label}
              onChange={(e) =>
                setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, label: e.target.value } : x)))
              }
              className="flex-1 min-w-0 rounded-md border border-notion-border/80 bg-notion-bg px-2 py-1 text-sm text-white"
            />
            <select
              value={NOTION_COLOR_KEYS.includes(it.color) ? it.color : 'gray'}
              onChange={(e) =>
                setItems((prev) =>
                  prev.map((x) => (x.id === it.id ? { ...x, color: e.target.value } : x)),
                )
              }
              className="rounded-md border border-notion-border/80 bg-notion-bg px-1.5 py-1 text-xs text-white max-w-[6.5rem]"
            >
              {NOTION_COLOR_KEYS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={items.length <= 1}
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}
              className="p-1.5 rounded-md text-notion-muted hover:text-rose-300 hover:bg-rose-950/30 shrink-0 disabled:opacity-30"
              title="Удалить вариант"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        <button
          type="button"
          onClick={() =>
            setItems((prev) => [...prev, { id: newId(), label: `Вариант ${prev.length + 1}`, color: 'gray' }])
          }
          className="text-sm px-3 py-1.5 rounded-md border border-notion-border text-notion-muted hover:bg-notion-hover hover:text-white"
        >
          + Вариант
        </button>
      </div>
    </div>
  );
}

function EditableLabel({ initial, onCommit }) {
  const [val, setVal] = useState(initial);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setVal(initial);
  }, [initial, editing]);

  return editing ? (
    <input
      autoFocus
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        setEditing(false);
        onCommit(val);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setVal(initial);
          setEditing(false);
        }
      }}
      className="w-full rounded-md border border-violet-500/40 bg-notion-bg px-2 py-1 text-sm text-white font-medium"
    />
  ) : (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="text-left text-sm font-medium text-white hover:text-violet-200 w-full truncate"
    >
      {val}
    </button>
  );
}
