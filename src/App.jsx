// src/App.jsx
import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { Container, Row, Col, Alert, Spinner, Badge } from 'react-bootstrap'

// Verde institucional
const SENA_GREEN = '#39A900'

function ambienteEnOracion(value) {
  const s = String(value ?? '').trim()
  if (!s || s === '—') return '—'
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\b([a-záéíóúñ])/g, (m) => m.toUpperCase())
}

function normalizeHeader(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
}

function normalizeRowKeys(row) {
  const out = {}
  for (const k of Object.keys(row)) out[normalizeHeader(k)] = row[k]
  return out
}

function dateOnly(value) {
  const s = String(value ?? '').trim()
  if (!s) return ''
  if (s.includes('T')) return s.split('T')[0]
  return s.split(' ')[0]
}

function parseDateLoose(value) {
  const s = dateOnly(value)
  if (!s) return null
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) {
    const a = Number(slash[1]), b = Number(slash[2]), y = Number(slash[3])
    let d, m
    if (a > 12) { d = a; m = b; } 
    else if (b > 12) { m = a; d = b; } 
    else { d = a; m = b; }
    return new Date(y, m - 1, d)
  }
  return null
}

function startOfTodayLocal() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function leftOfDoubleDash(value) {
  const s = String(value ?? '').trim()
  if (!s) return ''
  return s.split('--')[0].trim()
}

function normalizeValue(s) {
  return String(s ?? '').trim().toLowerCase()
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
        setError('')
        if (!csvUrl) throw new Error('Falta VITE_SHEET_CSV_URL en el archivo .env')
        const res = await fetch(csvUrl)
        if (!res.ok) throw new Error(`No se pudo leer el CSV (HTTP ${res.status}).`)
        const csvText = await res.text()
        const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true })
        setRows((parsed.data || []).map(normalizeRowKeys))
      } catch (e) {
        setError(e?.message || 'Error cargando datos')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [csvUrl])

  const vigenteOrdenado = useMemo(() => {
    const today = startOfTodayLocal()
    const filtered = rows.filter((r) => {
      const cierreDate = parseDateLoose(r[keys.cierre])
      return cierreDate && cierreDate >= today && normalizeValue(r[keys.tipoOferta]) === 'abierta'
    })
    return filtered.sort((a, b) => 
      (parseDateLoose(a[keys.cierre])?.getTime() ?? Infinity) - (parseDateLoose(b[keys.cierre])?.getTime() ?? Infinity)
    )
  }, [rows, keys])

  return (
    <div style={{ background: '#f5f6f7', minHeight: '100vh' }}>
      <style>{`
        .flip-wrap { perspective: 1000px; }
        .flip-card { height: 320px; cursor: pointer; }
        .flip-inner {
          position: relative; width: 100%; height: 100%;
          transition: transform 0.55s ease; transform-style: preserve-3d;
        }
        .flip-inner.is-flipped { transform: rotateY(180deg); }
        .flip-face {
          position: absolute; inset: 0; backface-visibility: hidden;
          border-radius: 14px; overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.08); border: 1px solid rgba(0,0,0,0.08);
        }
        .flip-front {
          background: ${SENA_GREEN}; color: white; display: flex;
          align-items: center; justify-content: center; text-align: center;
          padding: 14px; font-weight: 900; font-size: 24px;
        }
        .flip-back {
          background: white; transform: rotateY(180deg);
          padding: 14px; display: flex; flex-direction: column; justify-content: center; gap: 8px;
        }
        .back-title { font-weight: 900; text-transform: uppercase; text-align: center; color: ${SENA_GREEN}; font-size: 14px; margin-bottom: 4px; }
        .kv { display: flex; justify-content: space-between; border-top: 1px solid rgba(0,0,0,0.06); padding-top: 6px; font-size: 13px; }
        .k { color: rgba(0,0,0,0.6); }
        .v { font-weight: 700; text-align: right; }
        .ficha-link { color: ${SENA_GREEN}; text-decoration: none; border-bottom: 1px dashed ${SENA_GREEN}; }
        .ficha-link:hover { color: #2d8500; }
        .obs { margin-top: 4px; border-top: 1px dashed rgba(0,0,0,0.2); padding-top: 8px; font-size: 12px; }
        .obs-title { font-weight: 900; text-transform: uppercase; color: rgba(0,0,0,0.6); margin-bottom: 2px; }
      `}</style>

      <Container className="py-4">
        <Row className="mb-3 align-items-end">
          <Col><h3 className="mb-1">Oferta en inscripción en el CIDM</h3></Col>
          <Col xs="auto">
            {loading ? <Spinner animation="border" size="sm" /> : <Badge bg="secondary">{vigenteOrdenado.length} Resultados</Badge>}
          </Col>
        </Row>

        {error && <Alert variant="danger">{error}</Alert>}
        {!loading && vigenteOrdenado.length === 0 && <Alert variant="secondary" className="text-center">No hay fichas vigentes.</Alert>}

        <Row className="g-3">
          {vigenteOrdenado.map((r, idx) => {
            const nombre = safeText(leftOfDoubleDash(r[keys.nombreProg]), 'PROGRAMA SIN NOMBRE').toUpperCase()
            const ficha = safeText(r[keys.ficha])
            const isFlipped = flippedKey === idx

            return (
              <Col key={idx} xs={12} md={6} lg={4} className="flip-wrap">
                <div className="flip-card" onClick={() => setFlippedKey(isFlipped ? null : idx)}>
                  <div className={`flip-inner ${isFlipped ? 'is-flipped' : ''}`}>
                    <div className="flip-face flip-front">{nombre}</div>
                    <div className="flip-face flip-back">
                      <div className="back-title">{nombre}</div>
                      <div className="kv"><div className="k">Inicio</div><div className="v">{safeText(dateOnly(r[keys.ini]))}</div></div>
                      <div className="kv"><div className="k">Finalización</div><div className="v">{safeText(dateOnly(r[keys.fin]))}</div></div>
                      <div className="kv">
                        <div className="k">Número de ficha</div>
                        <div className="v">
                          <a 
                            href={`https://betowa.sena.edu.co/oferta?search=${ficha}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="ficha-link"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {ficha}
                          </a>
                        </div>
                      </div>
                      <div className="kv"><div className="k">Cierre inscripción</div><div className="v">{safeText(dateOnly(r[keys.cierre]))}</div></div>
                      <div className="obs">
                        <div className="obs-title">Observación</div>
                        <p className="m-0" style={{lineHeight: '1.2'}}>
                          Horario: {safeText(ambienteEnOracion(r[keys.horario]))} {safeText(r[keys.horaInicio])} a {safeText(r[keys.horaFinal])}. 
                          Ambiente: {safeText(ambienteEnOracion(r[keys.ambiente]))}.
                        </p>
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