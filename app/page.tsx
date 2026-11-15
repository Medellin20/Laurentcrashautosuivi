'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowRight, Check, Clock3, Copy, MapPin, Package, Plus, Search, Settings2, ShieldCheck, Truck, X, LockKeyhole, LogOut } from 'lucide-react';

type Shipment = {
  id: string; tracking_code: string; reference: string; customer_name: string; customer_phone: string | null;
  vehicle_label: string; origin: string; destination: string; current_status: string; eta: string | null;
  created_at: string; updated_at: string;
};
type Event = { id: string; shipment_id: string; title: string; location: string; description: string | null; occurred_at: string; is_completed: boolean; };

const demoShipment: Omit<Shipment, 'id' | 'created_at' | 'updated_at'> = {
  tracking_code: 'LC-2409-8472', reference: 'LC-8472', customer_name: 'Sophie Martin', customer_phone: '06 52 18 44 90',
  vehicle_label: 'Peugeot 208 — GR-214-LM', origin: 'Lyon, France', destination: 'Marseille, France', current_status: 'En route', eta: 'Aujourd’hui, 16:30',
};
const demoEvents: Omit<Event, 'id' | 'shipment_id'>[] = [
  { title: 'Livraison en cours', location: 'A7 — Valence', description: 'Votre véhicule est en route vers sa destination finale.', occurred_at: new Date().toISOString(), is_completed: false },
  { title: 'Véhicule pris en charge', location: 'Centre LC Laurent — Lyon', description: 'Le véhicule a été chargé et sécurisé par notre équipe.', occurred_at: new Date(Date.now() - 86400000).toISOString(), is_completed: true },
  { title: 'Dossier confirmé', location: 'Service logistique', description: 'Votre demande de transport a bien été enregistrée.', occurred_at: new Date(Date.now() - 172800000).toISOString(), is_completed: true },
];

const statusOptions = ['En préparation', 'Véhicule pris en charge', 'En route', 'Arrivé à destination', 'Livré'];
const formatDate = (value: string) => new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));

