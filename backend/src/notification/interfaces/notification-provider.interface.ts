export interface NotificationProvider {
    send(
        recipient: string,
        content: string,
        subject?: string,
        metadata?: Record<string, any>,
    ): Promise<void>;
}
