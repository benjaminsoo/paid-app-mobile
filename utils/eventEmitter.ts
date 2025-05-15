type EventCallback = (data: any) => void;

/**
 * A very simple event emitter for cross-component communication
 */
class EventEmitter {
  private events: Record<string, EventCallback[]>;

  constructor() {
    this.events = {};
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  on(event: string, callback: EventCallback): () => void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    
    this.events[event].push(callback);
    
    // Return unsubscribe function
    return () => {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
    };
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {any} data - Data to pass to callbacks
   */
  emit(event: string, data: any): void {
    if (this.events[event]) {
      this.events[event].forEach(callback => {
        callback(data);
      });
    }
  }
}

// Create a singleton instance
const eventEmitter = new EventEmitter();

export default eventEmitter; 