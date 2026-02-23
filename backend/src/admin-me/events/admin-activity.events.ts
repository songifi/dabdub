export const AdminEvents = {
    KYC_SUBMITTED: 'admin.kyc.submitted',
    KYC_REVIEW_STARTED: 'admin.kyc.review_started',
    KYC_APPROVED: 'admin.kyc.approved',
    KYC_REJECTED: 'admin.kyc.rejected',
    SETTLEMENT_REQUESTED: 'admin.settlement.requested',
    SETTLEMENT_COMPLETED: 'admin.settlement.completed',
    SUPPORT_TICKET_ASSIGNED: 'admin.support.ticket_assigned',
};

export class AdminActivityEvent {
    constructor(
        public readonly adminId: string | null, // null if platform-wide/system event
        public readonly type: string,
        public readonly title: string,
        public readonly detail?: string,
        public readonly resourceType?: string,
        public readonly resourceId?: string,
        public readonly resourceUrl?: string,
    ) { }
}
