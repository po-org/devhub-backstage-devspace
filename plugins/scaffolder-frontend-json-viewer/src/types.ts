export type FrontendJsonOutput = {
  request: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: any;
  };
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: any;
  };
  meta: {
    durationMs: number;
    timestamp: string;
  };
};
