# Issue 07: 品牌发布/静态备份原生动作

## What to build

Add the native equivalent of 5012's "generate static backup" / publish action to the selected brand content console. The action should be brand-aware, permission-gated, server-side, and should return a readable execution log or status.

## Acceptance criteria

- [ ] The native console exposes a publish/static-backup action for write-capable users.
- [ ] The action is brand-aware and does not blindly hardcode all brands to Everhot behavior.
- [ ] Unsupported brands show an honest disabled state or message.
- [ ] Script execution, if needed, happens server-side only.
- [ ] Publish results show success/error logs in the native UI.
- [ ] No publish action is available to read-only users.

## Blocked by

- Issue 02: 品牌产品列表与 taxonomy 数据适配
- Issue 04: 上架/下架、删除/归档和权限门禁
