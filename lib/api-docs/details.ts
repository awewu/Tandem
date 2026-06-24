import {
  API_AUTH_DESCRIPTIONS,
  API_AUTH_LABELS,
  type ApiEndpoint,
} from './catalog';

export interface ApiField {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}

export interface ApiStatus {
  code: string;
  description: string;
}

export interface ApiEndpointDoc {
  summary: string;
  contentType: string;
  requestHeaders: ApiField[];
  pathParams: ApiField[];
  queryParams: ApiField[];
  bodyParams: ApiField[];
  responseFields: ApiField[];
  statuses: ApiStatus[];
}

const JSON_TYPE = 'application/json';
const FORM_TYPE = 'application/x-www-form-urlencoded';
const MULTIPART_TYPE = 'multipart/form-data';

function field(name: string, type: string, description: string, required = false): ApiField {
  return { name, type, description, required };
}

function defaultHeaders(endpoint: ApiEndpoint): ApiField[] {
  const headers = [
    field('Content-Type', endpoint.methods.some((m) => m !== 'GET') ? JSON_TYPE : '无请求体时可省略', '请求体编码格式。文件上传与 OIDC token 接口除外。', endpoint.methods.some((m) => m !== 'GET')),
    field('x-request-id', 'string', '可选。调用方传入后服务端会透传；未传时由 middleware 自动生成。'),
  ];
  if (endpoint.auth !== 'public') {
    headers.push(field('Cookie', 'tandem_at=<access-token>', '必填。Tandem 登录态 Cookie，由登录接口写入。', true));
  }
  if (endpoint.path === '/api/oidc/token') {
    headers.push(field('Authorization', 'Basic base64(client_id:client_secret)', 'confidential client 可用 Basic 方式提交 client 凭据。'));
  }
  if (endpoint.path === '/api/oidc/userinfo') {
    headers.push(field('Authorization', 'Bearer <access_token>', 'OIDC access token。GET/POST 均支持。', true));
  }
  return headers;
}

function pathParams(path: string): ApiField[] {
  return Array.from(path.matchAll(/\{([^}]+)\}/g)).map((m) =>
    field(m[1], 'string', `路径参数 ${m[1]}。`, true),
  );
}

function defaultSummary(endpoint: ApiEndpoint): string {
  const path = endpoint.path;
  if (path.includes('/{id}')) return `对 ${endpoint.group} 模块中的指定资源进行查询、更新或删除。`;
  if (endpoint.methods.includes('POST') && endpoint.methods.includes('GET')) return `查询或创建 ${endpoint.group} 模块资源。`;
  if (endpoint.methods.includes('GET')) return `查询 ${endpoint.group} 模块数据。`;
  if (endpoint.methods.includes('POST')) return `创建、提交或触发 ${endpoint.group} 模块动作。`;
  if (endpoint.methods.includes('PATCH') || endpoint.methods.includes('PUT')) return `更新 ${endpoint.group} 模块资源。`;
  if (endpoint.methods.includes('DELETE')) return `删除 ${endpoint.group} 模块资源。`;
  return `${endpoint.group} 模块接口。`;
}

function defaultBody(endpoint: ApiEndpoint): ApiField[] {
  if (endpoint.methods.every((m) => m === 'GET' || m === 'DELETE')) return [];
  if (endpoint.path.includes('/import') || endpoint.path.includes('/bulk-invite')) {
    return [
      field('file', 'File', '上传文件。部分接口也支持 JSON 模式，具体以业务页面调用为准。'),
      field('payload', 'object', 'JSON 模式下的业务参数集合。'),
    ];
  }
  return [
    field('业务字段', 'object', '与当前资源对应的创建/更新字段。服务端会忽略或覆盖 tenantId、createdBy、ownerId 等敏感上下文字段。'),
  ];
}

