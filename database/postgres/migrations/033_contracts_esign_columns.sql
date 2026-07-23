-- Schema 漂移修复 · contracts 表补齐契约锁(QYS)电签列。
-- 背景：ContractEntity（services/api/.../delivery.entity.ts）已声明 esign_* / signed_pdf_key 列
--       并被 contract.service.ts（发起签署/回调/下载）与 bim.service.inheritFromQuotation（签单承接
--       时读写 contracts）使用，但历史迁移从未在 rhautt_nexus.contracts 建这些列。
-- 症状：签单闭环 crm.sign → bim.inheritFromQuotation 经 TypeORM 查/写 contracts 生成引用
--       "esign_contract_id" 的 SQL → QueryFailedError: column ContractEntity.esign_contract_id
--       does not exist → 500，签单/承接中断。
-- 修复：幂等补列（与实体定义一一对齐）。RLS（contracts_tenant_isolation，见 001/004）对新列同样生效。

BEGIN;

ALTER TABLE rhautt_nexus.contracts
  ADD COLUMN IF NOT EXISTS esign_contract_id varchar,
  ADD COLUMN IF NOT EXISTS esign_status      integer,
  ADD COLUMN IF NOT EXISTS esign_sign_url    text,
  ADD COLUMN IF NOT EXISTS signed_pdf_key    varchar;

-- 契约锁回调按平台侧合同号反查本地合同（contract.service webhook/download），加索引。
CREATE INDEX IF NOT EXISTS idx_contracts_tenant_esign_contract_id
  ON rhautt_nexus.contracts (tenant_id, esign_contract_id);

COMMENT ON COLUMN rhautt_nexus.contracts.esign_contract_id IS '契约锁平台侧合同 ID，发起签署后写入。';
COMMENT ON COLUMN rhautt_nexus.contracts.esign_status IS '契约锁合同状态：0草稿/1签署中/2已完成/3已撤回/4已拒签/5已过期。';
COMMENT ON COLUMN rhautt_nexus.contracts.esign_sign_url IS '最近一次生成的 H5 签署链接（临时记录，约 30min 有效）。';
COMMENT ON COLUMN rhautt_nexus.contracts.signed_pdf_key IS '已签署 PDF 在 object-storage 中的 key（回调后下载存入）。';

COMMIT;
