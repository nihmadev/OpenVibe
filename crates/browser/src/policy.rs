use url::Url;

/// Remote pages are rendered by the isolated Chromium process. Only ordinary
/// web navigation is accepted; local/privileged schemes never reach Chrome.
pub fn validate_navigation_url(input: &str) -> Result<String, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err("URL cannot be empty".to_string());
    }
    if trimmed == "about:blank" {
        return Ok(trimmed.to_string());
    }
    let has_explicit_scheme = trimmed.split_once(':').is_some_and(|(scheme, _)| {
        !scheme.is_empty()
            && scheme
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '-' | '.'))
    });
    let looks_like_host = !trimmed.chars().any(char::is_whitespace)
        && (trimmed.starts_with("localhost")
            || trimmed.starts_with("127.")
            || trimmed.starts_with("[::1]")
            || trimmed
                .split('/')
                .next()
                .is_some_and(|host| host.contains('.'))
            || trimmed
                .rsplit_once(':')
                .is_some_and(|(host, port)| !host.is_empty() && port.parse::<u16>().is_ok()));
    let candidate = if trimmed.contains("://") || (has_explicit_scheme && !looks_like_host) {
        trimmed.to_string()
    } else if looks_like_host {
        format!("https://{trimmed}")
    } else {
        let query = url::form_urlencoded::Serializer::new(String::new())
            .append_pair("q", trimmed)
            .finish();
        return Ok(format!("https://www.google.com/search?{query}"));
    };
    let parsed = Url::parse(&candidate).map_err(|error| format!("Invalid URL: {error}"))?;
    match parsed.scheme() {
        "http" | "https" => Ok(parsed.to_string()),
        scheme => Err(format!(
            "Navigation to '{scheme}:' is blocked. Only http(s) and about:blank are allowed"
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocks_privileged_and_local_schemes() {
        for url in [
            "file:///etc/passwd",
            "javascript:alert(1)",
            "data:text/html,hello",
            "chrome://settings",
        ] {
            assert!(
                validate_navigation_url(url).is_err(),
                "{url} must be blocked"
            );
        }
    }

    #[test]
    fn normalizes_web_urls() {
        assert_eq!(
            validate_navigation_url("example.com").unwrap(),
            "https://example.com/"
        );
        assert_eq!(
            validate_navigation_url("about:blank").unwrap(),
            "about:blank"
        );
        assert_eq!(
            validate_navigation_url("localhost:3000").unwrap(),
            "https://localhost:3000/"
        );
    }

    #[test]
    fn unknown_address_input_becomes_a_google_search() {
        assert_eq!(
            validate_navigation_url("open vibe browser").unwrap(),
            "https://www.google.com/search?q=open+vibe+browser"
        );
        assert_eq!(
            validate_navigation_url("weather").unwrap(),
            "https://www.google.com/search?q=weather"
        );
    }
}