function defaultResponse(endpoint: ApiEndpoint): ApiField[] {
  if (endpoint.methods.includes('DELETE')) return [field('ok', 'boolean', '操作是否成功。')];
  if (endpoint.methods.includes('GET')) return [field('items / data / <resource[]>', 'array | object', '查询结果。字段随业务资源类型变化。')];
  return [field('ok / <resource>', 'boolean | object', '操作结果或创建后的资源对象。')];
}

function defaultStatuses(endpoint: ApiEndpoint): ApiStatus[] {
  const statuses: ApiStatus[] = [];
  if (endpoint.methods.includes('GET')) statuses.push({ code: '200', description: '请求成功，返回查询结果。' });
  if (endpoint.methods.some((m) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(m))) {
    statuses.push({ code: '200/201', description: '写入、更新或动作执行成功。创建类接口通常返回 201。' });
    statuses.push({ code: '400', description: '请求参数缺失、格式错误或业务校验失败。' });
  }
  if (endpoint.auth !== 'public') statuses.push({ code: '401', description: '未登录、登录态过期或 access token 无效。' });
  if (endpoint.auth === 'role') statuses.push({ code: '403', description: '已登录但角色权限不足。' });
  if (endpoint.path.includes('/{')) statuses.push({ code: '404', description: '指定资源不存在，或当前用户无权访问该资源。' });
  statuses.push({ code: '500', description: '服务端异常。响应体通常包含 error 字段。' });
  return statuses;
}

