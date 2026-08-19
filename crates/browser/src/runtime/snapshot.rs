use super::{BrowserEventSink, BrowserManager, BrowserToolResult};
use crate::cdp::CdpConnection;
use base64::Engine;
use serde_json::{json, Value};

impl BrowserManager {
    pub async fn snapshot(&self, emit: &BrowserEventSink<'_>) -> Result<BrowserToolResult, String> {
        let started = std::time::Instant::now();
        let snapshot = self.capture_state(emit, true).await?;
        Ok(BrowserToolResult {
            action: "snapshot".to_string(),
            url: snapshot_url(Some(&snapshot)),
            target: None,
            duration_ms: started.elapsed().as_millis(),
            result: json!({"snapshot": snapshot}),
        })
    }

    pub(super) async fn capture_state(
        &self,
        emit: &BrowserEventSink<'_>,
        include_dom: bool,
    ) -> Result<Value, String> {
        let mut state = self.state.lock().await;
        let session = state
            .as_mut()
            .ok_or_else(|| "Browser is not open".to_string())?;
        let page_session = session.active_session.clone();
        let snapshot = if include_dom {
            runtime_json(&mut session.cdp, &page_session, SNAPSHOT_SCRIPT).await?
        } else {
            runtime_json(&mut session.cdp, &page_session, VIEWPORT_SCRIPT).await?
        };
        let shot = session
            .cdp
            .command(
                "Page.captureScreenshot",
                json!({"format":"jpeg","quality":72,"fromSurface":true}),
                Some(&page_session),
            )
            .await?;
        let data = shot["data"].as_str().unwrap_or_default();
        let mut payload = snapshot.clone();
        payload["image"] = Value::String(format!("data:image/jpeg;base64,{data}"));
        session.last_snapshot = Some(snapshot.clone());
        let login_requires_manual = include_dom
            && (snapshot["url"]
                .as_str()
                .is_some_and(|url| url.starts_with("https://accounts.google.com/"))
                || snapshot["elements"].as_array().is_some_and(|elements| {
                    elements.iter().any(|element| element["secret"] == true)
                }));
        if login_requires_manual && !session.agent_input_blocked {
            session.manual_control = true;
            session.agent_input_blocked = true;
            emit(
                "browser:manual-control",
                json!({"manual":true,"sessionId":session.id,"reason":"authentication"}),
            );
        }
        emit(
            "browser:page-changed",
            json!({
                "url": snapshot.get("url"), "title": snapshot.get("title"), "targetId": session.active_target
            }),
        );
        emit("browser:snapshot", payload);
        Ok(snapshot)
    }

    pub async fn wait(
        &self,
        milliseconds: u64,
        emit: &BrowserEventSink<'_>,
    ) -> Result<BrowserToolResult, String> {
        let duration = milliseconds.min(30_000);
        emit(
            "browser:action-started",
            json!({"action":"wait","target":duration}),
        );
        tokio::time::sleep(std::time::Duration::from_millis(duration)).await;
        let snapshot = self.capture_state(emit, true).await?;
        Ok(BrowserToolResult {
            action: "wait".into(),
            url: snapshot_url(Some(&snapshot)),
            target: None,
            duration_ms: u128::from(duration),
            result: json!({"snapshot":snapshot}),
        })
    }

    pub async fn screenshot(
        &self,
        emit: &BrowserEventSink<'_>,
    ) -> Result<BrowserToolResult, String> {
        let started = std::time::Instant::now();
        let mut state = self.state.lock().await;
        let session = state
            .as_mut()
            .ok_or_else(|| "Browser is not open".to_string())?;
        let page_session = session.active_session.clone();
        let shot = session
            .cdp
            .command(
                "Page.captureScreenshot",
                json!({"format":"png","fromSurface":true}),
                Some(&page_session),
            )
            .await?;
        let encoded = shot["data"]
            .as_str()
            .ok_or_else(|| "Chromium returned no screenshot".to_string())?;
        let path = self
            .screenshots_dir
            .join(format!("{}.png", uuid::Uuid::new_v4()));
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(encoded)
            .map_err(|error| format!("Invalid screenshot data: {error}"))?;
        std::fs::write(&path, bytes).map_err(|error| format!("Cannot save screenshot: {error}"))?;
        emit(
            "browser:snapshot",
            json!({"image":format!("data:image/png;base64,{encoded}"),"screenshotPath":path}),
        );
        Ok(BrowserToolResult {
            action: "screenshot".into(),
            url: snapshot_url(session.last_snapshot.as_ref()),
            target: None,
            duration_ms: started.elapsed().as_millis(),
            result: json!({"path":path,"mimeType":"image/png"}),
        })
    }
}
pub(super) async fn runtime_json(
    cdp: &mut CdpConnection,
    session_id: &str,
    expression: &str,
) -> Result<Value, String> {
    let result = cdp
        .command(
            "Runtime.evaluate",
            json!({"expression":expression,"returnByValue":true,"awaitPromise":true}),
            Some(session_id),
        )
        .await?;
    if let Some(description) = result["exceptionDetails"]["exception"]["description"].as_str() {
        return Err(format!("Page script failed: {description}"));
    }
    Ok(result["result"]["value"].clone())
}

