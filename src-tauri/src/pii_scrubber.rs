use regex::Regex;
use serde_json::Value;

/// Scrub PII/PHI from conversation JSON and replace with "BLOCKED"
pub fn scrub_conversation_json(json_content: String) -> Result<String, String> {
    // Parse the JSON
    let mut conversation: Value = serde_json::from_str(&json_content)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;
    
    // Scrub the conversation data
    scrub_conversation_value(&mut conversation)?;
    
    // Convert back to string
    serde_json::to_string_pretty(&conversation)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))
}

/// Recursively scrub PII from conversation value
fn scrub_conversation_value(value: &mut Value) -> Result<(), String> {
    match value {
        Value::Object(map) => {
            for (_, v) in map.iter_mut() {
                scrub_conversation_value(v)?;
            }
        }
        Value::Array(arr) => {
            for v in arr.iter_mut() {
                scrub_conversation_value(v)?;
            }
        }
        Value::String(s) => {
            *s = scrub_text_string(s);
        }
        _ => {} // Numbers, booleans, null don't need scrubbing
    }
    Ok(())
}

/// Scrub sensitive information from text strings
fn scrub_text_string(text: &str) -> String {
    let mut result = text.to_string();
    
    // ===== PERSONAL IDENTIFIERS =====
    
    // SSN detection - specific formats only
    let ssn_patterns = [
        r"\b\d{3}-\d{2}-\d{4}\b",           // XXX-XX-XXXX
        r"\b\d{3}\s\d{2}\s\d{4}\b",         // XXX XX XXXX
        r"\b\d{3}\.\d{2}\.\d{4}\b",         // XXX.XX.XXXX
    ];
    for pattern in ssn_patterns.iter() {
        let regex = Regex::new(pattern).unwrap();
        result = regex.replace_all(&result, "BLOCKED").to_string();
    }
    
    // Driver's License patterns (only specific formats)
    let dl_patterns = [
        r"\b[A-Z]\d{7}\b",                   // A1234567
    ];
    for pattern in dl_patterns.iter() {
        let regex = Regex::new(pattern).unwrap();
        result = regex.replace_all(&result, "BLOCKED").to_string();
    }
    
    // Passport numbers
    let passport_regex = Regex::new(r"\b[A-Z]\d{8}\b").unwrap();
    result = passport_regex.replace_all(&result, "BLOCKED").to_string();
    
    // Employee ID patterns (only specific formats)
    let employee_patterns = [
        r"\bEMP\d{6}\b",                     // EMP123456
    ];
    for pattern in employee_patterns.iter() {
        let regex = Regex::new(pattern).unwrap();
        result = regex.replace_all(&result, "BLOCKED").to_string();
    }
    
    // ===== CONTACT INFORMATION =====
    
    // Phone numbers - specific phone formats only
    let phone_patterns = [
        r"\b\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b",  // International
        r"\b\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b",                    // US Domestic
        r"\b1[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b",                 // US with 1
    ];
    for pattern in phone_patterns.iter() {
        let regex = Regex::new(pattern).unwrap();
        result = regex.replace_all(&result, "BLOCKED").to_string();
    }
    
    // Phone extensions
    let ext_regex = Regex::new(r"\b(?:ext|extension|ext\.)\s*\d{1,5}\b").unwrap();
    result = ext_regex.replace_all(&result, "BLOCKED").to_string();
    
    // Fax numbers
    let fax_regex = Regex::new(r"\b(?:fax|f\.)\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b").unwrap();
    result = fax_regex.replace_all(&result, "BLOCKED").to_string();
    
    // Email detection - comprehensive patterns
    let email_patterns = [
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",        // Standard email
        r"\b[A-Za-z0-9._%+-]+\s+at\s+[A-Za-z0-9.-]+\s+dot\s+[A-Z|a-z]{2,}\b", // Spoken "at dot"
        r"\b[A-Za-z0-9._%+-]+\s+@\s+[A-Za-z0-9.-]+\s+\.\s+[A-Z|a-z]{2,}\b",   // Spoken "@ ."
        r"\b[A-Za-z0-9._%+-]+\s+at\s+[A-Za-z0-9.-]+\s+\.\s+[A-Z|a-z]{2,}\b",  // Spoken "at ."
    ];
    for pattern in email_patterns.iter() {
        let regex = Regex::new(pattern).unwrap();
        result = regex.replace_all(&result, "BLOCKED").to_string();
    }
    
    // Address patterns - specific address formats only
    let address_patterns = [
        r"\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Place|Pl|Way|Circle|Cir)\b", // Street addresses
        r"\b[A-Za-z\s]+,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?\b",     // City, State ZIP
    ];
    for pattern in address_patterns.iter() {
        let regex = Regex::new(pattern).unwrap();
        result = regex.replace_all(&result, "BLOCKED").to_string();
    }
    
    // Social media handles (only actual handles, not random words)
    let social_patterns = [
        r"\b@[A-Za-z0-9_]{1,15}\b",                                        // Twitter/Instagram handles
    ];
    for pattern in social_patterns.iter() {
        let regex = Regex::new(pattern).unwrap();
        result = regex.replace_all(&result, "BLOCKED").to_string();
    }
    
    // ===== FINANCIAL INFORMATION =====
    
    // Credit card patterns - specific formats only
    let cc_patterns = [
        r"\b\d{4}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}\b",                // 16 digits (Visa/MC)
        r"\b\d{4}[-.\s]?\d{6}[-.\s]?\d{5}\b",                             // 15 digits (Amex)
    ];
    for pattern in cc_patterns.iter() {
        let regex = Regex::new(pattern).unwrap();
        result = regex.replace_all(&result, "BLOCKED").to_string();
    }
    
    // Bank account and routing numbers (only specific formats)
    let bank_patterns = [
        r"\b\d{9}\b",                                                       // Routing number (exact 9 digits)
        r"\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b",           // IBAN
    ];
    for pattern in bank_patterns.iter() {
        let regex = Regex::new(pattern).unwrap();
        result = regex.replace_all(&result, "BLOCKED").to_string();
    }
    
    // Tax IDs (only specific formats, not all 9-digit numbers)
    let tax_patterns = [
        r"\b\d{2}-\d{7}\b",                                                 // EIN XX-XXXXXXX
        r"\b\d{3}-\d{2}-\d{4}\b",                                          // TIN XXX-XX-XXXX
    ];
    for pattern in tax_patterns.iter() {
        let regex = Regex::new(pattern).unwrap();
        result = regex.replace_all(&result, "BLOCKED").to_string();
    }
    
    // ===== MEDICAL/HEALTH INFORMATION =====
    
    // Medical record numbers (only specific formats)
    let medical_patterns = [
        r"\bMRN\d{6,8}\b",                                                  // MRN123456
    ];
    for pattern in medical_patterns.iter() {
        let regex = Regex::new(pattern).unwrap();
        result = regex.replace_all(&result, "BLOCKED").to_string();
    }
    
    // Insurance numbers (only specific formats)
    let insurance_patterns = [
        r"\b[A-Z]{3}\d{6,8}\b",                                             // Group IDs
    ];
    for pattern in insurance_patterns.iter() {
        let regex = Regex::new(pattern).unwrap();
        result = regex.replace_all(&result, "BLOCKED").to_string();
    }
    
    // ICD codes
    let icd_regex = Regex::new(r"\b[A-Z]\d{2}\.\d{1,2}[A-Z0-9]?\b").unwrap();
    result = icd_regex.replace_all(&result, "BLOCKED").to_string();
    
    // ===== TEMPORAL DATA =====
    
    // Date patterns - specific date formats only
    let date_patterns = [
        r"\b\d{1,2}/\d{1,2}/\d{4}\b",                                      // MM/DD/YYYY
        r"\b\d{4}-\d{1,2}-\d{1,2}\b",                                      // YYYY-MM-DD
        r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b", // Month DD, YYYY
    ];
    for pattern in date_patterns.iter() {
        let regex = Regex::new(pattern).unwrap();
        result = regex.replace_all(&result, "BLOCKED").to_string();
    }
    
    // Age patterns (only specific age contexts)
    let age_patterns = [
        r"\bage\s*\d{1,3}\b",                                               // age 25
        r"\b\d{1,3}\s*years?\s*old\b",                                     // 25 years old
        r"\b(?:born|birth)\s+(?:in\s+)?\d{4}\b",                           // born 1990, birth 1990
    ];
    for pattern in age_patterns.iter() {
        let regex = Regex::new(pattern).unwrap();
        result = regex.replace_all(&result, "BLOCKED").to_string();
    }
    
    // ===== DIGITAL IDENTIFIERS =====
    
    // IP addresses - IPv4 and IPv6
    let ip_patterns = [
        r"\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b", // IPv4
        r"\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b",                   // IPv6 full
        r"\b(?:[0-9a-fA-F]{1,4}:){1,7}:\b",                                // IPv6 compressed
        r"\b::(?:[0-9a-fA-F]{1,4}:){1,7}\b",                               // IPv6 compressed
        r"\b(?:[0-9a-fA-F]{1,4}:){1,6}::[0-9a-fA-F]{1,4}\b",              // IPv6 compressed
    ];
    for pattern in ip_patterns.iter() {
        let regex = Regex::new(pattern).unwrap();
        result = regex.replace_all(&result, "BLOCKED").to_string();
    }
    
    // MAC addresses
    let mac_regex = Regex::new(r"\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b").unwrap();
    result = mac_regex.replace_all(&result, "BLOCKED").to_string();
    
    // URLs and file paths - specific formats only
    let url_patterns = [
        r"\bhttps?://[^\s]+\b",                                             // HTTP/HTTPS URLs
        r"\bwww\.[^\s]+\b",                                                 // WWW URLs
        r"\b[A-Za-z]:\\[^\s]*\b",                                          // Windows file paths
    ];
    for pattern in url_patterns.iter() {
        let regex = Regex::new(pattern).unwrap();
        result = regex.replace_all(&result, "BLOCKED").to_string();
    }
    
    // Device IDs and serial numbers (only specific formats)
    let device_patterns = [
        r"\b[A-Z]{2}\d{6,8}[A-Z0-9]{2,4}\b",                              // Serial numbers
    ];
    for pattern in device_patterns.iter() {
        let regex = Regex::new(pattern).unwrap();
        result = regex.replace_all(&result, "BLOCKED").to_string();
    }
    
    // ===== ENHANCED NAME DETECTION =====
    
    // Specific name patterns (case insensitive) - only actual personal names
    let name_patterns = [
        // Direct identification
        (r"(?i)\bmy name is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b", "my name is BLOCKED"),
        (r"(?i)\bI'm\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b", "I'm BLOCKED"),
        (r"(?i)\bI am\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b", "I am BLOCKED"),
        (r"(?i)\bcall me\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b", "call me BLOCKED"),
        (r"(?i)\bthis is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b", "this is BLOCKED"),
        
        // Greetings and introductions
        (r"(?i)\bnice to meet you,?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b", "nice to meet you, BLOCKED"),
        
        // Professional contexts (only with titles)
        (r"(?i)\bdr\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b", "Dr. BLOCKED"),
        (r"(?i)\bprofessor\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b", "Professor BLOCKED"),
        (r"(?i)\bprof\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b", "Prof. BLOCKED"),
        (r"(?i)\bmr\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b", "Mr. BLOCKED"),
        (r"(?i)\bms\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b", "Ms. BLOCKED"),
        (r"(?i)\bmrs\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b", "Mrs. BLOCKED"),
        (r"(?i)\bmiss\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b", "Miss BLOCKED"),
        
        // Family relationships
        (r"(?i)\bmy (?:father|dad|mother|mom|sister|brother|son|daughter|uncle|aunt|cousin|grandfather|grandmother|grandpa|grandma)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b", "my family member BLOCKED"),
    ];
    
    for (pattern, replacement) in name_patterns.iter() {
        let regex = Regex::new(pattern).unwrap();
        result = regex.replace_all(&result, *replacement).to_string();
    }
    
    // Only block names in specific contexts, not random capitalized word pairs
    
    // Only block actual names in specific contexts, not random capitalized words
    
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_ssn_scrubbing() {
        let input = "My SSN is 123-45-6789";
        let expected = "My SSN is BLOCKED";
        assert_eq!(scrub_text_string(input), expected);
    }
    
    #[test]
    fn test_phone_scrubbing() {
        let input = "Call me at 555-123-4567";
        let expected = "Call me at BLOCKED";
        assert_eq!(scrub_text_string(input), expected);
    }
    
    #[test]
    fn test_email_scrubbing() {
        let input = "Email me at john@example.com";
        let expected = "Email me at BLOCKED";
        assert_eq!(scrub_text_string(input), expected);
    }
    
    #[test]
    fn test_name_scrubbing() {
        let input1 = "My name is John Smith";
        let expected1 = "My name is BLOCKED";
        assert_eq!(scrub_text_string(input1), expected1);
        
        let input2 = "I am Nadav Shannon";
        let expected2 = "I am BLOCKED";
        assert_eq!(scrub_text_string(input2), expected2);
        
        let input3 = "Nice to meet you, Nadav";
        let expected3 = "Nice to meet you, BLOCKED";
        assert_eq!(scrub_text_string(input3), expected3);
        
        let input4 = "Standalone Name Here";
        let expected4 = "BLOCKED";
        assert_eq!(scrub_text_string(input4), expected4);
    }
}
