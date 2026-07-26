use agent::config::LlmConfig;
use serde_json::Value;
use std::sync::OnceLock;
use std::time::Duration;

const TIMEOUT_SECS: u64 = 10;
const MAX_OUTPUT_CHARS: usize = 20_000;
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const DEFAULT_JINA_API_KEY: &str =
    "jina_ee131140e3c6485284d0d0d0f8ad6e23H_rvMoSGTfyO53yPEAOIp8Pyoqbo";

static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn get_http_client() -> &'static reqwest::Client {
    HTTP_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .user_agent(USER_AGENT)
            .timeout(Duration::from_secs(TIMEOUT_SECS))
            .pool_idle_timeout(Duration::from_secs(90))
            .pool_max_idle_per_host(10)
            .build()
            .expect("Failed to build global HTTP client")
    })
}

pub fn get_jina_api_key() -> String {
    if let Ok(key) = std::env::var("JINA_API_KEY") {
        let trimmed = key.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    DEFAULT_JINA_API_KEY.to_string()
}

/// Encodes a string for inclusion in a URL query component (RFC 3986 percent-encoding).
pub fn url_encode(input: &str) -> String {
    let mut encoded = String::with_capacity(input.len());
    for byte in input.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char);
            }
            b' ' => encoded.push_str("%20"),
            _ => encoded.push_str(&format!("%{:02X}", byte)),
        }
    }
    encoded
}

/// Truncate text if it exceeds max character length.
pub fn truncate_output(text: &str, max_chars: usize) -> String {
    if text.chars().count() <= max_chars {
        text.to_string()
    } else {
        let truncated: String = text.chars().take(max_chars).collect();
        format!(
            "{truncated}\n\n... [Output truncated: Content exceeded {max_chars} characters limit]"
        )
    }
}

/// Downloads and converts a webpage into clean Markdown for context analysis using Jina Reader API.
pub async fn fetch_url(args: &Value) -> Result<String, String> {
    let raw_url = args["url"]
        .as_str()
        .ok_or_else(|| "Missing required parameter 'url'".to_string())?
        .trim();

    if raw_url.is_empty() {
        return Err("Parameter 'url' cannot be empty".to_string());
    }

    let target_url = if !raw_url.starts_with("http://") && !raw_url.starts_with("https://") {
        format!("https://{raw_url}")
    } else {
        raw_url.to_string()
    };

    let jina_url = format!("https://r.jina.ai/{target_url}");
    let api_key = get_jina_api_key();
    let client = get_http_client();

    let request = client
        .get(&jina_url)
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Accept", "text/plain, */*")
        .header("X-Retain-Images", "none")
        .header("X-With-Generated-Alt", "false")
        .header("X-With-Links-Summary", "false")
        .header("X-With-Images-Summary", "false")
        .header("X-Timeout", "5");

    let response = request
        .send()
        .await
        .map_err(|e| format!("Network error while fetching URL: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Jina Reader HTTP request failed with status code {}: {}",
            response.status(),
            target_url
        ));
    }

    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {e}"))?;

    Ok(truncate_output(&body, MAX_OUTPUT_CHARS))
}

/// Performs web queries to find up-to-date documentation, solutions, and code references using Jina Search API.
pub async fn web_search(args: &Value, _llm_config: Option<&LlmConfig>) -> Result<String, String> {
    let query = args["query"]
        .as_str()
        .ok_or_else(|| "Missing required parameter 'query'".to_string())?
        .trim();

    if query.is_empty() {
        return Err("Parameter 'query' cannot be empty".to_string());
    }

    let num_results = args["num_results"].as_u64().unwrap_or(5) as usize;
    let num_results = if num_results == 0 { 5 } else { num_results };

    let client = get_http_client();
    search_jina(client, query, num_results).await
}

async fn search_jina(
    client: &reqwest::Client,
    query: &str,
    num_results: usize,
) -> Result<String, String> {
    let encoded_query = url_encode(query);
    let jina_search_url = format!("https://s.jina.ai/{encoded_query}");
    let api_key = get_jina_api_key();

    let request = client
        .get(&jina_search_url)
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Accept", "application/json")
        .header("X-Retain-Images", "none")
        .header("X-With-Generated-Alt", "false")
        .header("X-With-Links-Summary", "false")
        .header("X-With-Images-Summary", "false")
        .header("X-Timeout", "5");

    let response = request
        .send()
        .await
        .map_err(|e| format!("Network error while searching: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Jina Search API failed with status code {}: {}",
            response.status(),
            query
        ));
    }

    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read search response body: {e}"))?;

    Ok(format_jina_response(&body, query, num_results))
}

fn format_jina_response(body: &str, query: &str, max_results: usize) -> String {
    if let Ok(json) = serde_json::from_str::<Value>(body) {
        if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
            let mut formatted = format!("### Web Search Results for: `{query}`\n\n");
            let count = data.len().min(max_results);
            for (idx, item) in data.iter().take(count).enumerate() {
                let title = item["title"].as_str().unwrap_or("No Title");
                let url = item["url"].as_str().unwrap_or("");
                let description = item["description"]
                    .as_str()
                    .or_else(|| item["content"].as_str())
                    .unwrap_or("");

                formatted.push_str(&format!("{}. [{}]({})\n", idx + 1, title, url));
                if !description.is_empty() {
                    formatted.push_str(&format!("   {}\n\n", description.trim()));
                } else {
                    formatted.push('\n');
                }
            }
            return truncate_output(&formatted, MAX_OUTPUT_CHARS);
        }
    }

    let mut formatted = format!("### Web Search Results for: `{query}`\n\n");
    formatted.push_str(body.trim());
    truncate_output(&formatted, MAX_OUTPUT_CHARS)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_url_encode() {
        assert_eq!(url_encode("hello world"), "hello%20world");
        assert_eq!(
            url_encode("rust & web search?"),
            "rust%20%26%20web%20search%3F"
        );
    }

    #[test]
    fn test_truncate_output() {
        let short = "Hello world";
        assert_eq!(truncate_output(short, 20), "Hello world");

        let long_text = "a".repeat(100);
        let truncated = truncate_output(&long_text, 10);
        assert!(truncated.contains("... [Output truncated: Content exceeded 10 characters limit]"));
        assert!(truncated.starts_with("aaaaaaaaaa"));
    }

    #[test]
    fn test_get_jina_api_key() {
        let key = get_jina_api_key();
        assert!(!key.is_empty());
        assert!(key.starts_with("jina_"));
    }

    #[test]
    fn test_format_jina_json_response() {
        let json_body = serde_json::json!({
            "data": [
                {
                    "title": "Rust Programming Language",
                    "url": "https://www.rust-lang.org",
                    "description": "A language empowering everyone to build reliable and efficient software."
                },
                {
                    "title": "crates.io",
                    "url": "https://crates.io",
                    "description": "The Rust community's crate registry."
                }
            ]
        }).to_string();

        let formatted = format_jina_response(&json_body, "rust lang", 5);
        assert!(formatted.contains("### Web Search Results for: `rust lang`"));
        assert!(formatted.contains("1. [Rust Programming Language](https://www.rust-lang.org)"));
        assert!(formatted.contains("2. [crates.io](https://crates.io)"));
    }

    #[tokio::test]
    async fn test_fetch_url_invalid_args() {
        let args = serde_json::json!({});
        let result = fetch_url(&args).await;
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing required parameter 'url'");
    }

    #[tokio::test]
    async fn test_web_search_invalid_args() {
        let args = serde_json::json!({});
        let result = web_search(&args, None).await;
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "Missing required parameter 'query'");
    }
}
