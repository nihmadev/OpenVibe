use browser::BrowserManager;
use serde_json::Value;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Arc, Mutex};

fn test_page() -> (String, std::thread::JoinHandle<()>, Arc<Mutex<Vec<String>>>) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("test listener");
    let address = listener.local_addr().expect("test address");
    let requests = Arc::new(Mutex::new(Vec::new()));
    let received_requests = requests.clone();
    let handle = std::thread::spawn(move || {
        for stream in listener.incoming().take(16) {
            let mut stream = stream.expect("accepted connection");
            let mut request = [0_u8; 2048];
            let length = stream.read(&mut request).unwrap_or_default();
            received_requests
                .lock()
                .expect("requests lock")
                .push(String::from_utf8_lossy(&request[..length]).to_string());
            let html = r#"<!doctype html><html><head><title>Browser smoke</title></head>
              <body><input aria-label="Search"><button onmouseenter="document.title='Hovered'" onclick="document.title='Clicked';document.querySelector('output').textContent='done';const password=document.createElement('input');password.type='password';password.setAttribute('aria-label','Password');password.value='ultra-secret';document.body.append(password)">Continue</button><output></output><script>if(navigator.webdriver || navigator.userAgent.includes('HeadlessChrome')) document.title='Compatibility failed'</script></body></html>"#;
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                html.len(),
                html
            );
            stream
                .write_all(response.as_bytes())
                .expect("write response");
        }
    });
    (format!("http://{address}"), handle, requests)
}

