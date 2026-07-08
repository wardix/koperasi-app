import { Table as BaseTable, type TableProps } from '@astryxdesign/core/Table';
import { TableHeaderCell } from '@astryxdesign/core/Table';
import React, { type ReactElement } from 'react';

const MyHeaderCell = (props: React.ComponentProps<typeof TableHeaderCell>) => <TableHeaderCell scope="col" {...props} />;

export function Table<T extends Record<string, unknown>>(props: TableProps<T>): ReactElement {
  return (
    <BaseTable
      {...props}
      components={{
        ...props.components,
        headerCell: MyHeaderCell,
      }}
    />
  );
}
