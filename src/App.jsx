import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Papa from 'papaparse'
import {
  Upload, Download, Search, Phone, PhoneOff, PhoneCall, PhoneForwarded,
  Star, X, ChevronUp, ChevronDown, FileText, RotateCcw, Clock, Building2,
  Mail, Globe, MapPin, MessageSquare, Calendar, Filter, BarChart3, Users,
  PhoneMissed, ArrowUpDown, Trash2, FileUp, Database, Settings, AlertCircle,
  Radar, Loader2, MapPinned, Plus, Check, ChevronLeft, ChevronRight,
  Mic, MicOff, Play, Square, Trash2 as Trash2Icon, Pause, Tag
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

// ─── SERPAPI SCRAPER MODAL ───
function SerpScraperModal({ isOpen, onClose, onImport }) {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('France')
  const [engine, setEngine] = useState('google_maps')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [totalSearched, setTotalSearched] = useState(0)
  const [siteFilter, setSiteFilter] = useState('tous') // 'tous' | 'sans_site' | 'avec_site'

  const filteredResults = useMemo(() => {
    if (siteFilter === 'sans_site') return results.filter(r => !r.siteWeb)
    if (siteFilter === 'avec_site') return results.filter(r => !!r.siteWeb)
    return results
  }, [results, siteFilter])

  const reset = () => {
    setResults([])
    setSelected(new Set())
    setError('')
    setPage(0)
    setHasMore(false)
    setTotalSearched(0)
  }

  const doSearch = async (pageNum = 0) => {
    if (!query.trim()) return
    setLoading(true)
    setError('')

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
      params.set('ll', '@46.603354,1.888334,6z') // center of France
      if (location.trim()) params.set('q', `${query.trim()} ${location.trim()}`)
      if (pageNum > 0) params.set('start', String(pageNum * 20))
    } else {
      params.set('engine', 'google')
      params.set('num', '20')
      if (location.trim()) params.set('location', location.trim())
      if (pageNum > 0) params.set('start', String(pageNum * 20))
    }

    try {
      const resp = await fetch(`/serpapi/search.json?${params.toString()}`)
      if (!resp.ok) {
        const text = await resp.text()
        if (resp.status === 429 || text.includes('rate limit')) {
          // Try next key
          const key2 = getNextSerpKey()
          params.set('api_key', key2)
          const resp2 = await fetch(`/serpapi/search.json?${params.toString()}`)
          if (!resp2.ok) throw new Error(`Erreur API: ${resp2.status}`)
          const data2 = await resp2.json()
          processResults(data2, pageNum)
          return
        }
        throw new Error(`Erreur API: ${resp.status} - ${text.slice(0, 200)}`)
      }
      const data = await resp.json()
      processResults(data, pageNum)
    } catch (err) {
      setError(err.message || 'Erreur de connexion à SerpAPI')
    } finally {
      setLoading(false)
    }
  }

  const processResults = (data, pageNum) => {
    let items = []

    if (engine === 'google_maps') {
      const places = data.local_results || data.place_results ? [data.place_results] : []
      items = (data.local_results || places).map(p => ({
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
      items = (data.organic_results || []).map(r => ({
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

    if (pageNum === 0) {
      setResults(items)
      setTotalSearched(items.length)
    } else {
      setResults(prev => {
        const existingIds = new Set(prev.map(r => r._id))
        const newItems = items.filter(i => !existingIds.has(i._id))
        return [...prev, ...newItems]
      })
      setTotalSearched(prev => prev + items.length)
    }

    setHasMore(items.length >= 15)
    setPage(pageNum)
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
        historiqueAppels: [],
        fichierSource: `SerpAPI: "${query}"`,
        dateImport: new Date().toISOString(),
      }))
    onImport(contacts)
    reset()
    onClose()
  }

  const handleLoadMore = () => {
    doSearch(page + 1)
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
                  onKeyDown={e => { if (e.key === 'Enter') { reset(); doSearch(0) } }}
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
            <div className="w-44">
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
            <div className="flex items-end">
              <button
                onClick={() => { reset(); doSearch(0) }}
                disabled={loading || !query.trim()}
                className="bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Rechercher
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-gray-600">
              Rotation automatique des clés API ({SERPAPI_KEYS.length} clés configurées)
            </p>
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
          <div className="p-4 border-t border-[#1e293b] flex items-center justify-between">
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
    const appel = {
      id: generateId(),
      date: new Date().toISOString(),
      statut,
    }
    const updates = {
      statut,
      dateDernierAppel: appel.date,
      historiqueAppels: [appel, ...contact.historiqueAppels],
    }
    if (statut === STATUTS.RAPPELER) {
      setShowRappelInput(true)
      return
    }
    onUpdate(contact.id, updates)
  }

  const handleRappelConfirm = () => {
    const appel = {
      id: generateId(),
      date: new Date().toISOString(),
      statut: STATUTS.RAPPELER,
    }
    onUpdate(contact.id, {
      statut: STATUTS.RAPPELER,
      dateDernierAppel: appel.date,
      dateRappel: dateRappel || null,
      historiqueAppels: [appel, ...contact.historiqueAppels],
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
          {/* Infos */}
          <div className="space-y-2">
            {contact.contact && (
              <div className="flex items-center gap-2 text-sm">
                <Users size={14} className="text-gray-500 shrink-0" />
                <span>{contact.contact}</span>
                {contact.poste && <span className="text-gray-500">— {contact.poste}</span>}
              </div>
            )}
            {contact.telephone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone size={14} className="text-gray-500 shrink-0" />
                <a href={`tel:${contact.telephone}`} className="text-[#3b82f6] hover:underline">{contact.telephone}</a>
              </div>
            )}
            {contact.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail size={14} className="text-gray-500 shrink-0" />
                <a href={`mailto:${contact.email}`} className="text-[#3b82f6] hover:underline">{contact.email}</a>
              </div>
            )}
            {contact.siteWeb && (
              <div className="flex items-center gap-2 text-sm">
                <Globe size={14} className="text-gray-500 shrink-0" />
                <a href={contact.siteWeb.startsWith('http') ? contact.siteWeb : `https://${contact.siteWeb}`} target="_blank" rel="noreferrer" className="text-[#3b82f6] hover:underline truncate">{contact.siteWeb}</a>
              </div>
            )}
            {contact.ville && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin size={14} className="text-gray-500 shrink-0" />
                <span>{contact.ville}</span>
              </div>
            )}
            {contact.fichierSource && (
              <div className="flex items-center gap-2 text-sm">
                <FileText size={14} className="text-gray-500 shrink-0" />
                <span className="text-gray-500">Source : {contact.fichierSource}</span>
              </div>
            )}
          </div>

          {/* Statut actuel */}
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${STATUT_COLORS[contact.statut]}`}>
              {contact.statut}
            </span>
            {contact.dateRappel && contact.statut === STATUTS.RAPPELER && (
              <span className="text-xs text-yellow-400 flex items-center gap-1">
                <Calendar size={12} />
                Rappel : {formatDateShort(contact.dateRappel)}
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
              {Object.values(STATUTS).filter(s => s !== STATUTS.NON_APPELE).map(statut => {
                const SIcon = STATUT_ICONS[statut]
                return (
                  <button
                    key={statut}
                    onClick={() => handleStatut(statut)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border border-[#1e293b] hover:border-[#3b82f6] ${contact.statut === statut ? 'ring-2 ring-[#3b82f6] bg-[#1e293b]' : 'bg-[#0a0f1c]'}`}
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
                Date de rappel
              </label>
              <input
                type="date"
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
  const [showImport, setShowImport] = useState(false)
  const [showScraper, setShowScraper] = useState(false)
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
  const backupInputRef = useRef(null)

  // Save to localStorage on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts))
  }, [contacts])

  useEffect(() => {
    localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tags))
  }, [tags])

  const handleAddTag = useCallback((tag) => {
    setTags(prev => prev.includes(tag) ? prev : [...prev, tag])
  }, [])

  // Stats
  const stats = useMemo(() => {
    const total = contacts.length
    const nonAppeles = contacts.filter(c => c.statut === STATUTS.NON_APPELE).length
    const appelesAujourdhui = contacts.filter(c => isToday(c.dateDernierAppel)).length
    const interesses = contacts.filter(c => c.statut === STATUTS.INTERESSE).length
    const appeleTotal = contacts.filter(c => c.statut !== STATUTS.NON_APPELE).length
    const taux = appeleTotal > 0 ? ((interesses / appeleTotal) * 100).toFixed(1) : '0.0'
    const progression = total > 0 ? (((total - nonAppeles) / total) * 100).toFixed(1) : '0.0'
    return { total, nonAppeles, appelesAujourdhui, interesses, appeleTotal, taux, progression }
  }, [contacts])

  // Filter + sort
  const filteredContacts = useMemo(() => {
    let list = contacts
    if (filtreStatut !== 'Tous') {
      list = list.filter(c => c.statut === filtreStatut)
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
    setContacts(prev => [...prev, ...newContacts])
  }, [])

  const handleUpdateContact = useCallback((id, updates) => {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
  }, [])

  const handleDeleteContact = useCallback((id) => {
    setContacts(prev => prev.filter(c => c.id !== id))
    if (selectedId === id) setSelectedId(null)
  }, [selectedId])

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(contacts, null, 2)], { type: 'application/json' })
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
        if (Array.isArray(data)) {
          setContacts(data)
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
          <div className="flex items-center gap-3">
            <PhoneCall size={24} className="text-[#3b82f6]" />
            <h1 className="text-xl font-bold">Cold Call CRM</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowImport(true)} className="bg-[#3b82f6] hover:bg-[#2563eb] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
              <Upload size={16} /> Importer CSV
            </button>
            <button onClick={() => setShowScraper(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors">
              <Radar size={16} /> Scraper Google
            </button>
            <button onClick={handleExport} className="bg-[#1e293b] hover:bg-[#2d3a4f] text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
              <Download size={16} /> Exporter
            </button>
            <input ref={backupInputRef} type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
            <button onClick={() => backupInputRef.current?.click()} className="bg-[#1e293b] hover:bg-[#2d3a4f] text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
              <RotateCcw size={16} /> Restaurer backup
            </button>
            {contacts.length > 0 && (
              <button onClick={handleClearAll} className="bg-red-900/30 hover:bg-red-900/50 text-red-400 px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
                <Trash2 size={16} /> Tout supprimer
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-4">
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
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium text-white ${STATUT_COLORS[contact.statut]}`}>
                          {contact.statut}
                        </span>
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
                          onClick={e => { e.stopPropagation(); handleDeleteContact(contact.id) }}
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
