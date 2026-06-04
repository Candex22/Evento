import { useEffect, useState, useRef } from 'react'
import PanelLayout from '../components/layout/PanelLayout'
import { pedidosPendientes, confirmarPedido, rechazarPedido } from '../api/cajero'
import { useToast, ToastContainer } from '../hooks/useToast'

const NAV = [
  { to: '/cajero', label: 'Pedidos', icon: '▦', end: true },
]

function fmtFecha(iso) {
  const d = new Date(iso)
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

export default function CajeroPedidosPage() {
  const [pedidos, setPedidos]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [busy, setBusy]         = useState({})
  const [rejectId, setRejectId] = useState(null)
  const [motivo, setMotivo]     = useState('')
  const { toasts, toast }       = useToast()
  const prevIds = useRef(new Set())

  const load = async (notificar = false) => {
    try {
      const data = await pedidosPendientes()
      if (notificar) {
        const nuevos = data.filter(p => !prevIds.current.has(p.id_pedido))
        if (nuevos.length > 0) toast.success(`${nuevos.length} pedido(s) nuevo(s)`)
      }
      prevIds.current = new Set(data.map(p => p.id_pedido))
      setPedidos(data)
    } catch {
      if (!notificar) toast.error('No se pudieron cargar los pedidos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(false)
    const t = setInterval(() => load(true), 8000)  // polling
    return () => clearInterval(t)
  }, [])

  const onConfirmar = async (id) => {
    setBusy(b => ({ ...b, [id]: true }))
    try {
      const res = await confirmarPedido(id)
      toast.success(res.message)
      await load(false)
    } catch (err) {
      toast.error(err.message)   // acá llega "Stock insuficiente: ..."
    } finally {
      setBusy(b => { const n = { ...b }; delete n[id]; return n })
    }
  }

  const onRechazar = async () => {
    if (!motivo.trim()) return toast.error('Escribí el motivo del rechazo.')
    const id = rejectId
    setBusy(b => ({ ...b, [id]: true }))
    try {
      const res = await rechazarPedido(id, motivo.trim())
      toast.success(res.message)
      setRejectId(null)
      setMotivo('')
      await load(false)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(b => { const n = { ...b }; delete n[id]; return n })
    }
  }

  return (
    <PanelLayout nav={NAV} brandSub="cajero">
      <ToastContainer toasts={toasts} />

      <div style={styles.header}>
        <h1 style={styles.title}>Pedidos pendientes</h1>
        <p style={styles.sub}>Revisá y confirmá o rechazá cada pedido</p>
      </div>

      {loading ? (
        <div style={styles.loading}><span className="spinner" /> Cargando…</div>
      ) : pedidos.length === 0 ? (
        <div className="empty-state"><div className="icon">✓</div><h3>No hay pedidos pendientes</h3><p>Los nuevos aparecen solos.</p></div>
      ) : (
        <div style={styles.list}>
          {pedidos.map(p => {
            const totalU = p.items.reduce((s, i) => s + i.cantidad, 0)
            const hayFaltante = p.items.some(i => i.cantidad > i.stock)
            return (
              <div key={p.id_pedido} className="card" style={styles.card}>
                <div style={styles.cardTop}>
                  <div>
                    <div style={styles.mozo}>{p.mozo_nombre} {p.mozo_apellido}</div>
                    <div style={styles.pedidoNombre}>{p.nombre} · {p.items.length} prod · {totalU} u.</div>
                  </div>
                  <span style={styles.hora}>{fmtFecha(p.created_at)}</span>
                </div>

                <div style={styles.items}>
                  {p.items.map((it, i) => {
                    const falta = it.cantidad > it.stock
                    return (
                      <div key={i} style={styles.itemRow}>
                        <span style={{ color: falta ? '#d57b7b' : '#f0ede8' }}>{it.producto}</span>
                        <span style={styles.itemCant}>
                          ×{it.cantidad}
                          <span style={{ ...styles.itemStock, color: falta ? '#d57b7b' : '#5a5754' }}>
                            (stock {it.stock})
                          </span>
                        </span>
                      </div>
                    )
                  })}
                </div>

                {hayFaltante && <div style={styles.warn}>⚠ No hay stock suficiente para confirmar</div>}

                <div style={styles.actions}>
                  <button className="btn btn-danger btn-sm" disabled={busy[p.id_pedido]} onClick={() => { setRejectId(p.id_pedido); setMotivo('') }}>
                    Rechazar
                  </button>
                  <button className="btn btn-success btn-sm" disabled={busy[p.id_pedido] || hayFaltante} onClick={() => onConfirmar(p.id_pedido)}>
                    {busy[p.id_pedido] ? <span className="spinner" /> : 'Confirmar'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de rechazo con motivo obligatorio */}
      {rejectId !== null && (
        <div style={styles.overlay} onClick={() => setRejectId(null)}>
          <div className="card" style={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Motivo del rechazo</h3>
            <p style={styles.sub}>El mozo lo verá para explicarlo en la mesa</p>
            <textarea
              autoFocus value={motivo} rows={3}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ej. No hay stock de gaseosa, ofrecer otra opción"
              style={{ marginTop: 12, marginBottom: 16, resize: 'vertical', width: '100%' }}
            />
            <div style={styles.modalBtns}>
              <button className="btn btn-ghost" onClick={() => setRejectId(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={onRechazar} disabled={busy[rejectId]}>
                {busy[rejectId] ? <span className="spinner" /> : 'Rechazar pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PanelLayout>
  )
}

const styles = {
  header:    { marginBottom: 24 },
  title:     { fontSize: 22, fontWeight: 600, color: '#f0ede8', marginBottom: 4 },
  sub:       { fontSize: 13, color: '#5a5754' },
  loading:   { display: 'flex', alignItems: 'center', gap: 10, color: '#5a5754', fontSize: 13, padding: 24 },
  list:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
  card:      { display: 'flex', flexDirection: 'column', gap: 12 },
  cardTop:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  mozo:      { fontSize: 14, fontWeight: 600, color: '#f0ede8' },
  pedidoNombre: { fontSize: 12, color: '#9a9690', fontFamily: "'DM Mono', monospace", marginTop: 2 },
  hora:      { fontSize: 11, color: '#5a5754', fontFamily: "'DM Mono', monospace" },
  items:     { display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid #2e2e2e', paddingTop: 12 },
  itemRow:   { display: 'flex', justifyContent: 'space-between', fontSize: 13 },
  itemCant:  { fontFamily: "'DM Mono', monospace", color: '#9a9690' },
  itemStock: { fontSize: 11, marginLeft: 6 },
  warn:      { fontSize: 12, color: '#d57b7b', background: '#1e1010', border: '1px solid #3a1a1a', borderRadius: 6, padding: '6px 10px' },
  actions:   { display: 'flex', justifyContent: 'flex-end', gap: 8 },
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 },
  modal:     { width: '100%', maxWidth: 420 },
  modalTitle:{ fontSize: 16, fontWeight: 600, color: '#f0ede8', marginBottom: 4 },
  modalBtns: { display: 'flex', justifyContent: 'flex-end', gap: 10 },
}