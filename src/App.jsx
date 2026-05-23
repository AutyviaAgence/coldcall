import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Papa from 'papaparse'
import {
  Upload, Download, Search, Phone, PhoneOff, PhoneCall, PhoneForwarded,
  Star, X, ChevronUp, ChevronDown, FileText, RotateCcw, Clock, Building2,
  Mail, Globe, MapPin, MessageSquare, Calendar, Filter, BarChart3, Users,
  PhoneMissed, ArrowUpDown, Trash2, FileUp, Database, Settings, AlertCircle,
  Radar, Loader2, MapPinned, Plus, Check, ChevronLeft, ChevronRight,
  Mic, MicOff, Play, Square, Trash2 as Trash2Icon, Pause, Tag, Bell, BellRing,
  UserPlus, Edit2, Save, Zap, TrendingUp, Factory, ListFilter, ChevronDown as ChevDown,
  PieChart, Activity, Target, Award
} from 'lucide-react'

const STATUTS = {
  NON_APPELE: 'Pas appelé',
  APPELE: 'Appelé',
  INTERESSE: 'Intéressé',
  PAS_INTERESSE: 'Pas intéressé',
  RAPPELER: 'Rappeler',
  INJOIGNABLE: 'Injoignable',
}

const STATUT_COLORS = {
  [STATUTS.NON_APPELE]: 'bg-gray-600',
  [STATUTS.APPELE]: 'bg-blue-600',
  [STATUTS.INTERESSE]: 'bg-green-600',
  [STATUTS.PAS_INTERESSE]: 'bg-red-600',
  [STATUTS.RAPPELER]: 'bg-yellow-600',
  [STATUTS.INJOIGNABLE]: 'bg-orange-600',
}

const STATUT_ICONS = {
  [STATUTS.NON_APPELE]: Phone,
  [STATUTS.APPELE]: PhoneCall,
  [STATUTS.INTERESSE]: Star,
  [STATUTS.INTERESSE]: Star,
  [STATUTS.PAS_INTERESSE]: PhoneOff,
  [STATUTS.RAPPELER]: PhoneForwarded,
  [STATUTS.INJOIGNABLE]: PhoneMissed,
}

const STORAGE_KEY = 'coldcall_crm_data'
const TAGS_STORAGE_KEY = 'coldcall_tags'

const TAG_COLORS = [
  'bg-violet-600', 'bg-pink-600', 'bg-cyan-600', 'bg-lime-600',
  'bg-amber-600', 'bg-rose-600', 'bg-teal-600', 'bg-indigo-600',
  'bg-fuchsia-600', 'bg-sky-600', 'bg-emerald-600', 'bg-orange-500',
]

