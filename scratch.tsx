function JournalLinesDialog({
  journalId,
  onClose,
}: {
  journalId: string;
  onClose: () => void;
}) {
  const { data: lines, isLoading, error } = useApiQuery<any[]>(`/api/accounting/journals/${journalId}/lines`);

  const columns = React.useMemo(() => [
    { key: 'account', header: 'Akun', width: proportional(40), renderCell: (item: any) => <VStack gap={1}><Text>{item.account_code} - {item.account_name}</Text><Text type="supporting">{item.description}</Text></VStack> },
    { key: 'debit', header: 'Debit', width: proportional(30), renderCell: (item: any) => <Text style={{textAlign: 'right'}}>{formatRp(Number(item.debit))}</Text> },
    { key: 'credit', header: 'Kredit', width: proportional(30), renderCell: (item: any) => <Text style={{textAlign: 'right'}}>{formatRp(Number(item.credit))}</Text> },
  ], []);

  return (
    <VStack gap={4} style={{ padding: '24px' }}>
      <Heading level={3}>Detail Baris Jurnal</Heading>
      <DataStateView isLoading={isLoading} error={error} hasData={lines && lines.length > 0}>
        <Table data={lines || []} columns={columns} idKey="id" />
      </DataStateView>
      <HStack hAlign="end">
        <Button label="Tutup" onClick={onClose} />
      </HStack>
    </VStack>
  );
}