const OVERRIDES: Record<string, Partial<ApiEndpointDoc>> = {
  '/api/auth/login': {
    summary: '账号密码登录。成功后服务端写入 httpOnly 登录 Cookie。',
    bodyParams: [
      field('email', 'string', '登录邮箱。', true),
      field('password', 'string', '登录密码。', true),
    ],
    responseFields: [
      field('ok', 'boolean', '是否登录成功。'),
      field('userId', 'string', '登录用户 ID。'),
      field('requiresMfa', 'boolean', '是否需要继续完成 MFA 校验。'),
      field('pendingSessionId', 'string | null', 'MFA 待验证会话 ID。'),
      field('mfaEnrollmentRequired', 'boolean', '特权账号是否必须先启用 MFA。'),
    ],
    statuses: [
      { code: '200', description: '登录成功，并设置 tandem_at Cookie。' },
      { code: '400', description: 'JSON 无效或 email/password 缺失。' },
      { code: '401', description: '账号或密码错误。' },
      { code: '429', description: '登录尝试过于频繁。响应头包含 Retry-After。' },
      { code: '500', description: '认证服务异常。' },
    ],
  },
  '/api/auth/me': {
    summary: '读取当前登录用户信息。',
    responseFields: [
      field('ok', 'boolean', '是否成功。'),
      field('user.id', 'string', '用户 ID。'),
      field('user.email', 'string', '用户邮箱。'),
      field('user.name', 'string', '用户名称。'),
      field('user.roles', 'string[]', '当前用户角色集合。'),
      field('user.tenantId', 'string', '租户 ID。'),
      field('user.mfaVerified', 'boolean', '当前会话是否已完成 MFA。'),
    ],
    statuses: [
      { code: '200', description: '返回当前用户。' },
      { code: '401', description: '未登录且 demo fallback 未开启。' },
      { code: '404', description: '会话有效但用户记录不存在。' },
    ],
  },
  '/api/health': {
    summary: '应用健康检查与依赖 readiness 探针。',
    responseFields: [
      field('ok', 'boolean', '关键依赖是否健康。'),
      field('version', 'string', '应用版本。'),
      field('uptimeSec', 'number', '进程启动时长，单位秒。'),
      field('checks.database', 'CheckResult', '数据库连通性。'),
      field('checks.redis', 'CheckResult', 'Redis 连通性，未配置时标记为可跳过。'),
      field('checks.storage', 'CheckResult', '对象存储连通性，未配置时标记为可跳过。'),
      field('checks.llm', 'CheckResult', 'LLM provider 配置检查。'),
      field('observability', 'boolean', '观测能力是否启用。'),
    ],
    statuses: [
      { code: '200', description: '关键依赖健康。' },
      { code: '503', description: '数据库、Redis 或对象存储等关键依赖不可用。' },
    ],
  },
  '/api/oidc/token': {
    summary: 'OIDC token 端点，支持 authorization_code 与 refresh_token。',
    contentType: FORM_TYPE,
    bodyParams: [
      field('grant_type', '"authorization_code" | "refresh_token"', '授权类型。', true),
      field('client_id', 'string', 'OIDC client ID。Basic 认证已提交时可省略。'),
      field('client_secret', 'string', 'confidential client secret。Basic 认证已提交时可省略。'),
      field('code', 'string', 'authorization_code 模式必填。'),
      field('redirect_uri', 'string', 'authorization_code 模式必填，必须与授权请求一致。'),
      field('code_verifier', 'string', '启用 PKCE 时必填。'),
      field('refresh_token', 'string', 'refresh_token 模式必填。'),
      field('scope', 'string', 'refresh_token 模式可选，只能收窄不能扩大。'),
    ],
    responseFields: [
      field('access_token', 'string', 'OIDC access token。'),
      field('token_type', '"Bearer"', '令牌类型。'),
      field('expires_in', 'number', '过期秒数。'),
      field('id_token', 'string', 'authorization_code 模式返回的 ID Token。'),
      field('refresh_token', 'string', '请求 offline_access 且 client 允许刷新时返回。'),
      field('scope', 'string', '实际授权范围。'),
    ],
    statuses: [
      { code: '200', description: '签发 token 成功。' },
      { code: '400', description: 'grant_type、code、redirect_uri、PKCE 或 content-type 错误。' },
      { code: '401', description: 'client_id/client_secret 无效。' },
      { code: '429', description: 'token 端点限流。' },
    ],
  },
  '/api/documents': {
    summary: '查询或创建协作文档。',
    queryParams: [
      field('ownerId', 'string', '按文档所有者筛选。'),
      field('q', 'string', '按标题模糊搜索。'),
      field('limit', 'number', '返回数量上限，最大 200，默认 50。'),
    ],
    bodyParams: [
      field('title', 'string', '文档标题。'),
      field('content', 'string | object', '文档正文或结构化内容。'),
      field('ownerId', 'string', '可选。默认当前用户。'),
    ],
    responseFields: [
      field('documents', 'Document[]', 'GET 返回的文档列表，含访问权限标记。'),
      field('<document>', 'Document', 'POST 返回创建后的文档对象。'),
    ],
  },
  '/api/org/users': {
    summary: '查询当前租户用户列表，返回前会按查看者权限做隐私脱敏。',
    queryParams: [
      field('role', 'string', '按角色筛选，例如 manager。'),
      field('departmentId', 'string', '按部门筛选。'),
      field('q', 'string', '按姓名或邮箱模糊搜索。'),
    ],
    responseFields: [
      field('users', 'User[]', '用户列表。敏感字段如 passwordHash、mfaSecret 不会返回。'),
    ],
  },
  '/api/kpi': {
    summary: '查询或创建 KPI 目标。创建 KPI 需要 kpi.write 权限，且周期必须处于 draft。',
    queryParams: [
      field('cycleId', 'string', '按 KPI 周期筛选。'),
      field('scope', '"bonus" | "monitor"', '按奖金/监控口径筛选。'),
      field('level', 'KpiLevel', 'individual / department / system / business_unit / company。'),
      field('subjectId', 'string', '按科目筛选。'),
      field('assigneeId', 'string', '按负责人筛选。'),
    ],
    bodyParams: [
      field('cycleId', 'string', 'KPI 周期 ID。', true),
      field('subjectId', 'string', 'KPI 科目 ID。', true),
      field('level', 'KpiLevel', 'KPI 层级。', true),
      field('assigneeId', 'string', '负责人用户 ID。', true),
      field('title', 'string', 'KPI 标题。', true),
      field('measureType', 'string', '计量方式。', true),
      field('targetValue', 'number', '目标值。', true),
      field('scope', '"bonus" | "monitor"', '奖金或监控口径。', true),
      field('startValue', 'number', '起始值，默认 0。'),
      field('unit', 'string', '单位，默认取科目默认单位。'),
      field('weight', 'number', '权重。'),
      field('parentKpiId', 'string', '上级 KPI。'),
      field('departmentId', 'string', '归属部门。'),
      field('description', 'string', '说明。'),
    ],
    responseFields: [
      field('kpis', 'Kpi[]', 'GET 返回的 KPI 列表。'),
      field('kpi', 'Kpi', 'POST 创建后的 KPI。'),
    ],
    statuses: [
      { code: '200', description: '查询成功。' },
      { code: '201', description: '创建 KPI 成功。' },
      { code: '400', description: '必填字段缺失、scope/level 非法、周期锁定、科目不存在或停用。' },
      { code: '401', description: '未登录。' },
      { code: '403', description: '缺少 kpi.write 权限。' },
      { code: '500', description: '服务端异常。' },
    ],
  },
  '/api/shouchao/import': {
    summary: '导入网页、纯文本或上传文件，并提炼为手抄笔记。',
    contentType: `${JSON_TYPE} 或 ${MULTIPART_TYPE}`,
    bodyParams: [
      field('file', 'File', 'multipart 上传文件。支持的文件类型由解析器决定。'),
      field('url', 'string', 'JSON 模式：导入远程 http(s) 链接。'),
      field('rawText', 'string', 'JSON 模式：直接提交原文。'),
      field('title', 'string', '可选标题。'),
    ],
    responseFields: [
      field('ok', 'boolean', '是否成功。'),
      field('note', 'ShouchaoNote', '生成的手抄笔记。'),
      field('mode', 'string', '导入模式。'),
    ],
    statuses: [
      { code: '200', description: '导入并提炼成功。' },
      { code: '400', description: '表单/JSON 无效，缺少 file/url/rawText，或 URL 非法。' },
      { code: '422', description: '文件解析失败或正文过短无法提炼。' },
      { code: '502', description: '远程抓取失败。' },
      { code: '503', description: 'AI 提炼服务失败。' },
    ],
  },
  '/api/mail/send': {
    summary: '使用当前用户绑定邮箱发送邮件。',
    bodyParams: [
      field('to', 'string | string[]', '收件人。', true),
      field('subject', 'string', '邮件主题。', true),
      field('text', 'string', '纯文本正文，text/html 至少一个。'),
      field('html', 'string', 'HTML 正文，text/html 至少一个。'),
      field('cc', 'string | string[]', '抄送。'),
      field('bcc', 'string | string[]', '密送。'),
    ],
    responseFields: [
      field('ok', 'boolean', '是否发送成功。'),
      field('messageId', 'string', '邮件服务返回的消息 ID。'),
    ],
    statuses: [
      { code: '200', description: '发送成功。' },
      { code: '400', description: '收件人、主题或正文缺失。' },
      { code: '401', description: '未登录。' },
      { code: '502', description: 'SMTP 或外部邮件服务发送失败。' },
    ],
  },
};

export function buildEndpointDoc(endpoint: ApiEndpoint): ApiEndpointDoc {
  const override = OVERRIDES[endpoint.path] ?? {};
  return {
    summary: override.summary ?? endpoint.note ?? defaultSummary(endpoint),
    contentType: override.contentType ?? (endpoint.methods.some((m) => m !== 'GET') ? JSON_TYPE : '无请求体'),
    requestHeaders: override.requestHeaders ?? defaultHeaders(endpoint),
    pathParams: override.pathParams ?? pathParams(endpoint.path),
    queryParams: override.queryParams ?? [],
    bodyParams: override.bodyParams ?? defaultBody(endpoint),
    responseFields: override.responseFields ?? defaultResponse(endpoint),
    statuses: override.statuses ?? defaultStatuses(endpoint),
  };
}

export function authDescription(endpoint: ApiEndpoint): string {
  return `${API_AUTH_LABELS[endpoint.auth]}：${API_AUTH_DESCRIPTIONS[endpoint.auth]}`;
}
