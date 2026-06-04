import { get, patch } from './client'

export const pedidosPendientes = ()           => get('/cajero/pedidos')
export const confirmarPedido   = (id)         => patch(`/cajero/pedidos/${id}/confirmar`)
export const rechazarPedido    = (id, motivo) => patch(`/cajero/pedidos/${id}/rechazar`, { motivo })