import React from 'react'
import { PageContainer } from '../../components/Primitives'
import { ApprovalWorkflowBuilder } from '../../components/workflows/ApprovalWorkflowBuilder'

const WorkflowSettings: React.FC = () => {
  return (
    <PageContainer
      title="Approval Workflows"
      subtitle="Configure multi-step approval chains for submittals, RFIs, change orders, pay applications, daily logs, and safety inspections."
    >
      <ApprovalWorkflowBuilder />
    </PageContainer>
  )
}

export default WorkflowSettings
