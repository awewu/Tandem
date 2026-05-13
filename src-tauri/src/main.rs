// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use regex::Regex;
use serde_json::{json, Value};
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;
use tauri::{Emitter, Window};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;
use tokio::time::timeout;

// =====================================================================
// Helpers
// =====================================================================

async fn run_hermes(args: Vec<String>, timeout_secs: u64) -> Result<(String, String, i32), String> {
    let fut = Command::new("hermes")
        .args(&args)
        .env("PYTHONIOENCODING", "utf-8")
        .env("PYTHONUTF8", "1")
        .env("NO_COLOR", "1")
        .env("FORCE_COLOR", "0")
        .output();
    let output = timeout(Duration::from_secs(timeout_secs), fut)
        .await
        .map_err(|_| format!("Timeout after {}s", timeout_secs))?
        .map_err(|e| format!("Failed to spawn hermes: {}", e))?;
    Ok((
        String::from_utf8_lossy(&output.stdout).to_string(),
        String::from_utf8_lossy(&output.stderr).to_string(),
        output.status.code().unwrap_or(-1),
    ))
}

/// Strip leading box-drawing / dingbat / question-mark mojibake characters.
fn clean_val(v: &str) -> String {
    v.trim_start_matches(|c: char| {
        c.is_whitespace()
            || ('\u{2500}'..='\u{259F}').contains(&c)
            || ('\u{2700}'..='\u{27BF}').contains(&c)
            || ('\u{2900}'..='\u{297F}').contains(&c)
            || ('\u{2B00}'..='\u{2BFF}').contains(&c)
            || c == '?'
    })
    .trim()
    .to_string()
}

/// Detect a column separator character in a table line.
fn detect_separator(line: &str) -> Option<char> {
    if line.contains('\u{2502}') {
        Some('\u{2502}')
    } else if line.contains('\u{2503}') {
        Some('\u{2503}')
    } else if line.contains('\u{2551}') {
        Some('\u{2551}')
    } else if line.contains('|') {
        Some('|')
    } else {
        None
    }
}

/// Heuristic: a line is "configured" if it doesn't contain "not X" markers.
fn is_configured(value: &str) -> bool {
    let v = value.to_lowercase();
    let neg = Regex::new(r"\bnot\s+(set|configured|logged|installed|running)\b").unwrap();
    if neg.is_match(&v) { return false; }
    if v.contains("stopped") || v.contains("disabled") { return false; }
    if v.contains("none") && !v.contains("configured") { return false; }
    if v.contains("configured")
        || v.contains("active")
        || v.contains("running")
        || v.contains("enabled")
        || v.contains("exists")
        || v.contains("logged in")
        || v.contains('\u{2713}')
    {
        return true;
    }
    let trimmed = value.trim();
    trimmed.starts_with("sk-") || trimmed.contains("...")
}

// =====================================================================
// hermes_health  (mirror of /api/health)
// =====================================================================

#[tauri::command]
async fn hermes_health() -> Result<Value, String> {
    let (stdout, stderr, code) = run_hermes(vec!["cron".into(), "status".into()], 8).await?;
    let combined = format!("{}{}", stdout, stderr);
    let re = Regex::new(r"(?i)running|active").unwrap();
    let running = code == 0 || re.is_match(&combined);
    Ok(json!({
        "ok": running,
        "version": if running { Some("Hermes (cron status)") } else { None },
        "error": if running { None } else {
            let msg = if !stderr.is_empty() { stderr } else if !stdout.is_empty() { stdout } else { format!("exit {}", code) };
            Some(msg)
        }
    }))
}

// =====================================================================
// hermes_skills  (mirror of /api/skills)
// =====================================================================

#[tauri::command]
async fn hermes_skills() -> Result<Value, String> {
    let (stdout, stderr, code) = run_hermes(vec!["skills".into(), "list".into()], 10).await?;
    let skills = parse_skills(&stdout);
    Ok(json!({
        "skills": skills.clone(),
        "count": skills.len(),
        "raw": stdout,
        "error": if code != 0 { Some(stderr) } else { None }
    }))
}

fn parse_skills(stdout: &str) -> Vec<Value> {
    let mut skills = vec![];
    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() { continue; }
        let Some(sep) = detect_separator(line) else { continue };
        let parts: Vec<&str> = line
            .split(sep)
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();
        if parts.len() < 2 { continue; }
        let name = parts[0];
        if name.is_empty() || name == "Name" { continue; }
        if name.chars().all(|c| matches!(c, '\u{2500}'..='\u{259F}' | '-' | '=' | '+' | ' ')) { continue; }
        let category = parts.get(1).copied().unwrap_or("").to_string();
        let source = parts.get(2).copied().unwrap_or("").to_string();
        let trust = parts.get(3).copied().unwrap_or("").to_string();
        let status = parts.get(4).copied().unwrap_or(parts.last().copied().unwrap_or("")).to_string();
        let s_low = status.to_lowercase();
        let enabled = s_low.contains("true") || s_low.contains("enabled");
        skills.push(json!({
            "name": name,
            "category": category,
            "source": source,
            "trust": trust,
            "status": status,
            "enabled": enabled,
        }));
    }
    skills
}

