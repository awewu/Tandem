/**
 * DOASComplianceEngine.js — moved to shared HVAC calculation kernel.
 *
 * Single source of truth now lives in packages/domain/hvac-kernels.
 * This file is a thin re-export kept so existing require('../core/...') call
 * sites stay valid. Do not add logic here; edit the kernel package instead.
 */
module.exports = require('../../packages/domain/hvac-kernels/fresh-air/DOASComplianceEngine');
