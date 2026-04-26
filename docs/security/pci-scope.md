# PCI Scope Assessment

## Recommended PCI Self-Assessment Questionnaire

This platform currently qualifies for **SAQ-A**.

### Why SAQ-A fits this platform

- Payment processing is fully outsourced to external payment providers and gateways.
- The backend does not store, process, or transmit full cardholder data (PAN, CVV, expiry) directly.
- All external payment gateways are configured with secure HTTPS endpoints, and tokenized payment flows are used.
- No card numbers, CVV values, or unmasked PANs are persisted in application data, logs, or database entities.

### Payment handling architecture

- External payment providers used include Flutterwave, Paystack, and Sudo Africa.
- The backend consumes provider APIs over HTTPS.
- Cardholder-related data is managed by the payment providers, not by this application.
- Sensitive operations are protected by authentication and RBAC.

### Conditions for SAQ-A

The platform is in scope for SAQ-A as long as:

- No full cardholder data is entered, transmitted, or stored by the application.
- All card acceptance and payment authorization are performed by third-party gateways.
- The platform maintains controls over administrative access, system security, and secure transport.

### When the scope changes to SAQ-D

If the platform later begins to:

- accept raw card PAN/CVV in backend services,
- store full cardholder data,
- process payments directly through its own infrastructure,

then the PCI scope must be elevated to **SAQ-D** and a full PCI compliance program will be required.
