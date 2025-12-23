import React from 'react';
import { InfoCard } from '@backstage/core-components';
import { StructuredMetadataTable } from '@backstage/core-components';
import ReactJson from 'react-json-view';
import { FrontendJsonOutput } from '../types';

type Props = {
  output: FrontendJsonOutput;
};

export const FrontendJsonStep = ({ output }: Props) => {
  return (
    <InfoCard title="HTTP Request / Response">
      <StructuredMetadataTable
        metadata={{
          Method: output.request.method,
          Path: output.request.path,
          Status: output.response.status,
          Duration: `${output.meta.durationMs} ms`,
          Timestamp: output.meta.timestamp,
        }}
      />

      <h3>Response Headers</h3>
      <ReactJson
        src={output.response.headers}
        name={false}
        collapsed={true}
        enableClipboard
      />

      <h3>Response Body</h3>
      <ReactJson
        src={output.response.body}
        name={false}
        collapsed={2}
        enableClipboard
        displayDataTypes={false}
      />
    </InfoCard>
  );
};
