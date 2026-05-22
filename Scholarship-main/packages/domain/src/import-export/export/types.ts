export type ReportFilters = {
  dateFrom?: string;
  dateTo?: string;
  campus?: string;
  modality?: string;
  enrollmentType?: string;
  advisorUserId?: string;
  status?: string;
};

export type ReportRow = Record<string, string | number | null>;
