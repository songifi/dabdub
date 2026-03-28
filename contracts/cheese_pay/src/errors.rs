use soroban_sdk::contracterror;

#[contracterror]
#[derive(Clone, Debug, PartialEq)]
pub enum Error {
    // Lifecycle
    AlreadyInitialized      = 1,
    NotInitialized          = 2,
    ContractPaused          = 3,
    Unauthorized            = 4,
    // Token / Balance
    InsufficientBalance     = 5,
    InvalidAmount           = 6,
    SelfTransfer            = 7,
    // PayLink
    PayLinkNotFound         = 8,
    PayLinkAlreadyPaid      = 9,
    PayLinkCancelled        = 10,
    PayLinkAlreadyExists    = 11,
    PayLinkExpired          = 12,
    NotPayLinkCreator       = 13,
    // Fees / Users
    FeeTooHigh              = 14,
    UsernameAlreadyRegistered = 15,
    UserAlreadyRegistered   = 16,
    UserNotFound            = 17,
}

#[cfg(test)]
mod tests {
    use super::Error;

    #[test]
    fn discriminants_are_stable() {
        assert_eq!(Error::AlreadyInitialized as u32, 1);
        assert_eq!(Error::NotInitialized as u32, 2);
        assert_eq!(Error::ContractPaused as u32, 3);
        assert_eq!(Error::Unauthorized as u32, 4);
        assert_eq!(Error::InsufficientBalance as u32, 5);
        assert_eq!(Error::InvalidAmount as u32, 6);
        assert_eq!(Error::SelfTransfer as u32, 7);
        assert_eq!(Error::PayLinkNotFound as u32, 8);
        assert_eq!(Error::PayLinkAlreadyPaid as u32, 9);
        assert_eq!(Error::PayLinkCancelled as u32, 10);
        assert_eq!(Error::PayLinkAlreadyExists as u32, 11);
        assert_eq!(Error::PayLinkExpired as u32, 12);
        assert_eq!(Error::NotPayLinkCreator as u32, 13);
        assert_eq!(Error::FeeTooHigh as u32, 14);
        assert_eq!(Error::UsernameAlreadyRegistered as u32, 15);
        assert_eq!(Error::UserAlreadyRegistered as u32, 16);
        assert_eq!(Error::UserNotFound as u32, 17);
    }

    #[test]
    fn clone_and_partial_eq() {
        let a = Error::Unauthorized;
        assert_eq!(a.clone(), a);
        assert_ne!(a, Error::ContractPaused);
    }
}
