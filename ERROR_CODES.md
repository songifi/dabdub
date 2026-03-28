# ERROR_CODES.md

| Code | Variant | Description | HTTP Status |
|------|---------|-------------|-------------|
| 1  | AlreadyInitialized       | initialize() already called                        | 409 Conflict             |
| 2  | NotInitialized           | Called before initialize()                         | 503 Service Unavailable  |
| 3  | ContractPaused           | Contract is administratively paused                | 503 Service Unavailable  |
| 4  | Unauthorized             | Caller lacks required role/ownership               | 403 Forbidden            |
| 5  | InsufficientBalance      | Sender balance below transfer amount               | 402 Payment Required     |
| 6  | InvalidAmount            | Amount is zero or out of bounds                    | 400 Bad Request          |
| 7  | SelfTransfer             | Sender and recipient are the same address          | 400 Bad Request          |
| 8  | PayLinkNotFound          | No PayLink for supplied identifier                 | 404 Not Found            |
| 9  | PayLinkAlreadyPaid       | PayLink already settled                            | 409 Conflict             |
| 10 | PayLinkCancelled         | PayLink was cancelled                              | 410 Gone                 |
| 11 | PayLinkAlreadyExists     | PayLink with that ID already exists                | 409 Conflict             |
| 12 | PayLinkExpired           | PayLink expiration timestamp passed                | 410 Gone                 |
| 13 | NotPayLinkCreator        | Caller is not the PayLink creator                  | 403 Forbidden            |
| 14 | FeeTooHigh               | Proposed fee exceeds protocol maximum              | 400 Bad Request          |
| 15 | UsernameAlreadyRegistered| Username already taken                             | 409 Conflict             |
| 16 | UserAlreadyRegistered    | Address already registered                         | 409 Conflict             |
| 17 | UserNotFound             | No user record for address/identifier              | 404 Not Found            |

> Never renumber or remove variants after deployment — codes are stored on-chain.
