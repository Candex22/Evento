const express = require('express');
const router = express.Router();
const { requireRole } = require('../middleware/auth');
const { pedidosPendientes, confirmarPedido, rechazarPedido } = require('../controllers/pedidoController');

router.use(requireRole('cajero', 'admin'));

router.get('/pedidos', pedidosPendientes);
router.patch('/pedidos/:id/confirmar', confirmarPedido);
router.patch('/pedidos/:id/rechazar', rechazarPedido);

module.exports = router;