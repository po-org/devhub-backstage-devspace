/**
 * Configuration options for the webhook plugin
 * @public
 */
export interface Config {
  /**
   * Webhook plugin configuration (optional)
   */
  webhook?: {
    /**
     * Enable debug logging
     */
    debug?: boolean;
  };
}
