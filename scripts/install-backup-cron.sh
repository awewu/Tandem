#!/usr/bin/env bash
# install-backup-cron.sh · Linux 部署后跑一次, 装 cron 每日 04:00 备份 + 7 天保留
# 用法: sudo bash scripts/install-backup-cron.sh /opt/tandem /var/backups/tandem
#       第 1 参 = 仓库根 (含 backup-pg.mjs); 第 2 参 = 备份输出目录 (S3 推荐 rclone, 见末尾)

set -euo pipefail

REPO_ROOT="${1:-/opt/tandem}"
BACKUP_DIR="${2:-/var/backups/tandem}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
CRON_HOUR="${BACKUP_HOUR:-4}"
CRON_FILE="/etc/cron.d/tandem-backup"

if [[ $EUID -ne 0 ]]; then
  echo "[install] need root (sudo)" >&2; exit 1
fi

if [[ ! -d "$REPO_ROOT" ]]; then
  echo "[install] repo root $REPO_ROOT 不存在" >&2; exit 1
fi
if [[ ! -f "$REPO_ROOT/scripts/backup-pg.mjs" ]]; then
  echo "[install] backup-pg.mjs not found in $REPO_ROOT/scripts/" >&2; exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 750 "$BACKUP_DIR"

cat > "$CRON_FILE" <<EOF
# Tandem PostgreSQL 备份 · 每日 ${CRON_HOUR}:00 + 保留 ${RETENTION_DAYS} 天
# 安装日期: $(date -Iseconds)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 ${CRON_HOUR} * * * root cd ${REPO_ROOT} && /usr/bin/node scripts/backup-pg.mjs --dir ${BACKUP_DIR} >> /var/log/tandem-backup.log 2>&1
10 ${CRON_HOUR} * * * root find ${BACKUP_DIR} -name 'tandem-*.sql.gz' -mtime +${RETENTION_DAYS} -delete >> /var/log/tandem-backup.log 2>&1
EOF

chmod 644 "$CRON_FILE"
touch /var/log/tandem-backup.log
chmod 640 /var/log/tandem-backup.log

echo "[install] OK · cron written to $CRON_FILE"
echo "[install] 下一次备份: $(date -d "${CRON_HOUR}:00 tomorrow" -Iseconds 2>/dev/null || echo "next ${CRON_HOUR}:00")"
echo "[install] 查日志: tail -f /var/log/tandem-backup.log"
echo ""
echo "[install] 异地拷贝 (强烈推荐) — 选一个:"
echo "  · aws s3 cp ${BACKUP_DIR}/tandem-*.sql.gz s3://your-bucket/tandem/ --recursive"
echo "  · rclone copy ${BACKUP_DIR} remote:tandem-backups"
echo "  · scp ${BACKUP_DIR}/*.sql.gz backup-host:/backup/tandem/"
echo ""
echo "[install] 恢复演练 (装完即跑一次, 必须做): "
echo "  gunzip -c $(ls -t ${BACKUP_DIR}/tandem-*.sql.gz | head -1) | psql 'postgresql://tandem:***@restore-host:5432/tandem_restore'"
