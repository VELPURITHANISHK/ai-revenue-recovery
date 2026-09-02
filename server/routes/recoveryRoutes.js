const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/recoveryController');

// Stats & Activity
router.get('/stats',                      ctrl.getStats);
router.get('/activity',                   ctrl.getGlobalActivity);

router.get('/failed-payments',            ctrl.getFailedPayments);
router.get('/cases',                      ctrl.getCases);
router.get('/escalations',                ctrl.getEscalations);
router.get('/cases/:id',                  ctrl.getCaseDetail);

// Phase 3: analyze only (structured JSON decision, no execution)
router.post('/:paymentId/analyze',        ctrl.analyzePayment);

// Phase 4: analyze + tool call + execute
router.post('/:paymentId/start',          ctrl.startRecovery);

router.post('/:paymentId/stop',           ctrl.stopRecovery);
router.get('/:paymentId/activity',        ctrl.getActivity);

// Demo/Dev only: Simulate customer paying the link
router.post('/:paymentId/simulate-success', ctrl.simulateSuccess);
router.post('/reset-demo',                 ctrl.resetDemo);

module.exports = router;
