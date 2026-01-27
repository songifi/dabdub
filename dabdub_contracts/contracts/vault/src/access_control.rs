use soroban_sdk::{contractevent, contracttype, symbol_short, Address, Env, Symbol, Vec};

// Role constants
pub const ADMIN_ROLE: Symbol = symbol_short!("ADMIN");
pub const OPERATOR_ROLE: Symbol = symbol_short!("OPERATOR");
pub const TREASURER_ROLE: Symbol = symbol_short!("TREASR");

#[contracttype]
#[derive(Clone)]
pub enum RoleKey {
    Admin,
    Roles(Address),
}

#[contractevent(topics = ["VAULT", "role"])]
pub struct RoleGrantedEvent {
    pub account: Address,
    pub role: Symbol,
}

#[contractevent(topics = ["VAULT", "role"])]
pub struct RoleRevokedEvent {
    pub account: Address,
    pub role: Symbol,
}

/// Grant a role to an address
pub fn grant_role(env: &Env, account: Address, role: Symbol) {
    let mut roles: Vec<Symbol> = env
        .storage()
        .instance()
        .get(&RoleKey::Roles(account.clone()))
        .unwrap_or(Vec::new(env));

    // Check if already has role
    for r in roles.iter() {
        if r == role {
            return;
        }
    }

    roles.push_back(role.clone());
    env.storage()
        .instance()
        .set(&RoleKey::Roles(account.clone()), &roles);

    // Emit event
    RoleGrantedEvent { account, role }.publish(env);
}

/// Revoke a role from an address
pub fn revoke_role(env: &Env, account: Address, role: Symbol) {
    let roles: Vec<Symbol> = env
        .storage()
        .instance()
        .get(&RoleKey::Roles(account.clone()))
        .unwrap_or(Vec::new(env));

    let mut new_roles = Vec::new(env);
    for r in roles.iter() {
        if r != role {
            new_roles.push_back(r);
        }
    }

    env.storage()
        .instance()
        .set(&RoleKey::Roles(account.clone()), &new_roles);

    // Emit event
    RoleRevokedEvent { account, role }.publish(env);
}

/// Check if address has role
pub fn has_role(env: &Env, account: &Address, role: Symbol) -> bool {
    let roles: Vec<Symbol> = env
        .storage()
        .instance()
        .get(&RoleKey::Roles(account.clone()))
        .unwrap_or(Vec::new(env));

    for r in roles.iter() {
        if r == role {
            return true;
        }
    }
    false
}

/// Require that caller has specific role (panics if not)
pub fn require_role(env: &Env, account: &Address, role: Symbol) {
    if !has_role(env, account, role) {
        panic!("Missing required role");
    }
}