// =====================================================================
// hermes_status  (mirror of /api/status)
// =====================================================================

#[tauri::command]
async fn hermes_status() -> Result<Value, String> {
    let (stdout, stderr, code) = run_hermes(vec!["status".into()], 15).await?;
    if code != 0 && stdout.is_empty() {
        return Ok(json!({
            "ok": false,
            "error": if !stderr.is_empty() { stderr } else { format!("exit {}", code) },
            "raw": stdout
        }));
    }
    Ok(parse_status(&stdout))
}

const SECTION_KEYS: &[&str] = &[
    "Environment",
    "API Keys",
    "Auth Providers",
    "API-Key Providers",
    "Terminal Backend",
    "Messaging Platforms",
    "Gateway Service",
    "Scheduled Jobs",
    "Sessions",
];

fn parse_status(stdout: &str) -> Value {
    let mut env_obj = serde_json::Map::new();
    let mut api_keys: Vec<Value> = vec![];
    let mut auth_providers: Vec<Value> = vec![];
    let mut api_key_providers: Vec<Value> = vec![];
    let mut messaging: Vec<Value> = vec![];
    let mut terminal = serde_json::Map::new();
    let mut gateway = serde_json::Map::new();
    let mut jobs: Option<Value> = None;
    let mut sessions: Option<Value> = None;
    let mut section: Option<&str> = None;

    let kv_re = Regex::new(r"^(\s+)([A-Za-z][\w \-/().]+?)\s{2,}(.+?)\s*$").unwrap();
    let kv_colon_re = Regex::new(r"^(\s+)([A-Za-z][\w \-/().]+?):\s+(.+?)\s*$").unwrap();
    let jobs_re = Regex::new(r"(\d+)\s*active.*?(\d+)\s*total").unwrap();
    let num_re = Regex::new(r"(\d+)").unwrap();

    for line in stdout.lines() {
        if line.trim().is_empty() { continue; }
        let trimmed = line.trim();
        if let Some(hit) = SECTION_KEYS.iter().find(|k| trimmed.ends_with(*k)) {
            if trimmed.len() - hit.len() <= 6 {
                section = Some(*hit);
                continue;
            }
        }
        let m = kv_re.captures(line).or_else(|| kv_colon_re.captures(line));
        let Some(caps) = m else { continue };
        let indent = caps.get(1).map(|m| m.as_str().len()).unwrap_or(0);
        let key = caps.get(2).map(|m| m.as_str().trim().trim_end_matches(':').to_string()).unwrap_or_default();
        let val = clean_val(caps.get(3).map(|m| m.as_str()).unwrap_or(""));
        let nested = indent >= 4;
        let Some(sec) = section else { continue };
        if nested && matches!(sec, "Auth Providers" | "API-Key Providers" | "Messaging Platforms" | "API Keys") {
            continue;
        }
        match sec {
            "Environment" => {
                let lk = key.to_lowercase();
                if lk.starts_with("project") { env_obj.insert("project".into(), Value::String(val)); }
                else if lk.starts_with("python") { env_obj.insert("python".into(), Value::String(val)); }
                else if lk.starts_with(".env") { env_obj.insert("envFile".into(), Value::String(val)); }
                else if lk.starts_with("model") { env_obj.insert("model".into(), Value::String(val)); }
                else if lk.starts_with("provider") { env_obj.insert("provider".into(), Value::String(val)); }
            }
            "API Keys" => api_keys.push(json!({"name": key, "configured": is_configured(&val), "hint": val})),
            "Auth Providers" => auth_providers.push(json!({"name": key, "configured": is_configured(&val), "hint": val})),
            "API-Key Providers" => api_key_providers.push(json!({"name": key, "configured": is_configured(&val), "hint": val})),
            "Terminal Backend" => {
                let lk = key.to_lowercase();
                if lk.starts_with("backend") { terminal.insert("backend".into(), Value::String(val)); }
                else if lk.starts_with("sudo") { terminal.insert("sudo".into(), Value::String(val)); }
            }
            "Messaging Platforms" => messaging.push(json!({"name": key, "configured": is_configured(&val), "hint": val})),
            "Gateway Service" => {
                let lk = key.to_lowercase();
                if lk.starts_with("status") { gateway.insert("status".into(), Value::String(val)); }
                else if lk.starts_with("manager") { gateway.insert("manager".into(), Value::String(val)); }
            }
            "Scheduled Jobs" => {
                if let Some(c) = jobs_re.captures(&val) {
                    let active: i64 = c[1].parse().unwrap_or(0);
                    let total: i64 = c[2].parse().unwrap_or(0);
                    jobs = Some(json!({"active": active, "total": total}));
                }
            }
            "Sessions" => {
                if let Some(c) = num_re.captures(&val) {
                    let active: i64 = c[1].parse().unwrap_or(0);
                    sessions = Some(json!({"active": active}));
                }
            }
            _ => {}
        }
    }
    json!({
        "ok": true,
        "environment": env_obj,
        "apiKeys": api_keys,
        "authProviders": auth_providers,
        "apiKeyProviders": api_key_providers,
        "messaging": messaging,
        "terminal": if terminal.is_empty() { Value::Null } else { Value::Object(terminal) },
        "gateway": if gateway.is_empty() { Value::Null } else { Value::Object(gateway) },
        "jobs": jobs.unwrap_or(Value::Null),
        "sessions": sessions.unwrap_or(Value::Null),
        "raw": stdout,
    })
}