pub(super) fn snapshot_url(snapshot: Option<&Value>) -> Option<String> {
    snapshot
        .and_then(|value| value["url"].as_str())
        .map(str::to_string)
}
const VIEWPORT_SCRIPT: &str = "({url:location.href,title:document.title,viewport:{width:innerWidth,height:innerHeight,deviceScaleFactor:devicePixelRatio},scroll:{x:scrollX,y:scrollY}})";

const SNAPSHOT_SCRIPT: &str = r#"(() => {
  if (!window.__openvibeRefNodes) window.__openvibeRefNodes = new Map();
  if (!window.__openvibeNodeRefs) window.__openvibeNodeRefs = new WeakMap();
  if (!window.__openvibeRefSeq) window.__openvibeRefSeq = 0;
  const refs = window.__openvibeRefNodes, nodes = window.__openvibeNodeRefs;
  const role = el => el.getAttribute('role') || ({A:'link',BUTTON:'button',INPUT:'textbox',TEXTAREA:'textbox',SELECT:'combobox',IMG:'img',H1:'heading',H2:'heading',H3:'heading',H4:'heading',H5:'heading',H6:'heading'}[el.tagName] || 'generic');
  const name = el => (el.getAttribute('aria-label') || el.getAttribute('alt') || el.getAttribute('placeholder') || el.innerText || el.getAttribute('title') || '').replace(/\s+/g,' ').trim().slice(0,240);
  const visible = el => { const r=el.getBoundingClientRect(), s=getComputedStyle(el); return r.width>0 && r.height>0 && s.visibility!=='hidden' && s.display!=='none'; };
  const interesting = el => /^(A|BUTTON|INPUT|TEXTAREA|SELECT|SUMMARY|IMG|H1|H2|H3)$/.test(el.tagName) || el.hasAttribute('role') || el.tabIndex>=0;
  const states = el => {
    const result=[];
    if (el.matches(':disabled') || el.getAttribute('aria-disabled')==='true') result.push('disabled');
    if ('checked' in el && el.checked===true) result.push('checked');
    else if (el.hasAttribute('aria-checked')) result.push(`checked=${el.getAttribute('aria-checked')}`);
    if ('selected' in el && el.selected===true) result.push('selected');
    if (el.hasAttribute('aria-expanded')) result.push(`expanded=${el.getAttribute('aria-expanded')}`);
    if ('readOnly' in el && el.readOnly===true) result.push('readonly');
    if ('required' in el && el.required===true) result.push('required');
    return result;
  };
  const elements=[];
  for (const el of document.querySelectorAll('a,button,input,textarea,select,summary,img,h1,h2,h3,[role],[tabindex]')) {
    if (elements.length>=350 || !interesting(el) || !visible(el)) continue;
    let ref=nodes.get(el); if (!ref) { ref='e'+(++window.__openvibeRefSeq); nodes.set(el,ref); refs.set(ref,el); }
    const r=el.getBoundingClientRect(); const password=el instanceof HTMLInputElement && el.type==='password';
    const item={ref,role:role(el),name:name(el),tag:el.tagName.toLowerCase(),states:states(el),box:{x:r.x,y:r.y,width:r.width,height:r.height}};
    if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) && !password) item.value=String(el.value).slice(0,240);
    if (password) item.secret=true;
    elements.push(item);
  }
  const content=[]; const seenContent=new Set(); let contentChars=0;
  const contentRoles={H1:'heading',H2:'heading',H3:'heading',H4:'heading',H5:'heading',H6:'heading',P:'paragraph',LI:'listitem',DT:'term',DD:'definition',BLOCKQUOTE:'blockquote',PRE:'code',CAPTION:'caption',TH:'columnheader',TD:'cell'};
  for (const el of document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,dt,dd,blockquote,pre,caption,th,td,[role="heading"],[role="alert"],[role="status"]')) {
    if (content.length>=180 || contentChars>=12000 || !visible(el)) continue;
    const text=(el.innerText || el.textContent || '').replace(/\s+/g,' ').trim();
    if (!text) continue;
    const contentRole=el.getAttribute('role') || contentRoles[el.tagName] || 'text';
    const key=`${contentRole}:${text}`; if (seenContent.has(key)) continue; seenContent.add(key);
    const clipped=text.slice(0,Math.min(500,12000-contentChars)); contentChars+=clipped.length;
    const item={role:contentRole,text:clipped};
    if (/^H[1-6]$/.test(el.tagName)) item.level=Number(el.tagName.slice(1));
    content.push(item);
  }
  const quote=value=>JSON.stringify(value);
  const outline=[
    ...content.map(item=>`- ${item.role} ${quote(item.text)}${item.level ? ` [level=${item.level}]` : ''}`),
    ...elements.map(item=>`- ${item.role}${item.name ? ` ${quote(item.name)}` : ''} [ref=${item.ref}]${item.states.length ? ` [${item.states.join(', ')}]` : ''}`)
  ].slice(0,400);
  return {url:location.href,title:document.title,viewport:{width:innerWidth,height:innerHeight,deviceScaleFactor:devicePixelRatio},scroll:{x:scrollX,y:scrollY},elements,content,outline};
})()"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snapshot_script_redacts_password_values() {
        assert!(SNAPSHOT_SCRIPT.contains("password"));
        assert!(SNAPSHOT_SCRIPT.contains("item.secret=true"));
        assert!(SNAPSHOT_SCRIPT.contains("content,outline"));
        assert!(!SNAPSHOT_SCRIPT.contains("localStorage"));
        assert!(!SNAPSHOT_SCRIPT.contains("document.cookie"));
    }
}
