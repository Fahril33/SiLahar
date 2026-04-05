export type ReportTemplateApproverRole =
  | "coordinator_team"
  | "division_head";

export type ReportTemplateApprover = {
  id: string;
  templateId: string;
  approverRole: ReportTemplateApproverRole;
  scopeLabel: string;
  officialName: string;
  officialTitle: string;
  officialNip: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ReportTemplateConfig = {
  id: string;
  templateCode: string;
  templateName: string;
  organizationName: string;
  budgetYear: number | null;
  isActive: boolean;
  updatedAt: string;
  notes: string[];
  approvers: ReportTemplateApprover[];
};

export type ReportTemplateApproverDraft = {
  scopeLabel: string;
  officialName: string;
  officialTitle: string;
  officialNip: string;
};