// =====================================================================
// hermes_mcp_list  (mirror of /api/mcp)
// =====================================================================

#[tauri::command]
async fn hermes_mcp_list() -> Result<Value, String> {
    let (stdout, stderr, code) = run_hermes(vec!["mcp".into(), "list".into()], 10).await?;
    if code != 0 && stdout.is_empty() {
        return Ok(json!({
            "ok": false,
            "servers": [],
            "error": if !stderr.is_empty() { stderr } else { format!("exit {}", code) }
        }));
    }
    let empty = Regex::new(r"(?i)no mcp servers configured").unwrap().is_match(&stdout);
    let servers = if empty { vec![] } else { parse_mcp_list(&stdout) };
    Ok(json!({
        "ok": true,
        "servers": servers.clone(),
        "count": servers.len(),
        "empty": empty
    }))
}

fn parse_mcp_list(stdout: &str) -> Vec<Value> {
    let mut servers = vec![];
    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() { continue; }
        let Some(sep) = detect_separator(line) else { continue };
        if line.chars().all(|c| matches!(c, '-' | '=' | '+' | ' ' | '|' | '\u{2500}'..='\u{257F}')) { continue; }
        let parts: Vec<&str> = line
            .split(sep)
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();
        if parts.len() < 2 { continue; }
        let name = parts[0];
        if name.is_empty() || name.eq_ignore_ascii_case("name") { continue; }
        let second = parts.get(1).copied().unwrap_or("").to_string();
        let third = parts.get(2).copied().unwrap_or("").to_string();
        let fourth = parts.get(3).copied().unwrap_or("").to_string();
        let f_low = fourth.to_lowercase();
        let enabled = fourth.is_empty() || f_low.contains("enabled") || f_low.contains("active") || f_low.contains("connected") || f_low.contains("ok");
        servers.push(json!({
            "name": name,
            "type": second,
            "endpoint": third,
            "status": fourth,
            "enabled": enabled,
        }));
    }
    servers
}

// =====================================================================
// hermes_memory_status  (mirror of /api/memory)
// =====================================================================

#[tauri::command]
async fn hermes_memory_status() -> Result<Value, String> {
    let (stdout, stderr, code) = run_hermes(vec!["memory".into(), "status".into()], 10).await?;
    if code != 0 && stdout.is_empty() {
        return Ok(json!({
            "ok": false,
            "error": if !stderr.is_empty() { stderr } else { format!("exit {}", code) },
            "raw": stdout
        }));
    }
    Ok(parse_memory_status(&stdout))
}