const SERPAPI_KEYS = [
  import.meta.env.VITE_SERPAPI_KEY_1,
  import.meta.env.VITE_SERPAPI_KEY_2,
].filter(Boolean)
let serpKeyIndex = 0
function getNextSerpKey() {
  const key = SERPAPI_KEYS[serpKeyIndex % SERPAPI_KEYS.length]
  serpKeyIndex++
  return key
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

function formatDate(d) {
  if (!d) return ''
  const date = new Date(d)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDateShort(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function isToday(d) {
  if (!d) return false
  const date = new Date(d)
  const now = new Date()
  return date.toDateString() === now.toDateString()
}

// Retourne la liste des statuts actifs d'un contact (gère ancien + nouveau format)
function getStatuts(c) {
  if (Array.isArray(c.statuts) && c.statuts.length > 0) return c.statuts
  return c.statut ? [c.statut] : [STATUTS.NON_APPELE]
}
function hasStatut(c, s) {
  return getStatuts(c).includes(s)
}

const PAPPERS_KEY = import.meta.env.VITE_PAPPERS_KEY || ''

// Codes NAF populaires pour le BTP et PME
const NAF_PRESETS = [
  { label: 'Plomberie / Chauffage', code: '4322A' },
  { label: 'Électricité', code: '4321A' },
  { label: 'Maçonnerie', code: '4120A' },
  { label: 'Couverture / Charpente', code: '4391A' },
  { label: 'Peinture / Vitrerie', code: '4334Z' },
  { label: 'Menuiserie', code: '4332A' },
  { label: 'Carrelage', code: '4333Z' },
  { label: 'Paysagisme', code: '8130Z' },
  { label: 'Nettoyage', code: '8121Z' },
  { label: 'Déménagement', code: '4942Z' },
  { label: 'Restauration', code: '5610A' },
  { label: 'Boulangerie', code: '1071A' },
  { label: 'Coiffure', code: '9602A' },
  { label: 'Garage automobile', code: '4520A' },
  { label: 'Carrosserie', code: '4520B' },
  { label: 'Serrurerie', code: '4322B' },
  { label: 'Agence immobilière', code: '6831Z' },
  { label: 'Imprimerie textile / Ennoblissement', code: '1330Z' },
  { label: 'Imprimerie générale', code: '1812Z' },
]

// ─── PAPPERS SCRAPER MODAL ───
function PappersScraperModal({ isOpen, onClose, onImport, tags, onAddTag }) {
  const [selectedNafs, setSelectedNafs] = useState([{ label: 'Imprimerie textile / Ennoblissement', code: '1330Z' }])
  const [nafInput, setNafInput] = useState('')
  const [showNafDropdown, setShowNafDropdown] = useState(false)
  const [departement, setDepartement] = useState('')
  const [ville, setVille] = useState('')
  const [caMin, setCaMin] = useState('')
  const [caMax, setCaMax] = useState('')
  const [effectifMin, setEffectifMin] = useState('')
  const [effectifMax, setEffectifMax] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [importTags, setImportTags] = useState([])
  const [newImportTag, setNewImportTag] = useState('')
  const abortRef = useRef(false)

  const reset = () => {
    setResults([]); setSelected(new Set()); setError('')
    setPage(1); setTotal(0); setHasMore(false)
    setImportTags([]); setNewImportTag('')
  }

  const buildParams = (p = 1) => {
    const params = new URLSearchParams({ api_token: PAPPERS_KEY, par_page: '50', page: String(p) })
    if (selectedNafs.length > 0) params.set('code_naf', selectedNafs.map(n => n.code).join(','))
    if (departement) params.set('departement', departement)
    if (ville) params.set('ville', ville)
    if (caMin) params.set('chiffre_affaires_min', String(Number(caMin) * 1000))
    if (caMax) params.set('chiffre_affaires_max', String(Number(caMax) * 1000))
    if (effectifMin) params.set('effectif_min', effectifMin)
    if (effectifMax) params.set('effectif_max', effectifMax)
    params.set('champs', 'nom_entreprise,siren,siege.telephone,siege.email,siege.site_web,siege.ville,siege.code_postal,chiffre_affaires,effectif,code_naf,libelle_code_naf')
    return params
  }

  const doSearch = async (p = 1) => {
    if (!PAPPERS_KEY) { setError('Clé Pappers manquante dans le fichier .env'); return }
    setLoading(true); setError('')
    abortRef.current = false
    try {
      const resp = await fetch(`/pappers/v2/recherche?${buildParams(p).toString()}`)
      if (!resp.ok) {
        const t = await resp.text()
        throw new Error(`Erreur Pappers ${resp.status}: ${t.slice(0, 200)}`)
      }
      const data = await resp.json()
      const items = (data.resultats || []).map(e => ({
        _id: e.siren,
        entreprise: e.nom_entreprise || '',
        telephone: e.siege?.telephone || '',
        email: e.siege?.email || '',
        siteWeb: e.siege?.site_web || '',
        ville: e.siege?.ville || '',
        codePostal: e.siege?.code_postal || '',
        ca: e.chiffre_affaires || null,
        effectif: e.effectif || null,
        naf: e.libelle_code_naf || '',
        siren: e.siren,
      }))
      if (p === 1) { setResults(items); setTotal(data.total || 0) }
      else setResults(prev => {
        const ids = new Set(prev.map(r => r._id))
        return [...prev, ...items.filter(i => !ids.has(i._id))]
      })
      setHasMore((p * 50) < (data.total || 0))
      setPage(p)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleSelect = id => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
  })
  const selectAll = () => setSelected(prev =>
    prev.size === results.length ? new Set() : new Set(results.map(r => r._id))
  )

  const addImportTag = (tag) => {
    const t = tag.trim(); if (!t || importTags.includes(t)) return
    setImportTags(p => [...p, t]); onAddTag(t); setNewImportTag('')
  }

  const handleImport = () => {
    const contacts = results.filter(r => selected.has(r._id)).map(r => ({
      id: generateId(),
      entreprise: r.entreprise, telephone: r.telephone, email: r.email,
      siteWeb: r.siteWeb, ville: r.ville || r.codePostal, contact: '', poste: '',
      statut: STATUTS.NON_APPELE, statuts: [STATUTS.NON_APPELE],
      dateDernierAppel: null, dateRappel: null,
      notes: [
        r.ca ? { id: generateId(), date: new Date().toISOString(), texte: `[Pappers] CA: ${(r.ca/1000).toFixed(0)}k€` } : null,
        r.effectif ? { id: generateId(), date: new Date().toISOString(), texte: `[Pappers] Effectif: ${r.effectif} salariés` } : null,
        r.naf ? { id: generateId(), date: new Date().toISOString(), texte: `[Pappers] Secteur: ${r.naf}` } : null,
      ].filter(Boolean),
      historiqueAppels: [], enregistrements: [],
      tags: [...importTags], fichierSource: `Pappers: ${codeNaf || 'recherche'}`,
      dateImport: new Date().toISOString(),
    }))
    importTags.forEach(t => onAddTag(t))
    onImport(contacts); reset(); onClose()
  }

  const formatCA = ca => {
    if (!ca) return '—'
    if (ca >= 1000000) return `${(ca/1000000).toFixed(1)}M€`
    if (ca >= 1000) return `${(ca/1000).toFixed(0)}k€`
    return `${ca}€`
  }

  if (!isOpen) return null
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#111827] rounded-xl border border-[#1e293b] max-w-4xl w-full max-h-[88vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[#1e293b]">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp size={20} className="text-violet-400" /> Scraper Pappers
            <span className="text-xs text-gray-500 font-normal ml-1">— Recherche par CA, effectif, secteur NAF</span>
          </h2>
          <button onClick={() => { reset(); onClose() }} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        {/* Filtres */}
        <div className="p-4 border-b border-[#1e293b] space-y-3">
          <div className="flex gap-2 flex-wrap">
            {/* Codes NAF multiples */}
            <div className="relative flex-1 min-w-[260px]">
              <label className="text-xs text-gray-500 mb-1 block">Secteurs NAF <span className="text-violet-400">(sélection multiple)</span></label>
              {/* Tags sélectionnés */}
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {selectedNafs.map(n => (
                  <span key={n.code} className="bg-violet-600/20 border border-violet-500/40 text-violet-300 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                    {n.label} <span className="text-violet-500">({n.code})</span>
                    <button onMouseDown={() => setSelectedNafs(prev => prev.filter(x => x.code !== n.code))} className="hover:text-red-400 ml-0.5"><X size={10} /></button>
                  </span>
                ))}
              </div>
              <div className="relative">
                <Factory size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={nafInput}
                  onChange={e => { setNafInput(e.target.value); setShowNafDropdown(true) }}
                  onFocus={() => setShowNafDropdown(true)}
                  onBlur={() => setTimeout(() => setShowNafDropdown(false), 150)}
                  placeholder="Ajouter un secteur..."
                  className="w-full bg-[#0a0f1c] border border-[#1e293b] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:border-violet-500 focus:outline-none"
                />
                {showNafDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#111827] border border-[#1e293b] rounded-lg shadow-xl z-20 max-h-52 overflow-y-auto">
                    {NAF_PRESETS
                      .filter(n => !nafInput || n.label.toLowerCase().includes(nafInput.toLowerCase()) || n.code.toLowerCase().includes(nafInput.toLowerCase()))
                      .map(n => {
                        const isActive = selectedNafs.some(s => s.code === n.code)
                        return (
                          <button key={n.code}
                            onMouseDown={() => {
                              if (isActive) setSelectedNafs(prev => prev.filter(x => x.code !== n.code))
                              else setSelectedNafs(prev => [...prev, n])
                              setNafInput('')
                            }}
                            className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors ${isActive ? 'bg-violet-600/20 text-violet-300' : 'hover:bg-[#1e293b] text-white'}`}>
                            <div className="flex items-center gap-2">
                              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isActive ? 'bg-violet-500 border-violet-500' : 'border-gray-600'}`}>
                                {isActive && <Check size={9} className="text-white" />}
                              </div>
                              <span>{n.label}</span>
                            </div>
                            <span className="text-xs text-gray-500">{n.code}</span>
                          </button>
                        )
                      })}
                    {/* Entrée manuelle si code inconnu */}
                    {nafInput && !NAF_PRESETS.some(n => n.code.toLowerCase() === nafInput.toLowerCase()) && (
                      <button onMouseDown={() => { setSelectedNafs(prev => [...prev, { label: nafInput, code: nafInput.toUpperCase() }]); setNafInput('') }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-[#1e293b] text-violet-400 flex items-center gap-2">
                        <Plus size={12} /> Ajouter "{nafInput.toUpperCase()}"
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* Département */}
            <div className="w-32">
              <label className="text-xs text-gray-500 mb-1 block">Département</label>
              <input type="text" value={departement} onChange={e => setDepartement(e.target.value)}
                placeholder="ex: 75, 13..."
                className="w-full bg-[#0a0f1c] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-violet-500 focus:outline-none" />
            </div>
            {/* Ville */}
            <div className="w-36">
              <label className="text-xs text-gray-500 mb-1 block">Ville</label>
              <input type="text" value={ville} onChange={e => setVille(e.target.value)}
                placeholder="ex: Lyon"
                className="w-full bg-[#0a0f1c] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-violet-500 focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-end">
            {/* CA */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">CA min (k€)</label>
              <input type="number" value={caMin} onChange={e => setCaMin(e.target.value)} placeholder="ex: 50"
                className="w-24 bg-[#0a0f1c] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-violet-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">CA max (k€)</label>
              <input type="number" value={caMax} onChange={e => setCaMax(e.target.value)} placeholder="ex: 500"
                className="w-24 bg-[#0a0f1c] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-violet-500 focus:outline-none" />
            </div>
            {/* Effectif */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Effectif min</label>
              <input type="number" value={effectifMin} onChange={e => setEffectifMin(e.target.value)} placeholder="1"
                className="w-20 bg-[#0a0f1c] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-violet-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Effectif max</label>
              <input type="number" value={effectifMax} onChange={e => setEffectifMax(e.target.value)} placeholder="10"
                className="w-20 bg-[#0a0f1c] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-violet-500 focus:outline-none" />
            </div>
            <div className="flex items-end gap-2 ml-auto">
              <button onClick={() => { reset(); doSearch(1) }} disabled={loading}
                className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Rechercher
              </button>
            </div>
          </div>
          {error && <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-2 text-xs text-red-400">{error}</div>}
        </div>

        {/* Résultats */}
        <div className="flex-1 overflow-y-auto p-4">
          {results.length === 0 && !loading && (
            <div className="text-center py-12">
              <TrendingUp size={48} className="mx-auto text-gray-700 mb-4" />
              <p className="text-gray-500">Configurez vos filtres et lancez la recherche</p>
              <p className="text-gray-600 text-sm mt-1">Données issues du registre officiel des entreprises françaises</p>
            </div>
          )}
          {loading && results.length === 0 && (
            <div className="text-center py-12"><Loader2 size={32} className="mx-auto text-violet-400 animate-spin mb-3" />
              <p className="text-gray-400 text-sm">Recherche en cours...</p></div>
          )}
          {results.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <button onClick={selectAll} className="text-xs text-violet-400 hover:underline">
                    {selected.size === results.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </button>
                  <span className="text-xs text-gray-500">{selected.size} sélectionné{selected.size > 1 ? 's' : ''} / {results.length} affichés ({total} total)</span>
                </div>
                {hasMore && <button onClick={() => doSearch(page + 1)} disabled={loading}
                  className="text-xs text-violet-400 hover:underline flex items-center gap-1">
                  {loading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Charger plus
                </button>}
              </div>
              <div className="space-y-2">
                {results.map(r => (
                  <div key={r._id} onClick={() => toggleSelect(r._id)}
                    className={`rounded-lg border p-3 cursor-pointer transition-all ${selected.has(r._id) ? 'border-violet-500 bg-violet-500/10' : 'border-[#1e293b] bg-[#0a0f1c] hover:border-[#2d3a4f]'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${selected.has(r._id) ? 'border-violet-500 bg-violet-500' : 'border-[#1e293b]'}`}>
                        {selected.has(r._id) && <Check size={12} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium text-sm">{r.entreprise}</span>
                          {r.naf && <span className="text-[10px] bg-[#1e293b] text-gray-400 px-1.5 py-0.5 rounded">{r.naf}</span>}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {r.telephone && <span className="text-xs text-[#3b82f6] flex items-center gap-1"><Phone size={10} />{r.telephone}</span>}
                          {r.email && <span className="text-xs text-gray-400 flex items-center gap-1"><Mail size={10} />{r.email}</span>}
                          {r.ville && <span className="text-xs text-gray-500 flex items-center gap-1"><MapPin size={10} />{r.codePostal} {r.ville}</span>}
                          {r.ca && <span className="text-xs text-green-400 flex items-center gap-1"><TrendingUp size={10} />CA: {formatCA(r.ca)}</span>}
                          {r.effectif && <span className="text-xs text-yellow-400 flex items-center gap-1"><Users size={10} />{r.effectif} sal.</span>}
                          {r.siteWeb && <span className="text-xs text-gray-500 flex items-center gap-1"><Globe size={10} />{r.siteWeb.replace(/^https?:\/\/(www\.)?/,'').slice(0,30)}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="p-4 border-t border-[#1e293b] space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500 flex items-center gap-1"><Tag size={12} />Tags :</span>
              {importTags.map((t, i) => (
                <span key={t} className={`px-2 py-0.5 rounded-full text-xs font-medium text-white flex items-center gap-1 ${TAG_COLORS[i % TAG_COLORS.length]}`}>
                  {t}<button onClick={() => setImportTags(p => p.filter(x => x !== t))}><X size={10} /></button>
                </span>
              ))}
              {tags.filter(t => !importTags.includes(t)).map(t => (
                <button key={t} onClick={() => addImportTag(t)}
                  className="px-2 py-0.5 rounded-full text-xs border border-dashed border-[#1e293b] text-gray-500 hover:text-white hover:border-violet-500 transition-colors">
                  + {t}
                </button>
              ))}
              <input type="text" value={newImportTag} onChange={e => setNewImportTag(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addImportTag(newImportTag) }}
                placeholder="Nouveau tag..." className="bg-[#0a0f1c] border border-[#1e293b] rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 focus:border-violet-500 focus:outline-none w-28" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{total} entreprises trouvées</span>
              <button onClick={handleImport} disabled={selected.size === 0}
                className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
                <Plus size={16} /> Importer {selected.size} contact{selected.size > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CAMPAGNE SCRAPER MODAL ───
function CampagneModal({ isOpen, onClose, onImport, tags, onAddTag }) {
  const [mode, setMode] = useState('maps') // 'maps' | 'pappers'
  const [query, setQuery] = useState('')
  const [localisations, setLocalisations] = useState('')
  const [selectedNafsCamp, setSelectedNafsCamp] = useState([])
  const [nafInput, setNafInput] = useState('')
  const [showNafDrop, setShowNafDrop] = useState(false)
  const [departements, setDepartements] = useState('')
  const [caMin, setCaMin] = useState('')
  const [caMax, setCaMax] = useState('')
  const [effectifMin, setEffectifMin] = useState('')
  const [effectifMax, setEffectifMax] = useState('')
  const [maxPerLoc, setMaxPerLoc] = useState(60)
  const [siteFilter, setSiteFilter] = useState('tous')
  const [phoneFilter, setPhoneFilter] = useState('tous')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [importTags, setImportTags] = useState([])
  const [newImportTag, setNewImportTag] = useState('')
  const abortRef = useRef(false)

  const isMobile = t => { if (!t) return false; const c = t.replace(/[\s.\-()+]/g,''); return /^(\+33|0033)?0?[67]/.test(c)||/^0[67]/.test(c) }

  const filteredResults = useMemo(() => {
    let list = results
    if (siteFilter === 'sans_site') list = list.filter(r => !r.siteWeb)
    else if (siteFilter === 'avec_site') list = list.filter(r => !!r.siteWeb)
    if (phoneFilter === 'mobile') list = list.filter(r => isMobile(r.telephone))
    else if (phoneFilter === 'fixe') list = list.filter(r => r.telephone && !isMobile(r.telephone))
    return list
  }, [results, siteFilter, phoneFilter])

  const reset = () => { setResults([]); setSelected(new Set()); setError(''); setProgress('') }

  const addImportTag = t => { const v=t.trim(); if(!v||importTags.includes(v))return; setImportTags(p=>[...p,v]); onAddTag(v); setNewImportTag('') }

  const runMapsCampagne = async () => {
    const locs = localisations.split('\n').map(s => s.trim()).filter(Boolean)
    if (!query.trim() || locs.length === 0) { setError('Remplissez la recherche et au moins une localisation'); return }
    const allItems = []; const seenIds = new Set()
    setLoading(true); abortRef.current = false

    for (const loc of locs) {
      if (abortRef.current) break
      const pagesNeeded = Math.ceil(maxPerLoc / 20)
      for (let p = 0; p < pagesNeeded; p++) {
        if (abortRef.current) break
        setProgress(`${loc} — page ${p + 1}/${pagesNeeded} (${allItems.length} total)`)
        try {
          const key = getNextSerpKey()
          const params = new URLSearchParams({
            api_key: key, engine: 'google_maps', type: 'search',
            q: `${query.trim()} ${loc}`, hl: 'fr', gl: 'fr',
            ll: '@46.603354,1.888334,6z',
          })
          if (p > 0) params.set('start', String(p * 20))
          const resp = await fetch(`/serpapi/search.json?${params}`)
          if (!resp.ok) break
          const data = await resp.json()
          const items = (data.local_results || []).map(pl => ({
            _id: pl.place_id || generateId(),
            entreprise: pl.title || '', telephone: pl.phone || '',
            adresse: pl.address || '', ville: (() => { const pts=(pl.address||'').split(','); return pts[pts.length-1]?.replace(/^\d{5}\s*/,'').trim()||'' })(),
            siteWeb: pl.website||pl.link||'', note: pl.rating?`${pl.rating}/5 (${pl.reviews||0} avis)`:'', loc,
          }))
          items.forEach(i => { if (!seenIds.has(i._id)) { seenIds.add(i._id); allItems.push(i) } })
          setResults([...allItems])
          if (items.length < 5) break
        } catch { break }
      }
    }
    setLoading(false); setProgress('')
  }

  const runPappersCampagne = async () => {
    const deps = departements.split(/[\n,]/).map(s => s.trim()).filter(Boolean)
    if (!selectedNafsCamp.length && !deps.length) { setError('Remplissez au moins un code NAF ou des départements'); return }
    const allItems = []; const seenIds = new Set()
    setLoading(true); abortRef.current = false

    const depsToUse = deps.length > 0 ? deps : ['']
    for (const dep of depsToUse) {
      if (abortRef.current) break
      setProgress(`Département ${dep || 'France entière'} (${allItems.length} total)`)
      try {
        const params = new URLSearchParams({ api_token: PAPPERS_KEY, par_page: '100', page: '1',
          champs: 'nom_entreprise,siren,siege.telephone,siege.email,siege.site_web,siege.ville,siege.code_postal,chiffre_affaires,effectif,libelle_code_naf' })
        if (selectedNafsCamp.length > 0) params.set('code_naf', selectedNafsCamp.map(n => n.code).join(','))
        if (dep) params.set('departement', dep)
        if (caMin) params.set('chiffre_affaires_min', String(Number(caMin)*1000))
        if (caMax) params.set('chiffre_affaires_max', String(Number(caMax)*1000))
        if (effectifMin) params.set('effectif_min', effectifMin)
        if (effectifMax) params.set('effectif_max', effectifMax)
        const resp = await fetch(`/pappers/v2/recherche?${params}`)
        if (!resp.ok) break
        const data = await resp.json()
        ;(data.resultats || []).forEach(e => {
          const item = { _id: e.siren, entreprise: e.nom_entreprise||'', telephone: e.siege?.telephone||'',
            email: e.siege?.email||'', siteWeb: e.siege?.site_web||'', ville: e.siege?.ville||'',
            codePostal: e.siege?.code_postal||'', ca: e.chiffre_affaires||null, effectif: e.effectif||null, naf: e.libelle_code_naf||'' }
          if (!seenIds.has(item._id)) { seenIds.add(item._id); allItems.push(item) }
        })
        setResults([...allItems])
      } catch { break }
    }
    setLoading(false); setProgress('')
  }

  const handleImport = () => {
    const contacts = filteredResults.filter(r => selected.has(r._id)).map(r => ({
      id: generateId(), entreprise: r.entreprise, telephone: r.telephone, email: r.email||'',
      siteWeb: r.siteWeb, ville: r.ville||r.adresse||'', contact: '', poste: '',
      statut: STATUTS.NON_APPELE, statuts: [STATUTS.NON_APPELE],
      dateDernierAppel: null, dateRappel: null,
      notes: [
        r.note ? { id: generateId(), date: new Date().toISOString(), texte: `[Campagne] ${r.note}` } : null,
        r.ca ? { id: generateId(), date: new Date().toISOString(), texte: `[Pappers] CA: ${(r.ca/1000).toFixed(0)}k€` } : null,
        r.effectif ? { id: generateId(), date: new Date().toISOString(), texte: `[Pappers] Effectif: ${r.effectif} sal.` } : null,
      ].filter(Boolean),
      historiqueAppels: [], enregistrements: [], tags: [...importTags],
      fichierSource: mode==='maps' ? `Campagne Maps: "${query}"` : `Campagne Pappers: ${selectedNafsCamp.map(n=>n.code).join(',')||''}`,
      dateImport: new Date().toISOString(),
    }))
    onImport(contacts); reset(); onClose()
  }

  if (!isOpen) return null
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#111827] rounded-xl border border-[#1e293b] max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[#1e293b]">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Zap size={20} className="text-yellow-400" /> Campagne de scraping
            <span className="text-xs text-gray-500 font-normal ml-1">— Multi-localisation, volume élevé</span>
          </h2>
          <button onClick={() => { reset(); onClose() }} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        {/* Onglets */}
        <div className="flex border-b border-[#1e293b]">
          {[{ id: 'maps', label: 'Google Maps', icon: MapPinned }, { id: 'pappers', label: 'Pappers', icon: TrendingUp }].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setMode(id); reset() }}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${mode === id ? 'border-yellow-400 text-yellow-400' : 'border-transparent text-gray-400 hover:text-white'}`}>
              <Icon size={15} />{label}
            </button>
          ))}
        </div>

        <div className="p-4 border-b border-[#1e293b] space-y-3">
          {mode === 'maps' ? (
            <div className="flex gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-gray-500 mb-1 block">Recherche</label>
                <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="ex: plombier, électricien, restaurant..." onKeyDown={e => { if (e.key==='Enter') { reset(); runMapsCampagne() } }}
                  className="w-full bg-[#0a0f1c] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-yellow-500 focus:outline-none" />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs text-gray-500 mb-1 block">Localisations (une par ligne)</label>
                <textarea value={localisations} onChange={e => setLocalisations(e.target.value)} rows={3}
                  placeholder={"Lyon\nMarseille\nBordeaux\nToulouse"}
                  className="w-full bg-[#0a0f1c] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-yellow-500 focus:outline-none resize-none" />
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Max / ville</label>
                  <select value={maxPerLoc} onChange={e => setMaxPerLoc(Number(e.target.value))}
                    className="w-24 bg-[#0a0f1c] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white focus:border-yellow-500 focus:outline-none">
                    {[20,40,60,100,200].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="flex gap-1.5">
                  {[{v:'tous',l:'Tous'},{v:'sans_site',l:'Sans site'},{v:'avec_site',l:'Avec site'}].map(o => (
                    <button key={o.v} onClick={() => setSiteFilter(o.v)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${siteFilter===o.v?'bg-yellow-600 text-white':'bg-[#0a0f1c] text-gray-400 border border-[#1e293b]'}`}>{o.l}</button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  {[{v:'tous',l:'Tous tél.'},{v:'mobile',l:'06/07'},{v:'fixe',l:'Fixe'}].map(o => (
                    <button key={o.v} onClick={() => setPhoneFilter(o.v)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${phoneFilter===o.v?'bg-emerald-600 text-white':'bg-[#0a0f1c] text-gray-400 border border-[#1e293b]'}`}>{o.l}</button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <label className="text-xs text-gray-500 mb-1 block">Secteurs NAF <span className="text-yellow-400">(sélection multiple)</span></label>
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {selectedNafsCamp.map(n => (
                    <span key={n.code} className="bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                      {n.label} <span className="text-yellow-500">({n.code})</span>
                      <button onMouseDown={() => setSelectedNafsCamp(prev => prev.filter(x => x.code !== n.code))}><X size={10} /></button>
                    </span>
                  ))}
                </div>
                <input type="text" value={nafInput} onChange={e => { setNafInput(e.target.value); setShowNafDrop(true) }}
                  onFocus={() => setShowNafDrop(true)} onBlur={() => setTimeout(() => setShowNafDrop(false), 150)}
                  placeholder="Ajouter un secteur..."
                  className="w-full bg-[#0a0f1c] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-yellow-500 focus:outline-none" />
                {showNafDrop && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#111827] border border-[#1e293b] rounded-lg shadow-xl z-20 max-h-44 overflow-y-auto">
                    {NAF_PRESETS.filter(n => !nafInput||n.label.toLowerCase().includes(nafInput.toLowerCase())||n.code.toLowerCase().includes(nafInput.toLowerCase())).map(n => {
                      const isActive = selectedNafsCamp.some(s => s.code === n.code)
                      return (
                        <button key={n.code} onMouseDown={() => { isActive ? setSelectedNafsCamp(p=>p.filter(x=>x.code!==n.code)) : setSelectedNafsCamp(p=>[...p,n]); setNafInput('') }}
                          className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between ${isActive?'bg-yellow-500/20 text-yellow-300':'hover:bg-[#1e293b] text-white'}`}>
                          <div className="flex items-center gap-2">
                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isActive?'bg-yellow-500 border-yellow-500':'border-gray-600'}`}>
                              {isActive && <Check size={9} className="text-black" />}
                            </div>
                            <span>{n.label}</span>
                          </div>
                          <span className="text-xs text-gray-500">{n.code}</span>
                        </button>
                      )
                    })}
                    {nafInput && !NAF_PRESETS.some(n=>n.code.toLowerCase()===nafInput.toLowerCase()) && (
                      <button onMouseDown={()=>{setSelectedNafsCamp(p=>[...p,{label:nafInput,code:nafInput.toUpperCase()}]);setNafInput('')}}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-[#1e293b] text-yellow-400 flex items-center gap-2">
                        <Plus size={12}/> Ajouter "{nafInput.toUpperCase()}"
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs text-gray-500 mb-1 block">Départements (virgule ou retour ligne)</label>
                <textarea value={departements} onChange={e => setDepartements(e.target.value)} rows={3}
                  placeholder={"69, 13, 33\n75, 92, 93, 94\n..."}
                  className="w-full bg-[#0a0f1c] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-yellow-500 focus:outline-none resize-none" />
              </div>
              <div className="space-y-1.5">
                <div><label className="text-xs text-gray-500 block mb-1">CA min (k€)</label>
                  <input type="number" value={caMin} onChange={e => setCaMin(e.target.value)} placeholder="50"
                    className="w-20 bg-[#0a0f1c] border border-[#1e293b] rounded-lg px-2 py-1.5 text-sm text-white focus:border-yellow-500 focus:outline-none" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">CA max (k€)</label>
                  <input type="number" value={caMax} onChange={e => setCaMax(e.target.value)} placeholder="500"
                    className="w-20 bg-[#0a0f1c] border border-[#1e293b] rounded-lg px-2 py-1.5 text-sm text-white focus:border-yellow-500 focus:outline-none" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Effectif max</label>
                  <input type="number" value={effectifMax} onChange={e => setEffectifMax(e.target.value)} placeholder="20"
                    className="w-20 bg-[#0a0f1c] border border-[#1e293b] rounded-lg px-2 py-1.5 text-sm text-white focus:border-yellow-500 focus:outline-none" /></div>
              </div>
            </div>
          )}
          {error && <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-2 text-xs text-red-400">{error}</div>}
          <div className="flex items-center gap-3">
            <button onClick={() => { reset(); mode==='maps' ? runMapsCampagne() : runPappersCampagne() }} disabled={loading}
              className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black font-bold px-6 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
              {loading ? progress || 'Scraping...' : 'Lancer la campagne'}
            </button>
            {loading && <button onClick={() => { abortRef.current = true }} className="text-sm text-gray-400 hover:text-red-400">Stop</button>}
            {!loading && results.length > 0 && <span className="text-xs text-gray-500">{filteredResults.length} résultats{siteFilter!=='tous'||phoneFilter!=='tous'?' (filtrés)':''} / {results.length} total</span>}
          </div>
        </div>

        {/* Résultats */}
        <div className="flex-1 overflow-y-auto p-4">
          {results.length === 0 && !loading && (
            <div className="text-center py-12"><Zap size={48} className="mx-auto text-gray-700 mb-4" />
              <p className="text-gray-500">Lancez une campagne pour scraper en masse</p>
              <p className="text-gray-600 text-sm mt-1">Plusieurs localisations seront scrapées automatiquement, les doublons éliminés</p>
            </div>
          )}
          {filteredResults.length > 0 && (
            <>
              <div className="flex items-center gap-3 mb-3">
                <button onClick={() => setSelected(prev => prev.size===filteredResults.length ? new Set() : new Set(filteredResults.map(r=>r._id)))}
                  className="text-xs text-yellow-400 hover:underline">
                  {selected.size===filteredResults.length?'Désélectionner':'Tout sélectionner'}
                </button>
                <span className="text-xs text-gray-500">{selected.size} sélectionné{selected.size>1?'s':''}</span>
              </div>
              <div className="space-y-2">
                {filteredResults.map(r => (
                  <div key={r._id} onClick={() => { const n=new Set(selected); n.has(r._id)?n.delete(r._id):n.add(r._id); setSelected(n) }}
                    className={`rounded-lg border p-3 cursor-pointer transition-all ${selected.has(r._id)?'border-yellow-500 bg-yellow-500/5':'border-[#1e293b] bg-[#0a0f1c] hover:border-[#2d3a4f]'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${selected.has(r._id)?'border-yellow-500 bg-yellow-500':'border-[#1e293b]'}`}>
                        {selected.has(r._id) && <Check size={12} className="text-black" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium text-sm">{r.entreprise}</span>
                          {r.loc && <span className="text-[10px] bg-[#1e293b] text-gray-400 px-1.5 py-0.5 rounded">{r.loc}</span>}
                          {r.naf && <span className="text-[10px] bg-[#1e293b] text-gray-400 px-1.5 py-0.5 rounded">{r.naf}</span>}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {r.telephone && <span className="text-xs text-[#3b82f6] flex items-center gap-1"><Phone size={10} />{r.telephone}</span>}
                          {r.siteWeb && <span className="text-xs text-gray-500 flex items-center gap-1"><Globe size={10} />{r.siteWeb.replace(/^https?:\/\/(www\.)?/,'').slice(0,35)}</span>}
                          {r.ville && <span className="text-xs text-gray-500 flex items-center gap-1"><MapPin size={10} />{r.ville}</span>}
                          {r.ca && <span className="text-xs text-green-400 flex items-center gap-1"><TrendingUp size={10} />CA: {r.ca>=1000000?(r.ca/1000000).toFixed(1)+'M€':r.ca>=1000?(r.ca/1000).toFixed(0)+'k€':r.ca+'€'}</span>}
                          {r.effectif && <span className="text-xs text-yellow-400 flex items-center gap-1"><Users size={10} />{r.effectif} sal.</span>}
                          {r.note && <span className="text-xs text-gray-600">{r.note}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {filteredResults.length > 0 && (
          <div className="p-4 border-t border-[#1e293b] space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500 flex items-center gap-1"><Tag size={12} />Tags :</span>
              {importTags.map((t, i) => (
                <span key={t} className={`px-2 py-0.5 rounded-full text-xs font-medium text-white flex items-center gap-1 ${TAG_COLORS[i % TAG_COLORS.length]}`}>
                  {t}<button onClick={() => setImportTags(p=>p.filter(x=>x!==t))}><X size={10} /></button>
                </span>
              ))}
              {tags.filter(t => !importTags.includes(t)).map(t => (
                <button key={t} onClick={() => addImportTag(t)}
                  className="px-2 py-0.5 rounded-full text-xs border border-dashed border-[#1e293b] text-gray-500 hover:text-white hover:border-yellow-500 transition-colors">+ {t}</button>
              ))}
              <input type="text" value={newImportTag} onChange={e => setNewImportTag(e.target.value)}
                onKeyDown={e => { if(e.key==='Enter') addImportTag(newImportTag) }}
                placeholder="Nouveau tag..." className="bg-[#0a0f1c] border border-[#1e293b] rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 focus:border-yellow-500 focus:outline-none w-28" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{results.length} résultats scrapés</span>
              <button onClick={handleImport} disabled={selected.size===0}
                className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black font-bold px-6 py-2 rounded-lg text-sm flex items-center gap-2">
                <Plus size={16} /> Importer {selected.size} contact{selected.size>1?'s':''}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SERPAPI SCRAPER MODAL ───
function SerpScraperModal({ isOpen, onClose, onImport, tags, onAddTag }) {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('France')
  const [engine, setEngine] = useState('google_maps')
  const [importTags, setImportTags] = useState([])
  const [newImportTag, setNewImportTag] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [totalSearched, setTotalSearched] = useState(0)
  const [siteFilter, setSiteFilter] = useState('tous') // 'tous' | 'sans_site' | 'avec_site'
  const [phoneFilter, setPhoneFilter] = useState('tous') // 'tous' | 'mobile' | 'fixe'
  const [maxResults, setMaxResults] = useState(60)
  const [loadingProgress, setLoadingProgress] = useState('')
  const abortRef = useRef(false)

  const isMobile = (tel) => {
    if (!tel) return false
    const clean = tel.replace(/[\s.\-()]/g, '')
    return /^(\+33|0033)?0?[67]/.test(clean) || /^0[67]/.test(clean)
  }

  const filteredResults = useMemo(() => {
    let list = results
    if (siteFilter === 'sans_site') list = list.filter(r => !r.siteWeb)
    else if (siteFilter === 'avec_site') list = list.filter(r => !!r.siteWeb)
    if (phoneFilter === 'mobile') list = list.filter(r => isMobile(r.telephone))
    else if (phoneFilter === 'fixe') list = list.filter(r => r.telephone && !isMobile(r.telephone))
    return list
  }, [results, siteFilter, phoneFilter])

  const reset = () => {
    setResults([])
    setSelected(new Set())
    setError('')
    setPage(0)
    setHasMore(false)
    setTotalSearched(0)
    setImportTags([])
    setNewImportTag('')
  }

  const addImportTag = (tag) => {
    const t = tag.trim()
    if (!t || importTags.includes(t)) return
    setImportTags(prev => [...prev, t])
    onAddTag(t)
    setNewImportTag('')
  }

  const removeImportTag = (tag) => {
    setImportTags(prev => prev.filter(t => t !== tag))
  }

  const fetchPage = async (pageNum) => {
    const key = getNextSerpKey()
    const params = new URLSearchParams({
      api_key: key,
      q: query.trim(),
      hl: 'fr',
      gl: 'fr',
    })

    if (engine === 'google_maps') {
      params.set('engine', 'google_maps')
      params.set('type', 'search')
      params.set('ll', '@46.603354,1.888334,6z')
      if (location.trim()) params.set('q', `${query.trim()} ${location.trim()}`)
      if (pageNum > 0) params.set('start', String(pageNum * 20))
    } else {
      params.set('engine', 'google')
      params.set('num', '20')
      if (location.trim()) params.set('location', location.trim())
      if (pageNum > 0) params.set('start', String(pageNum * 20))
    }

    const resp = await fetch(`/serpapi/search.json?${params.toString()}`)
    if (!resp.ok) {
      const text = await resp.text()
      if (resp.status === 429 || text.includes('rate limit')) {
        const key2 = getNextSerpKey()
        params.set('api_key', key2)
        const resp2 = await fetch(`/serpapi/search.json?${params.toString()}`)
        if (!resp2.ok) throw new Error(`Erreur API: ${resp2.status}`)
        return resp2.json()
      }
      throw new Error(`Erreur API: ${resp.status} - ${text.slice(0, 200)}`)
    }
    return resp.json()
  }

  const parseItems = (data) => {
    if (engine === 'google_maps') {
      const places = data.local_results || (data.place_results ? [data.place_results] : [])
      return places.map(p => ({
        _id: p.place_id || generateId(),
        entreprise: p.title || '',
        telephone: p.phone || '',
        adresse: p.address || '',
        ville: extractVille(p.address || ''),
        siteWeb: p.website || p.link || '',
        note: p.rating ? `${p.rating}/5 (${p.reviews || 0} avis)` : '',
        type: p.type || '',
        gps: p.gps_coordinates || null,
      }))
    } else {
      return (data.organic_results || []).map(r => ({
        _id: r.position?.toString() || generateId(),
        entreprise: r.title || '',
        telephone: '',
        adresse: '',
        ville: '',
        siteWeb: r.link || '',
        note: r.snippet || '',
        type: 'web',
      }))
    }
  }

  const doSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setResults([])
    setTotalSearched(0)
    setSelected(new Set())
    abortRef.current = false

    const allItems = []
    const seenIds = new Set()
    const totalPages = Math.ceil(maxResults / 20)

    try {
      for (let p = 0; p < totalPages; p++) {
        if (abortRef.current) break
        setLoadingProgress(`Page ${p + 1}/${totalPages} — ${allItems.length} résultats...`)

        const data = await fetchPage(p)
        const items = parseItems(data)

        const newItems = items.filter(i => !seenIds.has(i._id))
        newItems.forEach(i => { seenIds.add(i._id); allItems.push(i) })

        setResults([...allItems])
        setTotalSearched(allItems.length)

        if (items.length < 5) break // plus de résultats disponibles
        if (allItems.length >= maxResults) break
      }
      setHasMore(allItems.length >= maxResults)
      setPage(Math.ceil(allItems.length / 20) - 1)
    } catch (err) {
      setError(err.message || 'Erreur de connexion à SerpAPI')
    } finally {
      setLoading(false)
      setLoadingProgress('')
    }
  }

  const handleLoadMore = async () => {
    const nextPage = page + 1
    setLoading(true)
    setLoadingProgress('Chargement...')
    try {
      const data = await fetchPage(nextPage)
      const items = parseItems(data)
      const existingIds = new Set(results.map(r => r._id))
      const newItems = items.filter(i => !existingIds.has(i._id))
      setResults(prev => [...prev, ...newItems])
      setTotalSearched(prev => prev + newItems.length)
      setHasMore(items.length >= 5)
      setPage(nextPage)
    } catch (err) {
      setError(err.message || 'Erreur')
    } finally {
      setLoading(false)
      setLoadingProgress('')
    }
  }

  const extractVille = (address) => {
    if (!address) return ''
    // Try to extract city from French address format
    const parts = address.split(',').map(s => s.trim())
    if (parts.length >= 2) {
      // Usually the city is the second-to-last or last part
      const candidate = parts[parts.length - 1]
      // Remove postal code if present
      return candidate.replace(/^\d{5}\s*/, '').trim() || parts[parts.length - 2] || ''
    }
    return ''
  }

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === filteredResults.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredResults.map(r => r._id)))
    }
  }

  const handleImport = () => {
    const contacts = filteredResults
      .filter(r => selected.has(r._id))
      .map(r => ({
        id: generateId(),
        entreprise: r.entreprise,
        telephone: r.telephone,
        email: '',
        siteWeb: r.siteWeb,
        ville: r.ville || r.adresse,
        contact: '',
        poste: '',
        statut: STATUTS.NON_APPELE,
        dateDernierAppel: null,
        dateRappel: null,
        notes: r.note ? [{ id: generateId(), date: new Date().toISOString(), texte: `[SerpAPI] ${r.note}` }] : [],
        tags: [...importTags],
        historiqueAppels: [],
        fichierSource: `SerpAPI: "${query}"`,
        dateImport: new Date().toISOString(),
      }))
    importTags.forEach(t => onAddTag(t))
    onImport(contacts)
    reset()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#111827] rounded-xl border border-[#1e293b] max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1e293b]">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Radar size={20} className="text-[#3b82f6]" />
            Scraper SerpAPI
          </h2>
          <button onClick={() => { reset(); onClose() }} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Search form */}
        <div className="p-4 border-b border-[#1e293b] space-y-3">
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-gray-500 mb-1 block">Recherche</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') doSearch() }}
                  placeholder="ex: plombier, restaurant italien, agence web..."
                  className="w-full bg-[#0a0f1c] border border-[#1e293b] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none"
                />
              </div>
            </div>
            <div className="w-48">
              <label className="text-xs text-gray-500 mb-1 block">Localisation</label>
              <div className="relative">
                <MapPinned size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="Ville, région..."
                  className="w-full bg-[#0a0f1c] border border-[#1e293b] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none"
                />
              </div>
            </div>
            <div className="w-36">
              <label className="text-xs text-gray-500 mb-1 block">Moteur</label>
              <select
                value={engine}
                onChange={e => setEngine(e.target.value)}
                className="w-full bg-[#0a0f1c] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white focus:border-[#3b82f6] focus:outline-none"
              >
                <option value="google_maps">Google Maps</option>
                <option value="google">Google Search</option>
              </select>
            </div>
            <div className="w-24">
              <label className="text-xs text-gray-500 mb-1 block">Résultats</label>
              <select
                value={maxResults}
                onChange={e => setMaxResults(Number(e.target.value))}
                className="w-full bg-[#0a0f1c] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white focus:border-[#3b82f6] focus:outline-none"
              >
                <option value={20}>20</option>
                <option value={40}>40</option>
                <option value={60}>60</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => doSearch()}
                disabled={loading || !query.trim()}
                className="bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                {loading ? loadingProgress || 'Recherche...' : 'Rechercher'}
              </button>
              {loading && (
                <button onClick={() => { abortRef.current = true }} className="ml-2 text-gray-400 hover:text-red-400 text-xs">
                  Stop
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-gray-600">
              Rotation automatique des clés API ({SERPAPI_KEYS.length} clés configurées)
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Globe size={12} className="text-gray-500" />
                {[
                  { value: 'tous', label: 'Tous' },
                  { value: 'sans_site', label: 'Sans site web' },
                  { value: 'avec_site', label: 'Avec site web' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSiteFilter(opt.value)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      siteFilter === opt.value
                        ? 'bg-[#3b82f6] text-white'
                        : 'bg-[#0a0f1c] text-gray-400 hover:text-white border border-[#1e293b]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <Phone size={12} className="text-gray-500" />
                {[
                  { value: 'tous', label: 'Tous' },
                  { value: 'mobile', label: '06/07 uniquement' },
                  { value: 'fixe', label: 'Fixe uniquement' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setPhoneFilter(opt.value)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      phoneFilter === opt.value
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#0a0f1c] text-gray-400 hover:text-white border border-[#1e293b]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-3 bg-red-900/20 border border-red-800/30 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {results.length === 0 && !loading && (
            <div className="text-center py-12">
              <Radar size={48} className="mx-auto text-gray-700 mb-4" />
              <p className="text-gray-500">Lancez une recherche pour trouver des entreprises</p>
              <p className="text-gray-600 text-sm mt-1">Google Maps est recommandé pour la prospection (téléphone + adresse)</p>
            </div>
          )}

          {results.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={selectAll}
                    className="text-xs text-[#3b82f6] hover:underline"
                  >
                    {selected.size === filteredResults.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </button>
                  <span className="text-xs text-gray-500">
                    {selected.size} sélectionné{selected.size > 1 ? 's' : ''} / {filteredResults.length} résultats
                    {siteFilter !== 'tous' && ` (filtre : ${siteFilter === 'sans_site' ? 'sans site web' : 'avec site web'})`}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {filteredResults.map(r => (
                  <div
                    key={r._id}
                    onClick={() => toggleSelect(r._id)}
                    className={`rounded-lg border p-3 cursor-pointer transition-all ${
                      selected.has(r._id)
                        ? 'border-[#3b82f6] bg-[#3b82f6]/10'
                        : 'border-[#1e293b] bg-[#0a0f1c] hover:border-[#2d3a4f]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        selected.has(r._id) ? 'border-[#3b82f6] bg-[#3b82f6]' : 'border-[#1e293b]'
                      }`}>
                        {selected.has(r._id) && <Check size={12} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{r.entreprise}</span>
                          {r.type && r.type !== 'web' && (
                            <span className="text-xs bg-[#1e293b] text-gray-400 px-2 py-0.5 rounded-full">{r.type}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                          {r.telephone && (
                            <span className="text-xs text-[#3b82f6] flex items-center gap-1">
                              <Phone size={10} /> {r.telephone}
                            </span>
                          )}
                          {r.siteWeb && (
                            <span className="text-xs text-gray-400 flex items-center gap-1 truncate max-w-[250px]">
                              <Globe size={10} /> {r.siteWeb.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)}
                            </span>
                          )}
                          {(r.ville || r.adresse) && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <MapPin size={10} /> {r.ville || r.adresse}
                            </span>
                          )}
                        </div>
                        {r.note && (
                          <p className="text-xs text-gray-600 mt-1 truncate">{r.note}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Load more */}
              {hasMore && (
                <div className="text-center mt-4">
                  <button
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="text-sm text-[#3b82f6] hover:underline disabled:opacity-50 flex items-center gap-1 mx-auto"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
                    Charger plus de résultats
                  </button>
                </div>
              )}
            </>
          )}

          {loading && results.length === 0 && (
            <div className="text-center py-12">
              <Loader2 size={32} className="mx-auto text-[#3b82f6] animate-spin mb-4" />
              <p className="text-gray-400 text-sm">Recherche en cours...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="p-4 border-t border-[#1e293b] space-y-3">
            {/* Tags à appliquer */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500 flex items-center gap-1"><Tag size={12} /> Tags à appliquer :</span>
              {importTags.map((t, i) => (
                <span key={t} className={`px-2 py-0.5 rounded-full text-xs font-medium text-white flex items-center gap-1 ${TAG_COLORS[tags.indexOf(t) >= 0 ? tags.indexOf(t) % TAG_COLORS.length : i % TAG_COLORS.length]}`}>
                  {t}
                  <button onClick={() => removeImportTag(t)} className="hover:text-red-300"><X size={10} /></button>
                </span>
              ))}
              {tags.filter(t => !importTags.includes(t)).map((t, i) => (
                <button
                  key={t}
                  onClick={() => addImportTag(t)}
                  className="px-2 py-0.5 rounded-full text-xs border border-dashed border-[#1e293b] text-gray-500 hover:text-white hover:border-[#3b82f6] transition-colors"
                >
                  + {t}
                </button>
              ))}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newImportTag}
                  onChange={e => setNewImportTag(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addImportTag(newImportTag) }}
                  placeholder="Nouveau tag..."
                  className="bg-[#0a0f1c] border border-[#1e293b] rounded-lg px-2 py-1 text-xs text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none w-28"
                />
                <button
                  onClick={() => addImportTag(newImportTag)}
                  className="bg-[#1e293b] hover:bg-[#2d3a4f] text-white px-1.5 py-1 rounded-lg text-xs"
                >
                  <Plus size={12} />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{totalSearched} résultats trouvés</span>
              <button
                onClick={handleImport}
                disabled={selected.size === 0}
                className="bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Plus size={16} />
                Importer {selected.size} contact{selected.size > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CSV IMPORT MODAL ───
function CSVImportModal({ isOpen, onClose, onImport }) {
  const [files, setFiles] = useState([])
  const [parsedData, setParsedData] = useState([])
  const [columnMapping, setColumnMapping] = useState({})
  const [step, setStep] = useState(1) // 1: select files, 2: map columns
  const fileInputRef = useRef(null)

  const targetFields = [
    { key: 'entreprise', label: 'Nom entreprise' },
    { key: 'telephone', label: 'Téléphone' },
    { key: 'email', label: 'Email' },
    { key: 'siteWeb', label: 'Site web' },
    { key: 'ville', label: 'Ville' },
    { key: 'contact', label: 'Nom contact' },
    { key: 'poste', label: 'Poste / Fonction' },
  ]

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files)
    if (selectedFiles.length === 0) return

    const results = []
    let completed = 0

    selectedFiles.forEach((file, idx) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          results[idx] = { name: file.name, data: result.data, headers: result.meta.fields || [] }
          completed++
          if (completed === selectedFiles.length) {
            setFiles(selectedFiles)
            setParsedData(results)
            // Auto-detect column mapping from first file
            const allHeaders = [...new Set(results.flatMap(r => r.headers))]
            const autoMap = {}
            targetFields.forEach(f => {
              const match = allHeaders.find(h => {
                const lower = h.toLowerCase().trim()
                switch (f.key) {
                  case 'entreprise': return ['entreprise', 'société', 'societe', 'company', 'nom entreprise', 'raison sociale', 'nom'].includes(lower)
                  case 'telephone': return ['telephone', 'téléphone', 'tel', 'tél', 'phone', 'tel.', 'numéro'].includes(lower)
                  case 'email': return ['email', 'e-mail', 'mail', 'courriel', 'adresse email'].includes(lower)
                  case 'siteWeb': return ['site web', 'site', 'website', 'url', 'web', 'site internet'].includes(lower)
                  case 'ville': return ['ville', 'city', 'localité', 'commune', 'cp'].includes(lower)
                  case 'contact': return ['contact', 'nom contact', 'interlocuteur', 'prénom', 'nom complet', 'name'].includes(lower)
                  case 'poste': return ['poste', 'fonction', 'titre', 'title', 'role', 'rôle', 'job'].includes(lower)
                  default: return false
                }
              })
              autoMap[f.key] = match || ''
            })
            setColumnMapping(autoMap)
            setStep(2)
          }
        },
      })
    })
  }

  const allHeaders = useMemo(() => [...new Set(parsedData.flatMap(r => r.headers))], [parsedData])

  const handleImport = () => {
    const contacts = []
    parsedData.forEach(file => {
      file.data.forEach(row => {
        const contact = {
          id: generateId(),
          entreprise: '',
          telephone: '',
          email: '',
          siteWeb: '',
          ville: '',
          contact: '',
          poste: '',
          statut: STATUTS.NON_APPELE,
          dateDernierAppel: null,
          dateRappel: null,
          notes: [],
          historiqueAppels: [],
          fichierSource: file.name,
          dateImport: new Date().toISOString(),
        }
        targetFields.forEach(f => {
          if (columnMapping[f.key]) {
            contact[f.key] = (row[columnMapping[f.key]] || '').trim()
          }
        })
        // Skip empty rows
        if (contact.entreprise || contact.telephone || contact.email) {
          contacts.push(contact)
        }
      })
    })
    onImport(contacts)
    handleReset()
    onClose()
  }

  const handleReset = () => {
    setFiles([])
    setParsedData([])
    setColumnMapping({})
    setStep(1)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#111827] rounded-xl border border-[#1e293b] max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[#1e293b]">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Upload size={20} className="text-[#3b82f6]" />
            Importer des fichiers CSV
          </h2>
          <button onClick={() => { handleReset(); onClose() }} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(80vh-130px)]">
          {step === 1 && (
            <div className="text-center py-10">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#1e293b] rounded-xl p-10 cursor-pointer hover:border-[#3b82f6] transition-colors"
              >
                <FileUp size={48} className="mx-auto text-gray-500 mb-4" />
                <p className="text-gray-400 mb-2">Cliquez ou glissez vos fichiers CSV ici</p>
                <p className="text-gray-600 text-sm">Plusieurs fichiers seront fusionnés automatiquement</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="mb-4 flex flex-wrap gap-2">
                {parsedData.map((f, i) => (
                  <span key={i} className="bg-[#1e293b] text-sm px-3 py-1 rounded-full flex items-center gap-1">
                    <FileText size={14} className="text-[#3b82f6]" />
                    {f.name} ({f.data.length} lignes)
                  </span>
                ))}
              </div>

              {parsedData.length > 1 && (
                <div className="bg-[#3b82f6]/10 border border-[#3b82f6]/30 rounded-lg p-3 mb-4 flex items-start gap-2">
                  <AlertCircle size={16} className="text-[#3b82f6] mt-0.5 shrink-0" />
                  <p className="text-sm text-[#3b82f6]">
                    Fusion de {parsedData.length} fichiers — le fichier source sera indiqué sur chaque contact.
                  </p>
                </div>
              )}

              <h3 className="text-sm font-medium text-gray-400 mb-3">Associer les colonnes du CSV :</h3>
              <div className="space-y-2">
                {targetFields.map(field => (
                  <div key={field.key} className="flex items-center gap-3">
                    <label className="w-36 text-sm text-gray-300 shrink-0">{field.label}</label>
                    <select
                      value={columnMapping[field.key] || ''}
                      onChange={e => setColumnMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="flex-1 bg-[#0a0f1c] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white focus:border-[#3b82f6] focus:outline-none"
                    >
                      <option value="">— Ignorer —</option>
                      {allHeaders.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {parsedData[0]?.data?.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Aperçu (3 premières lignes) :</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#1e293b]">
                          {targetFields.filter(f => columnMapping[f.key]).map(f => (
                            <th key={f.key} className="px-2 py-1 text-left text-gray-500">{f.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedData[0].data.slice(0, 3).map((row, i) => (
                          <tr key={i} className="border-b border-[#1e293b]/50">
                            {targetFields.filter(f => columnMapping[f.key]).map(f => (
                              <td key={f.key} className="px-2 py-1 text-gray-300">{row[columnMapping[f.key]] || ''}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {step === 2 && (
          <div className="p-4 border-t border-[#1e293b] flex justify-between">
            <button onClick={handleReset} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
              ← Retour
            </button>
            <button
              onClick={handleImport}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Importer {parsedData.reduce((s, f) => s + f.data.length, 0)} contacts
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── EDITABLE FIELD ───
function EditField({ icon: Icon, label, value, onSave, type = 'text', link, linkExternal }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value || '')
  const inputRef = useRef(null)

  useEffect(() => { setDraft(value || '') }, [value])
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus() }, [editing])

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed !== (value || '')) onSave(trimmed)
    setEditing(false)
  }
  const cancel = () => { setDraft(value || ''); setEditing(false) }

  if (editing) {
    return (
      <div className="flex items-center gap-2 text-sm group">
        <Icon size={14} className="text-gray-500 shrink-0" />
        <input
          ref={inputRef}
          type={type}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') cancel()
          }}
          placeholder={label}
          className="flex-1 bg-[#0a0f1c] border border-[#3b82f6] rounded-lg px-2 py-1 text-sm text-white placeholder-gray-600 focus:outline-none"
        />
      </div>
    )
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="flex items-center gap-2 text-sm group cursor-pointer hover:bg-[#1e293b]/40 rounded px-1 py-0.5 -mx-1 transition-colors"
    >
      <Icon size={14} className="text-gray-500 shrink-0" />
      {value ? (
        link ? (
          <a
            href={link}
            target={linkExternal ? '_blank' : undefined}
            rel={linkExternal ? 'noreferrer' : undefined}
            onClick={e => e.stopPropagation()}
            className="text-[#3b82f6] hover:underline truncate flex-1"
          >
            {value}
          </a>
        ) : (
          <span className="flex-1 truncate">{value}</span>
        )
      ) : (
        <span className="text-gray-600 italic flex-1">Ajouter {label.toLowerCase()}...</span>
      )}
      <Edit2 size={11} className="text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </div>
  )
}

// ─── ADD CONTACT MODAL ───
function AddContactModal({ isOpen, onClose, onAdd, tags, onAddTag }) {
  const [form, setForm] = useState({
    entreprise: '', contact: '', poste: '', telephone: '', email: '', siteWeb: '', ville: '',
  })
  const [selectedTags, setSelectedTags] = useState([])
  const [newTag, setNewTag] = useState('')

  const reset = () => {
    setForm({ entreprise: '', contact: '', poste: '', telephone: '', email: '', siteWeb: '', ville: '' })
    setSelectedTags([])
    setNewTag('')
  }

  const handleSubmit = () => {
    if (!form.entreprise && !form.telephone && !form.email) {
      alert('Au moins un champ doit être rempli (entreprise, téléphone ou email)')
      return
    }
    const contact = {
      id: generateId(),
      ...form,
      statut: STATUTS.NON_APPELE,
      dateDernierAppel: null,
      dateRappel: null,
      notes: [],
      historiqueAppels: [],
      enregistrements: [],
      tags: [...selectedTags],
      fichierSource: 'Ajout manuel',
      dateImport: new Date().toISOString(),
    }
    onAdd([contact])
    reset()
    onClose()
  }

  const toggleTag = (t) => {
    setSelectedTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  const addNewTag = () => {
    const t = newTag.trim()
    if (!t) return
    onAddTag(t)
    if (!selectedTags.includes(t)) setSelectedTags(prev => [...prev, t])
    setNewTag('')
  }

  if (!isOpen) return null

  const fields = [
    { key: 'entreprise', label: 'Nom entreprise *', icon: Building2 },
    { key: 'contact', label: 'Nom du contact', icon: Users },
    { key: 'poste', label: 'Poste / Fonction', icon: Tag },
    { key: 'telephone', label: 'Téléphone', icon: Phone, type: 'tel' },
    { key: 'email', label: 'Email', icon: Mail, type: 'email' },
    { key: 'siteWeb', label: 'Site web', icon: Globe },
    { key: 'ville', label: 'Ville', icon: MapPin },
  ]

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#111827] rounded-xl border border-[#1e293b] max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[#1e293b]">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <UserPlus size={20} className="text-[#3b82f6]" />
            Ajouter un contact
          </h2>
          <button onClick={() => { reset(); onClose() }} className="text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3">
          {fields.map(({ key, label, icon: Icon, type }) => (
            <div key={key}>
              <label className="text-xs text-gray-500 mb-1 block">{label}</label>
              <div className="relative">
                <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={type || 'text'}
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter' && key === 'ville') handleSubmit() }}
                  placeholder={label}
                  className="w-full bg-[#0a0f1c] border border-[#1e293b] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none"
                />
              </div>
            </div>
          ))}

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Tags secteur</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((t, i) => (
                <button
                  key={t}
                  onClick={() => toggleTag(t)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    selectedTags.includes(t)
                      ? `${TAG_COLORS[i % TAG_COLORS.length]} text-white`
                      : 'bg-[#0a0f1c] text-gray-400 border border-[#1e293b] hover:text-white'
                  }`}
                >
                  {selectedTags.includes(t) && '✓ '}{t}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addNewTag() }}
                placeholder="Nouveau tag..."
                className="flex-1 bg-[#0a0f1c] border border-[#1e293b] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none"
              />
              <button onClick={addNewTag} className="bg-[#1e293b] hover:bg-[#2d3a4f] text-white px-3 py-1.5 rounded-lg text-xs">
                <Plus size={12} />
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#1e293b] flex justify-end gap-2">
          <button onClick={() => { reset(); onClose() }} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white px-6 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Save size={14} /> Créer le contact
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CONTACT DETAIL PANEL ───
function ContactPanel({ contact, onClose, onUpdate, tags, onAddTag }) {
  const [noteText, setNoteText] = useState('')
  const [dateRappel, setDateRappel] = useState('')
  const [showRappelInput, setShowRappelInput] = useState(false)
  const [newTagInput, setNewTagInput] = useState('')
  const [showTagPicker, setShowTagPicker] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [playingId, setPlayingId] = useState(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const audioRef = useRef(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    }
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach(t => t.stop())
        const reader = new FileReader()
        reader.onloadend = () => {
          const enregistrement = {
            id: generateId(),
            date: new Date().toISOString(),
            duree: recordingTime,
            audio: reader.result,
          }
          onUpdate(contact.id, {
            enregistrements: [enregistrement, ...(contact.enregistrements || [])],
          })
        }
        reader.readAsDataURL(blob)
        setRecordingTime(0)
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch {
      alert('Impossible d\'accéder au microphone. Vérifiez les permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  const playAudio = (enr) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (playingId === enr.id) { setPlayingId(null); return }
    const audio = new Audio(enr.audio)
    audioRef.current = audio
    setPlayingId(enr.id)
    audio.onended = () => { setPlayingId(null); audioRef.current = null }
    audio.play()
  }

  const deleteEnregistrement = (enrId) => {
    if (audioRef.current && playingId === enrId) { audioRef.current.pause(); audioRef.current = null; setPlayingId(null) }
    onUpdate(contact.id, {
      enregistrements: (contact.enregistrements || []).filter(e => e.id !== enrId),
    })
  }

  const formatTimer = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  if (!contact) return null

  const handleStatut = (statut) => {
    const current = getStatuts(contact)

    // "Pas appelé" = reset complet
    if (statut === STATUTS.NON_APPELE) {
      onUpdate(contact.id, {
        statut: STATUTS.NON_APPELE,
        statuts: [STATUTS.NON_APPELE],
        dateRappel: null,
      })
      return
    }

    // Si déjà présent → on le retire
    if (current.includes(statut)) {
      const next = current.filter(s => s !== statut && s !== STATUTS.NON_APPELE)
      const finalList = next.length > 0 ? next : [STATUTS.NON_APPELE]
      const updates = {
        statut: finalList[0],
        statuts: finalList,
      }
      if (statut === STATUTS.RAPPELER) updates.dateRappel = null
      onUpdate(contact.id, updates)
      return
    }

    // Sinon on l'ajoute
    const next = [...current.filter(s => s !== STATUTS.NON_APPELE), statut]
    const appel = {
      id: generateId(),
      date: new Date().toISOString(),
      statut,
    }
    const updates = {
      statut: next[0],
      statuts: next,
      dateDernierAppel: appel.date,
      historiqueAppels: [appel, ...contact.historiqueAppels],
    }
    if (statut === STATUTS.RAPPELER) {
      setShowRappelInput(true)
      // On applique quand même l'ajout du statut (sans dateRappel encore)
      onUpdate(contact.id, updates)
      return
    }
    onUpdate(contact.id, updates)
  }

  const handleRappelConfirm = () => {
    onUpdate(contact.id, {
      dateRappel: dateRappel || null,
    })
    setShowRappelInput(false)
    setDateRappel('')
  }

  const handleAddNote = () => {
    if (!noteText.trim()) return
    const note = {
      id: generateId(),
      date: new Date().toISOString(),
      texte: noteText.trim(),
    }
    onUpdate(contact.id, {
      notes: [note, ...contact.notes],
    })
    setNoteText('')
  }

  const Icon = STATUT_ICONS[contact.statut] || Phone

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-end z-50" onClick={onClose}>
      <div
        className="bg-[#111827] w-full max-w-lg h-full overflow-y-auto border-l border-[#1e293b] animate-slide-in"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'slideIn 0.2s ease-out' }}
      >
        <div className="sticky top-0 bg-[#111827] border-b border-[#1e293b] p-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold truncate flex items-center gap-2">
            <Building2 size={20} className="text-[#3b82f6] shrink-0" />
            {contact.entreprise || 'Sans nom'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* Infos éditables */}
          <div className="space-y-1">
            <EditField icon={Building2} label="Entreprise" value={contact.entreprise} onSave={v => onUpdate(contact.id, { entreprise: v })} />
            <EditField icon={Users} label="Contact" value={contact.contact} onSave={v => onUpdate(contact.id, { contact: v })} />
            <EditField icon={Tag} label="Poste" value={contact.poste} onSave={v => onUpdate(contact.id, { poste: v })} />
            <EditField icon={Phone} label="Téléphone" value={contact.telephone} type="tel" link={contact.telephone ? `tel:${contact.telephone}` : null} onSave={v => onUpdate(contact.id, { telephone: v })} />
            <EditField icon={Mail} label="Email" value={contact.email} type="email" link={contact.email ? `mailto:${contact.email}` : null} onSave={v => onUpdate(contact.id, { email: v })} />
            <EditField icon={Globe} label="Site web" value={contact.siteWeb} link={contact.siteWeb ? (contact.siteWeb.startsWith('http') ? contact.siteWeb : `https://${contact.siteWeb}`) : null} linkExternal onSave={v => onUpdate(contact.id, { siteWeb: v })} />
            <EditField icon={MapPin} label="Ville" value={contact.ville} onSave={v => onUpdate(contact.id, { ville: v })} />
            {contact.fichierSource && (
              <div className="flex items-center gap-2 text-sm pt-1">
                <FileText size={14} className="text-gray-500 shrink-0" />
                <span className="text-gray-500 text-xs">Source : {contact.fichierSource}</span>
              </div>
            )}
          </div>

          {/* Statut actuel */}
          <div className="flex items-center gap-2 flex-wrap">
            {getStatuts(contact).map(s => (
              <span key={s} className={`px-3 py-1 rounded-full text-xs font-medium text-white ${STATUT_COLORS[s]}`}>
                {s}
              </span>
            ))}
            {contact.dateRappel && hasStatut(contact, STATUTS.RAPPELER) && (
              <span className="text-xs text-yellow-400 flex items-center gap-1">
                <Calendar size={12} />
                Rappel : {formatDate(contact.dateRappel)}
              </span>
            )}
          </div>

          {/* Tags secteur */}
          <div>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Secteur / Tags</h3>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(contact.tags || []).map(t => (
                <span key={t} className={`px-2.5 py-0.5 rounded-full text-xs font-medium text-white flex items-center gap-1 ${TAG_COLORS[(tags.indexOf(t)) % TAG_COLORS.length] || 'bg-gray-600'}`}>
                  {t}
                  <button onClick={() => onUpdate(contact.id, { tags: (contact.tags || []).filter(x => x !== t) })} className="hover:text-red-300 ml-0.5">
                    <X size={10} />
                  </button>
                </span>
              ))}
              {!showTagPicker && (
                <button onClick={() => setShowTagPicker(true)} className="px-2 py-0.5 rounded-full text-xs border border-dashed border-[#1e293b] text-gray-500 hover:text-white hover:border-[#3b82f6] flex items-center gap-1 transition-colors">
                  <Plus size={10} /> Ajouter
                </button>
              )}
            </div>
            {showTagPicker && (
              <div className="bg-[#0a0f1c] rounded-lg p-3 border border-[#1e293b] space-y-2">
                {tags.filter(t => !(contact.tags || []).includes(t)).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.filter(t => !(contact.tags || []).includes(t)).map(t => (
                      <button
                        key={t}
                        onClick={() => { onUpdate(contact.id, { tags: [...(contact.tags || []), t] }); }}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium text-white hover:opacity-80 transition-opacity ${TAG_COLORS[tags.indexOf(t) % TAG_COLORS.length]}`}
                      >
                        + {t}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={e => setNewTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newTagInput.trim()) {
                        const tag = newTagInput.trim()
                        onAddTag(tag)
                        onUpdate(contact.id, { tags: [...new Set([...(contact.tags || []), tag])] })
                        setNewTagInput('')
                      }
                    }}
                    placeholder="Nouveau secteur..."
                    className="flex-1 bg-[#111827] border border-[#1e293b] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      if (newTagInput.trim()) {
                        const tag = newTagInput.trim()
                        onAddTag(tag)
                        onUpdate(contact.id, { tags: [...new Set([...(contact.tags || []), tag])] })
                        setNewTagInput('')
                      }
                    }}
                    className="bg-[#3b82f6] hover:bg-[#2563eb] text-white px-3 py-1.5 rounded-lg text-xs transition-colors"
                  >
                    <Plus size={12} />
                  </button>
                  <button onClick={() => { setShowTagPicker(false); setNewTagInput('') }} className="text-gray-500 hover:text-white text-xs px-2">
                    Fermer
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Boutons statut */}
          <div>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Changer le statut</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(STATUTS).map(statut => {
                const SIcon = STATUT_ICONS[statut]
                return (
                  <button
                    key={statut}
                    onClick={() => handleStatut(statut)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border border-[#1e293b] hover:border-[#3b82f6] ${hasStatut(contact, statut) ? `ring-2 ring-[#3b82f6] ${STATUT_COLORS[statut]}/20 bg-[#1e293b]` : 'bg-[#0a0f1c]'}`}
                  >
                    <SIcon size={14} />
                    {statut}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Rappel date picker */}
          {showRappelInput && (
            <div className="bg-[#0a0f1c] rounded-lg p-3 border border-yellow-600/30 space-y-2">
              <label className="text-sm text-yellow-400 flex items-center gap-1">
                <Calendar size={14} />
                Date et heure de rappel
              </label>
              <input
                type="datetime-local"
                value={dateRappel}
                onChange={e => setDateRappel(e.target.value)}
                className="w-full bg-[#111827] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white focus:border-[#3b82f6] focus:outline-none"
              />
              <div className="flex gap-2">
                <button onClick={handleRappelConfirm} className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-1.5 rounded-lg text-sm">
                  Confirmer
                </button>
                <button onClick={() => setShowRappelInput(false)} className="text-gray-400 hover:text-white text-sm">
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Ajouter une note</h3>
            <div className="flex gap-2">
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Note d'appel..."
                rows={2}
                className="flex-1 bg-[#0a0f1c] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none resize-none"
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleAddNote() }}
              />
              <button onClick={handleAddNote} className="bg-[#3b82f6] hover:bg-[#2563eb] text-white px-3 rounded-lg transition-colors shrink-0">
                <MessageSquare size={16} />
              </button>
            </div>
            {contact.notes.length > 0 && (
              <div className="mt-3 space-y-2">
                {contact.notes.map(note => (
                  <div key={note.id} className="bg-[#0a0f1c] rounded-lg p-3 border border-[#1e293b]">
                    <p className="text-sm text-gray-300">{note.texte}</p>
                    <p className="text-xs text-gray-600 mt-1">{formatDate(note.date)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Enregistrements audio */}
          <div>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Enregistrer l'appel</h3>
            <div className="flex items-center gap-3 mb-3">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <Mic size={16} /> Enregistrer
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={stopRecording}
                    className="flex items-center gap-2 bg-[#1e293b] hover:bg-[#2d3a4f] text-red-400 px-4 py-2 rounded-lg text-sm font-medium transition-colors animate-pulse"
                  >
                    <Square size={14} /> Arrêter
                  </button>
                  <span className="text-red-400 text-sm font-mono flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    {formatTimer(recordingTime)}
                  </span>
                </div>
              )}
            </div>
            {(contact.enregistrements || []).length > 0 && (
              <div className="space-y-2">
                {(contact.enregistrements || []).map(enr => (
                  <div key={enr.id} className="bg-[#0a0f1c] rounded-lg p-3 border border-[#1e293b] flex items-center gap-3">
                    <button
                      onClick={() => playAudio(enr)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                        playingId === enr.id ? 'bg-[#3b82f6] text-white' : 'bg-[#1e293b] text-gray-400 hover:text-white'
                      }`}
                    >
                      {playingId === enr.id ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400">{formatDate(enr.date)}</p>
                      <p className="text-xs text-gray-600">Durée : {formatTimer(enr.duree)}</p>
                    </div>
                    <button
                      onClick={() => deleteEnregistrement(enr.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors shrink-0"
                    >
                      <Trash2Icon size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Historique */}
          <div>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Historique des appels ({contact.historiqueAppels.length})
            </h3>
            {contact.historiqueAppels.length === 0 ? (
              <p className="text-sm text-gray-600">Aucun appel enregistré</p>
            ) : (
              <div className="space-y-1">
                {contact.historiqueAppels.map(appel => (
                  <div key={appel.id} className="flex items-center gap-2 py-1.5 text-sm border-b border-[#1e293b]/50">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${STATUT_COLORS[appel.statut]}`} />
                    <span className="text-gray-400">{formatDate(appel.date)}</span>
                    <span className="text-gray-300">{appel.statut}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── STATS PAGE ───
function StatsPage({ contacts, tags }) {
  const stats = useMemo(() => {
    const total = contacts.length
    if (total === 0) return null

    // Par statut
    const parStatut = {}
    Object.values(STATUTS).forEach(s => { parStatut[s] = 0 })
    contacts.forEach(c => {
      getStatuts(c).forEach(s => { parStatut[s] = (parStatut[s] || 0) + 1 })
    })

    // Par tag
    const parTag = {}
    contacts.forEach(c => {
      (c.tags || []).forEach(t => { parTag[t] = (parTag[t] || 0) + 1 })
    })

    // Appelés aujourd'hui
    const today = new Date().toDateString()
    const appelésAujourd = contacts.filter(c => c.dateDernierAppel && new Date(c.dateDernierAppel).toDateString() === today).length

    // Progression semaine (7 derniers jours)
    const parJour = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      parJour[d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' })] = 0
    }
    contacts.forEach(c => {
      if (!c.dateDernierAppel) return
      const d = new Date(c.dateDernierAppel)
      const now = new Date()
      const diff = Math.floor((now - d) / 86400000)
      if (diff <= 6) {
        const key = d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' })
        if (parJour[key] !== undefined) parJour[key]++
      }
    })

    // Taux
    const appelés = contacts.filter(c => !hasStatut(c, STATUTS.NON_APPELE)).length
    const interesses = contacts.filter(c => hasStatut(c, STATUTS.INTERESSE)).length
    const pasInteresses = contacts.filter(c => hasStatut(c, STATUTS.PAS_INTERESSE)).length
    const injoignables = contacts.filter(c => hasStatut(c, STATUTS.INJOIGNABLE)).length
    const rappeler = contacts.filter(c => hasStatut(c, STATUTS.RAPPELER)).length
    const tauxConversion = appelés > 0 ? ((interesses / appelés) * 100).toFixed(1) : '0.0'
    const tauxDecroché = appelés > 0 ? (((appelés - injoignables) / appelés) * 100).toFixed(1) : '0.0'

    // Avec/sans site, avec/sans tel
    const avecTel = contacts.filter(c => c.telephone).length
    const avecSite = contacts.filter(c => c.siteWeb).length
    const mobile = contacts.filter(c => {
      const clean = (c.telephone || '').replace(/[\s.\-()]/g, '')
      return /^0[67]/.test(clean) || /^(\+33|0033)[67]/.test(clean)
    }).length

    // Notes & enregistrements
    const totalNotes = contacts.reduce((s, c) => s + (c.notes || []).length, 0)
    const totalEnreg = contacts.reduce((s, c) => s + (c.enregistrements || []).length, 0)
    const totalAppels = contacts.reduce((s, c) => s + (c.historiqueAppels || []).length, 0)

    // Source
    const parSource = {}
    contacts.forEach(c => {
      const src = c.fichierSource ? c.fichierSource.split(':')[0].trim() : 'Inconnu'
      parSource[src] = (parSource[src] || 0) + 1
    })

    return {
      total, appelés, interesses, pasInteresses, injoignables, rappeler,
      tauxConversion, tauxDecroché, appelésAujourd,
      avecTel, avecSite, mobile, totalNotes, totalEnreg, totalAppels,
      parStatut, parTag, parJour, parSource,
      progression: total > 0 ? ((appelés / total) * 100).toFixed(1) : '0.0'
    }
  }, [contacts])

  if (!stats) return (
    <div className="flex-1 flex items-center justify-center text-center py-24">
      <div>
        <PieChart size={56} className="mx-auto text-gray-700 mb-4" />
        <p className="text-gray-500 text-lg">Aucun contact pour générer des statistiques</p>
        <p className="text-gray-600 text-sm mt-1">Importez des contacts pour commencer</p>
      </div>
    </div>
  )

  const maxJour = Math.max(...Object.values(stats.parJour), 1)
  const maxTag = Math.max(...Object.values(stats.parTag), 1)

  const StatCard = ({ label, value, sub, icon: Icon, color = 'text-[#3b82f6]' }) => (
    <div className="bg-[#111827] rounded-xl border border-[#1e293b] p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={18} className={color} />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )

  return (
    <div className="max-w-[1600px] mx-auto p-4 space-y-6">

      {/* KPIs principaux */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="Total contacts" value={stats.total} icon={Users} color="text-[#3b82f6]" />
        <StatCard label="Appelés" value={stats.appelés} sub={`${stats.progression}% du total`} icon={PhoneCall} color="text-blue-400" />
        <StatCard label="Aujourd'hui" value={stats.appelésAujourd} icon={Activity} color="text-cyan-400" />
        <StatCard label="Intéressés" value={stats.interesses} icon={Star} color="text-green-400" />
        <StatCard label="À rappeler" value={stats.rappeler} icon={PhoneForwarded} color="text-yellow-400" />
        <StatCard label="Taux conversion" value={`${stats.tauxConversion}%`} sub="intéressés / appelés" icon={Target} color="text-emerald-400" />
        <StatCard label="Taux décroché" value={`${stats.tauxDecroché}%`} sub="réponses / appels" icon={Award} color="text-purple-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Répartition par statut */}
        <div className="bg-[#111827] rounded-xl border border-[#1e293b] p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <PieChart size={16} className="text-[#3b82f6]" /> Répartition par statut
          </h2>
          <div className="space-y-2.5">
            {Object.entries(stats.parStatut).map(([statut, count]) => {
              const pct = stats.total > 0 ? (count / stats.total * 100).toFixed(1) : 0
              return (
                <div key={statut}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-400">{statut}</span>
                    <span className="text-white font-medium">{count} <span className="text-gray-500">({pct}%)</span></span>
                  </div>
                  <div className="w-full bg-[#1e293b] rounded-full h-2">
                    <div className={`h-2 rounded-full ${STATUT_COLORS[statut]} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Activité des 7 derniers jours */}
        <div className="bg-[#111827] rounded-xl border border-[#1e293b] p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Activity size={16} className="text-[#3b82f6]" /> Appels — 7 derniers jours
          </h2>
          <div className="flex items-end gap-2 h-32">
            {Object.entries(stats.parJour).map(([jour, count]) => {
              const h = maxJour > 0 ? (count / maxJour * 100) : 0
              return (
                <div key={jour} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-white font-medium">{count > 0 ? count : ''}</span>
                  <div className="w-full rounded-t relative" style={{ height: '80px' }}>
                    <div
                      className="absolute bottom-0 w-full bg-[#3b82f6] rounded-t transition-all"
                      style={{ height: `${Math.max(h, count > 0 ? 8 : 2)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 text-center leading-tight">{jour}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Source des contacts */}
        <div className="bg-[#111827] rounded-xl border border-[#1e293b] p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <FileText size={16} className="text-[#3b82f6]" /> Source des contacts
          </h2>
          <div className="space-y-2.5">
            {Object.entries(stats.parSource).sort((a, b) => b[1] - a[1]).map(([src, count], i) => {
              const pct = (count / stats.total * 100).toFixed(1)
              const colors = ['bg-[#3b82f6]', 'bg-emerald-500', 'bg-violet-500', 'bg-yellow-500', 'bg-rose-500', 'bg-cyan-500']
              return (
                <div key={src}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-400 truncate max-w-[160px]">{src}</span>
                    <span className="text-white font-medium shrink-0">{count} <span className="text-gray-500">({pct}%)</span></span>
                  </div>
                  <div className="w-full bg-[#1e293b] rounded-full h-2">
                    <div className={`h-2 rounded-full ${colors[i % colors.length]}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Tags secteur */}
        {Object.keys(stats.parTag).length > 0 && (
          <div className="bg-[#111827] rounded-xl border border-[#1e293b] p-5">
            <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
              <Tag size={16} className="text-[#3b82f6]" /> Contacts par secteur
            </h2>
            <div className="space-y-2.5">
              {Object.entries(stats.parTag).sort((a, b) => b[1] - a[1]).map(([tag, count], i) => {
                const pct = (count / stats.total * 100).toFixed(1)
                return (
                  <div key={tag}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium text-white ${TAG_COLORS[tags.indexOf(tag) % TAG_COLORS.length] || 'bg-gray-600'}`}>{tag}</span>
                      <span className="text-white font-medium">{count} <span className="text-gray-500">({pct}%)</span></span>
                    </div>
                    <div className="w-full bg-[#1e293b] rounded-full h-2">
                      <div className={`h-2 rounded-full ${TAG_COLORS[tags.indexOf(tag) % TAG_COLORS.length] || 'bg-gray-600'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Données qualité */}
        <div className="bg-[#111827] rounded-xl border border-[#1e293b] p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-[#3b82f6]" /> Qualité des données
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Avec téléphone', value: stats.avecTel, color: 'text-blue-400' },
              { label: 'Mobiles 06/07', value: stats.mobile, color: 'text-green-400' },
              { label: 'Avec site web', value: stats.avecSite, color: 'text-violet-400' },
              { label: 'Total appels', value: stats.totalAppels, color: 'text-cyan-400' },
              { label: 'Notes rédigées', value: stats.totalNotes, color: 'text-yellow-400' },
              { label: 'Enregistrements', value: stats.totalEnreg, color: 'text-rose-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[#0a0f1c] rounded-lg p-3">
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                <div className="w-full bg-[#1e293b] rounded-full h-1 mt-2">
                  <div className={`h-1 rounded-full bg-current ${color}`} style={{ width: `${Math.min((value / stats.total) * 100, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Progression globale */}
      <div className="bg-[#111827] rounded-xl border border-[#1e293b] p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
          <Target size={16} className="text-[#3b82f6]" /> Progression de la campagne
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>Appelés</span><span>{stats.appelés} / {stats.total}</span>
            </div>
            <div className="w-full bg-[#1e293b] rounded-full h-3">
              <div className="bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] h-3 rounded-full" style={{ width: `${stats.progression}%` }} />
            </div>
            <p className="text-right text-xs text-gray-400 mt-1">{stats.progression}%</p>
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>Intéressés</span><span>{stats.interesses} / {stats.appelés}</span>
            </div>
            <div className="w-full bg-[#1e293b] rounded-full h-3">
              <div className="bg-gradient-to-r from-green-500 to-emerald-400 h-3 rounded-full" style={{ width: `${stats.tauxConversion}%` }} />
            </div>
            <p className="text-right text-xs text-gray-400 mt-1">{stats.tauxConversion}%</p>
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>Taux décroché</span><span>{stats.appelés - stats.injoignables} / {stats.appelés}</span>
            </div>
            <div className="w-full bg-[#1e293b] rounded-full h-3">
              <div className="bg-gradient-to-r from-yellow-500 to-orange-400 h-3 rounded-full" style={{ width: `${stats.tauxDecroché}%` }} />
            </div>
            <p className="text-right text-xs text-gray-400 mt-1">{stats.tauxDecroché}%</p>
          </div>
        </div>
      </div>

    </div>
  )
}

// ─── MAIN APP ───
export default function App() {
  const [contacts, setContacts] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [search, setSearch] = useState('')
  const [filtreStatut, setFiltreStatut] = useState('Tous')
  const [sortCol, setSortCol] = useState('entreprise')
  const [sortDir, setSortDir] = useState('asc')
  const [selectedId, setSelectedId] = useState(null)
  const [page, setPage] = useState('contacts') // 'contacts' | 'stats'
  const [showImport, setShowImport] = useState(false)
  const [showScraper, setShowScraper] = useState(false)
  const [showAddContact, setShowAddContact] = useState(false)
  const [showPappers, setShowPappers] = useState(false)
  const [showCampagne, setShowCampagne] = useState(false)
  const [filtreTag, setFiltreTag] = useState('Tous')
  const [checkedIds, setCheckedIds] = useState(new Set())
  const [showBulkTagPicker, setShowBulkTagPicker] = useState(false)
  const [bulkNewTag, setBulkNewTag] = useState('')
  const [tags, setTags] = useState(() => {
    try {
      const saved = localStorage.getItem(TAGS_STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [notifPermission, setNotifPermission] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  )
  const [showRappelPanel, setShowRappelPanel] = useState(false)
  const backupInputRef = useRef(null)

  // Save to localStorage on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts))
  }, [contacts])

  useEffect(() => {
    localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tags))
  }, [tags])

  // ─── Rappels à venir ───
  const rappelsPending = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
    const inTwoDays = new Date(today); inTwoDays.setDate(inTwoDays.getDate() + 2)
    return contacts
      .filter(c => hasStatut(c, STATUTS.RAPPELER) && c.dateRappel)
      .map(c => {
        const d = new Date(c.dateRappel); d.setHours(0, 0, 0, 0)
        let type = null
        if (d.getTime() === today.getTime()) type = 'today'
        else if (d.getTime() === tomorrow.getTime()) type = 'tomorrow'
        else if (d.getTime() < today.getTime()) type = 'overdue'
        return { contact: c, date: d, type }
      })
      .filter(r => r.type && r.date.getTime() < inTwoDays.getTime())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [contacts])

  // ─── Notifications navigateur ───
  const requestNotifPermission = async () => {
    if (typeof Notification === 'undefined') {
      alert('Votre navigateur ne supporte pas les notifications.')
      return
    }
    const result = await Notification.requestPermission()
    setNotifPermission(result)
  }

  // Déclenche les notifs au montage et toutes les heures
  useEffect(() => {
    if (notifPermission !== 'granted') return

    const NOTIF_SENT_KEY = 'coldcall_notif_sent'
    const getSentToday = () => {
      try {
        const raw = localStorage.getItem(NOTIF_SENT_KEY)
        if (!raw) return {}
        const data = JSON.parse(raw)
        const todayStr = new Date().toDateString()
        return data.date === todayStr ? data.ids : {}
      } catch { return {} }
    }
    const saveSent = (ids) => {
      localStorage.setItem(NOTIF_SENT_KEY, JSON.stringify({ date: new Date().toDateString(), ids }))
    }

    const checkAndNotify = () => {
      const sent = getSentToday()
      rappelsPending.forEach(({ contact, type }) => {
        const notifKey = `${contact.id}_${type}`
        if (sent[notifKey]) return
        let title = ''
        let body = ''
        if (type === 'today') {
          title = '📞 Rappel aujourd\'hui'
          body = `${contact.entreprise || 'Contact'} — ${contact.telephone || ''}`
        } else if (type === 'tomorrow') {
          title = '⏰ Rappel demain'
          body = `${contact.entreprise || 'Contact'} — à rappeler demain`
        } else if (type === 'overdue') {
          title = '⚠️ Rappel en retard'
          body = `${contact.entreprise || 'Contact'} — à rappeler depuis le ${formatDateShort(contact.dateRappel)}`
        }
        try {
          const notif = new Notification(title, { body, tag: notifKey, requireInteraction: type === 'today' })
          notif.onclick = () => { window.focus(); setSelectedId(contact.id); notif.close() }
          sent[notifKey] = true
        } catch {}
      })
      saveSent(sent)
    }

    checkAndNotify()
    const interval = setInterval(checkAndNotify, 60 * 60 * 1000) // toutes les heures
    return () => clearInterval(interval)
  }, [notifPermission, rappelsPending])

  const handleAddTag = useCallback((tag) => {
    setTags(prev => prev.includes(tag) ? prev : [...prev, tag])
  }, [])

  // Stats
  const stats = useMemo(() => {
    const total = contacts.length
    const nonAppeles = contacts.filter(c => hasStatut(c, STATUTS.NON_APPELE)).length
    const appelesAujourdhui = contacts.filter(c => isToday(c.dateDernierAppel)).length
    const interesses = contacts.filter(c => hasStatut(c, STATUTS.INTERESSE)).length
    const appeleTotal = contacts.filter(c => !hasStatut(c, STATUTS.NON_APPELE)).length
    const taux = appeleTotal > 0 ? ((interesses / appeleTotal) * 100).toFixed(1) : '0.0'
    const progression = total > 0 ? (((total - nonAppeles) / total) * 100).toFixed(1) : '0.0'
    return { total, nonAppeles, appelesAujourdhui, interesses, appeleTotal, taux, progression }
  }, [contacts])

  // Filter + sort
  const filteredContacts = useMemo(() => {
    let list = contacts
    if (filtreStatut !== 'Tous') {
      list = list.filter(c => hasStatut(c, filtreStatut))
    }
    if (filtreTag !== 'Tous') {
      list = list.filter(c => (c.tags || []).includes(filtreTag))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        (c.entreprise || '').toLowerCase().includes(q) ||
        (c.telephone || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.ville || '').toLowerCase().includes(q) ||
        (c.contact || '').toLowerCase().includes(q) ||
        (c.notes || []).some(n => n.texte.toLowerCase().includes(q))
      )
    }
    list = [...list].sort((a, b) => {
      let va = a[sortCol] || ''
      let vb = b[sortCol] || ''
      if (sortCol === 'dateDernierAppel') {
        va = va || '0'
        vb = vb || '0'
      }
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [contacts, filtreStatut, filtreTag, search, sortCol, sortDir])

  const selectedContact = useMemo(() => contacts.find(c => c.id === selectedId), [contacts, selectedId])

  const toggleChecked = useCallback((id) => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const toggleCheckAll = useCallback(() => {
    setCheckedIds(prev => {
      if (prev.size === filteredContacts.length) return new Set()
      return new Set(filteredContacts.map(c => c.id))
    })
  }, [filteredContacts])

  const applyBulkTag = useCallback((tag) => {
    handleAddTag(tag)
    setContacts(prev => prev.map(c =>
      checkedIds.has(c.id) ? { ...c, tags: [...new Set([...(c.tags || []), tag])] } : c
    ))
    setShowBulkTagPicker(false)
    setBulkNewTag('')
  }, [checkedIds, handleAddTag])

  const handleImportContacts = useCallback((newContacts) => {
    setContacts(prev => {
      const normPhone = (t) => (t || '').replace(/[\s.\-()+]/g, '').replace(/^0033/, '0').replace(/^33/, '0')
      const normStr = (s) => (s || '').toLowerCase().trim()
      const keyOf = (c) => {
        const phone = normPhone(c.telephone)
        if (phone && phone.length >= 8) return `tel:${phone}`
        const email = normStr(c.email)
        if (email) return `email:${email}`
        return `name:${normStr(c.entreprise)}|${normStr(c.ville)}`
      }
      const existingKeys = new Set(prev.map(keyOf))
      const added = []
      let duplicates = 0
      for (const c of newContacts) {
        const k = keyOf(c)
        if (existingKeys.has(k)) { duplicates++; continue }
        existingKeys.add(k)
        added.push(c)
      }
      if (duplicates > 0) {
        setTimeout(() => alert(`${added.length} contact${added.length > 1 ? 's' : ''} importé${added.length > 1 ? 's' : ''}. ${duplicates} doublon${duplicates > 1 ? 's' : ''} ignoré${duplicates > 1 ? 's' : ''}.`), 50)
      }
      return [...prev, ...added]
    })
  }, [])

  const handleUpdateContact = useCallback((id, updates) => {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
  }, [])

  const handleDeleteContact = useCallback((id) => {
    setContacts(prev => prev.filter(c => c.id !== id))
    if (selectedId === id) setSelectedId(null)
  }, [selectedId])

  const handleExport = () => {
    const payload = {
      version: 2,
      exportDate: new Date().toISOString(),
      contacts,
      tags,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `coldcall_backup_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImportBackup = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        // Format v2: { version, contacts, tags }
        if (data && typeof data === 'object' && Array.isArray(data.contacts)) {
          setContacts(data.contacts)
          if (Array.isArray(data.tags)) {
            setTags(data.tags)
          } else {
            // Reconstruire les tags depuis les contacts si absents
            const extracted = [...new Set(data.contacts.flatMap(c => c.tags || []))]
            setTags(prev => [...new Set([...prev, ...extracted])])
          }
        } else if (Array.isArray(data)) {
          // Format v1 (ancien): tableau de contacts uniquement
          setContacts(data)
          const extracted = [...new Set(data.flatMap(c => c.tags || []))]
          setTags(prev => [...new Set([...prev, ...extracted])])
        } else {
          throw new Error('format')
        }
      } catch {
        alert('Fichier de backup invalide.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const handleClearAll = () => {
    if (confirm('Supprimer tous les contacts ? Cette action est irréversible.')) {
      setContacts([])
      setSelectedId(null)
    }
  }

  const handleRemoveDuplicates = () => {
    const normPhone = (t) => (t || '').replace(/[\s.\-()+]/g, '').replace(/^0033/, '0').replace(/^33/, '0')
    const normStr = (s) => (s || '').toLowerCase().trim()
    const keyOf = (c) => {
      const phone = normPhone(c.telephone)
      if (phone && phone.length >= 8) return `tel:${phone}`
      const email = normStr(c.email)
      if (email) return `email:${email}`
      return `name:${normStr(c.entreprise)}|${normStr(c.ville)}`
    }

    const groups = new Map()
    contacts.forEach(c => {
      const k = keyOf(c)
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k).push(c)
    })

    const duplicateGroups = [...groups.values()].filter(g => g.length > 1)
    const duplicateCount = duplicateGroups.reduce((s, g) => s + g.length - 1, 0)

    if (duplicateCount === 0) {
      alert('Aucun doublon détecté.')
      return
    }

    if (!confirm(`${duplicateCount} doublon${duplicateCount > 1 ? 's' : ''} détecté${duplicateCount > 1 ? 's' : ''} dans ${duplicateGroups.length} groupe${duplicateGroups.length > 1 ? 's' : ''}.\n\nLes contacts seront fusionnés (notes, historique, tags, enregistrements conservés). Continuer ?`)) return

    const score = (c) => {
      let s = 0
      if (c.telephone) s += 2
      if (c.email) s += 2
      if (c.siteWeb) s += 1
      if (c.ville) s += 1
      if (c.contact) s += 1
      s += (c.notes || []).length * 3
      s += (c.historiqueAppels || []).length * 3
      s += (c.enregistrements || []).length * 5
      if (c.statut && !hasStatut(c, STATUTS.NON_APPELE)) s += 2
      return s
    }

    const merged = []
    groups.forEach(group => {
      if (group.length === 1) { merged.push(group[0]); return }
      const sorted = [...group].sort((a, b) => score(b) - score(a))
      const primary = sorted[0]
      const others = sorted.slice(1)
      const fused = { ...primary }
      others.forEach(o => {
        fused.telephone = fused.telephone || o.telephone
        fused.email = fused.email || o.email
        fused.siteWeb = fused.siteWeb || o.siteWeb
        fused.ville = fused.ville || o.ville
        fused.contact = fused.contact || o.contact
        fused.poste = fused.poste || o.poste
        fused.notes = [...(fused.notes || []), ...(o.notes || [])]
        fused.historiqueAppels = [...(fused.historiqueAppels || []), ...(o.historiqueAppels || [])]
        fused.enregistrements = [...(fused.enregistrements || []), ...(o.enregistrements || [])]
        fused.tags = [...new Set([...(fused.tags || []), ...(o.tags || [])])]
      })
      fused.notes.sort((a, b) => new Date(b.date) - new Date(a.date))
      fused.historiqueAppels.sort((a, b) => new Date(b.date) - new Date(a.date))
      merged.push(fused)
    })

    setContacts(merged)
    setCheckedIds(new Set())
    alert(`${duplicateCount} doublon${duplicateCount > 1 ? 's' : ''} fusionné${duplicateCount > 1 ? 's' : ''}. ${merged.length} contacts restants.`)
  }

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <ArrowUpDown size={12} className="text-gray-600" />
    return sortDir === 'asc' ? <ChevronUp size={12} className="text-[#3b82f6]" /> : <ChevronDown size={12} className="text-[#3b82f6]" />
  }

  const columns = [
    { key: 'entreprise', label: 'Entreprise' },
    { key: 'contact', label: 'Contact' },
    { key: 'telephone', label: 'Téléphone' },
    { key: 'email', label: 'Email' },
    { key: 'ville', label: 'Ville' },
    { key: 'statut', label: 'Statut' },
    { key: 'tags', label: 'Secteur' },
    { key: 'dateDernierAppel', label: 'Dernier appel' },
  ]

  return (
    <div className="min-h-screen bg-[#0a0f1c] text-[#e2e8f0]">
      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>

      {/* Header */}
      <header className="bg-[#111827] border-b border-[#1e293b] px-4 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <PhoneCall size={24} className="text-[#3b82f6]" />
              <h1 className="text-xl font-bold">Cold Call CRM</h1>
            </div>
            {/* Onglets */}
            <div className="flex items-center bg-[#0a0f1c] rounded-lg p-0.5 border border-[#1e293b]">
              <button
                onClick={() => setPage('contacts')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${page === 'contacts' ? 'bg-[#1e293b] text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <Users size={14} /> Contacts
              </button>
              <button
                onClick={() => setPage('stats')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${page === 'stats' ? 'bg-[#1e293b] text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                <BarChart3 size={14} /> Statistiques
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Bouton notifications */}
            <div className="relative">
              <button
                onClick={() => {
                  if (notifPermission !== 'granted') { requestNotifPermission(); return }
                  setShowRappelPanel(p => !p)
                }}
                className={`relative bg-[#1e293b] hover:bg-[#2d3a4f] text-white p-2 rounded-lg transition-colors ${rappelsPending.some(r => r.type === 'today' || r.type === 'overdue') ? 'ring-2 ring-red-500/50' : ''}`}
                title={notifPermission === 'granted' ? 'Rappels à venir' : 'Activer les notifications'}
              >
                {rappelsPending.length > 0 ? <BellRing size={18} className="text-yellow-400" /> : <Bell size={18} />}
                {rappelsPending.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                    {rappelsPending.length}
                  </span>
                )}
              </button>
              {showRappelPanel && (
                <div className="absolute left-0 top-full mt-2 w-80 bg-[#111827] border border-[#1e293b] rounded-xl shadow-2xl z-30 overflow-hidden">
                  <div className="p-3 border-b border-[#1e293b] flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <BellRing size={14} className="text-yellow-400" />
                      Rappels ({rappelsPending.length})
                    </h3>
                    <button onClick={() => setShowRappelPanel(false)} className="text-gray-400 hover:text-white">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {rappelsPending.length === 0 ? (
                      <p className="p-4 text-xs text-gray-500 text-center">Aucun rappel à venir</p>
                    ) : (
                      rappelsPending.map(({ contact, type }) => (
                        <button
                          key={contact.id}
                          onClick={() => { setSelectedId(contact.id); setShowRappelPanel(false) }}
                          className="w-full p-3 border-b border-[#1e293b]/50 hover:bg-[#1e293b]/50 text-left transition-colors"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {type === 'overdue' && <span className="text-[10px] font-bold uppercase text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded">En retard</span>}
                            {type === 'today' && <span className="text-[10px] font-bold uppercase text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded">Aujourd'hui</span>}
                            {type === 'tomorrow' && <span className="text-[10px] font-bold uppercase text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded">Demain</span>}
                            <span className="text-xs text-gray-500">{formatDate(contact.dateRappel)}</span>
                          </div>
                          <p className="text-sm font-medium text-white truncate">{contact.entreprise || 'Sans nom'}</p>
                          {contact.telephone && <p className="text-xs text-[#3b82f6]">{contact.telephone}</p>}
                        </button>
                      ))
                    )}
                  </div>
                  {notifPermission !== 'granted' && (
                    <div className="p-3 border-t border-[#1e293b] bg-yellow-900/10">
                      <button onClick={requestNotifPermission} className="w-full text-xs text-yellow-400 hover:text-yellow-300 text-center">
                        Activer les notifications système
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={() => setShowImport(true)} className="bg-[#3b82f6] hover:bg-[#2563eb] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
              <Upload size={16} /> Importer CSV
            </button>
            <button onClick={() => setShowScraper(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
              <Radar size={16} /> Google Maps
            </button>
            <button onClick={() => setShowPappers(true)} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
              <TrendingUp size={16} /> Pappers
            </button>
            <button onClick={() => setShowCampagne(true)} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
              <Zap size={16} /> Campagne
            </button>
            <button onClick={() => setShowAddContact(true)} className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
              <UserPlus size={16} /> Ajouter
            </button>
            <button onClick={handleExport} className="bg-[#1e293b] hover:bg-[#2d3a4f] text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
              <Download size={16} /> Exporter
            </button>
            <input ref={backupInputRef} type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
            <button onClick={() => backupInputRef.current?.click()} className="bg-[#1e293b] hover:bg-[#2d3a4f] text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
              <RotateCcw size={16} /> Restaurer backup
            </button>
            {contacts.length > 0 && (
              <button onClick={handleRemoveDuplicates} className="bg-orange-900/30 hover:bg-orange-900/50 text-orange-400 px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors" title="Détecter et fusionner les doublons">
                <Users size={16} /> Dédupliquer
              </button>
            )}
            {contacts.length > 0 && (
              <button onClick={handleClearAll} className="bg-red-900/30 hover:bg-red-900/50 text-red-400 px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
                <Trash2 size={16} /> Tout supprimer
              </button>
            )}
          </div>
        </div>
      </header>

      {page === 'stats' && <StatsPage contacts={contacts} tags={tags} />}
      <main className="max-w-[1600px] mx-auto p-4" style={{ display: page === 'stats' ? 'none' : 'block' }}>
        {/* Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          {[
            { label: 'Total contacts', value: stats.total, icon: Users, color: 'text-[#3b82f6]' },
            { label: 'Pas appelés', value: stats.nonAppeles, icon: Phone, color: 'text-gray-400' },
            { label: "Appelés aujourd'hui", value: stats.appelesAujourdhui, icon: PhoneCall, color: 'text-blue-400' },
            { label: 'Intéressés', value: stats.interesses, icon: Star, color: 'text-green-400' },
            { label: 'Taux conversion', value: `${stats.taux}%`, icon: BarChart3, color: 'text-yellow-400' },
            { label: 'Progression', value: `${stats.progression}%`, icon: Clock, color: 'text-purple-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-[#111827] rounded-xl border border-[#1e293b] p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={16} className={color} />
                <span className="text-xs text-gray-500">{label}</span>
              </div>
              <p className="text-2xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="bg-[#111827] rounded-xl border border-[#1e293b] p-3 mb-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>Progression des appels</span>
            <span>{stats.appeleTotal} / {stats.total} contactés</span>
          </div>
          <div className="w-full bg-[#1e293b] rounded-full h-2.5">
            <div
              className="bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${stats.progression}%` }}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[#111827] rounded-xl border border-[#1e293b] p-3 mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#0a0f1c] border border-[#1e293b] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter size={14} className="text-gray-500" />
            {['Tous', ...Object.values(STATUTS)].map(s => (
              <button
                key={s}
                onClick={() => setFiltreStatut(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filtreStatut === s
                    ? 'bg-[#3b82f6] text-white'
                    : 'bg-[#0a0f1c] text-gray-400 hover:text-white border border-[#1e293b]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap w-full border-t border-[#1e293b] pt-2 mt-1">
              <Tag size={14} className="text-gray-500" />
              <button
                onClick={() => setFiltreTag('Tous')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filtreTag === 'Tous' ? 'bg-[#3b82f6] text-white' : 'bg-[#0a0f1c] text-gray-400 hover:text-white border border-[#1e293b]'
                }`}
              >
                Tous secteurs
              </button>
              {tags.map((t, i) => (
                <button
                  key={t}
                  onClick={() => setFiltreTag(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    filtreTag === t
                      ? `${TAG_COLORS[i % TAG_COLORS.length]} text-white`
                      : 'bg-[#0a0f1c] text-gray-400 hover:text-white border border-[#1e293b]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Table */}
        {contacts.length === 0 ? (
          <div className="bg-[#111827] rounded-xl border border-[#1e293b] p-16 text-center">
            <Database size={48} className="mx-auto text-gray-700 mb-4" />
            <p className="text-gray-500 text-lg mb-2">Aucun contact</p>
            <p className="text-gray-600 text-sm mb-4">Importez un fichier CSV pour commencer votre prospection</p>
            <button onClick={() => setShowImport(true)} className="bg-[#3b82f6] hover:bg-[#2563eb] text-white px-6 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2">
              <Upload size={16} /> Importer un CSV
            </button>
          </div>
        ) : (
          <div className="bg-[#111827] rounded-xl border border-[#1e293b] overflow-hidden">
            {/* Bulk actions bar */}
            {checkedIds.size > 0 && (
              <div className="bg-[#3b82f6]/10 border-b border-[#3b82f6]/20 px-4 py-2.5 flex items-center gap-3 flex-wrap">
                <span className="text-sm text-[#3b82f6] font-medium">
                  {checkedIds.size} sélectionné{checkedIds.size > 1 ? 's' : ''}
                </span>
                <div className="h-4 w-px bg-[#1e293b]" />
                <div className="relative">
                  <button
                    onClick={() => setShowBulkTagPicker(p => !p)}
                    className="flex items-center gap-1.5 bg-[#1e293b] hover:bg-[#2d3a4f] text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  >
                    <Tag size={12} /> Attribuer un tag
                  </button>
                  {showBulkTagPicker && (
                    <div className="absolute top-full left-0 mt-1 bg-[#111827] border border-[#1e293b] rounded-lg p-3 shadow-xl z-20 min-w-[220px]">
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {tags.map((t, i) => (
                            <button
                              key={t}
                              onClick={() => applyBulkTag(t)}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium text-white hover:opacity-80 transition-opacity ${TAG_COLORS[i % TAG_COLORS.length]}`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={bulkNewTag}
                          onChange={e => setBulkNewTag(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && bulkNewTag.trim()) applyBulkTag(bulkNewTag.trim()) }}
                          placeholder="Nouveau tag..."
                          className="flex-1 bg-[#0a0f1c] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-600 focus:border-[#3b82f6] focus:outline-none"
                        />
                        <button
                          onClick={() => { if (bulkNewTag.trim()) applyBulkTag(bulkNewTag.trim()) }}
                          className="bg-[#3b82f6] hover:bg-[#2563eb] text-white px-2.5 py-1.5 rounded-lg text-xs"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setCheckedIds(new Set())}
                  className="text-xs text-gray-400 hover:text-white ml-auto"
                >
                  Désélectionner
                </button>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e293b] bg-[#0a0f1c]/50">
                    <th className="px-3 py-3 w-10">
                      <div
                        onClick={toggleCheckAll}
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                          checkedIds.size > 0 && checkedIds.size === filteredContacts.length ? 'border-[#3b82f6] bg-[#3b82f6]' : 'border-[#1e293b] hover:border-gray-500'
                        }`}
                      >
                        {checkedIds.size > 0 && checkedIds.size === filteredContacts.length && <Check size={10} className="text-white" />}
                      </div>
                    </th>
                    {columns.map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300 select-none"
                      >
                        <div className="flex items-center gap-1">
                          {col.label}
                          <SortIcon col={col.key} />
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContacts.map(contact => (
                    <tr
                      key={contact.id}
                      onClick={() => setSelectedId(contact.id)}
                      className={`border-b border-[#1e293b]/50 hover:bg-[#1e293b]/30 cursor-pointer transition-colors ${checkedIds.has(contact.id) ? 'bg-[#3b82f6]/5' : ''}`}
                    >
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <div
                          onClick={() => toggleChecked(contact.id)}
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                            checkedIds.has(contact.id) ? 'border-[#3b82f6] bg-[#3b82f6]' : 'border-[#1e293b] hover:border-gray-500'
                          }`}
                        >
                          {checkedIds.has(contact.id) && <Check size={10} className="text-white" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium">{contact.entreprise || '—'}</td>
                      <td className="px-4 py-3 text-gray-400">{contact.contact || '—'}</td>
                      <td className="px-4 py-3">
                        {contact.telephone ? (
                          <span className="text-[#3b82f6]">{contact.telephone}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 truncate max-w-[200px]">{contact.email || '—'}</td>
                      <td className="px-4 py-3 text-gray-400">{contact.ville || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {getStatuts(contact).map(s => (
                            <span key={s} className={`px-2 py-0.5 rounded-full text-[10px] font-medium text-white ${STATUT_COLORS[s]}`}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(contact.tags || []).map(t => (
                            <span key={t} className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white ${TAG_COLORS[tags.indexOf(t) % TAG_COLORS.length] || 'bg-gray-600'}`}>
                              {t}
                            </span>
                          ))}
                          {!(contact.tags || []).length && <span className="text-gray-600 text-xs">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatDateShort(contact.dateDernierAppel)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            if (confirm(`Supprimer "${contact.entreprise || 'ce contact'}" ? Cette action est irréversible.`)) {
                              handleDeleteContact(contact.id)
                            }
                          }}
                          className="text-gray-600 hover:text-red-400 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 text-xs text-gray-600 border-t border-[#1e293b]">
              {filteredContacts.length} contact{filteredContacts.length > 1 ? 's' : ''} affiché{filteredContacts.length > 1 ? 's' : ''}
              {filtreStatut !== 'Tous' && ` (filtre : ${filtreStatut})`}
            </div>
          </div>
        )}
      </main>

      {/* SerpAPI Scraper Modal */}
      <SerpScraperModal
        isOpen={showScraper}
        onClose={() => setShowScraper(false)}
        onImport={handleImportContacts}
        tags={tags}
        onAddTag={handleAddTag}
      />

      {/* Pappers Scraper Modal */}
      <PappersScraperModal
        isOpen={showPappers}
        onClose={() => setShowPappers(false)}
        onImport={handleImportContacts}
        tags={tags}
        onAddTag={handleAddTag}
      />

      {/* Campagne Modal */}
      <CampagneModal
        isOpen={showCampagne}
        onClose={() => setShowCampagne(false)}
        onImport={handleImportContacts}
        tags={tags}
        onAddTag={handleAddTag}
      />

      {/* Add Contact Modal */}
      <AddContactModal
        isOpen={showAddContact}
        onClose={() => setShowAddContact(false)}
        onAdd={handleImportContacts}
        tags={tags}
        onAddTag={handleAddTag}
      />

      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        onImport={handleImportContacts}
      />

      {/* Contact Detail Panel */}
      <ContactPanel
        contact={selectedContact}
        onClose={() => setSelectedId(null)}
        onUpdate={handleUpdateContact}
        tags={tags}
        onAddTag={handleAddTag}
      />
    </div>
  )
}
