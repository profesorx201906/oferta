// src/App.jsx
import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { Container, Row, Col, Alert, Spinner, Badge } from 'react-bootstrap'

const SENA_GREEN = '#39A900'

// --- Utilidades de Formateo ---
function ambienteEnOracion(value) {
  const s = String(value ?? '').trim()
  if (!s || s === '—') return '—'
  return s.toLowerCase().replace(/\s+/g, ' ').replace(/\b([a-záéíóúñ])/g, (m) => m.toUpperCase())
}

function normalizeHeader(s) {
  return String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ')
}

function normalizeRowKeys(row) {
  const out = {}
  for (const k of Object.keys(row)) out[normalizeHeader(k)] = row[k]
  return out
}

function dateOnly(value) {
  const s = String(value ?? '').trim()
  if (!s) return ''
  return s.includes('T') ? s.split('T')[0] : s.split(' ')[0]
}

function parseDateLoose(value) {
  const s = dateOnly(value)
  if (!s) return null
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) {
    const a = Number(slash[1]), b = Number(slash[2]), y = Number(slash[3])
    let d = a > 12 ? a : b, m = a > 12 ? b : a
    return new Date(y, m - 1, d)
  }
  return null
}

function startOfTodayLocal() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function leftOfDoubleDash(value) {
  return String(value ?? '').split('--')[0].trim()
}

function safeText(v, fallback = '—') {
  const s = String(v ?? '').trim()
  return s || fallback
}

export default function App() {
  const csvUrl = import.meta.env.VITE_SHEET_CSV_URL
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [flippedKey, setFlippedKey] = useState(null)

  const keys = useMemo(() => ({
    nombreProg: normalizeHeader('NOMBRE DEL PROGRAMA DE FORMACIÓN'),
    ini: normalizeHeader('FECHA DE INICIO DE LA FORMACIÓN'),
    fin: normalizeHeader('FECHA DE FINALIZACIÓN DE LA FORMACIÓN'),
    ficha: normalizeHeader('Número de ficha'),
    cierre: normalizeHeader('Fecha de cierre inscripción'),
    tipoOferta: normalizeHeader('Tipo de oferta'),
    horaInicio: normalizeHeader('HORARIO DE INICIO'),
    horaFinal: normalizeHeader('HORA FINAL'),
    ambiente: normalizeHeader('AMBIENTE DE FORMACIÓN'),
    horario: normalizeHeader('LUNES, MIERCOLES, VIERNES ')
  }), [])

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const res = await fetch(csvUrl)
        if (!res.ok) throw new Error('Error al conectar con la fuente de datos.')
        const csvText = await res.text()
        const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true })
        setRows((parsed.data || []).map(normalizeRowKeys))
      } catch (e) { setError(e.message) } finally { setLoading(false) }
    }
    load()
  }, [csvUrl])

  const vigenteOrdenado = useMemo(() => {
    const today = startOfTodayLocal()
    return rows
      .filter(r => {
        const d = parseDateLoose(r[keys.cierre])
        return d && d >= today && String(r[keys.tipoOferta]).toLowerCase().includes('abierta')
      })
      .sort((a, b) => (parseDateLoose(a[keys.cierre])?.getTime() || 0) - (parseDateLoose(b[keys.cierre])?.getTime() || 0))
  }, [rows, keys])

  return (
    <div style={{ background: '#f5f6f7', minHeight: '100vh', paddingBottom: '40px' }}>
      <style>{`
        .flip-wrap { perspective: 1000px; }
        .flip-card { height: 310px; cursor: pointer; }
        .flip-inner {
          position: relative; width: 100%; height: 100%;
          transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1); transform-style: preserve-3d;
        }
        .flip-inner.is-flipped { transform: rotateY(180deg); }
        .flip-face {
          position: absolute; inset: 0; backface-visibility: hidden;
          border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .flip-front {
          background: ${SENA_GREEN}; color: white; display: flex;
          align-items: center; justify-content: center; text-align: center;
          padding: 20px; font-weight: 800; font-size: 22px; line-height: 1.2;
        }
        .flip-back {
          background: white; transform: rotateY(180deg);
          padding: 15px; display: flex; flex-direction: column; gap: 5px;
        }
        .back-title { font-weight: 800; color: ${SENA_GREEN}; font-size: 13px; text-align: center; margin-bottom: 5px; text-transform: uppercase; }
        .kv { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding: 3px 0; font-size: 12px; }
        .v { font-weight: 700; color: #333; }
        .obs-box { background: #f9f9f9; padding: 8px; border-radius: 8px; margin-top: 5px; font-size: 11px; border-left: 3px solid ${SENA_GREEN}; }
        .btn-link-custom {
          display: block; text-align: center; background: ${SENA_GREEN}; color: white;
          text-decoration: none; padding: 8px; border-radius: 6px; font-size: 12px; font-weight: 600; transition: 0.2s;
        }
        .btn-link-custom:hover { background: #2d8500; color: white; }
      `}</style>

      <Container className="py-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 style={{ fontWeight: 800, color: '#222' }}>Oferta Académica CIDM</h2>
          <Badge bg="success" style={{ fontSize: '1rem' }}>{vigenteOrdenado.length} Programas</Badge>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}
        {loading && <div className="text-center py-5"><Spinner animation="border" variant="success" /></div>}

        <Row className="g-4">
          {vigenteOrdenado.map((r, idx) => {
            const ficha = safeText(r[keys.ficha])
            const nombre = leftOfDoubleDash(r[keys.nombreProg]).toUpperCase()
            const isFlipped = flippedKey === idx

            return (
              <Col key={idx} xs={12} md={6} lg={4} className="flip-wrap">
                <div className="flip-card" onClick={() => setFlippedKey(isFlipped ? null : idx)}>
                  <div className={`flip-inner ${isFlipped ? 'is-flipped' : ''}`}>
                    <div className="flip-face flip-front">{nombre}</div>
                    
                    <div className="flip-face flip-back">
                      <div className="back-title">{nombre}</div>
                      
                      <div className="kv"><span>Numero de Ficha:</span> <span className="v">{ficha}</span></div>
                      <div className="kv"><span>Inicio Formación:</span> <span className="v">{dateOnly(r[keys.ini])}</span></div>
                      {/* NUEVO CAMPO AGREGADO */}
                      <div className="kv"><span>Finalización Formación:</span> <span className="v">{dateOnly(r[keys.fin])}</span></div>
                      <div className="kv"><span>Cierre inscripción:</span> <span className="v">{dateOnly(r[keys.cierre])}</span></div>
                      
                      <div className="obs-box">
                        <strong>Horario:</strong> {ambienteEnOracion(r[keys.horario])} ({r[keys.horaInicio]} - {r[keys.horaFinal]})<br/>
                        <strong>Ambiente:</strong> {ambienteEnOracion(r[keys.ambiente])}
                      </div>

                      <div className="mt-auto">
                        <a 
                          href={`https://betowa.sena.edu.co/oferta?search=${ficha}`}
                          target="_blank" rel="noopener noreferrer"
                          className="btn-link-custom"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Inscribirse en Betowa
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </Col>
            )
          })}
        </Row>
      </Container>
    </div>
  )
}