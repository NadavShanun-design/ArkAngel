use std::sync::RwLock;
use once_cell::sync::Lazy;
use serde::{Serialize, Deserialize};

/// Global user context that can be accessed throughout the application
static USER_CONTEXT: Lazy<RwLock<Option<UserContext>>> = Lazy::new(|| RwLock::new(None));

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserContext {
    pub user_id: String,
    pub organization_id: Option<String>,
    pub role: Option<String>,
}

/// Set the current user context (called when user logs in or auth state changes)
pub fn set_user_context(user_id: String, organization_id: Option<String>, role: Option<String>) {
    let mut context = USER_CONTEXT.write().unwrap();
    *context = Some(UserContext {
        user_id,
        organization_id,
        role,
    });
    println!("[UserContext] Set user context: user_id={}, org_id={:?}, role={:?}",
             context.as_ref().unwrap().user_id,
             context.as_ref().unwrap().organization_id,
             context.as_ref().unwrap().role);
}

/// Get the current user context
pub fn get_user_context() -> Option<UserContext> {
    let context = USER_CONTEXT.read().unwrap();
    context.clone()
}

/// Clear the user context (called on logout)
pub fn clear_user_context() {
    let mut context = USER_CONTEXT.write().unwrap();
    *context = None;
    println!("[UserContext] Cleared user context");
}

/// Check if a user is currently logged in
pub fn is_authenticated() -> bool {
    let context = USER_CONTEXT.read().unwrap();
    context.is_some()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_context() {
        // Initially no context
        assert!(!is_authenticated());

        // Set context
        set_user_context(
            "test-user-123".to_string(),
            Some("test-org-456".to_string()),
            Some("employee".to_string()),
        );

        // Should be authenticated now
        assert!(is_authenticated());

        // Get context
        let context = get_user_context().unwrap();
        assert_eq!(context.user_id, "test-user-123");
        assert_eq!(context.organization_id, Some("test-org-456".to_string()));
        assert_eq!(context.role, Some("employee".to_string()));

        // Clear context
        clear_user_context();

        // Should not be authenticated
        assert!(!is_authenticated());
    }
}
