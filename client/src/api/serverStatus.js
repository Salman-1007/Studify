// Global server status manager for Render cold-starts and connection health
class ServerStatusManager {
    constructor() {
        this.listeners = new Set();
        this.state = {
            isColdStarting: false,
            isReconnecting: false,
            attempt: 0,
            maxAttempts: 3,
            message: '',
            justConnected: false,
        };
        this.clearSuccessTimer = null;
    }

    getState() {
        return this.state;
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify() {
        for (const listener of this.listeners) {
            listener(this.state);
        }
    }

    startColdStart(attempt = 1) {
        if (this.clearSuccessTimer) {
            clearTimeout(this.clearSuccessTimer);
            this.clearSuccessTimer = null;
        }
        this.state = {
            isColdStarting: true,
            isReconnecting: false,
            attempt,
            maxAttempts: 3,
            message: 'Connecting to Studify cloud service... (Est. 15-30s on cold start)',
            justConnected: false,
        };
        this.notify();
    }

    updateAttempt(attempt) {
        this.state = {
            ...this.state,
            isColdStarting: true,
            attempt,
            message: `Connecting to Studify cloud service... (Attempt ${attempt}/3 · waking server)`,
        };
        this.notify();
    }

    markConnected() {
        if (this.state.isColdStarting || this.state.isReconnecting) {
            this.state = {
                isColdStarting: false,
                isReconnecting: false,
                attempt: 0,
                maxAttempts: 3,
                message: 'Connected to Studify cloud!',
                justConnected: true,
            };
            this.notify();

            this.clearSuccessTimer = setTimeout(() => {
                this.state = {
                    ...this.state,
                    justConnected: false,
                    message: '',
                };
                this.notify();
            }, 3000);
        }
    }

    markFailed(errorMessage) {
        this.state = {
            isColdStarting: false,
            isReconnecting: false,
            attempt: 0,
            maxAttempts: 3,
            message: errorMessage || 'Could not connect to Studify server. Please check your connection.',
            justConnected: false,
        };
        this.notify();
    }
}

export const serverStatus = new ServerStatusManager();