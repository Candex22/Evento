import { useEffect, useState } from 'react'
import AdminLayout from '../components/layout/AdminLayout'
import { getUsuariosRoles, darAdmin, quitarAdmin, countPendientes } from '../api/admin'
import { useToast, ToastContainer } from '../hooks/useToast'

export default function AdminRolesPage() {
  const [users, setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]     = useState({})
  const [pendingCount, setPendingCount] = useState(0)
  const { toasts, toast }   = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const [data, count] = await Promise.all([getUsuariosRoles(), countPendientes()])
      setUsers(data)
      setPendingCount(count.total)
    } catch {
      toast.error('No se pudieron cargar los usuarios.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const doRole = async (id, isAdmin) => {
    setBusy(b => ({ ...b, [id]: true }))
    try {
      if (isAdmin) {
        await quitarAdmin(id)
        toast.success('Permisos de administrador revocados.')
      } else {
        await darAdmin(id)
        toast.success('Permisos de administrador otorgados.')
      }
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(b => { const n = { ...b }; delete n[id]; return n })
    }
  }

  const admins  = users.filter(u => u.rol === 'administrador')
  const regular = users.filter(u => u.rol !== 'administrador')

  return (
    <AdminLayout pendingCount={pendingCount}>
      <ToastContainer toasts={toasts} />

      <div style={styles.header}>
        <h1 style={styles.title}>Gestión de roles</h1>
        <p style={styles.sub}>Solo usuarios activos pueden ser administradores</p>
      </div>

      {loading ? (
        <div style={styles.loading}><span className="spinner" /> Cargando…</div>
      ) : (
        <>
          {/* Administradores actuales */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>
              <span style={{ color: '#e8c547' }}>◉</span> Administradores
              <span style={styles.count}>{admins.length}</span>
            </h2>
            {admins.length === 0 ? (
              <p style={styles.empty}>No hay otros administradores.</p>
            ) : (
              <div className="card" style={{ padding: 0 }}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Usuario</th>
                        <th>Correo</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admins.map(u => (
                        <tr key={u.id_user}>
                          <td><strong>{u.nombre} {u.apellido}</strong></td>
                          <td><span style={styles.mono}>{u.name_user}</span></td>
                          <td>{u.correo_electronico}</td>
                          <td>
                            <button
                              className="btn btn-warn btn-sm"
                              disabled={busy[u.id_user]}
                              onClick={() => {
                                if (confirm(`¿Revocar permisos de admin a ${u.name_user}?`))
                                  doRole(u.id_user, true)
                              }}
                            >
                              {busy[u.id_user] ? <span className="spinner" /> : '↓'} Quitar admin
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* Usuarios regulares */}
          <section style={styles.section}>
            <h2 style={styles.sectionTitle}>
              <span style={{ color: '#9a9690' }}>◈</span> Usuarios regulares
              <span style={styles.count}>{regular.length}</span>
            </h2>
            {regular.length === 0 ? (
              <p style={styles.empty}>No hay usuarios regulares activos.</p>
            ) : (
              <div className="card" style={{ padding: 0 }}>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nombre</th>
                        <th>Usuario</th>
                        <th>Correo</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {regular.map(u => (
                        <tr key={u.id_user}>
                          <td><strong>{u.nombre} {u.apellido}</strong></td>
                          <td><span style={styles.mono}>{u.name_user}</span></td>
                          <td>{u.correo_electronico}</td>
                          <td>
                            <button
                              className="btn btn-success btn-sm"
                              disabled={busy[u.id_user]}
                              onClick={() => {
                                if (confirm(`¿Dar permisos de admin a ${u.name_user}?`))
                                  doRole(u.id_user, false)
                              }}
                            >
                              {busy[u.id_user] ? <span className="spinner" /> : '↑'} Hacer admin
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </AdminLayout>
  )
}

const styles = {
  header:       { marginBottom: 28 },
  title:        { fontSize: 22, fontWeight: 600, color: '#f0ede8', marginBottom: 4 },
  sub:          { fontSize: 13, color: '#5a5754' },
  loading:      { display: 'flex', alignItems: 'center', gap: 10, color: '#5a5754', fontSize: 13, padding: 24 },
  section:      { marginBottom: 32 },
  sectionTitle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500, color: '#9a9690', marginBottom: 12 },
  count:        { background: '#222', border: '1px solid #2e2e2e', borderRadius: 20, fontSize: 11, padding: '1px 8px', fontFamily: "'DM Mono', monospace", color: '#5a5754' },
  mono:         { fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#9a9690' },
  empty:        { fontSize: 13, color: '#5a5754', padding: '16px 0' },
}