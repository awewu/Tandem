#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Hermes / Tandem · PostgreSQL backup script
# ----------------------------------------------------------------------------
#
# 全库 pg_dump → 本地落盘 → 可选 S3 上传 → 自动清理旧文件
#
# 用法 (cron):
#   0 2 * * * /opt/hermes/scripts/backup-postgres.sh >> /var/log/hermes-backup.log 2>&1
#
# 环境变量:
#   DATABASE_URL          必填. postgres://user:pass@host:5432/dbname
#   BACKUP_DIR            默认 /var/backups/hermes
#   BACKUP_RETAIN_DAYS    默认 30 (本地保留天数)
#   S3_BUCKET             可选. 不填则跳过 S3 上传
#   S3_PREFIX             默认 hermes-tandem
#   AWS_ACCESS_KEY_ID     如启用 S3 必填
#   AWS_SECRET_ACCESS_KEY 如启用 S3 必填
#   AWS_REGION            默认 cn-north-1
#
# 退出码:
#   0  成功
#   1  pg_dump 失败
#   2  S3 上传失败 (本地已备份, 视作警告)
#
# 验证恢复: 参见 docs/RECOVERY-SOP.md

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/hermes}"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-30}"
S3_PREFIX="${S3_PREFIX:-hermes-tandem}"
AWS_REGION="${AWS_REGION:-cn-north-1}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[backup] FATAL: DATABASE_URL not set" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TS=$(date -u +%Y%m%d-%H%M%S)
HOSTNAME_SAFE=$(hostname | tr -c 'A-Za-z0-9' '-' | sed 's/^-*//;s/-*$//')
FILE="$BACKUP_DIR/hermes-${HOSTNAME_SAFE}-${TS}.sql.gz"

echo "[backup] $(date -u) start, output=$FILE"

# pg_dump - 使用 plain SQL 配合 gzip, 兼容性 / 易读 / 易 diff
# --no-owner / --no-privileges 让备份能跨用户恢复
# --clean --if-exists 让 restore 时可覆盖
if pg_dump \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
    --format=plain \
    "$DATABASE_URL" \
  | gzip -9 > "$FILE"; then
  echo "[backup] pg_dump ok, size=$(du -h "$FILE" | cut -f1)"
else
  echo "[backup] FATAL: pg_dump failed" >&2
  rm -f "$FILE"
  exit 1
fi

# 计算 SHA256 作为完整性 checksum (与本文件并列存)
sha256sum "$FILE" | awk '{print $1}' > "$FILE.sha256"
echo "[backup] sha256=$(cat "$FILE.sha256")"

# 上传 S3 (可选)
if [ -n "${S3_BUCKET:-}" ]; then
  if ! command -v aws >/dev/null 2>&1; then
    echo "[backup] WARN: S3_BUCKET set but aws CLI not found, skipping upload" >&2
  else
    echo "[backup] uploading to s3://$S3_BUCKET/$S3_PREFIX/"
    if aws s3 cp "$FILE" "s3://$S3_BUCKET/$S3_PREFIX/" \
         --region "$AWS_REGION" \
         --storage-class STANDARD_IA \
       && aws s3 cp "$FILE.sha256" "s3://$S3_BUCKET/$S3_PREFIX/" \
         --region "$AWS_REGION"; then
      echo "[backup] S3 upload ok"
    else
      echo "[backup] WARN: S3 upload failed (local backup preserved)" >&2
      exit 2
    fi
  fi
fi

# 清理过期本地文件
find "$BACKUP_DIR" -maxdepth 1 -name 'hermes-*.sql.gz*' -mtime "+$RETAIN_DAYS" -delete
echo "[backup] retention cleanup: kept last $RETAIN_DAYS days"

echo "[backup] $(date -u) done"
