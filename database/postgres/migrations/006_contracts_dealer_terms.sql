-- ════════════════════════════════════════════════════════════════════════
-- Rhautt Nexus · Migration 006
-- 合同持久化（ContractService）落位：contracts 增列 dealer_id / terms。
-- contracts 表已在 001 建表并启用 FORCE RLS + contracts_tenant_isolation，无需重复加固。
-- ════════════════════════════════════════════════════════════════════════

SET search_path TO rhautt_nexus, public;

-- 经销商归属（用于经销商维度筛选；租户隔离仍由 tenant_id RLS 策略保证）
ALTER TABLE rhautt_nexus.contracts
  ADD COLUMN IF NOT EXISTS dealer_id uuid REFERENCES rhautt_nexus.dealers(id);

-- 合同条款 / 报价快照引用（fromQuotationNo、lockedVersion、priceFrozen 等）
ALTER TABLE rhautt_nexus.contracts
  ADD COLUMN IF NOT EXISTS terms jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 便于按经销商 + 状态查询合同
CREATE INDEX IF NOT EXISTS contracts_dealer_status_idx
  ON rhautt_nexus.contracts (tenant_id, dealer_id, status);