fn parse_memory_status(stdout: &str) -> Value {
    let mut built_in_active = true;
    let mut built_in_desc: Option<String> = None;
    let mut provider_name: Option<String> = None;
    let mut provider_configured = false;
    let mut plugins: Vec<Value> = vec![];
    let mut in_plugins = false;

    let bullet_re = Regex::new(r"^\s*[\u{2022}\-\*\?\u{2500}-\u{259F}]+\s*([\w\-]+)\s*(?:\((.*?)\))?\s*$").unwrap();
    let kv_re = Regex::new(r"^\s*([A-Za-z][\w \-]+?):\s*(.+?)\s*$").unwrap();
    let plugins_header_re = Regex::new(r"(?i)installed plugins").unwrap();

    for line in stdout.lines() {
        if line.trim().is_empty() { continue; }
        if plugins_header_re.is_match(line) {
            in_plugins = true;
            continue;
        }
        if in_plugins {
            if let Some(c) = bullet_re.captures(line) {
                let name = c.get(1).map(|m| m.as_str().to_string()).unwrap_or_default();
                let desc = c.get(2).map(|m| m.as_str().trim().to_string()).unwrap_or_default();
                plugins.push(json!({"name": name, "description": desc}));
            } else if !line.starts_with(' ') && !line.starts_with('\t') {
                in_plugins = false;
            }
            continue;
        }
        if let Some(c) = kv_re.captures(line) {
            let key = c.get(1).map(|m| m.as_str().trim().to_string()).unwrap_or_default();
            let val = clean_val(c.get(2).map(|m| m.as_str()).unwrap_or(""));
            let lk = key.to_lowercase();
            if lk == "built-in" {
                built_in_desc = Some(val.clone());
                let lv = val.to_lowercase();
                built_in_active = lv.contains("always") || lv.contains("active") || lv.contains("enabled");
            } else if lk == "provider" {
                let lv = val.to_lowercase();
                let no_provider = lv.starts_with("(none") || lv.contains("built-in only");
                provider_configured = !no_provider;
                provider_name = if no_provider { None } else { Some(val) };
            }
        }
    }
    json!({
        "ok": true,
        "builtIn": {"active": built_in_active, "description": built_in_desc},
        "provider": {"name": provider_name, "configured": provider_configured},
        "plugins": plugins,
        "raw": stdout,
    })
}

// =====================================================================
// hermes_logs  (mirror of /api/logs)
// =====================================================================

#[tauri::command]
async fn hermes_logs(
    file: Option<String>,
    lines: Option<u32>,
    level: Option<String>,
    component: Option<String>,
    since: Option<String>,
) -> Result<Value, String> {
    let mut args: Vec<String> = vec!["logs".into()];
    if let Some(f) = file.as_deref() {
        if !f.is_empty() {
            args.push(format!("--file={}", f));
        }
    }
    let n = lines.unwrap_or(100).min(2000).max(1);
    args.push("-n".into());
    args.push(n.to_string());
    if let Some(l) = level.as_deref() {
        if !l.is_empty() {
            args.push("--level".into());
            args.push(l.into());
        }
    }
    if let Some(c) = component.as_deref() {
        if !c.is_empty() {
            args.push("--component".into());
            args.push(c.into());
        }
    }
    if let Some(s) = since.as_deref() {
        if !s.is_empty() {
            args.push("--since".into());
            args.push(s.into());
        }
    }
    let (stdout, stderr, code) = run_hermes(args, 15).await?;
    let entries = parse_log_entries(&stdout);
    Ok(json!({
        "ok": code == 0,
        "entries": entries,
        "raw": stdout,
        "error": if code != 0 { Some(stderr) } else { None },
    }))
}

fn parse_log_entries(stdout: &str) -> Vec<Value> {
    let re = Regex::new(
        r"^\[?(?P<ts>\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\]?\s+\[?(?P<level>[A-Z]+)\]?\s+(?:\[?(?P<component>[\w\.-]+)\]?\s+)?(?P<message>.*)$",
    ).unwrap();
    let mut entries = vec![];
    for line in stdout.lines() {
        let line = line.trim_end_matches('\r');
        if line.is_empty() { continue; }
        if let Some(c) = re.captures(line) {
            entries.push(json!({
                "timestamp": c.name("ts").map(|m| m.as_str()).unwrap_or(""),
                "level": c.name("level").map(|m| m.as_str()).unwrap_or("INFO"),
                "component": c.name("component").map(|m| m.as_str()).unwrap_or(""),
                "message": c.name("message").map(|m| m.as_str()).unwrap_or(""),
                "raw": line,
            }));
        } else {
            entries.push(json!({
                "timestamp": "",
                "level": "INFO",
                "component": "",
                "message": line,
                "raw": line,
            }));
        }
    }
    entries
}

// =====================================================================
// hermes_cron_list (legacy, unchanged)
// =====================================================================

#[tauri::command]
async fn hermes_cron_list() -> Result<Value, String> {
    let (stdout, _stderr, _code) = run_hermes(vec!["cron".into(), "list".into()], 10).await?;
    let jobs = parse_cron_output(&stdout);
    Ok(json!({"jobs": jobs, "raw": stdout}))
}

