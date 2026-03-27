#![no_std]
use soroban_sdk::{contract, contractimpl};

pub mod errors;
pub use errors::Error;

#[contract]
pub struct CheesePay;

#[contractimpl]
impl CheesePay {}
