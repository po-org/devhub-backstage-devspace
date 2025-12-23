/**
 * Config options for the enhanced HTTP request action
 */

export interface Config {
  /**
   * Configuration for the scaffolder backend module
   */
  scaffolder?: {
    /**
     * Default configuration for HTTP advanced actions
     */
    httpAdvanced?: {
      /**
       * Default timeout for HTTP requests in milliseconds
       * @default 30000
       */
      defaultTimeout?: number;

      /**
       * Default retry configuration
       */
      defaultRetry?: {
        /**
         * Whether retry is enabled by default
         * @default false
         */
        enabled?: boolean;

        /**
         * Maximum number of retry attempts
         * @default 3
         */
        maxRetries?: number;

        /**
         * Base delay between retries in milliseconds
         * @default 1000
         */
        retryDelay?: number;

        /**
         * Whether to use exponential backoff
         * @default true
         */
        exponentialBackoff?: boolean;
      };

      /**
       * Default pagination configuration
       */
      defaultPagination?: {
        /**
         * Maximum number of pages to fetch
         * @default 10
         */
        maxPages?: number;
      };

      /**
       * Whether to enable verbose logging by default
       * @default false
       */
      verboseLogging?: boolean;
    };
  };
}