fn parse_cron_output(stdout: &str) -> Vec<Value> {
    let mut jobs = vec![];
    let lines: Vec<&str> = stdout.lines().collect();
    let mut i = 0;
    while i < lines.len() {
        let line = lines[i].trim();
        if let Some((id, status)) = parse_job_id_line(line) {
            let mut job = json!({
                "id": id,
                "status": status,
                "name": "",
                "schedule": ""
            });
            i += 1;
            while i < lines.len() {
                let kv_line = lines[i].trim();
                if parse_job_id_line(kv_line).is_some() || kv_line.is_empty() { break; }
                if let Some((key, value)) = parse_kv_line(kv_line) {
                    match key.as_str() {
                        "name" => job["name"] = value.into(),
                        "schedule" => job["schedule"] = value.into(),
                        _ => {}
                    }
                }
                i += 1;
            }
            jobs.push(job);
            continue;
        }
        i += 1;
    }
    jobs
}

fn parse_job_id_line(line: &str) -> Option<(String, String)> {
    static RE: std::sync::OnceLock<Regex> = std::sync::OnceLock::new();
    let re = RE.get_or_init(|| Regex::new(r"^\s*([a-f0-9]{6,})\s*\[(\w+)\]").unwrap());
    re.captures(line).map(|c| (c[1].to_string(), c[2].to_lowercase()))
}

fn parse_kv_line(line: &str) -> Option<(String, String)> {
    let parts: Vec<&str> = line.splitn(2, ':').collect();
    if parts.len() == 2 {
        let key = parts[0].trim().to_lowercase().replace(' ', "_");
        let value = parts[1].trim().to_string();
        Some((key, value))
    } else { None }
}

#[tauri::command]
async fn hermes_cron_action(id: String, action: String) -> Result<Value, String> {
    let args: Vec<String> = match action.as_str() {
        "remove" => vec!["cron".into(), "remove".into(), id],
        "run" => vec!["cron".into(), "run".into(), id],
        "pause" => vec!["cron".into(), "pause".into(), id],
        "resume" => vec!["cron".into(), "resume".into(), id],
        _ => return Err(format!("Unknown action: {}", action)),
    };
    let (stdout, stderr, code) = run_hermes(args, 10).await?;
    Ok(json!({
        "success": code == 0,
        "raw": stdout,
        "error": if code != 0 { Some(stderr) } else { None }
    }))
}

#[tauri::command]
async fn hermes_cron_create(
    schedule: String,
    prompt: Option<String>,
    name: Option<String>,
    skills: Option<Vec<String>>,
) -> Result<Value, String> {
    let mut args: Vec<String> = vec!["cron".into(), "create".into(), schedule];
    if let Some(p) = prompt { args.push(p); }
    if let Some(n) = name {
        args.push("--name".into());
        args.push(n);
    }
    if let Some(s) = skills {
        for skill in s {
            args.push("--skill".into());
            args.push(skill);
        }
    }
    let (stdout, stderr, code) = run_hermes(args, 15).await?;
    Ok(json!({
        "success": code == 0,
        "raw": stdout,
        "error": if code != 0 { Some(stderr) } else { None }
    }))
}

// =====================================================================
// hermes_chat_stream  (mirror of /api/stream)
// =====================================================================

#[tauri::command]
async fn hermes_chat_stream(
    window: Window,
    messages: Vec<Value>,
    model: Option<String>,
    skills: Option<Vec<String>>,
    agent_id: Option<String>,
    system_prompt: Option<String>,
    temperature: Option<f64>,
) -> Result<(), String> {
    let mut prompt_text = String::new();
    // 独立的 systemPrompt 优先注入
    if let Some(sp) = system_prompt {
        prompt_text.push_str(&format!("System: {}\n", sp));
    }
    for m in messages {
        if let (Some(role), Some(content)) = (
            m.get("role").and_then(|v| v.as_str()),
            m.get("content").and_then(|v| v.as_str()),
        ) {
            match role {
                "system" => prompt_text.push_str(&format!("System: {}\n", content)),
                "user" => prompt_text.push_str(&format!("User: {}\n", content)),
                "assistant" => prompt_text.push_str(&format!("Assistant: {}\n", content)),
                _ => {}
            }
        }
    }
    if prompt_text.is_empty() { prompt_text = "User: hello\n".into(); }
    prompt_text.push_str("Assistant:");

    let mut args: Vec<String> = vec!["-z".into(), prompt_text];
    if let Some(m) = model { args.push("-m".into()); args.push(m); }
    if let Some(s) = skills {
        args.push("--skills".into());
        args.push(s.join(","));
    }
    if let Some(a) = agent_id {
        args.push("--agent-id".into());
        args.push(a);
    }
    if let Some(t) = temperature {
        args.push("--temperature".into());
        args.push(t.to_string());
    }

    let mut child = Command::new("hermes")
        .args(args.iter().map(|s| s.as_str()))
        .env("PYTHONIOENCODING", "utf-8")
        .env("PYTHONUTF8", "1")
        .env("NO_COLOR", "1")
        .env("FORCE_COLOR", "0")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn hermes: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let mut reader = BufReader::new(stdout).lines();
    let window_clone = window.clone();
    let child_arc = Arc::new(Mutex::new(child));

    tokio::spawn(async move {
        let timeout_duration = Duration::from_secs(120);
        let start_time = tokio::time::Instant::now();
        while let Ok(Ok(Some(line))) = timeout(Duration::from_millis(100), reader.next_line()).await {
            if start_time.elapsed() > timeout_duration {
                let _ = window_clone.emit("hermes-stream", json!({"error": "Timeout after 120s"}));
                break;
            }
            let _ = window_clone.emit("hermes-stream", json!({"content": line}));
        }
        let _ = window_clone.emit("hermes-stream", json!({"done": true}));
        let _ = async {
            let mut child = child_arc.lock().await;
            let _ = child.kill().await;
        }.await;
    });
    Ok(())
}

