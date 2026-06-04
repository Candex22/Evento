import { get, post, patch, del } from './client'

// Pendientes
export const getPendientes    = () => get('/admin/pendientes')
export const countPendientes  = () => get('/admin/pendientes/count')
export const aprobarUsuario   = (id) => post(`/admin/pendientes/${id}/aprobar`)
export const rechazarUsuario  = (id) => del(`/admin/pendientes/${id}`)

// Usuarios
export const getUsuarios      = () => get('/admin/usuarios')
export const activarUsuario   = (id) => patch(`/admin/usuarios/${id}/activar`)
export const desactivarUsuario= (id) => patch(`/admin/usuarios/${id}/desactivar`)
export const eliminarUsuario  = (id) => del(`/admin/usuarios/${id}`)

// Roles
export const getUsuariosRoles = () => get('/admin/roles')
export const darAdmin         = (id) => patch(`/admin/roles/${id}/dar-admin`)
export const quitarAdmin      = (id) => patch(`/admin/roles/${id}/quitar-admin`)