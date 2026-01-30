// src/App.jsx
import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { Container, Row, Col, Alert, Spinner, Badge } from 'react-bootstrap'

// Verde institucional
const SENA_GREEN = '#39A900'

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
    const a = Number(slash[1])
    const b = Number(slash[2])
    const y = Number(slash[3])

    let d, m
    if (a > 12) {
      d = a
      m = b
    } else if (b > 12) {
      m = a
      d = b
    } else {
      d = a
      m = b // DD/MM/YYYY por defecto
    }
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

  const keys = useMemo(() => {
    return {
      nombreProg: normalizeHeader('NOMBRE DEL PROGRAMA DE FORMACIÓN'),
      ini: normalizeHeader('FECHA DE INICIO DE LA FORMACIÓN'),
      fin: normalizeHeader('FECHA DE FINALIZACIÓN DE LA FORMACIÓN'),
      ficha: normalizeHeader('Número de ficha'),
      cierre: normalizeHeader('Fecha de cierre inscripción'),
      tipoOferta: normalizeHeader('Tipo de oferta'),

      // Observación
      horaInicio: normalizeHeader('HORARIO DE INICIO'),
      horaFinal: normalizeHeader('HORA FINAL'),
      ambiente: normalizeHeader('AMBIENTE DE FORMACIÓN'),
    }
  }, [])

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError('')

        if (!csvUrl) throw new Error('Falta VITE_SHEET_CSV_URL en el archivo .env')

        const res = await fetch(csvUrl)
        if (!res.ok) throw new Error(`No se pudo leer el CSV (HTTP ${res.status}). Verifica "Archivo → Publicar en la web".`)

        const csvText = await res.text()
        const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true })
        const normalized = (parsed.data || []).map(normalizeRowKeys)

        setRows(normalized)
      } catch (e) {
        setError(e?.message || 'Error cargando datos')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [csvUrl])

  // 1) Filtra vigentes + abierta
  // 2) Ordena ASC por Fecha de cierre inscripción (más próximo primero)
  const vigenteOrdenado = useMemo(() => {
    const today = startOfTodayLocal()

    const filtered = rows.filter((r) => {
      const cierreDate = parseDateLoose(r[keys.cierre])
      if (!cierreDate) return false

      const esVigente = cierreDate >= today
      const esAbierta = normalizeValue(r[keys.tipoOferta]) === 'abierta'
      return esVigente && esAbierta
    })

    filtered.sort((a, b) => {
      const da = parseDateLoose(a[keys.cierre])?.getTime() ?? Infinity
      const db = parseDateLoose(b[keys.cierre])?.getTime() ?? Infinity
      return da - db // ASC
    })

    return filtered
  }, [rows, keys.cierre, keys.tipoOferta])

  return (
    <div style={{ background: '#f5f6f7', minHeight: '100vh' }}>
      <style>{`
        .flip-wrap { perspective: 1000px; }
        .flip-card { height: 300px; } /* fijo para mantener mismo tamaño y que quepa observación */
        .flip-inner {
          position: relative;
          width: 100%;
          height: 100%;
          transition: transform 0.55s ease;
          transform-style: preserve-3d;
        }
        .flip-inner.is-flipped { transform: rotateY(180deg); }

        .flip-face {
          position: absolute;
          inset: 0;
          backface-visibility: hidden;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.08);
          border: 1px solid rgba(0,0,0,0.08);
        }

        .flip-front {
          background: ${SENA_GREEN};
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 14px;
          font-weight: 900;
          letter-spacing: 0.4px;
          font-size: 26px;
        }

        .flip-back {
          background: white;
          transform: rotateY(180deg);
          padding: 14px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 10px;
        }

        .back-title {
          font-weight: 900;
          text-transform: uppercase;
          text-align: center;
          color: ${SENA_GREEN};
          line-height: 1.15;
          margin-bottom: 2px;
        }

        .kv {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          border-top: 1px solid rgba(0,0,0,0.08);
          padding-top: 8px;
          font-size: 14px;
        }
        .k { color: rgba(0,0,0,0.6); }
        .v { font-weight: 700; }

        .obs {
          margin-top: 4px;
          border-top: 1px dashed rgba(0,0,0,0.2);
          padding-top: 10px;
          font-size: 13px;
          color: rgba(0,0,0,0.75);
        }
        .obs-title {
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-bottom: 6px;
          color: rgba(0,0,0,0.65);
        }
        .obs-p {
          margin: 0;
          line-height: 1.25;
        }
      `}</style>

      <Container className="py-4">
        <Row className="mb-3 align-items-end">
          <Col>
            <h3 className="mb-1" style={{ color: '#1f2a37' }}>Oferta en inscripción en el CIDM</h3>
          </Col>
          <Col xs="auto">
            {loading ? (
              <div className="d-flex align-items-center gap-2">
                <Spinner animation="border" size="sm" />
                <span>Cargando…</span>
              </div>
            ) : (
              <div className="d-flex align-items-center gap-2">
                <span className="text-muted">Resultados:</span>
                <Badge bg="secondary">{vigenteOrdenado.length}</Badge>
              </div>
            )}
          </Col>
        </Row>

        {error && <Alert variant="danger">{error}</Alert>}

        {!loading && vigenteOrdenado.length === 0 && (
          <Alert variant="secondary" className="text-center">
            No hay fichas vigentes con “Tipo de oferta” = Abierta.
          </Alert>
        )}

        <Row className="g-3">
          {vigenteOrdenado.map((r, idx) => {
            const nombre = safeText(leftOfDoubleDash(r[keys.nombreProg]), 'PROGRAMA SIN NOMBRE').toUpperCase()

            const ini = safeText(dateOnly(r[keys.ini]))
            const fin = safeText(dateOnly(r[keys.fin]))
            const ficha = safeText(r[keys.ficha])
            const cierre = safeText(dateOnly(r[keys.cierre]))

            const hIni = safeText(r[keys.horaInicio])
            const hFin = safeText(r[keys.horaFinal])
            const ambiente = safeText(r[keys.ambiente])

            const obsText = `Horario: ${hIni} a ${hFin}. Ambiente: ${ambiente}.`

            const isFlipped = flippedKey === idx

            return (
              <Col key={idx} xs={12} md={6} lg={4} className="flip-wrap">
                <div
                  className="flip-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => setFlippedKey(isFlipped ? null : idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setFlippedKey(isFlipped ? null : idx)
                  }}
                  title="Haz click para ver/ocultar detalles"
                  style={{ cursor: 'pointer' }}
                >
                  <div className={`flip-inner ${isFlipped ? 'is-flipped' : ''}`}>
                    {/* FRONT: solo nombre centrado */}
                    <div className="flip-face flip-front">{nombre}</div>

                    {/* BACK: nombre + detalles + OBS en párrafo */}
                    <div className="flip-face flip-back">
                      <div className="back-title">{nombre}</div>

                      <div className="kv">
                        <div className="k">Inicio</div>
                        <div className="v">{ini}</div>
                      </div>
                      <div className="kv">
                        <div className="k">Finalización</div>
                        <div className="v">{fin}</div>
                      </div>
                      <div className="kv">
                        <div className="k">Número de ficha</div>
                        <div className="v">{ficha}</div>
                      </div>
                      <div className="kv">
                        <div className="k">Cierre inscripción</div>
                        <div className="v">{cierre}</div>
                      </div>

                      <div className="obs">
                        <div className="obs-title">Observación</div>
                        <p className="obs-p">{obsText}</p>
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