// =====================================================================
// hermes_workflow_run  (mirror of /api/workflows/run, streaming via events)
// =====================================================================

#[tauri::command]
async fn hermes_workflow_run(
    window: Window,
    nodes: Vec<Value>,
    edges: Vec<Value>,
    initial_input: Option<String>,
    model: Option<String>,
    run_id: String,
) -> Result<(), String> {
    let event = format!("workflow:{}", run_id);
    let initial = initial_input.unwrap_or_default();

    // Topological sort
    let order = match topo_sort(&nodes, &edges) {
        Ok(o) => o,
        Err(e) => {
            let _ = window.emit(&event, json!({"event": "error", "message": e}));
            let _ = window.emit(&event, json!({"event": "done", "ok": false}));
            return Ok(());
        }
    };

    let nodes_clone = nodes.clone();
    let edges_clone = edges.clone();
    let event_owned = event.clone();
    let window_clone = window.clone();

    tokio::spawn(async move {
        let _ = window_clone.emit(&event_owned, json!({"event": "plan", "order": order, "total": order.len()}));

        let mut outputs: std::collections::HashMap<String, String> = std::collections::HashMap::new();
        let node_map: std::collections::HashMap<String, &Value> = nodes_clone
            .iter()
            .filter_map(|n| n.get("id").and_then(|i| i.as_str()).map(|id| (id.to_string(), n)))
            .collect();

        for id in &order {
            let Some(node) = node_map.get(id) else { continue };
            let label = node.get("label").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let ntype = node.get("type").and_then(|v| v.as_str()).unwrap_or("").to_string();

            let _ = window_clone.emit(&event_owned, json!({
                "event": "node:start", "id": id, "label": label, "type": ntype
            }));

            match ntype.as_str() {
                "trigger" => {
                    let out = if !initial.is_empty() { initial.clone() } else { format!("[Trigger: {}]", label) };
                    outputs.insert(id.clone(), out.clone());
                    let _ = window_clone.emit(&event_owned, json!({
                        "event": "node:done", "id": id, "output": out, "code": 0
                    }));
                }
                "condition" => {
                    let parents = parents_of(id, &edges_clone);
                    let pass: String = parents.iter()
                        .filter_map(|p| outputs.get(p).cloned())
                        .collect::<Vec<_>>()
                        .join("\n\n");
                    let out = if !pass.is_empty() { pass } else { format!("[Condition: {}]", label) };
                    outputs.insert(id.clone(), out.clone());
                    let _ = window_clone.emit(&event_owned, json!({
                        "event": "node:done", "id": id, "output": out, "code": 0, "note": "condition passed (MVP)"
                    }));
                }
                _ => {
                    // agent | tool | output
                    let parents = parents_of(id, &edges_clone);
                    let mut ctx = String::new();
                    for pid in &parents {
                        if let (Some(pn), Some(out)) = (node_map.get(pid), outputs.get(pid)) {
                            let pl = pn.get("label").and_then(|v| v.as_str()).unwrap_or("");
                            ctx.push_str(&format!("[Previous step \"{}\" output]\n{}\n\n", pl, out));
                        }
                    }
                    let seed = if parents.is_empty() { initial.clone() } else { String::new() };
                    let role = match ntype.as_str() {
                        "agent" => "Acting as agent",
                        "tool" => "Using tool",
                        _ => "Step",
                    };
                    let prompt = vec![ctx, seed, format!("{} \"{}\". Produce the next step's output.", role, label)]
                        .into_iter().filter(|s| !s.is_empty()).collect::<Vec<_>>().join("\n\n");
                    let _ = window_clone.emit(&event_owned, json!({
                        "event": "node:prompt", "id": id, "prompt": prompt
                    }));

                    let mut args: Vec<String> = vec!["-z".into(), prompt];
                    if let Some(ref m) = model { args.push("-m".into()); args.push(m.clone()); }

                    let child = Command::new("hermes")
                        .args(args.iter().map(|s| s.as_str()))
                        .env("PYTHONIOENCODING", "utf-8")
                        .env("PYTHONUTF8", "1")
                        .env("NO_COLOR", "1")
                        .env("FORCE_COLOR", "0")
                        .stdout(Stdio::piped())
                        .stderr(Stdio::piped())
                        .spawn();
                    let mut child = match child {
                        Ok(c) => c,
                        Err(e) => {
                            let _ = window_clone.emit(&event_owned, json!({
                                "event": "node:error", "id": id, "code": -1, "stderr": e.to_string()
                            }));
                            let _ = window_clone.emit(&event_owned, json!({"event": "done", "ok": false, "failedAt": id}));
                            return;
                        }
                    };
                    let stdout = match child.stdout.take() {
                        Some(s) => s,
                        None => {
                            let _ = window_clone.emit(&event_owned, json!({
                                "event": "node:error", "id": id, "stderr": "no stdout"
                            }));
                            return;
                        }
                    };
                    let mut output_acc = String::new();
                    let mut reader = BufReader::new(stdout).lines();
                    while let Ok(Some(line)) = reader.next_line().await {
                        output_acc.push_str(&line);
                        output_acc.push('\n');
                        let _ = window_clone.emit(&event_owned, json!({
                            "event": "node:chunk", "id": id, "chunk": format!("{}\n", line)
                        }));
                    }
                    let status = child.wait().await.ok();
                    let code = status.and_then(|s| s.code()).unwrap_or(0);
                    outputs.insert(id.clone(), output_acc.clone());
                    if code != 0 && output_acc.is_empty() {
                        let _ = window_clone.emit(&event_owned, json!({
                            "event": "node:error", "id": id, "code": code, "stderr": ""
                        }));
                        let _ = window_clone.emit(&event_owned, json!({"event": "done", "ok": false, "failedAt": id}));
                        return;
                    }
                    let _ = window_clone.emit(&event_owned, json!({
                        "event": "node:done", "id": id, "output": output_acc, "code": code
                    }));
                }
            }
        }

        // Determine final nodes (no outgoing edges)
        let finals: Vec<&String> = order.iter().filter(|id| {
            !edges_clone.iter().any(|e| e.get("from").and_then(|v| v.as_str()) == Some(id.as_str()))
        }).collect();
        let mut final_outputs = serde_json::Map::new();
        for id in &finals {
            final_outputs.insert((*id).clone(), Value::String(outputs.get(*id).cloned().unwrap_or_default()));
        }
        let _ = window_clone.emit(&event_owned, json!({
            "event": "done", "ok": true, "finalNodes": finals, "outputs": final_outputs
        }));
    });
    Ok(())
}