#[tokio::test]
async fn opens_snapshots_clicks_and_types_with_real_chromium() {
    let (url, _server, requests) = test_page();
    let data_dir = tempfile::tempdir().expect("temp app data");
    #[cfg(unix)]
    {
        let profile = data_dir.path().join("browser-profile");
        std::fs::create_dir_all(&profile).expect("profile directory");
        let host = std::env::var("HOSTNAME").unwrap_or_else(|_| "localhost".to_string());
        std::os::unix::fs::symlink(format!("{host}-999999999"), profile.join("SingletonLock"))
            .expect("stale singleton lock");
    }
    let browser = BrowserManager::new(data_dir.path());
    browser.prewarm().await.expect("prewarm browser");
    browser.mark_skill_read();
    let events = Arc::new(Mutex::new(Vec::<(String, Value)>::new()));
    let stream_events = events.clone();
    browser.set_ui_event_sink(Arc::new(move |name, value| {
        stream_events
            .lock()
            .expect("stream events lock")
            .push((name.to_string(), value));
    }));
    let emit = {
        let events = events.clone();
        move |name: &str, value: Value| {
            events
                .lock()
                .expect("events lock")
                .push((name.to_string(), value))
        }
    };

    browser.open(Some(&url), &emit).await.expect("open browser");
    assert!(events
        .lock()
        .expect("events lock")
        .iter()
        .any(|(name, _)| name == "browser:session-started"));
    let request_headers = requests.lock().expect("requests lock").join("\n");
    assert!(!request_headers.contains("HeadlessChrome"));
    assert!(request_headers
        .to_ascii_lowercase()
        .contains("accept-language:"));
    browser.start_ui_stream().await.expect("start screencast");
    browser.resize_ui(640, 480).await.expect("resize viewport");
    for _ in 0..40 {
        if events
            .lock()
            .expect("events lock")
            .iter()
            .any(|(name, value)| {
                name == "browser:snapshot"
                    && value["viewport"]["width"] == 640
                    && value["viewport"]["height"] == 480
            })
        {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }
    let frame_summaries: Vec<_> = events
        .lock()
        .expect("events lock")
        .iter()
        .map(|(name, value)| (name.clone(), value["viewport"].clone()))
        .collect();
    assert!(
        frame_summaries.iter().any(|(name, viewport)| {
            name == "browser:snapshot" && viewport["width"] == 640 && viewport["height"] == 480
        }),
        "expected a 640x480 screencast frame, got {frame_summaries:?}"
    );
    let snapshot = browser.snapshot(&emit).await.expect("snapshot");
    assert_eq!(snapshot.result["snapshot"]["title"], "Browser smoke");
    assert!(snapshot.result["snapshot"].get("image").is_none());
    assert!(snapshot.result["snapshot"]["outline"]
        .as_array()
        .expect("structured outline")
        .iter()
        .any(|line| line.as_str().is_some_and(|line| {
            line.contains("textbox") && line.contains("Search") && line.contains("ref=e")
        })));
    let elements = snapshot.result["snapshot"]["elements"]
        .as_array()
        .expect("snapshot elements");
    let input_ref = elements
        .iter()
        .find(|element| element["name"] == "Search")
        .and_then(|element| element["ref"].as_str())
        .expect("input ref")
        .to_string();
    let button_ref = elements
        .iter()
        .find(|element| element["name"] == "Continue")
        .and_then(|element| element["ref"].as_str())
        .expect("button ref")
        .to_string();
    let input_box = elements
        .iter()
        .find(|element| element["ref"] == input_ref)
        .and_then(|element| element["box"].as_object())
        .expect("input bounding box");
    let button_box = elements
        .iter()
        .find(|element| element["ref"] == button_ref)
        .and_then(|element| element["box"].as_object())
        .expect("button bounding box");
    let input_point = (
        input_box["x"].as_f64().expect("input x")
            + input_box["width"].as_f64().expect("input width") / 2.0,
        input_box["y"].as_f64().expect("input y")
            + input_box["height"].as_f64().expect("input height") / 2.0,
    );
    let button_point = (
        button_box["x"].as_f64().expect("button x")
            + button_box["width"].as_f64().expect("button width") / 2.0,
        button_box["y"].as_f64().expect("button y")
            + button_box["height"].as_f64().expect("button height") / 2.0,
    );

    browser
        .set_manual_control(true, &emit)
        .await
        .expect("enable manual hover");
    browser
        .manual_pointer("move", button_point.0, button_point.1, 0.0, 0.0, &emit)
        .await
        .expect("manual hover");
    let hover_snapshot = browser.snapshot(&emit).await.expect("hover snapshot");
    assert_eq!(hover_snapshot.result["snapshot"]["title"], "Hovered");

    // Ordinary user interaction is cooperative: it must not reserve the
    // browser or prevent the agent from continuing with a focused action.
    browser
        .fill(&input_ref, "openvibe", false, &emit)
        .await
        .expect("fill input");
    let clicked = browser
        .click(&button_ref, false, &emit)
        .await
        .expect("click button");
    assert_eq!(clicked.result["snapshot"]["title"], "Clicked");
    assert!(!clicked.result["snapshot"]
        .to_string()
        .contains("ultra-secret"));
    assert!(clicked.result["snapshot"]["elements"]
        .as_array()
        .expect("snapshot elements")
        .iter()
        .any(|element| element["name"] == "Password" && element["secret"] == true));
    let blocked = browser
        .press("Tab", &emit)
        .await
        .expect_err("authentication control must stay private");
    assert!(blocked.contains("authentication is under private user control"));
    assert!(events
        .lock()
        .expect("events lock")
        .iter()
        .any(|(name, _)| name == "browser:pointer-move"));

    browser
        .set_manual_control(true, &emit)
        .await
        .expect("enable manual control");
    browser
        .manual_pointer("down", input_point.0, input_point.1, 0.0, 0.0, &emit)
        .await
        .expect("manual pointer down");
    browser
        .manual_pointer("up", input_point.0, input_point.1, 0.0, 0.0, &emit)
        .await
        .expect("manual pointer up");
    browser
        .manual_key("End", None, &emit)
        .await
        .expect("move caret");
    browser
        .manual_key("x", Some("x"), &emit)
        .await
        .expect("manual input");
    let manual_snapshot = browser.snapshot(&emit).await.expect("manual snapshot");
    let manual_value = manual_snapshot.result["snapshot"]["elements"]
        .as_array()
        .and_then(|elements| elements.iter().find(|element| element["ref"] == input_ref))
        .and_then(|element| element["value"].as_str())
        .expect("manual input value");
    assert_eq!(manual_value, "openvibex");

    browser.close(&emit).await.expect("close browser");
    assert!(!browser.is_running().await);
}
