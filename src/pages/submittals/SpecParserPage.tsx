import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer, Btn } from '../../components/Primitives';
import { useProjectId } from '../../hooks/useProjectId';
import SpecParser from '../../components/submittals/SpecParser';
import type { ExtractedSubmittal } from '../../components/submittals/SpecParser';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const SpecParserPage: React.FC = () => {
  const projectId = useProjectId();
  const navigate = useNavigate();

  const handleExtractComplete = useCallback(
    (items: ExtractedSubmittal[]) => {
      toast.success(`Imported ${items.length} submittal requirements`);
      navigate('/submittals');
    },
    [navigate]
  );

  return (
    <PageContainer
      title="Specification Parser"
      subtitle="Extract submittal requirements from project specs"
      actions={
        <Btn
          variant="ghost"
          size="sm"
          icon={<ArrowLeft size={14} />}
          onClick={() => navigate('/submittals')}
        >
          Back to Submittals
        </Btn>
      }
    >
      <SpecParser
        projectId={projectId ?? ''}
        onExtractComplete={handleExtractComplete}
      />
    </PageContainer>
  );
};

export default SpecParserPage;