fn topo_sort(nodes: &[Value], edges: &[Value]) -> Result<Vec<String>, String> {
    use std::collections::{HashMap, VecDeque};
    let mut in_deg: HashMap<String, i32> = HashMap::new();
    let mut adj: HashMap<String, Vec<String>> = HashMap::new();
    for n in nodes {
        if let Some(id) = n.get("id").and_then(|v| v.as_str()) {
            in_deg.insert(id.into(), 0);
            adj.insert(id.into(), vec![]);
        }
    }
    for e in edges {
        let from = e.get("from").and_then(|v| v.as_str()).unwrap_or("");
        let to = e.get("to").and_then(|v| v.as_str()).unwrap_or("");
        if from.is_empty() || to.is_empty() { continue; }
        if !in_deg.contains_key(from) || !in_deg.contains_key(to) { continue; }
        adj.get_mut(from).unwrap().push(to.into());
        *in_deg.get_mut(to).unwrap() += 1;
    }
    let mut queue: VecDeque<String> = in_deg.iter()
        .filter(|(_, d)| **d == 0)
        .map(|(k, _)| k.clone())
        .collect();
    let mut order = vec![];
    while let Some(id) = queue.pop_front() {
        order.push(id.clone());
        if let Some(nexts) = adj.get(&id).cloned() {
            for n in nexts {
                if let Some(d) = in_deg.get_mut(&n) {
                    *d -= 1;
                    if *d == 0 { queue.push_back(n); }
                }
            }
        }
    }
    if order.len() != nodes.len() {
        Err("Workflow contains a cycle or disconnected nodes".into())
    } else {
        Ok(order)
    }
}

