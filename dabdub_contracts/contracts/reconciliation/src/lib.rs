#![no_std]

mod test;

use soroban_sdk::{contract, contractimpl, contracttype, Address, Bytes, BytesN, Env, Vec};

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct MerkleProofNode {
    pub sibling: BytesN<32>,
    pub is_left: bool,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct ReconciliationBatch {
    pub merkle_root: BytesN<32>,
    pub submitted_at: u64,
    pub submitted_ledger: u32,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    CurrentBatch,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct ReconciliationSubmittedEvent {
    pub merkle_root: BytesN<32>,
    pub submitted_at: u64,
    pub submitted_ledger: u32,
}

#[contract]
pub struct ReconciliationContract;

#[contractimpl]
impl ReconciliationContract {
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn submit_merkle_root(env: Env, caller: Address, merkle_root: BytesN<32>) {
        caller.require_auth();
        Self::require_admin(&env, &caller);

        let batch = ReconciliationBatch {
            merkle_root: merkle_root.clone(),
            submitted_at: env.ledger().timestamp(),
            submitted_ledger: env.ledger().sequence(),
        };
        env.storage().instance().set(&DataKey::CurrentBatch, &batch);

        env.events().publish(
            ("RECONCILIATION", "submitted"),
            ReconciliationSubmittedEvent {
                merkle_root,
                submitted_at: batch.submitted_at,
                submitted_ledger: batch.submitted_ledger,
            },
        );
    }

    /// Returns `true` when a mismatch is detected, `false` when proof is valid.
    pub fn verify_settlement(env: Env, payment_id: BytesN<32>, proof: Vec<MerkleProofNode>) -> bool {
        let batch: ReconciliationBatch = env
            .storage()
            .instance()
            .get(&DataKey::CurrentBatch)
            .expect("No reconciliation batch submitted");

        let mut current = Self::hash_leaf(&env, &payment_id);
        for i in 0..proof.len() {
            let node = proof.get(i).unwrap();
            current = if node.is_left {
                Self::hash_pair(&env, &node.sibling, &current)
            } else {
                Self::hash_pair(&env, &current, &node.sibling)
            };
        }

        current != batch.merkle_root
    }

    pub fn get_current_batch(env: Env) -> Option<ReconciliationBatch> {
        env.storage().instance().get(&DataKey::CurrentBatch)
    }

    fn require_admin(env: &Env, caller: &Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if &admin != caller {
            panic!("Not admin");
        }
    }

    fn hash_leaf(env: &Env, payment_id: &BytesN<32>) -> BytesN<32> {
        let id_arr = payment_id.to_array();
        env.crypto().sha256(&Bytes::from_slice(env, &id_arr)).into()
    }

    fn hash_pair(env: &Env, left: &BytesN<32>, right: &BytesN<32>) -> BytesN<32> {
        let left_arr = left.to_array();
        let right_arr = right.to_array();

        let mut combined = [0u8; 64];
        combined[..32].copy_from_slice(&left_arr);
        combined[32..].copy_from_slice(&right_arr);

        env.crypto().sha256(&Bytes::from_slice(env, &combined)).into()
    }
}
