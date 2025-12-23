/**
 * Backend module for enhanced HTTP request actions
 * 
 * This version is compatible with legacy backend systems
 * and does not require @backstage/backend-plugin-api
 */

// This file provides exports for the new backend system if available
// For legacy systems, just import the action directly from ./actions

export { createHttpAdvancedAction } from './actions/http-advanced-action';

// Note: If you're using the new backend system, you'll need to manually
// register this action in your backend. See SETUP_GUIDE.md for instructions.
