#![no_std]

mod test;

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum Role {
    ReadOnly,
    ComplianceAdmin,
    OperationsAdmin,
    SuperAdmin,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Role(Address),
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct RoleGrantedEvent {
    pub account: Address,
    pub role: Role,
    pub granted_by: Address,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct RoleRevokedEvent {
    pub account: Address,
    pub revoked_by: Address,
}

#[contract]
pub struct RbacAccessContract;

#[contractimpl]
impl RbacAccessContract {
    pub fn __constructor(env: Env, super_admin: Address) {
        env.storage()
            .instance()
            .set(&DataKey::Role(super_admin), &Role::SuperAdmin);
    }

    pub fn grant_role(env: Env, caller: Address, account: Address, role: Role) {
        caller.require_auth();
        Self::require_role(&env, &caller, Role::SuperAdmin);

        env.storage()
            .instance()
            .set(&DataKey::Role(account.clone()), &role);
        env.events().publish(
            ("RBAC", "role_granted"),
            RoleGrantedEvent {
                account,
                role,
                granted_by: caller,
            },
        );
    }

    pub fn revoke_role(env: Env, caller: Address, account: Address) {
        caller.require_auth();
        Self::require_role(&env, &caller, Role::SuperAdmin);

        let key = DataKey::Role(account.clone());
        if !env.storage().instance().has(&key) {
            panic!("role not assigned");
        }
        env.storage().instance().remove(&key);
        env.events().publish(
            ("RBAC", "role_revoked"),
            RoleRevokedEvent {
                account,
                revoked_by: caller,
            },
        );
    }

    pub fn get_role(env: Env, account: Address) -> Option<Role> {
        env.storage().instance().get(&DataKey::Role(account))
    }

    /// Sensitive operation requiring minimum `OperationsAdmin`.
    pub fn execute_operations_task(env: Env, caller: Address) {
        caller.require_auth();
        Self::require_role(&env, &caller, Role::OperationsAdmin);
    }

    /// Sensitive operation requiring minimum `ComplianceAdmin`.
    pub fn execute_compliance_task(env: Env, caller: Address) {
        caller.require_auth();
        Self::require_role(&env, &caller, Role::ComplianceAdmin);
    }

    /// Sensitive operation requiring minimum `ReadOnly`.
    pub fn execute_read_task(env: Env, caller: Address) {
        caller.require_auth();
        Self::require_role(&env, &caller, Role::ReadOnly);
    }

    fn require_role(env: &Env, caller: &Address, minimum_role: Role) {
        let caller_role = env
            .storage()
            .instance()
            .get::<DataKey, Role>(&DataKey::Role(caller.clone()))
            .expect("role not assigned");

        if Self::role_rank(caller_role) < Self::role_rank(minimum_role) {
            panic!("insufficient role");
        }
    }

    fn role_rank(role: Role) -> u32 {
        match role {
            Role::ReadOnly => 1,
            Role::ComplianceAdmin => 2,
            Role::OperationsAdmin => 3,
            Role::SuperAdmin => 4,
        }
    }
}