export function Home({ adminOnly = false }: { adminOnly?: boolean }) {
  const [view, setView] = useState<'track' | 'admin'>('track');
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [trackingCode, setTrackingCode] = useState('');
  const [selected, setSelected] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(!adminOnly);
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [newForm, setNewForm] = useState({ reference: '', customer_name: '', vehicle_label: '', origin: '', destination: '', eta: '' });

  const loadData = async () => {
    setLoading(true);
    const [{ data: shipmentRows }, { data: eventRows }] = await Promise.all([
      supabase.from('shipments').select('*').order('created_at', { ascending: false }),
      supabase.from('shipment_events').select('*').order('occurred_at', { ascending: false }),
    ]);
    let rows = (shipmentRows ?? []) as Shipment[];
    if (!rows.length) {
      const { data: created } = await supabase.from('shipments').insert(demoShipment).select().maybeSingle();
      if (created) {
        rows = [created as Shipment];
        const seeded = demoEvents.map((event) => ({ ...event, shipment_id: created.id }));
        const { data: createdEvents } = await supabase.from('shipment_events').insert(seeded).select();
        setEvents((createdEvents ?? []) as Event[]);
      }
    } else setEvents((eventRows ?? []) as Event[]);
    setShipments(rows);
    setLoading(false);
  };

  useEffect(() => {
    if (!adminOnly) return;
    fetch('/api/admin/session').then((response) => response.json()).then((result) => {
      setAdminAuthenticated(Boolean(result.authenticated));
    }).catch(() => setAuthError('Impossible de vérifier la session.')).finally(() => setAuthChecked(true));
  }, [adminOnly]);

  useEffect(() => { if (!adminOnly || adminAuthenticated) void loadData(); }, [adminOnly, adminAuthenticated]);

  const logIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError('');
    const response = await fetch('/api/admin/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: adminPassword }),
    });
    const result = await response.json();
    if (!response.ok) { setAuthError(result.error ?? 'Connexion impossible.'); return; }
    setAdminAuthenticated(true);
    setAdminPassword('');
  };
  const logOut = async () => {
    await fetch('/api/admin/session', { method: 'DELETE' });
    setAdminAuthenticated(false);
    setAuthChecked(true);
  };

  const selectedEvents = useMemo(() => selected ? events.filter((event) => event.shipment_id === selected.id).sort((a, b) => +new Date(b.occurred_at) - +new Date(a.occurred_at)) : [], [events, selected]);
  const stats = useMemo(() => ({ total: shipments.length, active: shipments.filter((s) => !['Livré', 'Arrivé à destination'].includes(s.current_status)).length, delivered: shipments.filter((s) => s.current_status === 'Livré').length }), [shipments]);

  const findShipment = () => {
    const result = shipments.find((shipment) => shipment.tracking_code.toLowerCase() === trackingCode.trim().toLowerCase());
    setSelected(result ?? null);
    setMessage(result ? '' : 'Aucun véhicule ne correspond à ce code. Vérifiez les caractères saisis.');
    if (result) document.getElementById('tracking-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const copyCode = async (code: string) => { await navigator.clipboard?.writeText(code); setMessage('Code copié dans le presse-papiers.'); setTimeout(() => setMessage(''), 2200); };

  const updateStatus = async (shipment: Shipment, status: string) => {
    const { error } = await supabase.from('shipments').update({ current_status: status, updated_at: new Date().toISOString() }).eq('id', shipment.id);
    if (!error) { await loadData(); setSelected({ ...shipment, current_status: status }); }
  };
  const addShipment = async () => {
    if (!newForm.reference || !newForm.customer_name || !newForm.vehicle_label || !newForm.origin || !newForm.destination) return;
    const code = `LC-${new Date().getFullYear().toString().slice(2)}${Math.floor(10 + Math.random() * 89)}-${Math.floor(1000 + Math.random() * 8999)}`;
    const { data } = await supabase.from('shipments').insert({ ...newForm, tracking_code: code, current_status: 'En préparation' }).select().maybeSingle();
    if (data) { await supabase.from('shipment_events').insert({ shipment_id: data.id, title: 'Dossier créé', location: 'Centre LC Laurent', description: 'Le dossier de transport a été créé.', is_completed: true }); setShowNew(false); setNewForm({ reference: '', customer_name: '', vehicle_label: '', origin: '', destination: '', eta: '' }); await loadData(); }
  };

  return <main className="min-h-screen bg-[#f5f5f3]">
    <header className="sticky top-0 z-30 border-b border-black/10 bg-[#111214]/95 text-white backdrop-blur-md">
      <div className="mx-auto flex h-[76px] max-w-[1320px] items-center justify-between px-5 lg:px-10">
        <a href="/" className="flex items-center gap-3 text-left">
          <img src="/Logo_automobile_LC_Laurent_metallise copy.png" alt="LC Laurent Crash Autos" className="h-12 w-auto object-contain" />
          <span className="hidden border-l border-white/20 pl-3 text-[10px] font-bold uppercase tracking-[.22em] text-white/50 sm:block">Logistique<br />& suivi</span>
        </a>
        {!adminOnly && <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[.06] p-1 text-xs font-semibold">
          <button onClick={() => setView('track')} className={`rounded-full px-4 py-2 transition ${view === 'track' ? 'bg-[#e21c23] text-white' : 'text-white/60 hover:text-white'}`}>Suivre un véhicule</button>
        </div>}
      </div>
    </header>

    {!adminOnly && view === 'track' ? <>
      <section className="noise relative overflow-hidden bg-[#111214] text-white">
        <div className="absolute -right-28 -top-40 h-[600px] w-[600px] rounded-full bg-[#e21c23]/20 blur-[120px]" />
        <div className="relative mx-auto grid max-w-[1320px] gap-12 px-5 pb-20 pt-16 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:px-10 lg:pb-24 lg:pt-24">
          <div className="animate-rise"><div className="mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[.2em] text-[#ff4b50]"><span className="h-px w-8 bg-[#e21c23]" /> Transport automobile sécurisé</div>
            <h1 className="font-display max-w-xl text-5xl font-bold leading-[.98] tracking-[-.05em] sm:text-7xl">Votre véhicule,<br /><span className="text-[#e21c23]">à chaque étape.</span></h1>
            <p className="mt-7 max-w-lg text-base leading-7 text-white/60">Suivez l’avancement de votre transport en toute transparence. Entrez le code communiqué par notre équipe pour accéder à votre parcours.</p>
          </div>
          <div className="relative rounded-[28px] border border-white/10 bg-white/[.07] p-6 shadow-2xl backdrop-blur-md sm:p-8">
            <div className="mb-8 flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-white/50">Portail client</p><h2 className="font-display mt-2 text-2xl font-bold">Où est votre véhicule ?</h2></div><div className="rounded-2xl bg-[#e21c23] p-3"><Truck size={22} /></div></div>
            <label className="mb-2 block text-xs font-semibold text-white/50" htmlFor="tracking">Code de suivi</label>
            <div className="flex gap-2 rounded-xl border border-white/15 bg-black/20 p-1.5 focus-within:border-[#e21c23]"><input id="tracking" value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && findShipment()} placeholder="Ex. LC-2409-8472" className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm font-semibold uppercase tracking-wider text-white outline-none" /><button onClick={findShipment} className="flex items-center gap-2 rounded-lg bg-[#e21c23] px-4 py-3 text-sm font-bold transition hover:bg-[#c9161d]"><Search size={16} /> <span className="hidden sm:inline">Rechercher</span></button></div>
            <div className="mt-5 flex items-center gap-2 text-xs text-white/40"><ShieldCheck size={15} className="text-[#e21c23]" /> Informations accessibles avec votre code personnel</div>
            {message && <p className="mt-4 text-sm text-[#ff757a]">{message}</p>}
          </div>
        </div>
      </section>
      <section id="tracking-result" className="mx-auto max-w-[1320px] px-5 py-12 lg:px-10 lg:py-16">
        {!selected ? <div className="grid gap-5 md:grid-cols-3"><Feature icon={<MapPin />} title="Localisation claire" text="Chaque étape et chaque lieu sont indiqués simplement." /><Feature icon={<Clock3 />} title="Suivi actualisé" text="Les informations sont mises à jour par notre équipe logistique." /><Feature icon={<ShieldCheck />} title="Transport sécurisé" text="Votre véhicule est pris en charge par des professionnels." /></div> : <TrackingCard shipment={selected} events={selectedEvents} onCopy={copyCode} />}
      </section>
      <footer className="border-t border-black/10 px-5 py-8 text-center text-xs text-black/40">© {new Date().getFullYear()} LC Laurent Crash Autos · Transport et logistique automobile</footer>
    </> : adminOnly ? (authChecked && adminAuthenticated
      ? <AdminView shipments={shipments} events={events} stats={stats} loading={loading} onSelect={(shipment) => setSelected(shipment)} onStatus={updateStatus} onNew={() => setShowNew(true)} onCopy={copyCode} onLogOut={logOut} />
      : <AdminLogin checked={authChecked} password={adminPassword} setPassword={setAdminPassword} error={authError} onSubmit={logIn} />)
      : null}

    {showNew && <NewShipmentModal form={newForm} setForm={setNewForm} onClose={() => setShowNew(false)} onSubmit={addShipment} />}
  </main>;
}

export default Home;

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm"><div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff0f0] text-[#e21c23]">{icon}</div><h3 className="font-display text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-black/55">{text}</p></div>; }
function TrackingCard({ shipment, events, onCopy }: { shipment: Shipment; events: Event[]; onCopy: (code: string) => void }) { return <div className="animate-rise overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-xl shadow-black/5"><div className="border-b border-black/10 bg-[#111214] p-6 text-white sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-[#ff595f]"><span className="live-pulse h-2 w-2 rounded-full bg-[#e21c23]" /> Suivi en direct</div><h2 className="font-display mt-3 text-3xl font-bold">{shipment.vehicle_label}</h2><p className="mt-2 text-sm text-white/50">Dossier {shipment.reference} · {shipment.customer_name}</p></div><div className="rounded-xl bg-white/10 px-4 py-3 text-right"><p className="text-[10px] uppercase tracking-widest text-white/45">Code de suivi</p><button onClick={() => onCopy(shipment.tracking_code)} className="mt-1 flex items-center gap-2 font-mono text-sm font-bold text-white hover:text-[#ff595f]">{shipment.tracking_code}<Copy size={14} /></button></div></div><div className="mt-8 grid gap-4 sm:grid-cols-3"><Info label="Départ" value={shipment.origin} /><Info label="Destination" value={shipment.destination} /><Info label="Livraison estimée" value={shipment.eta ?? 'À confirmer'} /></div></div><div className="p-6 sm:p-8"><div className="mb-6 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.17em] text-black/40">Historique du transport</p><h3 className="font-display mt-1 text-xl font-bold">Les dernières nouvelles</h3></div><span className="rounded-full bg-[#fff0f0] px-3 py-1.5 text-xs font-bold text-[#c9161d]">{shipment.current_status}</span></div><div className="space-y-0">{events.length ? events.map((event, index) => <div className="relative flex gap-4 pb-7" key={event.id}><div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-4 border-white bg-[#e21c23] text-white shadow-sm">{event.is_completed ? <Check size={14} strokeWidth={3} /> : <Truck size={14} />}</div>{index < events.length - 1 && <div className="absolute left-[15px] top-8 h-full w-0.5 bg-[#e21c23]/20" />}<div className="min-w-0 pt-0.5"><div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h4 className="font-bold">{event.title}</h4><span className="text-xs text-black/40">{formatDate(event.occurred_at)}</span></div><p className="mt-1 flex items-center gap-1 text-sm font-medium text-[#e21c23]"><MapPin size={13} /> {event.location}</p>{event.description && <p className="mt-1 text-sm leading-6 text-black/55">{event.description}</p>}</div></div>) : <p className="text-sm text-black/50">Le parcours sera bientôt renseigné par notre équipe.</p>}</div></div></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="border-l-2 border-[#e21c23] pl-3"><p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>; }

function AdminLogin({ checked, password, setPassword, error, onSubmit }: { checked: boolean; password: string; setPassword: (value: string) => void; error: string; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) { return <section className="mx-auto flex min-h-[calc(100vh-76px)] max-w-[1320px] items-center justify-center px-5 py-12"><form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-7 shadow-xl sm:p-9"><div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-[#fff0f0] text-[#e21c23]"><LockKeyhole size={22} /></div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#e21c23]">Espace sécurisé</p><h1 className="font-display mt-2 text-3xl font-bold">Connexion admin</h1><p className="mt-2 text-sm leading-6 text-black/55">Saisissez le mot de passe administrateur pour gérer les transports.</p><label htmlFor="admin-password" className="mb-2 mt-6 block text-xs font-bold text-black/60">Mot de passe</label><input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-black/15 bg-[#fafaf8] px-3 py-3 text-sm outline-none focus:border-[#e21c23] focus:ring-2 focus:ring-[#e21c23]/10" />{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<button disabled={!checked} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#e21c23] px-5 py-3 text-sm font-bold text-white hover:bg-[#c9161d] disabled:opacity-60">{checked ? 'Se connecter' : 'Vérification…'}</button></form></section>; }

function AdminView({ shipments, events, stats, loading, onSelect, onStatus, onNew, onCopy, onLogOut }: { shipments: Shipment[]; events: Event[]; stats: { total: number; active: number; delivered: number }; loading: boolean; onSelect: (shipment: Shipment) => void; onStatus: (shipment: Shipment, status: string) => void; onNew: () => void; onCopy: (code: string) => void; onLogOut: () => void }) { return <section className="mx-auto max-w-[1320px] px-5 py-10 lg:px-10 lg:py-14"><div className="flex flex-wrap items-end justify-between gap-5"><div><div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-[#e21c23]"><Settings2 size={14} /> Centre de pilotage</div><h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Vos transports.</h1><p className="mt-3 text-black/55">Créez les dossiers et faites évoluer chaque parcours manuellement.</p></div><div className="flex gap-3"><button onClick={onLogOut} className="flex items-center gap-2 rounded-xl border border-black/15 px-4 py-3 text-sm font-bold text-black/60 hover:bg-black/[.04]"><LogOut size={16} /> Déconnexion</button><button onClick={onNew} className="flex items-center gap-2 rounded-xl bg-[#e21c23] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#e21c23]/20 transition hover:bg-[#c9161d]"><Plus size={18} /> Nouveau dossier</button></div></div><div className="mt-10 grid gap-4 sm:grid-cols-3"><Stat label="Dossiers suivis" value={stats.total} icon={<Package />} /><Stat label="Transports actifs" value={stats.active} icon={<Truck />} accent /><Stat label="Livraisons terminées" value={stats.delivered} icon={<Check />} /></div><div className="mt-10 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-black/10 p-5"><div><h2 className="font-display text-xl font-bold">Tous les transports</h2><p className="mt-1 text-xs text-black/45">Modifiez le statut pour actualiser le suivi client.</p></div><span className="rounded-full bg-black/[.04] px-3 py-1 text-xs font-bold text-black/50">{shipments.length} dossier{shipments.length > 1 ? 's' : ''}</span></div>{loading ? <div className="p-8 text-sm text-black/45">Chargement des dossiers…</div> : <div className="divide-y divide-black/[.08]">{shipments.map((shipment) => <div key={shipment.id} className="flex flex-wrap items-center gap-4 p-5 transition hover:bg-black/[.02]"><div className="flex min-w-[220px] flex-1 items-center gap-4"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#111214] text-white"><Truck size={19} /></div><div><button onClick={() => onSelect(shipment)} className="text-left font-bold hover:text-[#e21c23]">{shipment.vehicle_label}</button><p className="mt-1 text-xs text-black/45">{shipment.customer_name} · {shipment.reference}</p></div></div><div className="flex items-center gap-2 text-xs text-black/55"><MapPin size={14} className="text-[#e21c23]" /> {shipment.origin} <ArrowRight size={13} /> {shipment.destination}</div><div className="flex items-center gap-2"><button onClick={() => onCopy(shipment.tracking_code)} className="rounded-lg border border-black/10 px-3 py-2 font-mono text-xs font-bold text-black/60 hover:border-[#e21c23] hover:text-[#e21c23]">{shipment.tracking_code}</button><select aria-label={`Statut de ${shipment.vehicle_label}`} value={shipment.current_status} onChange={(e) => onStatus(shipment, e.target.value)} className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-[#e21c23]">{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></div></div>)}</div>}</div><p className="mt-5 flex items-center gap-2 text-xs text-black/40"><ShieldCheck size={14} /> Les mises à jour apparaissent immédiatement sur la page de suivi client.</p></section>; }
function Stat({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent?: boolean }) { return <div className={`rounded-2xl border p-5 ${accent ? 'border-[#e21c23]/25 bg-[#fff4f4]' : 'border-black/10 bg-white'}`}><div className="flex items-start justify-between"><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent ? 'bg-[#e21c23] text-white' : 'bg-black/[.05] text-black/60'}`}>{icon}</span><span className="font-display text-3xl font-bold">{value}</span></div><p className="mt-5 text-xs font-bold uppercase tracking-wider text-black/45">{label}</p></div>; }
function NewShipmentModal({ form, setForm, onClose, onSubmit }: { form: { reference: string; customer_name: string; vehicle_label: string; origin: string; destination: string; eta: string }; setForm: React.Dispatch<React.SetStateAction<{ reference: string; customer_name: string; vehicle_label: string; origin: string; destination: string; eta: string }>>; onClose: () => void; onSubmit: () => void }) { const fields: { key: keyof typeof form; label: string; placeholder: string }[] = [{ key: 'reference', label: 'Référence dossier', placeholder: 'LC-2024-001' }, { key: 'customer_name', label: 'Nom du client', placeholder: 'Prénom Nom' }, { key: 'vehicle_label', label: 'Véhicule', placeholder: 'Marque, modèle — immatriculation' }, { key: 'origin', label: 'Lieu de départ', placeholder: 'Ville ou centre de prise en charge' }, { key: 'destination', label: 'Destination', placeholder: 'Ville de livraison' }, { key: 'eta', label: 'Livraison estimée', placeholder: 'Demain, 14:00' }]; return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm"><div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-[#e21c23]">Nouveau transport</p><h2 className="font-display mt-2 text-2xl font-bold">Créer un dossier</h2></div><button onClick={onClose} className="rounded-lg p-2 text-black/50 hover:bg-black/5"><X size={20} /></button></div><div className="mt-7 grid gap-4 sm:grid-cols-2">{fields.map((field) => <label key={field.key} className={field.key === 'vehicle_label' ? 'sm:col-span-2' : ''}><span className="mb-1.5 block text-xs font-bold text-black/55">{field.label}</span><input value={form[field.key]} onChange={(e) => setForm((current) => ({ ...current, [field.key]: e.target.value }))} placeholder={field.placeholder} className="w-full rounded-lg border border-black/15 bg-[#fafaf8] px-3 py-2.5 text-sm outline-none transition focus:border-[#e21c23] focus:ring-2 focus:ring-[#e21c23]/10" /></label>)}</div><div className="mt-7 flex justify-end gap-3"><button onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-black/60 hover:bg-black/5">Annuler</button><button onClick={onSubmit} className="rounded-lg bg-[#e21c23] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#c9161d]">Créer le dossier</button></div></div></div>; }
