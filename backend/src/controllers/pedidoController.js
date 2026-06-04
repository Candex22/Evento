const pool = require('../config/db');

// POST /api/mozo/pedidos — el mozo crea un pedido (queda pendiente)
async function crearPedido(req, res) {
  const nombre = (req.body.nombre || '').trim();
  const items = Array.isArray(req.body.items) ? req.body.items : [];

  if (!nombre) return res.status(400).json({ error: 'El nombre del pedido es obligatorio.' });

  const limpios = items
    .map(i => ({ id_producto: parseInt(i.id_producto, 10), cantidad: parseInt(i.cantidad, 10) }))
    .filter(i => !isNaN(i.id_producto) && !isNaN(i.cantidad) && i.cantidad > 0);

  if (limpios.length === 0) return res.status(400).json({ error: 'Agregá al menos un producto con cantidad.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ped = await client.query(
      'INSERT INTO pedido (nombre, id_mozo) VALUES ($1, $2) RETURNING id_pedido',
      [nombre, req.session.id_usuario]
    );
    const id_pedido = ped.rows[0].id_pedido;
    for (const it of limpios) {
      await client.query(
        'INSERT INTO pedido_item (id_pedido, id_producto, cantidad) VALUES ($1, $2, $3)',
        [id_pedido, it.id_producto, it.cantidad]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ message: 'Pedido enviado. Esperando confirmación del cajero.', id_pedido });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al crear pedido:', err);
    res.status(500).json({ error: 'Error al crear el pedido.' });
  } finally {
    client.release();
  }
}

// GET /api/mozo/pedidos — pedidos del mozo logueado (lista + polling)
async function misPedidos(req, res) {
  try {
    const r = await pool.query(
      `SELECT p.id_pedido, p.nombre, p.estado, p.motivo_rechazo, p.created_at, p.resolved_at,
              COALESCE(
                json_agg(json_build_object('producto', pr.nombre, 'cantidad', pi.cantidad) ORDER BY pr.nombre)
                FILTER (WHERE pi.id_item IS NOT NULL), '[]'
              ) AS items
       FROM pedido p
       LEFT JOIN pedido_item pi ON pi.id_pedido = p.id_pedido
       LEFT JOIN producto pr ON pr.id_producto = pi.id_producto
       WHERE p.id_mozo = $1
       GROUP BY p.id_pedido
       ORDER BY p.created_at DESC
       LIMIT 50`,
      [req.session.id_usuario]
    );
    res.json(r.rows);
  } catch (err) {
    console.error('Error al listar pedidos del mozo:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// GET /api/cajero/pedidos — pendientes con datos del mozo y detalle
async function pedidosPendientes(req, res) {
  try {
    const r = await pool.query(
      `SELECT p.id_pedido, p.nombre, p.created_at,
              u.nombre AS mozo_nombre, u.apellido AS mozo_apellido,
              COALESCE(
                json_agg(json_build_object(
                  'producto', pr.nombre, 'cantidad', pi.cantidad, 'stock', pr.stock
                ) ORDER BY pr.nombre) FILTER (WHERE pi.id_item IS NOT NULL), '[]'
              ) AS items
       FROM pedido p
       JOIN usuario u ON u.id_user = p.id_mozo
       LEFT JOIN pedido_item pi ON pi.id_pedido = p.id_pedido
       LEFT JOIN producto pr ON pr.id_producto = pi.id_producto
       WHERE p.estado = 'pendiente'
       GROUP BY p.id_pedido, u.nombre, u.apellido
       ORDER BY p.created_at ASC`
    );
    res.json(r.rows);
  } catch (err) {
    console.error('Error al listar pendientes:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
}

// PATCH /api/cajero/pedidos/:id/confirmar — valida stock, descuenta y registra egresos
async function confirmarPedido(req, res) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ped = await client.query('SELECT estado FROM pedido WHERE id_pedido = $1 FOR UPDATE', [id]);
    if (ped.rowCount === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pedido no encontrado.' }); }
    if (ped.rows[0].estado !== 'pendiente') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'El pedido ya fue resuelto.' }); }

    // items con stock actual (bloqueando las filas de producto)
    const items = await client.query(
      `SELECT pi.id_producto, pi.cantidad, pr.nombre, pr.stock
       FROM pedido_item pi JOIN producto pr ON pr.id_producto = pi.id_producto
       WHERE pi.id_pedido = $1 FOR UPDATE OF pr`,
      [id]
    );

    const faltantes = items.rows
      .filter(i => i.cantidad > i.stock)
      .map(i => `${i.nombre} (pide ${i.cantidad}, hay ${i.stock})`);
    if (faltantes.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Stock insuficiente: ${faltantes.join(', ')}.` });
    }

    for (const it of items.rows) {
      await client.query('UPDATE producto SET stock = stock - $1 WHERE id_producto = $2', [it.cantidad, it.id_producto]);
      await client.query(
        "INSERT INTO movimiento_stock (id_producto, id_usuario, tipo, cantidad) VALUES ($1, $2, 'egreso', $3)",
        [it.id_producto, req.session.id_usuario, it.cantidad]
      );
    }
    await client.query(
      "UPDATE pedido SET estado = 'confirmado', id_cajero = $1, resolved_at = NOW() WHERE id_pedido = $2",
      [req.session.id_usuario, id]
    );
    await client.query('COMMIT');
    res.json({ message: 'Pedido confirmado. Stock actualizado.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al confirmar pedido:', err);
    res.status(500).json({ error: 'Error al confirmar el pedido.' });
  } finally {
    client.release();
  }
}

// PATCH /api/cajero/pedidos/:id/rechazar — requiere motivo
async function rechazarPedido(req, res) {
  const id = parseInt(req.params.id, 10);
  const motivo = (req.body.motivo || '').trim();
  if (isNaN(id)) return res.status(400).json({ error: 'ID inválido.' });
  if (!motivo) return res.status(400).json({ error: 'El motivo del rechazo es obligatorio.' });

  try {
    const r = await pool.query(
      `UPDATE pedido SET estado = 'rechazado', id_cajero = $1, motivo_rechazo = $2, resolved_at = NOW()
       WHERE id_pedido = $3 AND estado = 'pendiente' RETURNING id_pedido`,
      [req.session.id_usuario, motivo, id]
    );
    if (r.rowCount === 0) return res.status(409).json({ error: 'El pedido no existe o ya fue resuelto.' });
    res.json({ message: 'Pedido rechazado.' });
  } catch (err) {
    console.error('Error al rechazar pedido:', err);
    res.status(500).json({ error: 'Error al rechazar el pedido.' });
  }
}

module.exports = { crearPedido, misPedidos, pedidosPendientes, confirmarPedido, rechazarPedido };