/**
 * A2A 发现文档标准路径 /.well-known/agent-card.json
 *
 * 真实实现在 app/api/mcp-server/agent-card/route.ts (那里才被 tsconfig 纳入类型检查)。
 * next.config.js 已加 rewrite 把本路径转发到该 API route; 此文件仅作相对再导出兜底,
 * 用相对路径 import (不依赖 @/ path alias, 因 dot 目录可能不在 tsconfig include 内)。
 */
export { GET, runtime, dynamic } from '../../api/mcp-server/agent-card/route';
