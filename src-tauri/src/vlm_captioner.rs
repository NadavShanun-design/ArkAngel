use serde::{Deserialize, Serialize};
use std::fs;
use base64::{Engine as _, engine::general_purpose};

// OpenAI API constants
const OPENAI_BASE_URL: &str = "https://api.openai.com/v1/chat/completions";
const GPT4O_MINI_MODEL: &str = "gpt-4o-mini";
const MAX_TOKENS: u32 = 800;

/// Result from VLM captioning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptionResult {
    pub caption: String,
    pub model: String,
    pub tokens_used: u32,
    pub cost: f64,
}

/// Detailed prompt for screenshot captioning
fn get_captioning_prompt() -> &'static str {
    r#"Analyze this screenshot in detail. This description will be used for semantic search later, so be specific and comprehensive.

Describe the following:

1. **Primary UI Elements**:
   - What buttons, inputs, dropdowns, or controls are visible?
   - What are their exact labels and positions?

2. **Visible Text Content**:
   - Extract all readable text (headings, labels, body text)
   - Include any error messages, notifications, or tooltips

3. **User Action Context**:
   - What was the user doing or about to do?
   - What workflow step does this represent?

4. **Application Identification**:
   - What software, website, or application is shown?
   - What specific page or view is displayed?

5. **Data and Content**:
   - What data, documents, or media are visible?
   - Are there tables, charts, or lists? Describe them.

6. **Technical Details**:
   - Any code, terminal output, or technical information?
   - Any configuration settings or developer tools visible?

7. **Visual Layout**:
   - How are elements arranged on screen?
   - What's the visual hierarchy?

Format: Write in clear, technical prose. Use specific names and values. Aim for 300-500 words."#
}

/// OpenAI API response structure
#[derive(Debug, Deserialize)]
struct OpenAIResponse {
    choices: Vec<Choice>,
    usage: Usage,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: Message,
}

#[derive(Debug, Deserialize)]
struct Message {
    content: String,
}

#[derive(Debug, Deserialize)]
struct Usage {
    prompt_tokens: u32,
    completion_tokens: u32,
}

/// Generate caption using GPT-4o-mini
pub async fn caption_with_gpt4o_mini(
    image_path: &str,
    api_key: &str,
) -> Result<CaptionResult, String> {
    println!("[VLM] Starting caption generation for: {}", image_path);

    // Read and encode image
    let image_bytes = fs::read(image_path)
        .map_err(|e| format!("Failed to read image: {}", e))?;

    let base64_image = general_purpose::STANDARD.encode(&image_bytes);
    println!("[VLM] Image encoded, size: {} bytes", image_bytes.len());

    // Build request payload
    let request_body = serde_json::json!({
        "model": GPT4O_MINI_MODEL,
        "messages": [{
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": get_captioning_prompt()
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": format!("data:image/png;base64,{}", base64_image),
                        "detail": "high"
                    }
                }
            ]
        }],
        "max_tokens": MAX_TOKENS,
        "temperature": 0.3
    });

    // Send request with retry logic
    let response = send_with_retry(OPENAI_BASE_URL, api_key, &request_body).await?;

    // Parse response
    let openai_response: OpenAIResponse = serde_json::from_str(&response)
        .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;

    if openai_response.choices.is_empty() {
        return Err("No choices in OpenAI response".to_string());
    }

    let caption = openai_response.choices[0].message.content.clone();
    let tokens_used = openai_response.usage.prompt_tokens + openai_response.usage.completion_tokens;

    // Calculate cost (GPT-4o-mini pricing as of 2025)
    // Input: $0.150 per 1M tokens, Output: $0.600 per 1M tokens
    let input_cost = (openai_response.usage.prompt_tokens as f64 / 1_000_000.0) * 0.150;
    let output_cost = (openai_response.usage.completion_tokens as f64 / 1_000_000.0) * 0.600;
    let total_cost = input_cost + output_cost;

    println!("[VLM] Caption generated successfully:");
    println!("[VLM]   Tokens: {} (prompt: {}, completion: {})",
             tokens_used,
             openai_response.usage.prompt_tokens,
             openai_response.usage.completion_tokens);
    println!("[VLM]   Cost: ${:.6}", total_cost);
    println!("[VLM]   Caption length: {} chars", caption.len());

    Ok(CaptionResult {
        caption,
        model: GPT4O_MINI_MODEL.to_string(),
        tokens_used,
        cost: total_cost,
    })
}

/// Send HTTP request with exponential backoff retry
async fn send_with_retry(
    url: &str,
    api_key: &str,
    body: &serde_json::Value,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let max_retries = 3;

    for attempt in 0..max_retries {
        match client
            .post(url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(body)
            .send()
            .await
        {
            Ok(response) => {
                let status = response.status();

                if status.is_success() {
                    let text = response.text().await
                        .map_err(|e| format!("Failed to read response: {}", e))?;
                    return Ok(text);
                } else if status.as_u16() == 429 {
                    // Rate limit - retry with backoff
                    let wait_secs = 2u64.pow(attempt);
                    println!("[VLM] Rate limited, waiting {} seconds...", wait_secs);
                    tokio::time::sleep(tokio::time::Duration::from_secs(wait_secs)).await;
                    continue;
                } else {
                    let error_text = response.text().await.unwrap_or_default();
                    return Err(format!("API error {}: {}", status, error_text));
                }
            }
            Err(e) => {
                if attempt == max_retries - 1 {
                    return Err(format!("Request failed after {} retries: {}", max_retries, e));
                }
                println!("[VLM] Request failed, retrying... (attempt {}/{})", attempt + 1, max_retries);
                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            }
        }
    }

    Err("Max retries exceeded".to_string())
}

/// Generate caption using Claude Sonnet (alternative)
pub async fn caption_with_claude(
    image_path: &str,
    api_key: &str,
) -> Result<CaptionResult, String> {
    println!("[VLM] Starting Claude caption generation for: {}", image_path);

    // Read and encode image
    let image_bytes = fs::read(image_path)
        .map_err(|e| format!("Failed to read image: {}", e))?;

    let base64_image = general_purpose::STANDARD.encode(&image_bytes);

    // Claude API request format
    let request_body = serde_json::json!({
        "model": "claude-3-5-sonnet-20241022",
        "max_tokens": MAX_TOKENS,
        "messages": [{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": base64_image
                    }
                },
                {
                    "type": "text",
                    "text": get_captioning_prompt()
                }
            ]
        }]
    });

    // Send request
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Claude API error: {}", error_text));
    }

    // Parse Claude response
    let response_json: serde_json::Value = response.json().await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let caption = response_json["content"][0]["text"]
        .as_str()
        .ok_or("No caption in response")?
        .to_string();

    let input_tokens = response_json["usage"]["input_tokens"].as_u64().unwrap_or(0) as u32;
    let output_tokens = response_json["usage"]["output_tokens"].as_u64().unwrap_or(0) as u32;
    let tokens_used = input_tokens + output_tokens;

    // Claude Sonnet pricing: $3.00 per 1M input, $15.00 per 1M output
    let cost = (input_tokens as f64 / 1_000_000.0) * 3.0 + (output_tokens as f64 / 1_000_000.0) * 15.0;

    println!("[VLM] Claude caption generated, tokens: {}, cost: ${:.6}", tokens_used, cost);

    Ok(CaptionResult {
        caption,
        model: "claude-3-5-sonnet".to_string(),
        tokens_used,
        cost,
    })
}
