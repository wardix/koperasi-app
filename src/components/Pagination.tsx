import { HStack } from '@astryxdesign/core/Layout';
import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, limit, total, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil((total || 0) / limit) || 1;
  return (
    <HStack hAlign="between" vAlign="center" padding={2}>
      <Text type="body">Halaman {page} dari {totalPages}</Text>
      <HStack gap={2}>
        <Button 
          label="Sebelumnya" 
          variant="outline" 
          disabled={page <= 1} 
          onClick={() => onPageChange(Math.max(1, page - 1))} 
        />
        <Button 
          label="Selanjutnya" 
          variant="outline" 
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)} 
        />
      </HStack>
    </HStack>
  );
}
