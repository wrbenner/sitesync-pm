// Owner Report page — wraps the OwnerReport component in PageContainer.

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PageContainer, Btn } from '../components/Primitives'
import { OwnerReport } from '../components/reports/OwnerReport'

export const OwnerReportPage: React.FC = () => {
  const navigate = useNavigate()

  return (
    <PageContainer
      title="Owner Report"
      subtitle="Auto-generated OAC meeting report with AI insights"
      actions={
        <Btn variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => navigate('/reports')}>
          All Reports
        </Btn>
      }
    >
      <OwnerReport />
    </PageContainer>
  )
}

export default OwnerReportPage