fn parents_of(id: &str, edges: &[Value]) -> Vec<String> {
    edges.iter()
        .filter_map(|e| {
            let to = e.get("to").and_then(|v| v.as_str())?;
            let from = e.get("from").and_then(|v| v.as_str())?;
            if to == id { Some(from.to_string()) } else { None }
        })
        .collect()
}

// =====================================================================
// hermes_llm_stream  (mirror of /api/llm-stream — BYOK OpenAI-compatible proxy)
// =====================================================================

#[tauri::command]
async fn hermes_llm_stream(
    window: Window,
    messages: Vec<Value>,
    model: String,
    system_prompt: Option<String>,
    temperature: Option<f64>,
    provider: Value,
) -> Result<(), String> {
    let base_url = provider
        .get("baseURL")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing provider.baseURL".to_string())?
        .trim_end_matches('/')
        .to_string();
    let api_key = provider
        .get("apiKey")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let extra_headers: Vec<(String, String)> = provider
        .get("headers")
        .and_then(|v| v.as_object())
        .map(|m| {
            m.iter()
                .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                .collect()
        })
        .unwrap_or_default();

    // Compose upstream messages: prepend systemPrompt as a system message if provided.
    let mut upstream_msgs: Vec<Value> = Vec::new();
    if let Some(sp) = system_prompt.as_ref().filter(|s| !s.trim().is_empty()) {
        upstream_msgs.push(json!({"role": "system", "content": sp}));
    }
    for m in messages {
        if let (Some(role), Some(content)) = (
            m.get("role").and_then(|v| v.as_str()),
            m.get("content").and_then(|v| v.as_str()),
        ) {
            upstream_msgs.push(json!({"role": role, "content": content}));
        }
    }

    let mut body = json!({
        "model": model,
        "messages": upstream_msgs,
        "stream": true,
    });
    if let Some(t) = temperature {
        body["temperature"] = json!(t);
    }

    let url = format!("{}/chat/completions", base_url);
    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| format!("reqwest build: {}", e))?;
    let mut req = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("Accept", "text/event-stream");
    if let Some(k) = api_key {
        req = req.header("Authorization", format!("Bearer {}", k));
    }
    for (k, v) in extra_headers {
        req = req.header(k, v);
    }

    let window_clone = window.clone();
    tokio::spawn(async move {
        let resp = match req.json(&body).send().await {
            Ok(r) => r,
            Err(e) => {
                let _ = window_clone.emit("hermes-stream", json!({"error": format!("upstream request failed: {}", e)}));
                let _ = window_clone.emit("hermes-stream", json!({"done": true}));
                return;
            }
        };
        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            let _ = window_clone.emit(
                "hermes-stream",
                json!({"error": format!("upstream {} {}: {}", status.as_u16(), status.canonical_reason().unwrap_or(""), text.chars().take(500).collect::<String>())}),
            );
            let _ = window_clone.emit("hermes-stream", json!({"done": true}));
            return;
        }

        use futures_util::StreamExt;
        let mut stream = resp.bytes_stream();
        let mut buf = String::new();
        while let Some(chunk) = stream.next().await {
            let bytes = match chunk {
                Ok(b) => b,
                Err(e) => {
                    let _ = window_clone.emit("hermes-stream", json!({"error": format!("stream read error: {}", e)}));
                    break;
                }
            };
            buf.push_str(&String::from_utf8_lossy(&bytes));
            // SSE events delimited by \n\n
            while let Some(idx) = buf.find("\n\n") {
                let event = buf[..idx].to_string();
                buf = buf[idx + 2..].to_string();
                for line in event.split('\n') {
                    let t = line.trim();
                    if !t.starts_with("data:") {
                        continue;
                    }
                    let payload = t[5..].trim();
                    if payload.is_empty() || payload == "[DONE]" {
                        continue;
                    }
                    if let Ok(v) = serde_json::from_str::<Value>(payload) {
                        if let Some(delta) = v
                            .get("choices")
                            .and_then(|c| c.get(0))
                            .and_then(|c| c.get("delta"))
                            .and_then(|d| d.get("content"))
                            .and_then(|c| c.as_str())
                        {
                            if !delta.is_empty() {
                                let _ = window_clone
                                    .emit("hermes-stream", json!({"content": delta}));
                            }
                        }
                    }
                }
            }
        }
        let _ = window_clone.emit("hermes-stream", json!({"done": true}));
    });

    Ok(())
}

// =====================================================================
// main
// =====================================================================

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            hermes_health,
            hermes_skills,
            hermes_status,
            hermes_mcp_list,
            hermes_memory_status,
            hermes_logs,
            hermes_cron_list,
            hermes_cron_action,
            hermes_cron_create,
            hermes_chat_stream,
            hermes_llm_stream,
            hermes_workflow_run,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
